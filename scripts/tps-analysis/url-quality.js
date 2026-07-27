require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = (s,p)=>c.query(s,p).then(r=>r.rows);
  console.log('jarir market segments:');
  console.table(await q(`select substring(product_url from 'jarir\\.com/([a-z]{2}-[a-z]{2})') as market, count(*) n, count(distinct product_url) distinct_urls from product_stores where store_id=1 group by 1 order by 2 desc`));
  console.log('jarir rows vs distinct urls:');
  console.table(await q(`select count(*) rows, count(distinct product_url) distinct_urls, count(distinct product_id) distinct_products from product_stores where store_id=1`));
  console.log('amazon clean /dp/ coverage:');
  console.table(await q(`select count(*) filter (where product_url ~ '/dp/[A-Z0-9]{10}') has_dp, count(*) total from product_stores where store_id=2`));
  console.log('extra clean /p/ coverage:');
  console.table(await q(`select count(*) filter (where product_url ~ '/p/[A-Za-z0-9]+$') clean_p, count(*) total from product_stores where store_id=4`));
  console.log('almanea clean /en/product/p- coverage:');
  console.table(await q(`select count(*) filter (where product_url like '%/en/product/p-%') clean, count(*) total from product_stores where store_id=5`));
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
