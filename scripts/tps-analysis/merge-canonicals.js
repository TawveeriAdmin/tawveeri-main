// Fix missed matches / duplicate canonicals (Founder identity-integrity directive 2026-07-27) — v2.
// LIGHTWEIGHT: one read query, all grouping/impact computed IN MEMORY, then a few bulk updates.
// For each VALID observation identity_key mapping to >1 active canonical, fold the surplus canonicals
// into the primary (most offers): re-point price_history + deactivate surplus. Reversible.
// Default DRY RUN; pass --go to apply.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const APPROVED = new Set(['amazon','أمازون','أمازون السعودية','noon','نون','jarir','جرير','مكتبة جرير','extra','اكسترا','إكسترا','almanea','المنيع','swsg','الشتاء والصيف','lulu','لولو هايبر ماركت','sharafdg','شرف دي جي']);

(async () => {
  const GO = process.argv.includes('--go');
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();

  // ONE read: every canonical's observation identity_key + its approved store_names + offer count.
  const rows = (await c.query(`
    select npo.identity_key ikey, ph.canonical_product_id cid, ph.store_name sn
    from price_history ph join normalized_product_observations npo on npo.id = ph.tps_observation_id
    where npo.identity_key is not null and npo.identity_key_status='valid' and ph.canonical_product_id is not null`)).rows;

  // key -> canonical -> {offers, approvedStores:Set}
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.ikey)) byKey.set(r.ikey, new Map());
    const km = byKey.get(r.ikey);
    if (!km.has(r.cid)) km.set(r.cid, { offers: 0, stores: new Set() });
    const e = km.get(r.cid); e.offers++;
    const s = (r.sn || '').trim(); if (APPROVED.has(s)) e.stores.add(s);
  }

  const merges = []; // {primary, surplus:[cid], newComparison:bool}
  for (const [, km] of byKey) {
    if (km.size < 2) continue;
    const canons = [...km.entries()].sort((a, b) => b[1].offers - a[1].offers);
    const primary = canons[0][0];
    const surplus = canons.slice(1).map((x) => x[0]);
    const beforeStores = km.get(primary).stores.size;
    const afterStores = new Set([].concat(...canons.map((x) => [...x[1].stores]))).size;
    merges.push({ primary, surplus, newComparison: beforeStores < 2 && afterStores >= 2 });
  }
  const surplusIds = merges.flatMap((m) => m.surplus);
  const newComparisons = merges.filter((m) => m.newComparison).length;
  console.log(`merge groups: ${merges.length} | surplus canonicals to fold: ${surplusIds.length} | NEW >=2-store comparisons: ${newComparisons}`);

  if (GO && surplusIds.length) {
    // Build a VALUES map (surplus -> primary) and re-point in ONE statement, then deactivate in one.
    const pairs = merges.flatMap((m) => m.surplus.map((s) => [s, m.primary]));
    const values = pairs.map((_, i) => `($${i * 2 + 1}::uuid,$${i * 2 + 2}::uuid)`).join(',');
    const params = pairs.flat();
    const rep = await c.query(`update price_history ph set canonical_product_id = v.prim
      from (values ${values}) as v(surplus, prim) where ph.canonical_product_id = v.surplus`, params);
    const de = await c.query(`update canonical_products set is_active=false where id = any($1::uuid[])`, [surplusIds]);
    console.log(`APPLIED: re-pointed ${rep.rowCount} price_history rows; deactivated ${de.rowCount} surplus canonicals.`);
  } else if (surplusIds.length) {
    console.log('(dry run — pass --go to apply)');
  }
  await c.end();
})().catch(e => { console.error(e.code || e.message); process.exit(1); });
