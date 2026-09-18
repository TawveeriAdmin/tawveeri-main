import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
const { Client } = require('pg');
async function main() {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, statement_timeout: 45000 });
  await pg.connect();
  const evidence: any = { at: new Date().toISOString(), scope: 'iPhone 18 Pro / Amazon; read only', results: {} };
  const queries = {
    canonicals: `select id,name_ar,name_en,model_number,category,tps_identity_key,attributes,is_active from canonical_products where category='mobile' and (name_en ilike '%iphone%18%' or name_ar ilike '%ايفون%18%')`,
    legacy: `select p.id,p.name_ar,p.name_en,p.canonical_product_id,ps.store_id,ps.current_price,ps.product_url,ps.availability,ps.last_scraped_at from products p join product_stores ps on ps.product_id=p.id where ps.store_id in (2,5) and (p.name_en ilike '%iphone%18%' or p.name_ar ilike '%ايفون%18%')`,
    current: `select * from tps_current_offers where store_id in (2,5) and category='mobile' and (identity_key ilike '%18%' or payload::text ilike '%iphone%18%')`,
    raw: `select id,store_id,scraped_at,raw_name,payload from raw_observations where store_id=2 and scraped_at>now()-interval '7 days' and (raw_name ilike '%iphone%18%' or raw_name ilike '%ايفون%18%') order by id desc limit 50`,
  };
  try {
    await pg.query('BEGIN READ ONLY');
    for (const [name, sql] of Object.entries(queries)) {
      try { await pg.query('SAVEPOINT inspection'); evidence.results[name] = (await pg.query(sql)).rows; }
      catch (error) { await pg.query('ROLLBACK TO SAVEPOINT inspection'); evidence.results[name] = { error: String(error) }; }
    }
    await pg.query('COMMIT');
    const response = await fetch('https://tawveeri.com/api/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'iPhone 18 Pro 256', pageSize: 20 }) });
    evidence.search = { status: response.status, data: await response.json() };
    writeFileSync('scratchpad/amazon-iphone18-before.json', JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ results: Object.fromEntries(Object.entries(evidence.results).map(([k,v]: any) => [k, Array.isArray(v) ? v.length : v])), searchStatus: response.status, products: evidence.search.data.products?.map((p:any)=>({name:p.name_en,key:p.tps_identity_key,price:p.current_price,stores:p.stores})) }));
  } finally { await pg.end(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
