import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const VERSION = 'tawveeri-match-2026-06-13-v1.7';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.MATCH_MODEL || 'claude-sonnet-4-6';
const SECRET = process.env.MATCH_SECRET || process.env.CRON_SECRET || '';
const MAX_OFFERS = 30;

type Offer = {
  product_id: string; name_ar: string; name_en: string | null; brand: string | null;
  store_name: string; price: number; original_price: number | null; url: string | null;
};

function json(data: Record<string, any>, status = 200) {
  return NextResponse.json({ version: VERSION, ...data }, { status, headers: { 'Cache-Control': 'no-store' } });
}

const clean = (s: string) => s.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim();
const arDigits = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

// ── الجسر اللغوي: عربي ⇄ إنجليزي ────────────────────────────
const AR_EN: Record<string, string[]> = {
  'مكيف': ['split ac', 'air conditioner', 'ac'], 'سبليت': ['split'], 'شباك': ['window'],
  'ثلاجة': ['refrigerator', 'fridge'], 'فريزر': ['freezer'], 'غسالة': ['washer', 'washing machine'],
  'نشافة': ['dryer'], 'جوال': ['phone', 'smartphone'], 'تلفزيون': ['tv', 'television'],
  'شاشة': ['tv', 'monitor'], 'لابتوب': ['laptop', 'notebook'], 'سماعة': ['headphone', 'earbuds', 'speaker'],
  'سماعات': ['headphones', 'earbuds'], 'مكنسة': ['vacuum'], 'مايكروويف': ['microwave'], 'ميكروويف': ['microwave'],
  'فرن': ['oven'], 'تابلت': ['tablet'], 'ساعة': ['watch'], 'ذكية': ['smart'], 'كاميرا': ['camera'],
  'ايفون': ['iphone'], 'آيفون': ['iphone'], 'جالكسي': ['galaxy'], 'جلكسي': ['galaxy'], 'جالاكسي': ['galaxy'],
  'برو': ['pro'], 'ماكس': ['max'], 'بلس': ['plus'], 'الترا': ['ultra'], 'ميني': ['mini'], 'اير': ['air'],
  'سامسونج': ['samsung'], 'ابل': ['apple'], 'آبل': ['apple'], 'شاومي': ['xiaomi'], 'هواوي': ['huawei'],
  'سوني': ['sony'], 'هايسنس': ['hisense'], 'توشيبا': ['toshiba'], 'ميديا': ['midea'], 'هاير': ['haier'],
  'جري': ['gree'], 'دايكن': ['daikin'], 'لينوفو': ['lenovo'], 'ديل': ['dell'], 'اسوس': ['asus'],
  'ايسر': ['acer'], 'انكر': ['anker'], 'بوز': ['bose'], 'نوت': ['note'], 'بكسل': ['pixel'],
};
const EN_AR: Record<string, string[]> = {};
for (const [ar, ens] of Object.entries(AR_EN))
  for (const en of ens) { (EN_AR[en] ||= []).push(ar); }
EN_AR['lg'] = ['ال جي', 'إل جي']; AR_EN['ال جي'] = ['lg']; AR_EN['إل جي'] = ['lg'];
EN_AR['classpro'] = ['كلاس برو']; AR_EN['كلاس برو'] = ['classpro', 'class pro'];

function expand(token: string): string[] {
  const t = token.toLowerCase();
  const out = new Set<string>([token]);
  for (const v of AR_EN[t] || []) out.add(v);
  for (const v of EN_AR[t] || []) out.add(v);
  if (/^\d{4,6}$/.test(t)) out.add(`${t.slice(0, -3)} ${t.slice(-3)}`);
  return [...out];
}

