// Product Identity & Comparison Integrity Audit (Founder directive 2026-07-27) — v2.
// Uses the REAL per-store normalized observations (price_history.tps_observation_id →
// normalized_product_observations) behind each >=2-store canonical. Detects:
//  - FALSE MERGE: one canonical groups observations with >1 distinct identity_key OR conflicting
//    storage_gb / capacity (BTU/kg/L) — i.e. different variants shown as the same product.
//  - MISSED MATCH: >1 canonical sharing the SAME identity_key (same product split apart).
// READ-ONLY.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const APPROVED = new Set(['amazon','أمازون','أمازون السعودية','noon','نون','jarir','جرير','مكتبة جرير','extra','اكسترا','إكسترا','almanea','المنيع','swsg','الشتاء والصيف','lulu','لولو هايبر ماركت','sharafdg','شرف دي جي']);
const distinct = (a) => [...new Set(a.filter((x) => x != null && x !== ''))];
const btu = (s) => { const m = (s || '').toLowerCase().match(/(\d{4,5})\s*(btu|وحد)/); return m ? m[1] : null; };
const kg = (s) => { const m = (s || '').toLowerCase().match(/(\d{1,2})\s*(kg|كجم|كيلو)/); return m ? m[1] : null; };

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = (s) => c.query(s).then(r => r.rows);

  const rows = await q(`
    select ph.canonical_product_id cid, cp.name_en cname, cp.category,
           npo.store_id, npo.raw_name, npo.identity_key,
           (npo.normalized_payload->>'storage_gb') storage
    from price_history ph
    join canonical_products cp on cp.id = ph.canonical_product_id and cp.is_active
    join normalized_product_observations npo on npo.id = ph.tps_observation_id
    where ph.tps_observation_id is not null`);

  const byCanon = new Map();
  const keyToCanon = new Map(); // identity_key -> set of canonical ids (missed-match detector)
  for (const r of rows) {
    if (!APPROVED.has((r.store_id || '').trim())) continue;
    if (!byCanon.has(r.cid)) byCanon.set(r.cid, { cname: r.cname, cat: r.category, obs: [] });
    byCanon.get(r.cid).obs.push(r);
    if (r.identity_key) { if (!keyToCanon.has(r.identity_key)) keyToCanon.set(r.identity_key, new Set()); keyToCanon.get(r.identity_key).add(r.cid); }
  }

  let multi = 0; const falseMerges = []; const byCatTotal = {}, byCatBad = {};
  for (const [cid, g] of byCanon) {
    const stores = distinct(g.obs.map((o) => o.store_id));
    if (stores.length < 2) continue;
    multi++;
    const cat = g.cat || 'other'; byCatTotal[cat] = (byCatTotal[cat] || 0) + 1;
    const keys = distinct(g.obs.map((o) => o.identity_key));
    const storages = distinct(g.obs.map((o) => o.storage));
    const btus = distinct(g.obs.map((o) => btu(o.raw_name)));
    const kgs = distinct(g.obs.map((o) => kg(o.raw_name)));
    const conflicts = [];
    if (keys.length > 1) conflicts.push('keys=' + keys.length);
    if (storages.length > 1) conflicts.push('storage=' + storages.join('/'));
    if (btus.length > 1) conflicts.push('BTU=' + btus.join('/'));
    if (kgs.length > 1) conflicts.push('kg=' + kgs.join('/'));
    if (conflicts.length) {
      byCatBad[cat] = (byCatBad[cat] || 0) + 1;
      if (falseMerges.length < 25) falseMerges.push({ cat, conflicts: conflicts.join(' '), names: distinct(g.obs.map((o) => `${o.store_id}: ${(o.raw_name || '').slice(0, 34)}`)).slice(0, 4) });
    }
  }

  // Missed matches: same identity_key spread across >1 canonical
  const missed = [...keyToCanon.entries()].filter(([, s]) => s.size > 1);

  const totalBad = Object.values(byCatBad).reduce((a, b) => a + b, 0);
  console.log(`\n=== ${multi} >=2-store canonicals covered by normalized observations ===`);
  console.log(`FALSE MERGES: ${totalBad}  |  MISSED MATCHES (same identity_key in >1 canonical): ${missed.length}`);
  console.log('\nfalse merges by category (bad/total):');
  for (const cat of Object.keys(byCatTotal).sort((a, b) => (byCatBad[b] || 0) - (byCatBad[a] || 0))) console.log(`  ${cat.padEnd(18)} ${byCatBad[cat] || 0} / ${byCatTotal[cat]}`);
  console.log('\nsample false merges:');
  falseMerges.forEach(f => { console.log(`  [${f.cat}] ${f.conflicts}`); f.names.forEach(n => console.log('       •', n)); });
  console.log('\nsample missed matches (same identity_key, multiple canonicals):');
  missed.slice(0, 8).forEach(([k, s]) => console.log(`  ${k}  → ${s.size} canonicals`));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
