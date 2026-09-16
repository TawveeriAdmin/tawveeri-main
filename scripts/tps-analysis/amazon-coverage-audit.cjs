// Read-only, Amazon-only production measurement. No credentials enter the artifact.
const fs = require('fs');
const path = require('path');
const pg = require('pg');
require('dotenv').config({ path: '.env.local', quiet: true });
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const queries = {
  totals: `select count(*) offer_rows, count(distinct product_id) products,
    count(distinct product_url) urls from product_stores where store_id=2`,
  completeness: `with p as (select distinct p.* from products p join product_stores ps
    on ps.product_id=p.id where ps.store_id=2)
    select category,count(*) products,
    count(*) filter(where canonical_product_id is not null) linked,
    count(*) filter(where coalesce(image_url,'')<>'') with_image,
    count(*) filter(where coalesce(brand,'') not in ('','Unknown','unknown')) known_brand,
    count(*) filter(where coalesce(specifications,'{}'::jsonb)<>'{}'::jsonb) with_specs
    from p group by category order by category`,
  currentOffers: `select category,status,count(*) offers,max(observed_at) latest
    from tps_current_offers where store_id=2 group by category,status order by category,status`,
  freshness: `select count(*) offers,
    count(*) filter(where last_scraped_at is null) never_pdp_scraped,
    count(*) filter(where last_scraped_at>=now()-interval '24 hours') pdp_scraped_24h,
    count(*) filter(where updated_at>=now()-interval '24 hours') updated_24h,
    count(*) filter(where current_price>0) priced,
    count(*) filter(where price_quarantined_at is not null) quarantined
    from product_stores where store_id=2`,
  cadence: `select date_trunc('day',started_at) as run_day,run_type,count(*) runs,
    count(*) filter(where status='success') successes,
    sum(products_discovered) discovered,sum(products_new) new,sum(products_updated) updated
    from scraping_runs where store_id=2 and started_at>now()-interval '7 days'
    group by 1,2 order by 1 desc,2`,
  latestRuns: `select id,store_name,status,run_type,started_at,finished_at,
    products_discovered,products_new,products_updated,products_failed
    from scraping_runs where store_id=2 order by started_at desc limit 15`,
  schedule: `select id,job_type,is_active,last_run_at,last_success_at
    from scraping_schedules where store_id=2`,
};

(async () => {
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw || new URL(raw).hostname !== 'db.vyceqrzttspyycdpojtn.supabase.co') {
    throw new Error('Refusing non-production database');
  }
  const output = path.resolve(process.argv[2] || 'scratchpad/amazon-coverage-audit.json');
  const evidence = { at: new Date().toISOString(), project: 'vyceqrzttspyycdpojtn', queries, results: {} };
  const client = new pg.Client({ connectionString: toPoolerDbUrl(raw),
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000, statement_timeout: 20000 });
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for (const [name, sql] of Object.entries(queries)) {
      evidence.results[name] = (await client.query(sql)).rows;
    }
    await client.query('COMMIT');
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify({ output, totals: evidence.results.totals }));
  } finally {
    await client.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