// ── 1) مرشّحون — بحث ثنائي اللغة + توازن بين المتاجر ─────────
async function findCandidates(qRaw: string): Promise<Offer[]> {
  const sb = createServerClient();
  const q = clean(arDigits(qRaw));
  const sel = 'id,name_ar,name_en,brand,product_stores!inner(store_name,current_price,original_price,product_url)';
  const seen = new Map<string, any>();
  const grab = (rows: any[] | null) => { for (const r of rows || []) if (!seen.has(r.id)) seen.set(r.id, r); };

  const tokens = q.split(/\s+/).filter(t => t.length >= 2).slice(0, 5);
  if (tokens.length) {
    let qq = sb.from('products').select(sel);
    for (const t of tokens) {
      const ors = expand(t).flatMap(v => [`name_ar.ilike.%${v}%`, `name_en.ilike.%${v}%`]).join(',');
      qq = qq.or(ors);
    }
    grab((await qq.limit(60)).data);
  }
  if (seen.size < 4) {
    const { data } = await sb.from('products').select(sel)
      .or(`name_ar.ilike.%${q}%,name_en.ilike.%${q}%`).limit(30);
    grab(data);
  }

  const all: Offer[] = [];
  for (const p of seen.values())
    for (const s of p.product_stores || [])
      all.push({
        product_id: p.id, name_ar: p.name_ar, name_en: p.name_en, brand: p.brand,
        store_name: s.store_name, price: Number(s.current_price),
        original_price: s.original_price ? Number(s.original_price) : null, url: s.product_url,
      });

  // توازن: round-robin بين المتاجر حتى السقف — يضمن حضور كل المتاجر
  const byStore = new Map<string, Offer[]>();
  for (const o of all) { if (!byStore.has(o.store_name)) byStore.set(o.store_name, []); byStore.get(o.store_name)!.push(o); }
  const buckets = [...byStore.values()];
  const balanced: Offer[] = [];
  for (let i = 0; balanced.length < MAX_OFFERS; i++) {
    let added = false;
    for (const b of buckets) if (b[i]) { balanced.push(b[i]); added = true; if (balanced.length >= MAX_OFFERS) break; }
    if (!added) break;
  }
  return balanced;
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

// ── 3) القاموس المحفوظ (union-find) ─────────────────────────
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

// ── 4) حكم وفّر ──────────────────────────────────────────────
const SYSTEM = `أنت محرك مطابقة منتجات لمنصة توفيري السعودية. تقرر أي العروض تمثل نفس المنتج الفيزيائي عبر متاجر مختلفة.
قواعد صارمة:
1. نفس الماركة شرط أساسي. الماركة العربية تكافئ الإنجليزية (سامسونج=Samsung، كلاس برو=ClassPro، هايسنس=HISENSE، ال جي=LG، ميديا=Midea، هاير=Haier).
2. أرقام السعة/الموديل/المقاس يجب أن تتطابق تماماً. "17 500" تعني 17500. 17500 ≠ 20500 ≠ 18000 — رقم مختلف = منتج مختلف.
3. الاسم العربي والإنجليزي لنفس المنتج يتطابقان: "جالاكسي اس 25 الترا 256 جيجا" = "Galaxy S25 Ultra 256GB".
4. اختلاف النوع (بارد فقط ≠ حار وبارد) أو السعة (128 ≠ 256 جيجا) = منتجات مختلفة. اختلاف اللون فقط مع تطابق كل شيء = نفس المنتج.
5. فرق سعر أكبر من 40% = خفّض الثقة تحت 0.8 إلا بتطابق الموديل حرفياً.
6. الشك = لا تجمع.
أرجع JSON فقط بدون أي شرح أو نص قبله أو بعده. ابدأ مباشرة بالقوس { وانتهِ بالقوس }.
الصيغة:
{"groups":[{"ids":["..."],"label_ar":"اسم موحّد مختصر","confidence":0.95,"reason_ar":"سبب موجز"}],"summary_ar":"جملة سعودية ودودة تلخص أفضل سعر"}
ids فقط من القائمة المعطاة. reason_ar مختصر جداً (٦ كلمات كحد أقصى).`;

// يستخرج كتلة JSON من نص النموذج (مع إرجاع القوس البادئ المحذوف بالـ prefill)
function parseVerdict(raw: string): any {
  const text = '{' + raw;
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  const jsonStr = (s >= 0 && e > s) ? text.slice(s, e + 1) : text;
  return JSON.parse(jsonStr);
}

async function callAnthropic(lines: string, system: any[], temperature: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      temperature,
      system,
      messages: [
        { role: 'user', content: `العروض:\n${lines} — أرجع JSON فقط بدون شرح.` },
        { role: 'assistant', content: '{' }, // prefill: يبدأ من القوس مباشرة، يمنع المقدمة
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`api_${res.status}:${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
}

async function waffarJudge(offers: Offer[]): Promise<{ verdict: any | null; reason: string }> {
  if (!ANTHROPIC_KEY) return { verdict: null, reason: 'no_anthropic_key' };
  const lines = offers.map(o =>
    `${o.product_id} | ${o.store_name} | ${o.brand || '-'} | ${o.name_ar} | ${o.name_en || '-'} | ${o.price} ريال`).join('\n');

  const systemMain = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];

  // المحاولة الأولى — prefill + JSON صارم
  let firstRaw = '';
  try {
    firstRaw = await callAnthropic(lines, systemMain, 0);
  } catch (e: any) {
    console.error('[match:llm]', String(e?.message || e));
    return { verdict: null, reason: String(e?.message || e).slice(0, 200) };
  }
  try {
    return { verdict: parseVerdict(firstRaw), reason: 'ok' };
  } catch {
    console.error('[match:parse]', ('{' + firstRaw).slice(0, 300));
  }

  // إعادة المحاولة — system مخفّف + temperature 0.1
  const systemRetry = [{ type: 'text', text: SYSTEM.replace('أرجع JSON فقط بدون أي شرح أو نص قبله أو بعده. ابدأ مباشرة بالقوس { وانتهِ بالقوس }.', '') }];
  try {
    const secondRaw = await callAnthropic(lines, systemRetry, 0.1);
    return { verdict: parseVerdict(secondRaw), reason: 'ok_retry' };
  } catch (err2: any) {
    console.error('[match:parse_retry]', String(err2?.message || err2));
    return { verdict: null, reason: `parse_fail_retry:${('{' + firstRaw).slice(0, 150)}` };
  }
}

// ── 5) الحفظ في القاموس الدائم ──────────────────────────────
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
  const secret = url.searchParams.get('secret')?.trim();
  if (!q) return json({ usage: '/api/match?q=اسم المنتج — أضف &secret=... لتفعيل حكم وفّر', secretConfigured: !!SECRET, hasAnthropicKey: !!ANTHROPIC_KEY });

  const offers = await findCandidates(q);
  if (!offers.length) return json({ q, offers: 0, groups: [], secretConfigured: !!SECRET, hasAnthropicKey: !!ANTHROPIC_KEY, note: 'لا نتائج في المخزون' });

  const names = [...new Set(offers.map(o => o.name_ar))];
  const nameToCid = await canonicalMap(names);
  const cids = [...new Set([...nameToCid.values()])];
  const parent = await dictionaryGroups(cids);

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

  let llmUsed = false, savedLinks = 0, summary_ar: string | null = null;
  let llmReason = 'not_attempted';
  // مرحلة البناء: وفّر يحكم على كل العروض لبناء القاموس من الصفر
  // (لاحقاً نرجّعها إلى: offers.filter(o => !grouped.has(o.product_id)))
  const rest = offers;
  const authorized = !!secret && !!SECRET && secret === SECRET;
  const restStores = new Set(rest.map(o => o.store_name)).size;
  if (!authorized) {
    llmReason = 'not_authorized';
  } else if (restStores < 2) {
    llmReason = `one_store_only:${restStores}`;
  } else {
    const { verdict, reason } = await waffarJudge(rest);
    llmReason = reason;
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
  return json({ q, totalOffers: offers.length, stores: [...new Set(offers.map(o => o.store_name))].length, secretConfigured: !!SECRET, hasAnthropicKey: !!ANTHROPIC_KEY, llmAuthorized: authorized, llmUsed, llmReason, savedLinks, summary_ar, groups, singles });
}
