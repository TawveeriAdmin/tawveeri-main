import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const VERSION = 'tawveeri-match-2026-06-13-v1';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
const MODEL = process.env.MATCH_MODEL || 'claude-sonnet-4-6';
const MAX_OFFERS = 30;

type Offer = {
  product_id: string; name_ar: string; name_en: string | null; brand: string | null;
  store_name: string; price: number; original_price: number | null; url: string | null;
};

function json(data: Record<string, any>, status = 200) {
  return NextResponse.json({ version: VERSION, ...data }, { status, headers: { 'Cache-Control': 'no-store' } });
}

const clean = (s: string) => s.replace(/[%_]/g, ' ').trim();
const arDigits = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

// ── 1) مرشّحون من المخزون الحي ─────────────────────────────
async function findCandidates(qRaw: string): Promise<Offer[]> {
  const sb = createServerClient();
  const q = clean(arDigits(qRaw));
  const sel = 'id,name_ar,name_en,brand,product_stores!inner(store_name,current_price,original_price,product_url)';
  const seen = new Map<string, any>();

  const grab = (rows: any[] | null) => { for (const r of rows || []) if (!seen.has(r.id)) seen.set(r.id, r); };

  const { data: full } = await sb.from('products').select(sel)
    .or(`name_ar.ilike.%${q}%,name_en.ilike.%${q}%`).limit(25);
  grab(full);

  if (seen.size < 6) {
    const tokens = q.split(/\s+/).filter(t => t.length >= 2).slice(0, 4);
    if (tokens.length > 1) {
      let qa = sb.from('products').select(sel);
      for (const t of tokens) qa = qa.ilike('name_ar', `%${t}%`);
      grab((await qa.limit(20)).data);
      let qe = sb.from('products').select(sel);
      for (const t of tokens) qe = qe.ilike('name_en', `%${t}%`);
      grab((await qe.limit(20)).data);
    }
  }

  const offers: Offer[] = [];
  for (const p of seen.values())
    for (const s of p.product_stores || [])
      offers.push({
        product_id: p.id, name_ar: p.name_ar, name_en: p.name_en, brand: p.brand,
        store_name: s.store_name, price: Number(s.current_price),
        original_price: s.original_price ? Number(s.original_price) : null, url: s.product_url,
      });
  return offers.slice(0, MAX_OFFERS);
}

// ── 2) جسر الهوية: products ⇄ canonical_products ───────────
async function canonicalMap(names: string[]): Promise<Map<string, string>> {
  const sb = createServerClient();
  const map = new Map<string, string>();
  if (!names.length) return map;
  const { data } = await sb.from('canonical_products').select('id,name_ar').in('name_ar', names);
  for (const r of data || []) map.set(r.name_ar, r.id);
  return map;
}

// ── 3) القاموس: روابط محفوظة (union-find) ──────────────────
async function dictionaryGroups(cids: string[]): Promise<Map<string, string>> {
  const sb = createServerClient();
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
  const union = (a: string, b: string) => { for (const x of [a, b]) if (!parent.has(x)) parent.set(x, x); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  if (!cids.length) return parent;
  const list = cids.join(',');
  const { data } = await sb.from('product_links').select('primary_product_id,linked_product_id')
    .or(`primary_product_id.in.(${list}),linked_product_id.in.(${list})`);
  for (const l of data || []) union(l.primary_product_id, l.linked_product_id);
  for (const c of cids) if (!parent.has(c)) parent.set(c, c);
  for (const k of [...parent.keys()]) find(k);
  return parent;
}

// ── 4) وفّر يحكم (Claude API + prompt caching) ─────────────
const SYSTEM = `أنت محرك مطابقة منتجات لمنصة توفيري السعودية. تقرر أي العروض تمثل نفس المنتج الفيزيائي عبر متاجر مختلفة.
قواعد صارمة:
1. نفس الماركة شرط أساسي. الماركة العربية تكافئ الإنجليزية (سامسونج=Samsung، كلاس برو=ClassPro، هايسنس=HISENSE، ال جي=LG، ميديا=Midea، هاير=Haier).
2. أرقام السعة/الموديل/المقاس يجب أن تتطابق تماماً. "17 500" تعني 17500. 17500 ≠ 20500 ≠ 18000 — رقم مختلف = منتج مختلف، حتى لو تشابه كل شيء آخر.
3. الاسم العربي والإنجليزي لنفس المنتج يتطابقان: "مكيف سامسونج سبليت ١٨٠٠٠" = "Samsung Split AC 18 000 BTU".
4. فرق سعر أكبر من 40% بين عرضين = خفّض الثقة تحت 0.8 إلا إذا تطابق الموديل حرفياً.
5. لا تطابق إلا بيقين. الشك = لا تجمع.
أرجع JSON فقط بلا أي نص آخر:
{"groups":[{"ids":["..."],"label_ar":"اسم موحّد مختصر","confidence":0.95,"reason_ar":"سبب موجز"}],"summary_ar":"جملة سعودية ودودة تلخص أفضل سعر"}
ids فقط من القائمة المعطاة. مجموعة = منتج واحد بعدة عروض.`;

async function waffarJudge(offers: Offer[]): Promise<any | null> {
  if (!ANTHROPIC_KEY) return null;
  const lines = offers.map(o =>
    `${o.product_id} | ${o.store_name} | ${o.brand || '-'} | ${o.name_ar} | ${o.name_en || '-'} | ${o.price} ريال`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1200, temperature: 0,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `العروض:\n${lines}` }],
    }),
  });
  if (!res.ok) { console.error('[match:llm]', res.status, await res.text().catch(() => '')); return null; }
  const data = await res.json();
  const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch { console.error('[match:parse]', text.slice(0, 300)); return null; }
}

