// scripts/tps-analysis/blind-gate-build.ts — founder blind gate (2026-10-04). READ-ONLY, offline.
//
// Builds the 84-pair blind sheet (60 stratified + 24 review-tier, the SAME pairs reviewer-2 labelled
// blind) for the founder. The sheet carries ONLY listing facts: both titles, store names, and the
// attributes a commercial buyer needs, read by plain regexes that are deliberately independent of the
// verifier under test. NO label, NO verdict, NO prediction, NO pair stratum is written to the sheet.
// The side order (which store is A) and the pair order are shuffled with a fixed seed; the mapping is
// kept in a separate file so the later comparison can be done.
//
//   npx tsx scripts/tps-analysis/blind-gate-build.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';

const OUT = process.argv[2] || 'docs/evidence/amazon-diagnostic-2026-10-03/phase3b/blind-gate';
const slice = JSON.parse(fs.readFileSync('scripts/experiments/identity-phase3a/blind-slice.json', 'utf8')) as Array<{ id: string; category: string; control_store: string }>;
const pairs = new Map<string, any>((JSON.parse(fs.readFileSync('tests/fixtures/identity/pairs-2026-10-03.json', 'utf8')) as any[]).map((p) => [p.id, p]));

// ── seeded shuffle (mulberry32) ──
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(20261004);
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const AR_CAT: Record<string, string> = { mobile: 'جوال', tv: 'تلفزيون', laptop: 'لابتوب', tablet: 'تابلت', refrigerator: 'ثلاجة', washing_machine: 'غسالة', vacuum: 'مكنسة', microwave: 'مايكرويف', dishwasher: 'غسالة صحون', monitor: 'شاشة كمبيوتر' };
const STORE_AR: Record<string, string> = { Amazon: 'أمازون', eXtra: 'إكسترا', Almanea: 'المنيع' };

const lower = (t: string) => t.toLowerCase().replace(/[‎‏]/g, '');
const num = (x: string) => String(Number(x));

