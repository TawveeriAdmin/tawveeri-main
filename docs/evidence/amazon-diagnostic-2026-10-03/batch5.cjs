const fs = require('fs'); const pg = require('pg');
require('dotenv').config({ path: 'C:/Users/Hp/Downloads/Tawveeri-Official/.env.local', quiet: true });
const { toPoolerDbUrl } = require('C:/Users/Hp/Downloads/Tawveeri-Official/scripts/tps-core/pooler-url');
const OUT = process.argv[2];
const ELIG = (a) => `(${a}.price>0 and ${a}.observed_at>=now()-interval '168 hours' and coalesce(${a}.payload->>'_availability','')<>'out_of_stock')`;
const KEYS = `('apple|iPhone|15|Standard|128','apple|ipad air|m4|128|wifi|11','lenovo|idea tab|NO_GEN|256|wifi|11','beko|MODEL:DVN05420W','apple|iPhone|13|Pro Max|256')`;
const Q = {
  b_rows: `select o.identity_key, o.store_id, o.status, o.price, o.observed_at, o.raw_obs_id, o.confidence, (select string_agg(k, ',') from jsonb_object_keys(o.payload) k where k like '\\_%') meta_keys, o.payload->>'_superseded_by_identity' superseded, o.payload->>'_availability' avail, left(o.url, 70) url from tps_current_offers o where o.identity_key in ${KEYS} order by 1,2`,
  b_npo: `select n.identity_key, n.store_id, n.canonical_product_id, n.identity_key_status, n.observed_at, n.source_record_id from normalized_product_observations n where n.identity_key in ${KEYS} and n.store_id::text='2' order by observed_at desc limit 12`,
  b_canonicals: `select tps_identity_key, id, is_active, name_ar, model_number from canonical_products where tps_identity_key in ${KEYS}`,
  b_delist: `select d.* from tps_offer_delist_signals d join canonical_products c on c.id=d.canonical_product_id where c.tps_identity_key in ${KEYS}`,
  b_price_history_amz: `select c.tps_identity_key, count(*) n, max(ph.observed_at) last from price_history ph join canonical_products c on c.id=ph.canonical_product_id where c.tps_identity_key in ${KEYS} and ph.store_id=2 group by 1`,
  shared_keys_without_canonical: `with v as (select identity_key, store_id, price, observed_at, payload from tps_current_offers where status='valid'), k as (select identity_key from v group by 1 having bool_or(store_id=2) and bool_or(store_id in (4,5))) select count(*) shared_keys, count(*) filter (where not exists (select 1 from canonical_products c where c.tps_identity_key=k.identity_key)) no_canonical, count(*) filter (where not exists (select 1 from tps_product_projection p where p.tps_identity_key=k.identity_key)) no_projection, count(*) filter (where exists (select 1 from canonical_products c where c.tps_identity_key=k.identity_key and not c.is_active)) canonical_inactive from k`,
  amz_valid_null_price: `with v as (select identity_key, store_id, price, observed_at, payload from tps_current_offers where status='valid') select count(*) amz_valid_null_price, count(*) filter (where exists (select 1 from v r where r.identity_key=v.identity_key and r.store_id in (4,5) and ${ELIG('r')})) with_eligible_rival, count(*) filter (where coalesce(payload->>'_availability','')='out_of_stock') marked_oos from v where store_id=2 and not (price>0)`,
  amz_current_vs_canonical_mismatch: `with amz as (select o.identity_key, o.raw_obs_id from tps_current_offers o where o.store_id=2 and o.status='valid' and ${ELIG('o')}), riv as (select identity_key from tps_current_offers t where t.status='valid' and t.store_id in (4,5) and ${ELIG('t')} group by 1) select count(*) amz_elig_with_elig_rival, count(*) filter (where c.id is null) key_has_no_canonical, count(*) filter (where c.id is not null and n.canonical_product_id is not null and n.canonical_product_id<>c.id) amz_obs_linked_to_other_canonical, count(*) filter (where n.id is null) amz_obs_not_normalized from amz join riv using (identity_key) left join canonical_products c on c.tps_identity_key=amz.identity_key left join normalized_product_observations n on n.source_table='raw_observations' and n.source_record_id::text=amz.raw_obs_id::text`,
};
(async () => {
  const client = new pg.Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000, statement_timeout: 120000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const out = { captured_at: new Date().toISOString(), results: {} };
  for (const [k, sql] of Object.entries(Q)) {
    const t0 = Date.now(); await client.query('SAVEPOINT q');
    try { const { rows } = await client.query(sql); await client.query('RELEASE SAVEPOINT q'); out.results[k] = rows; console.log(`\n## ${k} (${Date.now() - t0} ms, ${rows.length} rows)`); for (const r of rows) console.log(JSON.stringify(r).slice(0, 330)); }
    catch (e) { await client.query('ROLLBACK TO SAVEPOINT q'); out.results[k] = { error: e.message }; console.log(`\n## ${k} ERROR ${e.message}`); }
  }
  await client.query('ROLLBACK'); await client.end();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
