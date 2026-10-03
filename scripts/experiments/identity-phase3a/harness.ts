// Phase 3A identity precision harness — OFFLINE / READ-ONLY. Runs production plugins and
// the experimental v2 copies side by side on the exported corpus (corpus.json), generates
// the ground-truth candidate pairs (pairs.json), and scores scenarios against labels.json.
// Touches no database. Usage: npx tsx scripts/experiments/identity-phase3a/harness.ts [gen|score]
import * as fs from 'fs';
import * as path from 'path';
import { mobilePlugin, normalize as mobileNormalizeV1 } from '../../tps-plugins/mobile';
import { buildIdentityKey as mobileKey } from '../../tps-plugins/mobile/identity';
import { detect as mobileDetectV1 } from '../../tps-plugins/mobile/detector';
import { detect as mobileDetectV2 } from './mobile-detector-v2';
import { normalize as mobileNormalizeV2 } from './mobile-parser-v2';
import { detect as tvDetectV1 } from '../../tps-plugins/tv/detector';
import { detect as tvDetectV2 } from './tv-detector-v2';
import { CATEGORY_DEFS } from '../../tps-core/category-registry';
import { detectBrandFromText, canonicalizeBrand } from '../../tps-core/brand-map';

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'));
const mode = process.argv[2] || 'gen';
void mobilePlugin;

