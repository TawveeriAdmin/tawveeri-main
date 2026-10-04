// scripts/tps-analysis/identity-shadow.ts — Phase 3B SHADOW RUN (2026-10-03). READ-ONLY.
//
// Replays the production identity rules (v1, flag off) and the Phase-3B rules (v2, flag on)
// IN-PROCESS over the newest observation of every listing seen in the last N days across all
// stores that hold current offers, then applies the verifier to every v2 key shared by ≥2 stores.
// Nothing is written to the database; the user-visible comparison is untouched. Output is a JSON
// evidence file: identity diff (unchanged / changed / merge→split / split→merge / new / lost /
// newly-shared / shared-lost / review / reject / conflict classes / brand changes) and the
// COMMERCIAL impact (merchant added/removed, cheapest merchant or price changed, saving changed,
// false best-price removed, best-price recovered), with an Amazon-specific breakdown that separates
// identity loss from freshness, availability and source-data loss.
//
//   npx tsx scripts/tps-analysis/identity-shadow.ts [days=7] [out=docs/evidence/.../shadow.json]
import * as fs from 'fs';
import pg from 'pg';
import 'dotenv/config';
import { CATEGORY_DEFS } from '../tps-core/category-registry';
import { verifyPair, resolveGroup, modelCodeOfKey } from '../tps-core/identity-verifier';
import { brandOrNull } from '../tps-core/store-identity-guard';
import { extractManufacturerModel } from '../../src/lib/identity/store-identifiers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

const DAYS = Number(process.argv[2] || 7);
const OUT = process.argv[3] || `docs/evidence/amazon-diagnostic-2026-10-03/phase3b/shadow-${DAYS}d.json`;
const FRESH_H = 168;
const defs = Object.values(CATEGORY_DEFS) as any[];

type Obs = { store_id: number; raw_name: string; payload: any; price: number | null; availability: string | null; scraped_at: string; };
type Keyed = { key: string | null; status: string | null; category: string | null; detected: boolean };

function adapt(p: any, rawName: string) {
  const nameAr = String(p.nameAr ?? p.name_ar ?? p.name ?? rawName ?? '');
  const nameEn = String(p.nameEn ?? p.name_en ?? p.title ?? '');
  const brand = brandOrNull(typeof (p.brandEn ?? p.brand ?? p.brandAr) === 'string' ? (p.brandEn ?? p.brand ?? p.brandAr) : null);
  return { nameAr, nameEn, brand };
}
function keyOf(o: Obs): Keyed {
  const { nameAr, nameEn, brand } = adapt(o.payload ?? {}, o.raw_name);
  for (const def of defs) {
    let det = false; try { det = def.plugin.detect(nameAr, nameEn); } catch { continue; }
    if (!det) continue;
    try { const n = def.normalize(nameAr, nameEn, brand, o.payload ?? {}); const id = def.plugin.buildIdentityKey(brand, n.payload, { model_number: n.model_number }); return { key: id.key ?? null, status: id.status, category: def.category, detected: true }; }
    catch { return { key: null, status: 'error', category: def.category, detected: true }; }
  }
  return { key: null, status: null, category: null, detected: false };
}
const declaredModel = (o: Obs): string | null => (o.payload ? extractManufacturerModel(o.payload) : null);
const eligible = (o: Obs, now: number) => (o.price ?? 0) > 0 && o.availability !== 'out_of_stock' && (now - Date.parse(o.scraped_at)) / 36e5 <= FRESH_H;
const inc = (m: Record<string, number>, k: string, n = 1) => { m[k] = (m[k] || 0) + n; };