// ── 5) الحفظ: المطابقة تصير ذاكرة دائمة ────────────────────
async function saveLinks(groups: any[], nameToCid: Map<string, string>, offers: Offer[]): Promise<number> {
  const sb = createServerClient();
  const byId = new Map(offers.map(o => [o.product_id, o]));
  const rows: any[] = [];
  for (const g of groups || []) {
    if (!Array.isArray(g.ids) || g.ids.length < 2 || (g.confidence ?? 0) < 0.8) continue;
    const cids = [...new Set(g.ids.map((id: string) => nameToCid.get(byId.get(id)?.name_ar || '')).filter(Boolean))] as string[];
    if (cids.length < 2) continue;
    cids.sort();
    for (let i = 1; i < cids.length; i++)
      rows.push({ primary_product_id: cids[0], linked_product_id: cids[i], match_method: 'waffar_llm_v1', confidence: Math.min(g.confidence, 0.999), is_verified: false });
  }
  if (!rows.length) return 0;
  const { error, count } = await sb.from('product_links')
    .upsert(rows, { onConflict: 'primary_product_id,linked_product_id', ignoreDuplicates: true, count: 'exact' });
  if (error) { console.error('[match:save]', error.message); return 0; }
  return count ?? rows.length;
}

// ── Route ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  const secret = url.searchParams.get('secret');
  if (!q) return json({ usage: '/api/match?q=اسم المنتج — أضف &secret=... لتفعيل حكم وفّر' });

  const offers = await findCandidates(q);
  if (!offers.length) return json({ q, offers: 0, groups: [], note: 'لا نتائج في المخزون' });

  const names = [...new Set(offers.map(o => o.name_ar))];
  const nameToCid = await canonicalMap(names);
  const cids = [...new Set([...nameToCid.values()])];
  const parent = await dictionaryGroups(cids);

  // مجموعات القاموس (عابرة المتاجر فقط)
  const cidToOffers = new Map<string, Offer[]>();
  for (const o of offers) {
    const cid = nameToCid.get(o.name_ar); if (!cid) continue;
    const root = parent.get(cid) || cid;
    if (!cidToOffers.has(root)) cidToOffers.set(root, []);
    cidToOffers.get(root)!.push(o);
  }
  const groups: any[] = [];
  const grouped = new Set<string>();
  for (const [, members] of cidToOffers) {
    if (new Set(members.map(m => m.store_name)).size < 2) continue;
    members.sort((a, b) => a.price - b.price);
    members.forEach(m => grouped.add(m.product_id));
    groups.push({ source: 'dictionary', label_ar: members[0].name_ar, confidence: 1, offers: members.map((m, i) => ({ ...m, cheapest: i === 0 })) });
  }

  // الباقي → حكم وفّر (لو السر صحيح وفيه متجرين+)
  let llmUsed = false, savedLinks = 0, summary_ar: string | null = null;
  const rest = offers.filter(o => !grouped.has(o.product_id));
  const authorized = !!secret && secret === process.env.CRON_SECRET;
  if (authorized && new Set(rest.map(o => o.store_name)).size >= 2) {
    const verdict = await waffarJudge(rest);
    if (verdict) {
      llmUsed = true; summary_ar = verdict.summary_ar || null;
      savedLinks = await saveLinks(verdict.groups, nameToCid, rest);
      const byId = new Map(rest.map(o => [o.product_id, o]));
      for (const g of verdict.groups || []) {
        const members = (g.ids || []).map((id: string) => byId.get(id)).filter(Boolean) as Offer[];
        if (members.length < 2) continue;
        members.sort((a, b) => a.price - b.price);
        members.forEach(m => grouped.add(m.product_id));
        groups.push({ source: 'waffar', label_ar: g.label_ar, confidence: g.confidence, reason_ar: g.reason_ar, offers: members.map((m, i) => ({ ...m, cheapest: i === 0 })) });
      }
    }
  }

  const singles = offers.filter(o => !grouped.has(o.product_id));
  return json({ q, totalOffers: offers.length, llmUsed, llmAuthorized: authorized, savedLinks, summary_ar, groups, singles });
}