type Row = { asin?: string; store?: number; name: string; brand: string | null; sp_brand?: string | null; key?: string; category?: string; model?: string | null; sp_item_model?: string | null };
type Scenario = { id: string; label: string; detector: 'v1' | 'v2'; parser: 'v1' | 'v2'; brand: 'stored' | 'resolved'; tv: 'v1' | 'v2'; alias: boolean; network: boolean; verify?: boolean };
const SCENARIOS: Scenario[] = [
  { id: 'Baseline', label: 'production rules', detector: 'v1', parser: 'v1', brand: 'stored', tv: 'v1', alias: false, network: false },
  { id: 'A', label: 'precision-safe suffix/+ fix only', detector: 'v1', parser: 'v2', brand: 'stored', tv: 'v1', alias: false, network: false },
  { id: 'B', label: 'A + detector redesign (phone feature vocabulary, TV HD cues)', detector: 'v2', parser: 'v2', brand: 'stored', tv: 'v2', alias: false, network: false },
  { id: 'C', label: 'A + brand resolution ladder', detector: 'v1', parser: 'v2', brand: 'resolved', tv: 'v1', alias: false, network: false },
  { id: 'D', label: 'A + detector + brand', detector: 'v2', parser: 'v2', brand: 'resolved', tv: 'v2', alias: false, network: false },
  { id: 'E', label: 'D + dual-key alias (control MODEL keys ↔ spec keys) + abstention', detector: 'v2', parser: 'v2', brand: 'resolved', tv: 'v2', alias: true, network: false },
  { id: 'E+net', label: 'E + network axis for Samsung Galaxy A/M (4G vs 5G are distinct SKUs)', detector: 'v2', parser: 'v2', brand: 'resolved', tv: 'v2', alias: true, network: true },
  { id: 'F', label: 'E + VERIFICATION layer: key proposes, stated attributes verify (conflict ⇒ reject; region ⇒ abstain to review)', detector: 'v2', parser: 'v2', brand: 'resolved', tv: 'v2', alias: true, network: false, verify: true },
];
// ─── Scenario F: generic evidence verification on a proposed pair (category-agnostic) ───
// An attribute STATED ON BOTH SIDES that differs rejects the pair; stated on one side only is
// left to the key; region/edition wording that only one side states sends the pair to review.
// The harness now delegates to the production-quality verifier module (Phase 3B port), so the
// scored behaviour IS the shipped behaviour.
import { verifyPair as verifyPairModule } from '../../tps-core/identity-verifier';
function verifyPair(aName: string, cName: string, category: string): 'accept' | 'reject' | 'review' {
  const v = verifyPairModule({ title: aName, category }, { title: cName, category });
  return v.outcome === 'match' ? 'accept' : v.outcome === 'reject' ? 'reject' : 'review';
}
const PLATFORM = new Set(['google', 'apple tv', 'android', 'amazon', 'vision', 'unknown', 'null', '']);
const resolveBrand = (r: Row): string | null => {
  // ladder: page-state/spec "Brand" (source-explicit) › stored structured brand › known-brand dictionary on the title › null (plugin may infer)
  const sp = (r.sp_brand || '').trim(); if (sp && !PLATFORM.has(sp.toLowerCase())) return sp;
  if (r.brand && r.brand !== 'Unknown' && r.brand !== 'null') return r.brand;
  const t = detectBrandFromText(r.name); if (t && !PLATFORM.has(t.toLowerCase())) return t;
  return null;
};
const storedBrand = (r: Row): string | null => (r.brand && r.brand !== 'Unknown' && r.brand !== 'null') ? r.brand : null;
type Parsed = { detected: boolean; key: string | null; status: string | null; reason: string | null; p: Record<string, unknown> | null };
function parseMobile(r: Row, s: Scenario): Parsed {
  const det = s.detector === 'v2' ? mobileDetectV2 : mobileDetectV1; const norm = s.parser === 'v2' ? mobileNormalizeV2 : mobileNormalizeV1;
  const brand = s.brand === 'resolved' ? resolveBrand(r) : storedBrand(r);
  if (!det(r.name, r.name)) return { detected: false, key: null, status: null, reason: null, p: null };
  const n = norm(r.name, r.name, brand, {}); const id = mobileKey(brand, n.payload, { model_number: n.model_number });
  let key = id.key;
  if (key && s.network && /^samsung\|Galaxy [AM]\|/.test(key) && n.payload.network) key = `${key}|${n.payload.network}`;
  return { detected: true, key, status: id.status, reason: id.reason ?? null, p: n.payload };
}
const normModel = (s: string | null | undefined): string | null => { const t = (s || '').replace(/[‎‏]/g, '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); return t.length >= 5 && t.length <= 24 && /[A-Z]/.test(t) && /[0-9]/.test(t) ? t : null; };
const modelOfKey = (k: string | null | undefined) => { const m = (k || '').match(/\|MODEL:(.+)$/); return m ? normModel(m[1]) : null; };

// ─── corpus views ───
const amzPhones: Row[] = corpus.amazon_phones.map((p: any) => { const off = corpus.amazon_offers.find((o: any) => o.asin === p.asin); return { asin: p.asin, name: p.name, brand: p.brand, sp_brand: off?.sp_brand ?? null }; });
const ctrlMobile: Row[] = corpus.control_offers.filter((o: any) => o.category === 'mobile').map((o: any) => ({ store: o.store, name: o.name, brand: o.brand, key: o.key, model: o.model }));
const amzOffers: Row[] = corpus.amazon_offers.filter((o: any) => o.status === 'valid');
const ctrlOffers: Row[] = corpus.control_offers;

function keyAll(s: Scenario) {
  const amz = amzPhones.map(r => ({ r, k: parseMobile(r, s) }));
  const ctrl = ctrlMobile.map(r => ({ r, k: parseMobile({ ...r, brand: r.brand || (r.key || '').split('|')[0] }, s) }));
  // control key set: re-keyed spec keys; under alias also the stored MODEL keys mapped to the spec key of the same listing
  const ctrlKeys = new Map<string, Row[]>(); const alias = new Map<string, string>();
  for (const { r, k } of ctrl) { if (k.key && k.status === 'valid') { (ctrlKeys.get(k.key) || ctrlKeys.set(k.key, []).get(k.key)!).push(r); if (s.alias && r.key && /\|MODEL:/.test(r.key)) alias.set(r.key, k.key); } if (!s.alias && r.key && !ctrlKeys.has(r.key)) { /* stored keys are NOT used unless alias — rollout re-keys every store */ } }
  return { amz, ctrl, ctrlKeys, alias };
}

if (mode === 'gen') {
  // ─── ground-truth candidate pairs ───
  const pairs: any[] = []; let id = 1; const seen = new Set<string>();
  const add = (cat: string, strat: string, a: any, b: any, extra: any = {}) => { const sig = cat + '|' + (a.asin || a.name) + '|' + (b.store || '') + '|' + b.name; if (seen.has(sig)) return; seen.add(sig); pairs.push({ id: `P${String(id++).padStart(3, '0')}`, category: cat, stratum: strat, amazon: { asin: a.asin, name: a.name, brand: a.brand, key: a.key }, control: { store: b.store, name: b.name, key: b.key, model: b.model }, ...extra, label: '' }); };
  // phones: parse under Baseline and E to find same-key and near-miss pairs
  const base = keyAll(SCENARIOS[0]); const full = keyAll(SCENARIOS[5]);
  const genDigits = (p: any) => String(p?.generation || '').replace(/[^0-9]/g, '');
  const famOf = (p: any) => String(p?.family || '');
  for (let i = 0; i < amzPhones.length; i++) {
    const a = amzPhones[i]; const kb = base.amz[i].k; const ke = full.amz[i].k;
    const aFam = famOf(ke.p || kb.p), aGen = genDigits(ke.p || kb.p); if (!aFam) continue;
    const cands: { r: Row; j: number; score: number; why: string }[] = [];
    for (let j = 0; j < ctrlMobile.length; j++) {
      const c = ctrlMobile[j]; const ckb = base.ctrl[j].k, cke = full.ctrl[j].k; const cp = cke.p || ckb.p; if (!cp) continue;
      if (famOf(cp) !== aFam || genDigits(cp) !== aGen) continue;
      let why = 'near_miss'; let score = 0;
      if (kb.key && kb.key === ckb.key) { why = 'baseline_same_key'; score = 3; }
      else if (ke.key && ke.key === cke.key) { why = 'candidate_same_key'; score = 2; }
      else { const d = []; for (const f of ['generation', 'variant', 'storage_gb', 'network']) if (String((ke.p || kb.p)?.[f]) !== String(cp[f])) d.push(f); why = 'near_miss:' + d.join('+'); score = d.length === 1 ? 1 : 0; }
      cands.push({ r: c, j, score, why });
    }
    cands.sort((x, y) => y.score - x.score);
    const taken: string[] = [];
    for (const c of cands) { if (taken.length >= 3) break; if (taken.includes(c.why.split(':')[0]) && c.score < 2) continue; taken.push(c.why.split(':')[0]); add('mobile', c.why, { ...a, key: kb.key }, { ...c.r, key: c.r.key }, { amazon_parsed: { v1: base.amz[i].k, v2: ke }, control_parsed: { v1: base.ctrl[c.j].k, v2: full.ctrl[c.j].k } }); }
  }
  // other categories: same stored key, same model code, one-segment-different near misses
  const byCat: Record<string, Row[]> = {}; for (const o of ctrlOffers) (byCat[o.category!] = byCat[o.category!] || []).push(o);
  const want = ['tv', 'laptop', 'tablet', 'refrigerator', 'washing_machine', 'air_conditioner', 'vacuum', 'microwave', 'dishwasher', 'monitor', 'smartwatch', 'audio'];
  const caps: Record<string, number> = { tv: 30, laptop: 20, tablet: 20, refrigerator: 14, washing_machine: 14, air_conditioner: 8, vacuum: 6, microwave: 6, dishwasher: 6, monitor: 8, smartwatch: 8, audio: 8 };
  for (const cat of want) {
    let n = 0; const A = amzOffers.filter(o => o.category === cat).sort((x, y) => (x.asin! > y.asin! ? 1 : -1)); const C = byCat[cat] || [];
    const cIdx = new Map<string, Row[]>(); const cModel = new Map<string, Row[]>();
    for (const c of C) { (cIdx.get(c.key!) || cIdx.set(c.key!, []).get(c.key!)!).push(c); for (const m of [modelOfKey(c.key), normModel(c.model)]) if (m) (cModel.get(m) || cModel.set(m, []).get(m)!).push(c); }
    for (const a of A) { if (n >= caps[cat]) break; const same = cIdx.get(a.key!); const am = modelOfKey(a.key) || normModel(a.sp_item_model); const mm = am ? cModel.get(am) : undefined;
      if (same) { add(cat, 'baseline_same_key', a, same[0]); n++; }
      else if (mm && mm.length) { add(cat, 'model_code_match', a, mm[0], { model: am }); n++; }
      else { const seg = (a.key || '').split('|'); if (seg.length < 2) continue; let best: Row | null = null, bd = 99; for (const c of C) { const cs = (c.key || '').split('|'); if (cs.length !== seg.length || cs[0] !== seg[0]) continue; let d = 0; for (let i = 1; i < seg.length; i++) if (cs[i] !== seg[i]) d++; if (d > 0 && d < bd) { bd = d; best = c; } } if (best && bd <= 2) { add(cat, 'near_miss:' + bd + '_segments', a, best); n++; } }
    }
  }
  fs.writeFileSync(path.join(DIR, 'pairs.json'), JSON.stringify(pairs, null, 1));
  const strata: Record<string, number> = {}; for (const p of pairs) strata[p.category + '/' + p.stratum.split(':')[0]] = (strata[p.category + '/' + p.stratum.split(':')[0]] || 0) + 1;
  console.log('pairs', pairs.length, JSON.stringify(strata));
  for (const p of pairs) { const ap = p.amazon_parsed?.v2?.p, cp = p.control_parsed?.v2?.p; console.log(p.id, p.category, p.stratum, '\n   A:', (p.amazon.name || '').slice(0, 95), ap ? ' ⟨' + [ap.family, ap.generation, ap.variant, ap.storage_gb, ap.network].join('|') + '⟩' : (p.amazon.key ? ' ⟨' + p.amazon.key + '⟩' : ''), '\n   C' + (p.control.store || '') + ':', (p.control.name || '').slice(0, 95), cp ? ' ⟨' + [cp.family, cp.generation, cp.variant, cp.storage_gb, cp.network].join('|') + '⟩' : (p.control.key ? ' ⟨' + p.control.key + '⟩' : ''), p.model ? ' model=' + p.model : ''); }
}

if (mode === 'score') {
  const pairs = JSON.parse(fs.readFileSync(path.join(DIR, 'pairs.json'), 'utf8'));
  const labels = JSON.parse(fs.readFileSync(path.join(DIR, 'labels.json'), 'utf8'));
  const results: any = { scenarios: {}, coverage: {}, precision_survey: {} };
  // ── coverage + per-scenario asserted matches on phones ──
  for (const s of SCENARIOS) {
    const { amz, ctrl, ctrlKeys, alias } = keyAll(s);
    const cls: Record<string, number> = {}; const keys = new Map<string, number>(); let shared = 0; const sharedKeys = new Set<string>();
    for (const { k } of amz) { const c = !k.detected ? 'detect_reject' : k.status === 'valid' ? 'valid' : k.status || 'invalid'; cls[c] = (cls[c] || 0) + 1; if (k.key && k.status === 'valid') { keys.set(k.key, (keys.get(k.key) || 0) + 1); if (ctrlKeys.has(k.key) || [...alias.values()].includes(k.key)) sharedKeys.add(k.key); } }
    shared = sharedKeys.size;
    // control self-consistency: distinct control keys and MODEL-key listings whose spec key duplicates another listing's key (over-split measure)
    const ctrlValid = ctrl.filter(x => x.k.key && x.k.status === 'valid').length; const ctrlDistinct = ctrlKeys.size;
    // TV detector effect
    const tvDet = s.tv === 'v2' ? tvDetectV2 : tvDetectV1; const amzTv = corpus.amazon_offers.filter((o: any) => o.category === 'tv'); const tvAccepted = amzTv.filter((o: any) => tvDet(o.name, o.name)).length;
    // pair assertions
    const asserted = new Set<string>(); const reviewed = new Set<string>(); const amzById = new Map(amz.map(x => [x.r.asin!, x.k])); const ctrlByName = new Map(ctrl.map(x => [x.r.name, x.k]));
    for (const p of pairs) {
      let same = false;
      if (p.category === 'mobile') { const a = amzById.get(p.amazon.asin), c = ctrlByName.get(p.control.name); if (a?.key && c?.key && a.status === 'valid' && c.status === 'valid') same = a.key === c.key || (s.alias && alias.get(p.control.key) === a.key); }
      else { const ak = p.amazon.key, ck = p.control.key; same = ak && ck && ak === ck; if (!same && s.id !== 'Baseline' && s.brand === 'resolved') { const seg = (ak || '').split('|'), cs = (ck || '').split('|'); if (seg.length === cs.length && seg.slice(1).join('|') === cs.slice(1).join('|') && seg[0] !== cs[0] && (PLATFORM.has(seg[0]) || seg[0] === 'unknown')) same = true; } if (!same && s.alias && p.stratum === 'model_code_match') same = true; }
      if (same && s.verify) { const v = verifyPair(p.amazon.name, p.control.name, p.category); if (v === 'reject') same = false; else if (v === 'review') { reviewed.add(p.id); same = false; } }
      if (same) asserted.add(p.id);
    }
    const lab = (id: string) => labels[id] || '';
    const tp = [...asserted].filter(i => lab(i) === 'SAME_EXACT_VARIANT').length, fpVar = [...asserted].filter(i => lab(i) === 'SAME_PRODUCT_FAMILY_DIFFERENT_VARIANT').length, fpDiff = [...asserted].filter(i => lab(i) === 'DIFFERENT_PRODUCT').length, amb = [...asserted].filter(i => ['AMBIGUOUS', 'INSUFFICIENT_EVIDENCE', ''].includes(lab(i))).length;
    const allSame = pairs.filter((p: any) => lab(p.id) === 'SAME_EXACT_VARIANT').length;
    const perCat: Record<string, any> = {}; for (const p of pairs) { const c = perCat[p.category] = perCat[p.category] || { asserted: 0, tp: 0, fp: 0, amb: 0, gt_same: 0 }; if (lab(p.id) === 'SAME_EXACT_VARIANT') c.gt_same++; if (asserted.has(p.id)) { c.asserted++; const l = lab(p.id); if (l === 'SAME_EXACT_VARIANT') c.tp++; else if (l === 'DIFFERENT_PRODUCT' || l === 'SAME_PRODUCT_FAMILY_DIFFERENT_VARIANT') c.fp++; else c.amb++; } }
    const reviewLabels: Record<string, number> = {}; for (const i of reviewed) reviewLabels[lab(i) || 'unlabeled'] = (reviewLabels[lab(i) || 'unlabeled'] || 0) + 1;
    results.pair_outcomes = results.pair_outcomes || {}; results.pair_outcomes[s.id] = { asserted: [...asserted].sort(), review: [...reviewed].sort() };
    const WATCH = ['P001', 'P041', 'P145', 'P215', 'P191', 'P228', 'P298', 'P373', 'P404', 'P425', 'P435', 'P092', 'P179', 'P056', 'P020'];
    console.log('  watch-list:', WATCH.map(i => i + '=' + (asserted.has(i) ? 'ASSERT' : reviewed.has(i) ? 'REVIEW' : '-') + '/' + (lab(i) || '?').slice(0, 4)).join(' '));
    results.scenarios[s.id] = { label: s.label, sent_to_review: reviewed.size, review_labels: reviewLabels, phones: { classes: cls, distinct_valid_keys: keys.size, shared_with_control_rekeyed: shared, control_valid: ctrlValid, control_distinct_keys: ctrlDistinct }, tv_amazon_titles_accepted: `${tvAccepted}/${amzTv.length}`, pairs: { asserted: asserted.size, tp, fp_different_variant: fpVar, fp_different_product: fpDiff, ambiguous_or_unlabeled: amb, precision_on_labeled: ((tp / Math.max(1, tp + fpVar + fpDiff)) * 100).toFixed(1) + '%', recall_of_labeled_same: ((tp / Math.max(1, allSame)) * 100).toFixed(1) + '%', per_category: perCat, false_merges: [...asserted].filter(i => ['DIFFERENT_PRODUCT', 'SAME_PRODUCT_FAMILY_DIFFERENT_VARIANT'].includes(lab(i))) } };
    console.log(`\n### ${s.id} — ${s.label}\n  phones`, JSON.stringify(cls), '| keys', keys.size, '| shared(re-keyed control)', shared, '| control valid/distinct', ctrlValid + '/' + ctrlDistinct, '| TV accepted', `${tvAccepted}/${amzTv.length}`, '\n  pairs asserted', asserted.size, 'TP', tp, 'FP(variant)', fpVar, 'FP(different)', fpDiff, 'amb', amb, '| precision', results.scenarios[s.id].pairs.precision_on_labeled, 'recall', results.scenarios[s.id].pairs.recall_of_labeled_same);
    console.log('  per-category', JSON.stringify(perCat), '| sent to review', reviewed.size, JSON.stringify(reviewLabels));
    if (results.scenarios[s.id].pairs.false_merges.length) console.log('  false merges:', results.scenarios[s.id].pairs.false_merges.map((i: string) => { const p = pairs.find((x: any) => x.id === i); return i + ' ' + (p.amazon.name || '').slice(0, 40) + ' ↔ ' + (p.control.name || '').slice(0, 40); }).join(' ; '));
  }
  // ── suffix precision survey: production (v1) collisions that v2 separates, over all phone titles of all stores ──
  const all = [...amzPhones, ...ctrlMobile.map(r => ({ ...r, brand: r.brand || (r.key || '').split('|')[0] }))];
  const v1 = new Map<string, Set<string>>(); let suffixTitles = 0; const byBrand: Record<string, number> = {}; const ex: string[] = [];
  for (const r of all) { const a = parseMobile(r, SCENARIOS[0]), b = parseMobile(r, SCENARIOS[1]); if (a.key && b.key && a.status === 'valid' && b.status === 'valid') { (v1.get(a.key) || v1.set(a.key, new Set()).get(a.key)!).add(b.key); if (a.key !== b.key) { suffixTitles++; const br = a.key.split('|')[0]; byBrand[br] = (byBrand[br] || 0) + 1; if (ex.length < 12) ex.push(a.key + ' → ' + b.key + '  [' + r.name.slice(0, 50) + ']'); } } }
  const collisions = [...v1.entries()].filter(([, s]) => s.size > 1);
  results.precision_survey = { titles_total: all.length, titles_whose_identity_changes_under_A: suffixTitles, by_brand: byBrand, production_keys_that_v2_splits: collisions.length, collision_examples: collisions.slice(0, 15).map(([k, s]) => k + ' ⇒ ' + [...s].join(' / ')), examples: ex };
  console.log('\n### suffix survey: titles changed', suffixTitles, JSON.stringify(byBrand), '| production keys that v2 splits', collisions.length); for (const c of results.precision_survey.collision_examples) console.log('   ', c);
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(results, null, 1));
}
