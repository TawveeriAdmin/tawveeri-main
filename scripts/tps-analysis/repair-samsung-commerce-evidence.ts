/** Dry by default. Replay only missing Samsung normalized evidence, then append
 * proven current-price events omitted by the old two-pass change detector. */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
import { corroboratePass } from '../tps-core/progressive-engine';
import { CATEGORY_DEFS } from '../tps-core/category-registry';
import { guardSamsungConnections } from '../tps-core/samsung-connection-guard';
const { Client } = require('pg');
async function main() {
  const apply = process.argv.includes('--apply');
  const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
  const keys = source.models.filter((m: any) => !m.exclusion && m.identity).map((m: any) => m.identity.key);
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, keepAlive: true });
  await pg.connect();
  const guard = guardSamsungConnections([pg]);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const result: any = { startedAt: new Date().toISOString(), apply };
  const file = `docs/evidence/samsung-recovery-commerce-repair-${Date.now()}.json`;
  const save = () => writeFileSync(file, JSON.stringify(result, null, 2));
  try {
    if (apply && !(await pg.query('select pg_try_advisory_lock($1) ok', [8148148])).rows[0].ok) throw new Error('Normalizer lane occupied');
    const rows = (await pg.query(`select o.*,c.id canonical_id from tps_current_offers o
      join canonical_products c on c.tps_identity_key=o.identity_key and c.category=o.category
      where o.store_id=6 and o.status='valid' and o.identity_key=any($1::text[])
      and not exists(select 1 from normalized_product_observations n where n.canonical_product_id=c.id and n.store_id='6')`, [keys])).rows;
    if (rows.some((r: any) => r.identity_key !== 'samsung|MODEL:' + r.payload?._manufacturer_model)) throw new Error('Unverified manufacturer identity');
    result.replay = rows;
    result.canonicalsBefore = (await pg.query('select * from canonical_products where id=any($1::uuid[])', [rows.map((r: any) => r.canonical_id)])).rows;
    result.metrics = []; save();
    for (const category of new Set<string>(rows.map((r: any) => r.category))) {
      const sweepRows = rows.filter((r: any) => r.category === category).map((r: any) => ({ ...r,
        raw_obs_id: Number(r.raw_obs_id), price: r.price == null ? null : Number(r.price) }));
      const touched = sweepRows.map((r: any) => r.identity_key);
      const priorCurrentState = {};
      for (const singleStore of [false, true]) {
        guard.assertHealthy();
        result.metrics.push(await corroboratePass(sb, CATEGORY_DEFS[category], touched, { dry: !apply, singleStore, sweepRows, priorCurrentState }));
      }
      save();
    }
    // Point lookups by canonical/store; no unbounded observation-history replay.
    const candidates = (await pg.query(`select c.id canonical_id,c.model_number,o.price,o.observed_at,o.payload->>'_availability' availability,
      n.id observation_id,h.id previous_history_id,h.price previous_price,h.observed_at previous_observed_at
      from tps_current_offers o join canonical_products c on c.tps_identity_key=o.identity_key and c.category=o.category
      join normalized_product_observations n on n.canonical_product_id=c.id and n.store_id='6'
        and n.normalized_payload->>'_raw_id'=o.raw_obs_id::text
      join raw_observations r on r.id=o.raw_obs_id and r.scraped_at=o.observed_at
      left join lateral (select id,price,observed_at from price_history where canonical_product_id=c.id
        and (store_id=6 or store_name in ('سامسونج السعودية','samsung_ksa')) order by observed_at desc limit 1) h on true
      where o.store_id=6 and o.status='valid' and o.price>0 and o.identity_key=any($1::text[])
        and o.identity_key='samsung|MODEL:'||(o.payload->>'_manufacturer_model')
        and (h.id is null or (h.price<>o.price and h.observed_at<=o.observed_at))`, [keys])).rows;
    result.priceEventPlan = candidates; save();
    if (apply) {
      guard.assertHealthy(); await pg.query('BEGIN');
      result.appended = [];
      for (const r of candidates) {
        result.appended.push((await pg.query(`insert into price_history
          (canonical_product_id,store_id,store_name,price,availability,tps_observation_id,observed_at)
          values ($1,6,'سامسونج السعودية',$2,$3,$4,$5) returning id,canonical_product_id,price,observed_at`,
          [r.canonical_id, r.price, r.availability, r.observation_id, r.observed_at])).rows[0]);
      }
      await pg.query('COMMIT');
    }
    result.completedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ file, apply, replay: rows.length, plannedPrices: candidates.length, appended: result.appended?.length || 0, metrics: result.metrics }));
  } catch (error) { await pg.query('ROLLBACK').catch(() => {}); result.error = String(error); save(); throw error; }
  finally { guard.close(); await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
