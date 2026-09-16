import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
const { Client } = require('pg');

async function main() {
  const phase = process.argv.find(a => a.startsWith('--phase='))?.slice(8) || 'after';
  const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
  const models = source.models.filter((m: any) => !m.exclusion && m.identity).map((m: any) => ({ model: m.model, category: m.identity.category }));
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, statement_timeout: 45000 });
  await pg.connect();
  const result: any = { observedAt: new Date().toISOString(), phase, sourceCompletedAt: source.completedAt };
  try {
    const response = await fetch('https://tawveeri.com/api/debug/scheduler', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    result.runtime = { status: response.status, ...await response.json() };
    result.jobs = (await pg.query("select * from tps_job_state where job in ('samsung-delta-watch','reobserve','refresh')")).rows;
    result.runs = (await pg.query('select * from samsung_delta_watch_runs order by started_at desc limit 4')).rows;
    result.models = (await pg.query(`with expected as (select * from jsonb_to_recordset($1::jsonb) as e(model text,category text))
      select e.*,c.id canonical_id,c.is_active,c.category canonical_category,p.canonical_id projection_id,
        o.status,o.price,o.observed_at,o.url,o.raw_obs_id,o.payload->>'_availability' normalized_availability,
        coalesce(o.payload->>'_availability',raw.payload->>'availability') availability,
        o.payload->>'_original_price' original_price,
        (select count(*)::int from normalized_product_observations n where n.canonical_product_id=c.id) normalized_rows,
        (select count(distinct co.store_id)::int from tps_current_offers co where co.identity_key=c.tps_identity_key and co.status='valid'
          and co.price>0 and coalesce(co.payload->>'_availability','out_of_stock') in ('in_stock','limited_stock','pre_order')) purchasable_stores
      from expected e left join canonical_products c on c.tps_identity_key='samsung|MODEL:'||e.model
      left join tps_product_projection p on p.canonical_id=c.id
      left join tps_current_offers o on o.identity_key='samsung|MODEL:'||e.model and o.category=e.category and o.store_id=6
      left join raw_observations raw on raw.id=o.raw_obs_id`, [JSON.stringify(models)])).rows;
    result.categories = {};
    for (const row of result.models) {
      const count = result.categories[row.category] ??= { expected: 0, canonical: 0, active: 0, projection: 0, validOffer: 0, priced: 0, purchasable: 0, multiStore: 0 };
      count.expected++; count.canonical += Number(!!row.canonical_id); count.active += Number(row.is_active === true);
      count.projection += Number(!!row.projection_id); count.validOffer += Number(row.status === 'valid');
      count.priced += Number(row.price > 0); count.purchasable += Number(row.status === 'valid' && row.price > 0 && ['in_stock','limited_stock','pre_order'].includes(row.availability));
      count.multiStore += Number(row.purchasable_stores >= 2);
    }
    result.totals = Object.values(result.categories).reduce((sum: any, count: any) => {
      for (const key in count) sum[key] = (sum[key] || 0) + count[key]; return sum;
    }, {});
    result.legacy = (await pg.query(`select count(*)::int total,count(*) filter(where p.canonical_product_id is not null)::int linked,
      count(*) filter(where p.is_active)::int active from products p join product_stores ps on ps.product_id=p.id and ps.store_id=6`)).rows[0];
    result.completedAt = new Date().toISOString();
    writeFileSync(`docs/evidence/samsung-recovery-production-${phase}-2026-09-16.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ commit: result.runtime.commit, totals: result.totals, legacy: result.legacy,
      latestRun: result.runs[0] && { status: result.runs[0].status, started: result.runs[0].started_at, finished: result.runs[0].finished_at } }));
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