(async () => {
  const client = new pg.Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, statement_timeout: 300000 });
  await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const { rows: stores } = await client.query(`select s.id, s.slug, s.name_ar from stores s where s.id in (select distinct store_id from tps_current_offers where status='valid')`);
  const storeIds = stores.map((s: any) => Number(s.id)); const slugOf = new Map<number, string>(stores.map((s: any) => [Number(s.id), s.slug]));
  // newest observation per (store, listing) in the window
  const { rows } = await client.query(`select distinct on (r.store_id, r.raw_name) r.store_id, r.raw_name, r.payload, coalesce(r.price, nullif(r.payload->>'current_price','')::numeric) price, coalesce(r.availability, r.payload->>'availability') availability, r.scraped_at from raw_observations r where r.store_id = any($1::int[]) and r.scraped_at >= now() - ($2 || ' days')::interval order by r.store_id, r.raw_name, r.scraped_at desc`, [storeIds, String(DAYS)]);
  const { rows: cur } = await client.query(`select identity_key, store_id, category, price, observed_at, payload->>'_availability' availability, name from tps_current_offers where status='valid'`);
  await client.query('ROLLBACK'); await client.end();
  const now = Date.now();
  console.log(`observations ${rows.length} across ${storeIds.length} stores (${DAYS} d) | current valid offers ${cur.length}`);

  // ── v1 and v2 keys for every observation ──
  const obs: Obs[] = rows.map((r: any) => ({ store_id: Number(r.store_id), raw_name: r.raw_name, payload: r.payload, price: r.price != null ? Number(r.price) : null, availability: r.availability, scraped_at: r.scraped_at }));
  process.env.TPS_IDENTITY_V2 = '0'; const v1 = obs.map(keyOf);
  process.env.TPS_IDENTITY_V2 = '1'; const v2 = obs.map(keyOf);
  delete process.env.TPS_IDENTITY_V2;

  const diff: Record<string, number> = {}; const byCat: Record<string, Record<string, number>> = {}; const brandChanges: Record<string, number> = {};
  const v1Groups = new Map<string, number[]>(), v2Groups = new Map<string, number[]>();
  for (let i = 0; i < obs.length; i++) {
    const a = v1[i], b = v2[i]; const cat = b.category || a.category || 'none'; byCat[cat] = byCat[cat] || {};
    const av = a.key && a.status === 'valid', bv = b.key && b.status === 'valid';
    if (av) (v1Groups.get(a.key!) || v1Groups.set(a.key!, []).get(a.key!)!).push(i);
    if (bv) (v2Groups.get(b.key!) || v2Groups.set(b.key!, []).get(b.key!)!).push(i);
    let c: string;
    if (av && bv) c = a.key === b.key ? 'identity_unchanged' : 'key_changed'; else if (!av && bv) c = !a.detected && b.detected ? 'new_identity_from_detector' : 'new_identity_from_key'; else if (av && !bv) c = 'lost_identity'; else c = 'neither_valid';
    inc(diff, c); inc(byCat[cat], c);
    if (av && bv && a.key !== b.key) { const ba = a.key!.split('|')[0], bb = b.key!.split('|')[0]; if (ba !== bb) inc(brandChanges, `${ba}→${bb}`); }
  }
  // merge→split and split→merge (over observations with both keys valid)
  const v1ToV2 = new Map<string, Set<string>>(), v2ToV1 = new Map<string, Set<string>>();
  for (let i = 0; i < obs.length; i++) { const a = v1[i], b = v2[i]; if (a.key && a.status === 'valid' && b.key && b.status === 'valid') { (v1ToV2.get(a.key) || v1ToV2.set(a.key, new Set()).get(a.key)!).add(b.key); (v2ToV1.get(b.key) || v2ToV1.set(b.key, new Set()).get(b.key)!).add(a.key); } }
  const mergeToSplit = [...v1ToV2.entries()].filter(([, s]) => s.size > 1), splitToMerge = [...v2ToV1.entries()].filter(([, s]) => s.size > 1);

  // ── per-category ledger (the decision matrix is category-by-category, never a global average) ──
  const byCatShared: Record<string, Record<string, number>> = {};
  const catInc = (cat: string, k: string, n = 1) => inc(byCatShared[cat] = byCatShared[cat] || {}, k, n);
  // Lost / changed identities, with the titles, so the report can say WHY (not only how many).
  const lostExamples: any[] = [], changedExamples: any[] = [];
  for (let i = 0; i < obs.length; i++) {
    const a = v1[i], b = v2[i]; const av = a.key && a.status === 'valid', bv = b.key && b.status === 'valid';
    if (av && !bv && lostExamples.length < 40) lostExamples.push({ store: slugOf.get(obs[i].store_id), title: obs[i].raw_name.slice(0, 90), v1_key: a.key, v2_status: b.detected ? b.status : 'detect_reject' });
    if (av && bv && a.key !== b.key && changedExamples.length < 40) changedExamples.push({ store: slugOf.get(obs[i].store_id), title: obs[i].raw_name.slice(0, 90), v1_key: a.key, v2_key: b.key });
  }

  // ── cross-store sharing + verifier on v2 groups ──
  const sharedV1 = new Set([...v1Groups.entries()].filter(([, ix]) => new Set(ix.map(i => obs[i].store_id)).size >= 2).map(([k]) => k));
  const verdicts: Record<string, number> = {}; const conflictClasses: Record<string, number> = {}; const reviewClasses: Record<string, number> = {};
  const classExamples: Record<string, any[]> = {};
  const addExample = (cls: string, i: number, j: number, cat: string, reasons: string[]) => { const arr = classExamples[cls] = classExamples[cls] || []; if (arr.length < 40) arr.push({ category: cat, a: `${slugOf.get(obs[i].store_id)}: ${obs[i].raw_name.slice(0, 95)}`, b: `${slugOf.get(obs[j].store_id)}: ${obs[j].raw_name.slice(0, 95)}`, reasons }); };
  const v2Shared: Array<{ key: string; category: string; stores: number[]; kept: number[]; review: number[]; rejected: number[] }> = [];
  for (const [key, ix] of v2Groups) {
    const storesIn = [...new Set(ix.map(i => obs[i].store_id))]; if (storesIn.length < 2) continue;
    const cat = v2[ix[0]].category || 'unknown';
    // newest obs per store in the group
    const perStore = new Map<number, number>(); for (const i of ix) { const s = obs[i].store_id; const prev = perStore.get(s); if (prev == null || obs[i].scraped_at > obs[prev].scraped_at) perStore.set(s, i); }
    // Members in price order (cheapest first) — the SAME order the compare page passes, so the
    // greedy consistent-set tie-break resolves identically here and in production.
    const members = [...perStore.values()].sort((i, j) => (obs[i].price ?? Infinity) - (obs[j].price ?? Infinity) || i - j);
    const kept: number[] = [], review: number[] = [], rejected: number[] = [];
    // Pair-level classes (each unordered pair counted once) for the conflict / review tables.
    for (let a = 0; a < members.length; a++) for (let b = a + 1; b < members.length; b++) {
      const i = members[a], j = members[b]; const v = verifyPair({ title: obs[i].raw_name, category: cat }, { title: obs[j].raw_name, category: cat });
      if (v.outcome === 'reject') { for (const r of v.reasons) if (/conflict|bundle/.test(r)) { inc(conflictClasses, r.split(':')[0]); addExample(r.split(':')[0], i, j, cat, v.reasons); } }
      else if (v.outcome === 'review') { for (const r of v.reasons) if (/unknown|one_side|near|region/.test(r)) { inc(reviewClasses, r.split(':')[0]); addExample(r.split(':')[0], i, j, cat, v.reasons); } }
    }
    // Member-level outcome through the ONE group-resolution authority (no anchor here: the shadow
    // has no canonical name per key, so this is the conservative, anchor-less resolution).
    // The key's own MODEL: segment is structured evidence for every member (the compare page passes
    // the same); nothing else structured is passed, so this is exactly what the read gate can see.
    const res = resolveGroup(members.map(i => ({ title: obs[i].raw_name, label: slugOf.get(obs[i].store_id), structured: declaredModel(obs[i]) ? { model: declaredModel(obs[i])! } : undefined })), cat, null, modelCodeOfKey(key));
    members.forEach((i, m) => { const o = res[m].outcome; inc(verdicts, o); (o === 'reject' ? rejected : o === 'review' ? review : kept).push(i); });
    // Precondition sizing: a review member whose SOURCE payload states a model code the title does
    // not — feeding the source-explicit code to the verifier would resolve it (a data wiring task).
    for (const i of review) { if (!declaredModel(obs[i])) { inc(reviewClasses, 'review_member_without_declared_model'); catInc(cat, 'review_member_without_declared_model'); } }
    v2Shared.push({ key, category: cat, stores: storesIn, kept, review, rejected });
  }
  const newlyShared = v2Shared.filter(g => !sharedV1.has(g.key) && new Set(g.kept.map(i => obs[i].store_id)).size >= 2);
  const sharedLost = [...sharedV1].filter(k => !v2Groups.has(k) || new Set((v2Groups.get(k) || []).map(i => obs[i].store_id)).size < 2);

  for (const k of sharedV1) catInc(v1[v1Groups.get(k)![0]].category || 'unknown', 'shared_v1');
  for (const g of v2Shared) { catInc(g.category, 'shared_v2_proposed'); if (new Set(g.kept.map(i => obs[i].store_id)).size >= 2) catInc(g.category, 'shared_v2_verified'); catInc(g.category, 'members_match', g.kept.length); catInc(g.category, 'members_review', g.review.length); catInc(g.category, 'members_reject', g.rejected.length); }
  for (const g of newlyShared) catInc(g.category, 'newly_shared_verified');
  for (const k of sharedLost) catInc(v1[v1Groups.get(k)![0]].category || 'unknown', 'previously_shared_lost');

  // ── commercial impact: v1 composition (current offers as deployed) vs v2 composition (shadow) per key ──
  const curByKey = new Map<string, any[]>(); for (const c of cur) (curByKey.get(c.identity_key) || curByKey.set(c.identity_key, []).get(c.identity_key)!).push(c);
  const curElig = (c: any) => Number(c.price) > 0 && c.availability !== 'out_of_stock' && (now - Date.parse(c.observed_at)) / 36e5 <= FRESH_H;
  const impact: Record<string, number> = {}; const examples: any[] = []; const amz: Record<string, number> = {};
  const AMZ = 2;
  for (const g of v2Shared) {
    // every impact / Amazon line lands in the global table AND the category ledger
    const imp = (k: string, n = 1) => { inc(impact, k, n); catInc(g.category, k, n); };
    const amzInc = (k: string) => { inc(amz, k); catInc(g.category, `amazon_${k}`); };
    const v2Offers = g.kept.filter(i => eligible(obs[i], now)).map(i => ({ store: obs[i].store_id, price: obs[i].price!, name: obs[i].raw_name }));
    const v1Rows = (curByKey.get(g.key) || []).filter(curElig).map(c => ({ store: Number(c.store_id), price: Number(c.price) }));
    const v1Stores = new Set(v1Rows.map(o => o.store)), v2Stores = new Set(v2Offers.map(o => o.store));
    const added = [...v2Stores].filter(s => !v1Stores.has(s)), removed = [...v1Stores].filter(s => !v2Stores.has(s));
    const cheap = (arr: { store: number; price: number }[]) => arr.length ? arr.reduce((m, o) => o.price < m.price ? o : m) : null;
    const c1 = cheap(v1Rows), c2 = cheap(v2Offers);
    const sav = (arr: { price: number }[]) => arr.length >= 2 ? Math.max(...arr.map(o => o.price)) - Math.min(...arr.map(o => o.price)) : 0;
    if (added.length) imp('merchant_added', added.length); if (removed.length) imp('merchant_removed', removed.length);
    if (c1 && c2 && c1.store !== c2.store) imp('cheapest_merchant_changed'); if (c1 && c2 && c1.price !== c2.price) imp('cheapest_price_changed');
    if (v1Rows.length >= 2 && v2Offers.length >= 2 && sav(v1Rows) !== sav(v2Offers)) imp('saving_changed');
    if (v1Rows.length !== v2Offers.length) imp('offer_count_changed');
    const rejectedStores = new Set(g.rejected.map(i => obs[i].store_id));
    if (c1 && rejectedStores.has(c1.store)) imp('false_best_price_removed');
    if (c2 && (!c1 || c2.price < c1.price) && !v1Stores.has(c2.store)) imp('best_price_opportunity_recovered');
    if (v1Rows.length < 2 && v2Offers.length >= 2) imp('comparison_created'); if (v1Rows.length >= 2 && v2Offers.length < 2) imp('comparison_lost');
    if ((added.length || removed.length || (c1 && c2 && c1.store !== c2.store)) && examples.length < 60) examples.push({ key: g.key, category: g.category, v1: v1Rows.map(o => `${slugOf.get(o.store)}:${o.price}`), v2: v2Offers.map(o => `${slugOf.get(o.store)}:${o.price}`), review: g.review.map(i => slugOf.get(obs[i].store_id)), rejected: g.rejected.map(i => `${slugOf.get(obs[i].store_id)}:${obs[i].raw_name.slice(0, 50)}`) });
    // Amazon breakdown within shared groups
    const amzMembers = [...g.kept, ...g.review, ...g.rejected].filter(i => obs[i].store_id === AMZ);
    for (const i of amzMembers) { if (g.rejected.includes(i)) amzInc('excluded_identity_conflict'); else if (g.review.includes(i)) amzInc('excluded_identity_review'); else if ((obs[i].price ?? 0) <= 0) amzInc('excluded_no_price_source'); else if (obs[i].availability === 'out_of_stock') amzInc('excluded_availability'); else if ((now - Date.parse(obs[i].scraped_at)) / 36e5 > FRESH_H) amzInc('excluded_freshness'); else { amzInc('shown_in_comparison'); if (c2 && c2.store === AMZ) amzInc('cheapest_when_eligible'); } }
  }
  const amzIdent = (ks: Keyed[]) => ks.filter((k, i) => obs[i].store_id === AMZ && k.key && k.status === 'valid').map(k => k.key!);
  const amzV1 = new Set(amzIdent(v1)), amzV2 = new Set(amzIdent(v2));
  const sharedWith = (keys: Set<string>, groups: Map<string, number[]>, store: number) => [...keys].filter(k => (groups.get(k) || []).some(i => obs[i].store_id === store)).length;
  const amazon = { valid_identities_v1: amzV1.size, valid_identities_v2: amzV2.size, normalized_observations_v1: v1.filter((k, i) => obs[i].store_id === AMZ && k.key && k.status === 'valid').length, normalized_observations_v2: v2.filter((k, i) => obs[i].store_id === AMZ && k.key && k.status === 'valid').length, shared_with_extra_v1: sharedWith(amzV1, v1Groups, 4), shared_with_extra_v2_verified: newlyShared.concat(v2Shared.filter(g => sharedV1.has(g.key))).filter(g => g.kept.some(i => obs[i].store_id === AMZ) && g.kept.some(i => obs[i].store_id === 4)).length, shared_with_almanea_v1: sharedWith(amzV1, v1Groups, 5), shared_with_almanea_v2_verified: v2Shared.filter(g => g.kept.some(i => obs[i].store_id === AMZ) && g.kept.some(i => obs[i].store_id === 5)).length, in_shared_groups: amz };

  // ── SAME-OBSERVATION A/B (ADR-403 / founder item 20) ──────────────────────────────────────────────
  // The earlier commercial figures compared the DEPLOYED current-offer table with a later replay, so price
  // drift and freshness leaked into "cheapest changed". Here BOTH worlds are built from the SAME newest
  // observation per (store, listing), the SAME prices and the SAME eligibility rule; the only difference is
  // grouping (v1 keys vs v2 keys + verifier verdicts). Every difference below is therefore identity-caused
  // by construction. world1 = production grouping; world2 = candidate grouping, verified members only.
  const AMZ_ID = 2;
  const elig = (i: number) => eligible(obs[i], now);
  const newestPerStore = (ix: number[], pred: (i: number) => boolean) => { const m = new Map<number, number>(); for (const i of ix) { if (!pred(i)) continue; const s = obs[i].store_id; const p = m.get(s); if (p == null || obs[i].scraped_at > obs[p].scraped_at || (obs[i].scraped_at === obs[p].scraped_at && i < p)) m.set(s, i); } return m; };
  const catOf = (i: number) => v2[i].category || v1[i].category || 'none';
  const inC1 = new Set<number>(), inC2 = new Set<number>(); const w1Groups: Array<{ key: string; members: number[] }> = [];
  for (const [key, ix] of v1Groups) { const m = newestPerStore(ix, elig); if (m.size >= 2) { const mem = [...m.values()]; w1Groups.push({ key, members: mem }); mem.forEach(i => inC1.add(i)); } }
  const verdictOf = new Map<number, 'match' | 'review' | 'reject'>();
  const w2Count: Record<string, number> = {}; let w2Groups = 0;
  for (const g of v2Shared) { g.kept.forEach(i => verdictOf.set(i, 'match')); g.review.forEach(i => verdictOf.set(i, 'review')); g.rejected.forEach(i => verdictOf.set(i, 'reject')); const m = newestPerStore(g.kept, elig); if (m.size >= 2) { w2Groups++; [...m.values()].forEach(i => inC2.add(i)); } }
  const AB: Record<string, Record<string, number>> = {}; const abInc = (cat: string, k: string, n = 1) => { inc(AB[cat] = AB[cat] || {}, k, n); inc(AB.ALL = AB.ALL || {}, k, n); };
  const abExamples: Record<string, any[]> = {};
  const abEx = (k: string, e: any) => { const a = abExamples[k] = abExamples[k] || []; if (a.length < 12) a.push(e); };
  for (const g of w1Groups) abInc(catOf(g.members[0]), 'world1_comparisons');
  for (const g of v2Shared) { const m = newestPerStore(g.kept, elig); if (m.size >= 2) abInc(g.category, 'world2_comparisons'); }
  for (const i of inC1) { const c = catOf(i); abInc(c, 'world1_listings_in_comparisons'); if (obs[i].store_id === AMZ_ID) abInc(c, 'amazon_world1_in_comparison'); }
  for (const i of inC2) { const c = catOf(i); abInc(c, 'world2_listings_in_comparisons'); if (obs[i].store_id === AMZ_ID) abInc(c, 'amazon_world2_in_comparison'); }
  for (const i of inC1) if (!inC2.has(i)) {
    const c = catOf(i), vd = verdictOf.get(i); const reason = vd === 'reject' ? 'removed_rejected_by_verifier' : vd === 'review' ? 'removed_review_unverified' : (v1[i].key !== v2[i].key ? 'removed_regrouped_by_v2_key' : 'removed_group_fell_below_two_stores');
    abInc(c, 'listing_removed_from_comparison'); abInc(c, reason); if (obs[i].store_id === AMZ_ID) { abInc(c, 'amazon_comparison_removed'); abInc(c, 'amazon_' + reason); }
    abEx(reason, { store: slugOf.get(obs[i].store_id), cat: c, title: obs[i].raw_name.slice(0, 80), v1_key: v1[i].key, v2_key: v2[i].key });
  }
  for (const i of inC2) if (!inC1.has(i)) {
    const c = catOf(i); const reason = !(v1[i].key && v1[i].status === 'valid') ? 'added_new_identity_from_detector_or_suffix' : 'added_regrouped_by_v2_key';
    abInc(c, 'listing_added_to_comparison'); abInc(c, reason); if (obs[i].store_id === AMZ_ID) { abInc(c, 'amazon_comparison_recovered'); abInc(c, 'amazon_' + reason); }
    abEx(reason, { store: slugOf.get(obs[i].store_id), cat: c, title: obs[i].raw_name.slice(0, 80), v1_key: v1[i].key, v2_key: v2[i].key });
  }
  // best-price effect, per world1 comparison, SAME prices: cheapest member vs cheapest member that survives in world2
  for (const g of w1Groups) {
    const c = catOf(g.members[0]); const cheapest = g.members.reduce((a, b) => (obs[b].price! < obs[a].price! || (obs[b].price === obs[a].price && obs[b].store_id < obs[a].store_id)) ? b : a);
    const survivors = g.members.filter(i => inC2.has(i));
    const vd = verdictOf.get(cheapest);
    if (vd === 'reject') { abInc(c, 'false_best_price_removed_by_identity'); abEx('false_best_price', { cat: c, store: slugOf.get(obs[cheapest].store_id), price: obs[cheapest].price, title: obs[cheapest].raw_name.slice(0, 80), key: g.key }); if (obs[cheapest].store_id === AMZ_ID) abInc(c, 'amazon_false_best_removed'); }
    else if (vd === 'review') abInc(c, 'unverified_best_price_demoted_to_reference');
    if (survivors.length < 2) { abInc(c, 'comparison_lost_by_identity'); continue; }
    const best2 = Math.min(...survivors.map(i => obs[i].price!));
    if (best2 !== obs[cheapest].price) { abInc(c, 'best_price_changed_attributable_to_identity'); abInc(c, 'best_price_delta_sar_x100', Math.round((best2 - obs[cheapest].price!) * 100)); }
  }
  for (const [k, g] of Object.entries(AB)) if (g.best_price_delta_sar_x100 != null) { g.best_price_delta_sar_total = g.best_price_delta_sar_x100 / 100; delete g.best_price_delta_sar_x100; void k; }
  // unsafe identities removed: v1 keys shared by ≥2 stores whose v2 verdict rejects ≥1 member
  const unsafeRemoved: Record<string, number> = {};
  for (const g of v2Shared) if (g.rejected.length) inc(unsafeRemoved, g.category);

  const out = { generated_at: new Date().toISOString(), window_days: DAYS, label: 'SHADOW (offline replay of production observations; no DB write; user-visible comparison untouched)', stores: stores.map((s: any) => s.slug), observations: obs.length, identity_diff: diff, identity_diff_by_category: byCat, merge_to_split: mergeToSplit.length, merge_to_split_examples: mergeToSplit.slice(0, 15).map(([k, s]) => `${k} ⇒ ${[...s].join(' / ')}`), split_to_merge: splitToMerge.length, split_to_merge_examples: splitToMerge.slice(0, 15).map(([k, s]) => `${k} ⇐ ${[...s].join(' / ')}`), brand_changes: brandChanges, shared_identities_v1: sharedV1.size, shared_identities_v2_proposed: v2Shared.length, shared_identities_v2_verified: v2Shared.filter(g => new Set(g.kept.map(i => obs[i].store_id)).size >= 2).length, newly_shared_verified: newlyShared.length, newly_shared_examples: newlyShared.slice(0, 25).map(g => ({ key: g.key, stores: g.kept.map(i => slugOf.get(obs[i].store_id)), names: g.kept.map(i => obs[i].raw_name.slice(0, 60)) })), previously_shared_lost: sharedLost.length, previously_shared_lost_examples: sharedLost.slice(0, 15), verifier_verdicts_on_shared_members: verdicts, conflict_classes: conflictClasses, review_classes: reviewClasses, class_examples: classExamples, commercial_impact: impact, commercial_examples: examples, amazon, by_category: byCatShared, lost_identity_examples: lostExamples, key_changed_examples: changedExamples, commercial_ab: AB, commercial_ab_examples: abExamples, unsafe_identities_removed_by_category: unsafeRemoved };
  fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ identity_diff: diff, merge_to_split: mergeToSplit.length, split_to_merge: splitToMerge.length, shared_v1: sharedV1.size, shared_v2_proposed: v2Shared.length, shared_v2_verified: out.shared_identities_v2_verified, newly_shared_verified: newlyShared.length, previously_shared_lost: sharedLost.length, verdicts, conflictClasses, reviewClasses, impact, amazon }, null, 1));
  console.log('written', OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
