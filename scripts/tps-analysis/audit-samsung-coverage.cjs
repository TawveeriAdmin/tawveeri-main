/* Read-only Samsung production snapshot. No credentials are written to artifacts. */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('vyceqrzttspyycdpojtn')) throw new Error('Unexpected database');
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  const result = { measured_at: new Date().toISOString(), database: 'vyceqrzttspyycdpojtn', queries: {} };
  const queries = {
    store: "select id,name,slug from stores where slug='samsung_ksa'",
    legacy_counts: `select count(*) offers,count(distinct product_id) products,count(distinct product_url) urls,max(last_scraped_at) last_scraped,max(updated_at) last_updated from product_stores where store_id=6`,
    legacy_categories: `select p.category,count(distinct p.id) products,count(*) offers,count(distinct p.id) filter(where p.canonical_product_id is not null) linked_products from product_stores ps join products p on p.id=ps.product_id where ps.store_id=6 group by p.category order by p.category`,
    completeness: `with p as (select distinct p.* from products p join product_stores ps on ps.product_id=p.id where ps.store_id=6) select count(*) denominator,count(*) filter(where nullif(name_ar,'') is not null or nullif(name_en,'') is not null) named,count(*) filter(where nullif(image_url,'') is not null) imaged,count(*) filter(where nullif(brand,'') is not null) branded,count(*) filter(where nullif(model,'') is not null) modelled,count(*) filter(where specifications is not null and specifications <> '{}'::jsonb) specifications_present,count(*) filter(where canonical_product_id is not null) linked from p`,
    offers: `select category,status,count(*) offers,count(distinct identity_key) identities,min(observed_at) oldest,max(observed_at) newest,count(*) filter(where url like '%?%') with_query from tps_current_offers where store_id=6 group by category,status order by category,status`,
    runs: `select id,run_type,status,products_discovered,products_new,products_updated,products_failed,started_at,finished_at,error_message,job_type from scraping_runs where store_id=6 or store_name='samsung_ksa' order by started_at desc limit 50`,
    delta_runs: 'select * from samsung_delta_watch_runs order by started_at desc limit 20',
    baseline: `select category,classification,lifecycle_state,count(*) urls,count(distinct identity_key) identities from samsung_official_url_baseline group by category,classification,lifecycle_state order by classification,category`,
    baseline_links: `select b.category,count(distinct b.identity_key) identities,count(distinct b.identity_key) filter(where exists(select 1 from canonical_products cp where cp.tps_identity_key=b.identity_key and cp.is_active)) active_canonicals,count(distinct b.identity_key) filter(where exists(select 1 from tps_current_offers o where o.identity_key=b.identity_key and o.store_id=6 and o.status='valid')) valid_offers from samsung_official_url_baseline b where classification='CURRENT_VALID_PRODUCT' group by b.category order by b.category`,
    job_state: "select * from tps_job_state where job='samsung-delta-watch'",
    sample: `select category,identity_key,price,url,name,observed_at from tps_current_offers where store_id=6 and status='valid' and price>0 order by random() limit 10`,
    query_urls: "select url from tps_current_offers where store_id=6 and url like '%?%'",
  };
  try {
    await c.connect();
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for (const [name, sql] of Object.entries(queries)) {
      result.queries[name] = { sql, rows: (await c.query(sql)).rows };
      console.log(name, JSON.stringify(result.queries[name].rows).slice(0, 6000));
    }
    await c.query('COMMIT');
    fs.writeFileSync(process.argv[2] || 'docs/evidence/samsung-coverage-before-2026-09-16.json', JSON.stringify(result, null, 2) + '\n');
  } finally { await c.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
