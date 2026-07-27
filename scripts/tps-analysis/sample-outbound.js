// READ-ONLY: pull a representative product_url sample per active approved store for outbound testing.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

(async () => {
  const client = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await client.connect();
  const q = (sql, p) => client.query(sql, p).then(r => r.rows);
  // store_id -> slug for the 4 active approved retailers
  const stores = { 1: 'jarir', 2: 'amazon', 4: 'extra', 5: 'almanea' };
  const out = {};
  for (const [id, slug] of Object.entries(stores)) {
    // 12 evenly-sampled in-stock offers across the catalog, with the product name for match-checking
    const rows = await q(`
      select ps.product_url, p.name_en, p.name_ar, ps.current_price
      from product_stores ps join products p on p.id = ps.product_id
      where ps.store_id = $1 and ps.availability = 'in_stock' and ps.product_url is not null
      order by md5(ps.product_url) limit 12`, [Number(id)]);
    out[slug] = rows;
  }
  require('fs').writeFileSync(process.argv[2] || 'outbound-sample.json', JSON.stringify(out, null, 2));
  for (const k of Object.keys(out)) console.error(`${k}: ${out[k].length} urls`);
  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
