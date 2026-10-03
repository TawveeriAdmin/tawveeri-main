// READ-ONLY counterfactual identity simulation on exported production data (p2a.json). Writes nothing to production.
const fs = require('fs'); const SP = process.argv[2];
const R = JSON.parse(fs.readFileSync(SP + '/p2a.json')).results;
const clean = (s) => (s || '').replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
const normModel = (s) => { s = clean(s).toUpperCase(); if (!s) return null; s = s.replace(/^MODEL\s*(NO\.?|NUMBER)?\s*:?\s*/i, ''); const strict = s.replace(/[^A-Z0-9]/g, ''); return strict.length >= 5 && strict.length <= 24 && /[A-Z]/.test(strict) && /[0-9]/.test(strict) && !/\s/.test(s) ? strict : null; };
const normModelLoose = (s) => { s = clean(s).toUpperCase(); const strict = s.replace(/[^A-Z0-9]/g, ''); return strict.length >= 5 && strict.length <= 24 && /[A-Z]/.test(strict) && /[0-9]/.test(strict) ? strict : null; }; // allows one-space model names like "Latitude 7470"? no — letters+digits only after stripping, still requires both
const normBrand = (b) => { b = clean(b).toLowerCase(); const map = { 'super general': 'supergeneral', 'black & decker': 'black+decker', 'black+decker': 'black+decker', 'de\'longhi': 'delonghi', 'delonghi': 'delonghi', 'lg electronics': 'lg', 'samsung electronics': 'samsung', 'hewlett packard': 'hp', 'hewlett-packard': 'hp', 'hp inc': 'hp', 'asustek': 'asus', 'tcl': 'tcl', 'honor': 'honor', 'huawei': 'huawei', 'apple': 'apple', 'xiaomi': 'xiaomi', 'redmi': 'xiaomi', 'skyworth': 'skyworth', 'nikai': 'nikai', 'dansat': 'dansat', 'hisense': 'hisense', 'toshiba': 'toshiba', 'midea': 'midea', 'gree': 'gree', 'haier': 'haier', 'panasonic': 'panasonic', 'sony': 'sony', 'lenovo': 'lenovo', 'dell': 'dell', 'acer': 'acer', 'msi': 'msi', 'microsoft': 'microsoft', 'google': 'google', 'anker': 'anker', 'jbl': 'jbl', 'bosch': 'bosch', 'beko': 'beko', 'sharp': 'sharp', 'philips': 'philips', 'impex': 'impex', 'aoc': 'aoc', 'gameon': 'gameon', 'ugine': 'ugine', 'aston': 'aston', 'mando': 'mando', 'falcon': 'falcon' }; return map[b] || b.replace(/[^a-z0-9+]/g, ''); };
const PLATFORM_BRANDS = new Set(['google', 'apple', 'vision', 'unknown', 'microsoft', 'amazon', 'android', '']);
// ---------- control index ----------
const ctrl = R.ctrl_offers_ids.filter(o => o.status === 'valid');
const ctrlKeys = new Map(); // identity_key -> {stores:Set, cats:Set, names}
const ctrlByModel = new Map(); // normModel -> [{store,key,cat,name,brand}]
const addModel = (m, rec) => { if (!m) return; const arr = ctrlByModel.get(m) || []; if (!arr.some(x => x.key === rec.key && x.store === rec.store)) arr.push(rec); ctrlByModel.set(m, arr); };
for (const o of ctrl) {
  const k = ctrlKeys.get(o.identity_key) || { stores: new Set(), cats: new Set(), names: [] }; k.stores.add(o.store_id); k.cats.add(o.category); if (k.names.length < 2) k.names.push(clean(o.name).slice(0, 80)); ctrlKeys.set(o.identity_key, k);
  const brand = (o.identity_key.split('|')[0] || '').toLowerCase(); const rec = { store: o.store_id, key: o.identity_key, cat: o.category, name: clean(o.name).slice(0, 90), brand };
  const mk = o.identity_key.match(/\|MODEL:(.+)$/); if (mk) addModel(normModel(mk[1]), rec);
  for (const f of [o.mm, o.pl_model, o.pl_modelNumber, o.pl_mpn, o.pl_manufacturerModel]) addModel(normModel(f), rec);
}
// ---------- amazon side ----------
const amz = R.amz_offers_ids; const amzValid = amz.filter(o => o.status === 'valid');
const isCtrlKey = (k) => ctrlKeys.has(k);
const A = { valid: amzValid.length, shared_now: amzValid.filter(o => isCtrlKey(o.identity_key)).length };
// Scenario B: brand cleanup — replace key brand when PDP spec Brand is trustworthy and differs
const trust = (o) => { const sb = o.sp_brand ? normBrand(o.sp_brand) : null; return sb && !PLATFORM_BRANDS.has(sb) ? sb : null; };
const applyB = (o) => { const sb = trust(o); const parts = o.identity_key.split('|'); if (sb && parts[0] !== sb && (PLATFORM_BRANDS.has(parts[0]) || parts[0] === 'null' || o.sp_brand)) { parts[0] = sb; return parts.join('|'); } return o.identity_key; };
// Scenario C: model enrichment from PDP identifiers (Item model number > Model number > Model name)
const amzModel = (o) => normModel(o.sp_item_model) || normModel(o.sp_model_number) || (o.category !== 'mobile' && o.category !== 'tablet' ? normModel(o.sp_model_name) : null); // model name for phones/tablets is a marketing name ("iPhone 15") — excluded
const sim = (label, transform, opts = {}) => {
  const res = { label, amazon_valid: amzValid.length, shared_keys: 0, new_shared_vs_A: 0, shared_with_extra: 0, shared_with_almanea: 0, model_matches: 0, model_ambiguous: 0, cross_category_matches: 0, collisions_amazon_keys_merged: 0, matched_pairs: [] };
  const seenKeys = new Map(); const baseShared = new Set(amzValid.filter(o => isCtrlKey(o.identity_key)).map(o => o.asin || o.identity_key));
  for (const o of amzValid) {
    let key = transform ? transform(o) : o.identity_key; let matchedVia = null; let ctrlRecs = [];
    if (isCtrlKey(key)) { matchedVia = 'key'; const k = ctrlKeys.get(key); ctrlRecs = [...k.stores].map(s => ({ store: s, key, cat: [...k.cats][0], name: k.names[0] })); }
    else if (opts.model) { const m = amzModel(o); if (m) { const brand = key.split('|')[0]; let recs = ctrlByModel.get(m) || []; if (opts.brandGuard) recs = recs.filter(r => r.brand === brand || !brand || brand === 'null' || PLATFORM_BRANDS.has(brand)); if (recs.length) { const keys = new Set(recs.map(r => r.key)); if (keys.size > 1) res.model_ambiguous++; else { matchedVia = 'model:' + m; ctrlRecs = recs; res.model_matches++; if (recs.some(r => r.cat !== o.category)) res.cross_category_matches++; } } } }
    if (matchedVia) { res.shared_keys++; if (!baseShared.has(o.asin || o.identity_key)) res.new_shared_vs_A++; if (ctrlRecs.some(r => r.store === 4)) res.shared_with_extra++; if (ctrlRecs.some(r => r.store === 5)) res.shared_with_almanea++; if (res.matched_pairs.length < 400 && matchedVia !== 'key') res.matched_pairs.push({ asin: o.asin, category: o.category, amazon_key: o.identity_key, new_key: key, via: matchedVia, amazon_name: clean(o.name).slice(0, 90), control: ctrlRecs.slice(0, 2).map(r => r.store + ':' + r.key + ' :: ' + r.name) }); }
    const prev = seenKeys.get(key); if (prev && prev !== o.asin) res.collisions_amazon_keys_merged++; seenKeys.set(key, o.asin);
  }
  res.overlap_pct = (100 * res.shared_keys / amzValid.length).toFixed(1) + '%';
  return res;
};
const S = {};
S.A = sim('A current', null);
S.B = sim('B brand cleanup (PDP spec Brand, platform tokens replaced)', applyB);
S.C = sim('C model enrichment (PDP Item model number / Model number; brand-guarded)', null, { model: true, brandGuard: true });
S.D = sim('D brand + model', applyB, { model: true, brandGuard: true });
S.E = sim('E brand + model, brand guard relaxed (same model, any brand token)', applyB, { model: true, brandGuard: false });
S.F = { label: 'F deterministic GTIN/EAN/UPC', amazon_with_gtin: amz.filter(o => false).length, note: 'Amazon pages/payloads carry no GTIN (0 of 1,653 offers; 0 products.specifications identifier keys); eXtra feed carries barCode for 1,200/1,200 daily rows but it is not read by the engine; Almanea feed gtin field is empty (0 of 15,245). Scenario F = 0 additional Amazon matches today (UNKNOWN until an identifier source exists).' };
// baseline facts
const facts = { amazon_offers: amz.length, amazon_valid: amzValid.length, amazon_with_pdp_evidence: amzValid.filter(o => o.has_pdp).length, amazon_with_spec_table: amzValid.filter(o => o.has_specs).length, amazon_with_item_model: amzValid.filter(o => normModel(o.sp_item_model)).length, amazon_with_model_name: amzValid.filter(o => normModel(o.sp_model_name)).length, amazon_with_any_usable_model: amzValid.filter(o => amzModel(o)).length, amazon_with_spec_brand: amzValid.filter(o => o.sp_brand).length, amazon_brand_trust_differs: amzValid.filter(o => trust(o) && trust(o) !== o.identity_key.split('|')[0]).length, control_valid_offers: ctrl.length, control_distinct_keys: ctrlKeys.size, control_model_index_size: ctrlByModel.size, control_offers_with_any_model_field: ctrl.filter(o => normModel(o.mm) || normModel(o.pl_model) || normModel(o.pl_modelNumber)).length };
// per-category view for D
const perCat = {}; for (const o of amzValid) { const c = perCat[o.category] = perCat[o.category] || { valid: 0, shared_A: 0, usable_model: 0 }; c.valid++; if (isCtrlKey(o.identity_key)) c.shared_A++; if (amzModel(o)) c.usable_model++; }
for (const p of S.D.matched_pairs) { const c = perCat[p.category]; if (c) c.new_D = (c.new_D || 0) + 1; }
// human-review sample: up to 120 model-based matches, stratified by category, plus 30 brand-cleanup key matches
const review = []; const byCat = {}; for (const p of S.E.matched_pairs) { (byCat[p.category] = byCat[p.category] || []).push(p); }
for (const [cat, arr] of Object.entries(byCat)) { arr.sort((a, b) => (a.asin > b.asin ? 1 : -1)); for (const p of arr.slice(0, 15)) review.push({ ...p, reviewer_label: '' }); }
fs.writeFileSync(SP + '/p2sim.json', JSON.stringify({ captured_from: 'p2a.json', facts, scenarios: S, per_category_D: perCat, review_sample: review }, null, 1));
console.log('FACTS', JSON.stringify(facts));
for (const k of ['A', 'B', 'C', 'D', 'E']) { const s = S[k]; console.log(k, s.label, '| shared', s.shared_keys, s.overlap_pct, '| new vs A', s.new_shared_vs_A, '| extra', s.shared_with_extra, 'almanea', s.shared_with_almanea, '| model matches', s.model_matches, 'ambiguous', s.model_ambiguous, 'cross-cat', s.cross_category_matches, '| amazon key collisions', s.collisions_amazon_keys_merged); }
console.log('F', S.F.note);
console.log('per category (D):', JSON.stringify(perCat));
console.log('review sample size', review.length);
for (const p of S.D.matched_pairs.slice(0, 25)) console.log('  ', p.category, p.asin, p.via, '|', p.amazon_name.slice(0, 60), '=>', p.control[0].slice(0, 110));