function condition(t: string): string { return /\b(refurbished|renewed|pre-?owned|open box|used)\b|مجدد|مستعمل/.test(lower(t)) ? 'مجدّد / مستعمل' : 'لم تُذكر'; }
function network(t: string): string | null { const l = lower(t); const g5 = /(?<![a-z0-9])(5g|5 جي)(?![a-z0-9])/.test(l), g4 = /(?<![a-z0-9])(4g|lte|4 جي)(?![a-z0-9])/.test(l); return g5 && g4 ? '4G و 5G' : g5 ? '5G' : g4 ? '4G / LTE' : null; }
function storage(t: string): string | null {
  const l = lower(t).replace(/expandable (?:up )?to\s*\d+\s*(?:gb|tb)/g, '').replace(/up to\s*\d+\s*(?:gb|tb)/g, '');
  const tb = l.match(/(?<![\d.])(\d(?:\.\d)?)\s*(?:tb|تيرا)/); const gbs = [...l.matchAll(/(?<![\d.])(\d{2,4})\s*(?:gb|g\b|جيجا)/g)].map((m) => Number(m[1])).filter((n) => n >= 16);
  const plus = l.match(/(?<![\d.])(\d{1,2})\s*\+\s*(\d{2,4})\s*(?:gb|g\b|جيجا)/);
  if (plus) return `${plus[2]} جيجا`;
  if (tb && (!gbs.length || Number(tb[1]) <= 2)) return `${num(tb[1])} تيرا`;
  return gbs.length ? `${Math.max(...gbs)} جيجا` : null;
}
function ram(t: string): string | null { const l = lower(t); const m = l.match(/(?<![\d.])(\d{1,2})\s*(?:gb|g|جيجا(?:بايت)?)\s*(?:ram|رام)/) || l.match(/(?:ram|رام)\s*(\d{1,2})\s*(?:gb|g|جيجا)?/) || l.match(/(?<![\d.])(\d{1,2})\s*\+\s*\d{2,4}\s*(?:gb|g\b|جيجا)/) || l.match(/(?<![\d.])\d{2,4}\s*(?:gb|جيجا)\s*,\s*(\d{1,2})\s*(?:gb|جيجا)/); return m ? `${m[1]} جيجا` : null; }
function inches(t: string): string | null { const l = lower(t).replace(/(?<![\d.])(\d{1,2}) (\d)(?=\s*(?:-?\s*inch|"|”|بوصة))/g, '$1.$2'); const m = l.match(/(?<![\d.])(\d{1,2}(?:\.\d)?)\s*(?:"|”|''|-?\s*inch(?:es)?|بوصه|بوصة|انش)/); return m ? `${m[1]} بوصة` : null; }
function kg(t: string): string | null { const l = lower(t).replace(/(?<![\d.])(\d{1,2}) (\d)(?=\s*kg)/g, '$1.$2'); const m = l.match(/(?<![\d.])(\d{1,2}(?:\.\d)?)\s*(?:[-/]\s*\d{1,2}(?:\.\d)?\s*)?(?:kg|كجم|كيلو)/); return m ? `${num(m[1])} كجم` : null; }
function litres(t: string): string | null { const m = lower(t).match(/(?<![\d.])(\d{2,4})\s*(?:l\b|liter|litre|لتر|ليتر)/); return m ? `${m[1]} لتر` : null; }
function washerType(t: string): string | null { const l = lower(t); if (/(washer\s*\/?\s*dryer|washing\s*&\s*drying|2\s*in\s*1|2in1|with dryer|combo|مجفف)/.test(l)) return 'غسالة + مجفّف'; if (/(washing machine|washer|غساله|غسالة)/.test(l)) return 'غسالة'; return null; }
function places(t: string): string | null { const m = lower(t).match(/(\d{1,2})\s*(?:place|مكان)/); return m ? `${m[1]} مكان` : null; }
function watts(t: string): string | null { const m = lower(t).match(/(?<![\d.])(\d{3,4})\s*(?:w\b|watt|واط)/); return m ? `${m[1]} واط` : null; }
function edition(t: string): string | null { const l = lower(t); const out: string[] = []; if (/enterprise edition/.test(l)) out.push('Enterprise Edition'); if (/international version|global version|uk version|us version|eu version|hk version|cn version/.test(l)) out.push('نسخة دولية/خارجية'); if (/ksa version|middle east version|saudi version|gcc version|نسخة السعودية/.test(l)) out.push('نسخة السعودية'); return out.length ? out.join(' · ') : null; }
function bundle(t: string): string | null { return /\b(bundle|combo pack|\+\s*(bud|buds|watch|band|cover|case)\b|with free|gift)|مع هدية|طقم|حزمة/i.test(t) ? 'مع ملحقات / هدية' : null; }
function code(t: string): string | null {
  const toks = t.toUpperCase().match(/(?<![A-Z0-9])[A-Z0-9][A-Z0-9\-/.]{4,22}[A-Z0-9](?![A-Z0-9])/g) || [];
  const good = toks.filter((x) => { const s = x.replace(/[^A-Z0-9]/g, ''); const segs = x.split(/[-/.]/); return s.length >= 6 && /[A-Z]/.test(s) && (s.match(/\d/g) || []).length >= 3 && !/\d+X\d+/.test(s) && !/^(\d+)(GB|TB|KG|HZ|MM|MAH|W|L|K|P|MP|BTU|INCH|RPM)$/.test(s) && !/(1920|1080|2160|3840)/.test(s) && !/^(I[3579]-|DDR\d|RTX|GTX|AMD|CORE)/.test(x) && !segs.some((g) => /^\d+(GB|TB|MB|KG|HZ|W|L|MM|K|P)$/.test(g) || /^DDR\d$/.test(g)) && segs.some((g) => /[A-Z]/.test(g) && /\d/.test(g)); });
  return good.length ? good.reduce((a, b) => (b.length > a.length ? b : a)) : null;
}

const validCode = (m: string | null | undefined) => (m && /^[A-Za-z0-9-/.]{6,24}$/.test(m) && /[A-Za-z]/.test(m) && (m.match(/d/g) || []).length >= 3 ? m.toUpperCase() : null);
type Side = { store: string; title: string };
function facts(cat: string, t: string): Record<string, string | null> {
  const f: Record<string, string | null> = {};
  if (cat === 'mobile') Object.assign(f, { storage: storage(t), ram: ram(t), network: network(t) });
  else if (cat === 'tablet') Object.assign(f, { screen: inches(t), storage: storage(t), ram: ram(t), network: network(t) });
  else if (cat === 'laptop') Object.assign(f, { screen: inches(t), storage: storage(t), ram: ram(t) });
  else if (cat === 'tv' || cat === 'monitor') Object.assign(f, { screen: inches(t) });
  else if (cat === 'washing_machine') Object.assign(f, { type: washerType(t), kg: kg(t) });
  else if (cat === 'refrigerator') Object.assign(f, { litres: litres(t) });
  else if (cat === 'dishwasher') Object.assign(f, { places: places(t) });
  else if (cat === 'microwave') Object.assign(f, { litres: litres(t) });
  else if (cat === 'vacuum') Object.assign(f, { watts: watts(t), litres: litres(t) });
  f.edition = edition(t); f.bundle = bundle(t);
  return f;
}
const LABELS: Record<string, string> = { screen: 'حجم الشاشة', storage: 'السعة التخزينية', ram: 'الذاكرة (RAM)', network: 'الشبكة', type: 'النوع', kg: 'سعة الغسيل', litres: 'السعة', places: 'عدد الأماكن', watts: 'القدرة', edition: 'النسخة / المنطقة', bundle: 'ملحقات' };

const order = shuffle(slice.map((s) => s.id));
const sheet: any[] = []; const mapping: any[] = [];
order.forEach((id, i) => {
  const p = pairs.get(id)!; const cat: string = p.category;
  const ctrlStore = slice.find((s) => s.id === id)!.control_store;
  const amazon: Side = { store: 'Amazon', title: p.amazon.name };
  const ctrl: Side = { store: ctrlStore, title: p.control.name };
  const amazonFirst = rand() < 0.5; const [A, B] = amazonFirst ? [amazon, ctrl] : [ctrl, amazon];
  const fa = facts(cat, A.title), fb = facts(cat, B.title);
  const rows: Array<{ k: string; label: string; a: string; b: string }> = [];
  const brandA = (A.store === 'Amazon' ? p.amazon.brand : (p.control.key || '').split('|')[0]) || '', brandB = (B.store === 'Amazon' ? p.amazon.brand : (p.control.key || '').split('|')[0]) || '';
  const cap = (s: string) => (!s || s.toLowerCase() === 'unknown' ? 'غير محددة' : s.length <= 3 ? s.toUpperCase() : s[0].toUpperCase() + s.slice(1).toLowerCase());
  rows.push({ k: 'brand', label: 'العلامة التجارية', a: cap(String(brandA)), b: cap(String(brandB)) });
  const modelA = A.store === 'Amazon' ? code(A.title) : (validCode(p.control.model) || code(A.title)), modelB = B.store === 'Amazon' ? code(B.title) : (validCode(p.control.model) || code(B.title));
  rows.push({ k: 'model', label: 'رقم الموديل', a: modelA || 'غير مذكور', b: modelB || 'غير مذكور' });
  rows.push({ k: 'condition', label: 'الحالة', a: condition(A.title), b: condition(B.title) });
  for (const k of Object.keys(LABELS)) { if (fa[k] == null && fb[k] == null) continue; if (k === 'edition' || k === 'bundle') { rows.push({ k, label: LABELS[k], a: fa[k] || 'لم يُذكر', b: fb[k] || 'لم يُذكر' }); } else rows.push({ k, label: LABELS[k], a: fa[k] || 'لم تُذكر', b: fb[k] || 'لم تُذكر' }); }
  sheet.push({ n: i + 1, id, cat: AR_CAT[cat] || cat, a: { store: STORE_AR[A.store] || A.store, title: A.title }, b: { store: STORE_AR[B.store] || B.store, title: B.title }, rows });
  mapping.push({ n: i + 1, id, category: cat, a_store: A.store, b_store: B.store });
});
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'sheet.json'), JSON.stringify(sheet));
fs.writeFileSync(path.join(OUT, 'mapping.json'), JSON.stringify(mapping, null, 1));
console.log('pairs', sheet.length, 'bytes', JSON.stringify(sheet).length);
