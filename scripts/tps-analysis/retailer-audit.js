// One-off production read-only audit for the 27-retailer scope directive.
// READ-ONLY. Prints stores, active-offer counts, freshness, canonical contribution.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

(async () => {
  const client = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await client.connect();
  const q = (sql, p) => client.query(sql, p).then(r => r.rows);

  console.log('=== stores table (all rows) ===');
  const stores = await q(`select id, name, slug, category, coalesce(link,'') as link from stores order by id`);
  console.table(stores);

  console.log('\n=== product_stores: offers per store_id ===');
  const ps = await q(`
    select store_id,
           count(*) as offers,
           count(*) filter (where availability = 'in_stock') as in_stock,
           count(*) filter (where product_url is not null and product_url <> '') as has_url,
           max(updated_at)::date as last_update,
           count(*) filter (where updated_at > now() - interval '7 days') as fresh_7d,
           count(*) filter (where updated_at > now() - interval '30 days') as fresh_30d
    from product_stores group by store_id order by offers desc`);
  console.table(ps);

  console.log('\n=== products total + image coverage ===');
  console.table(await q(`select count(*) as products, count(*) filter (where image_url is not null) as with_image from products`));

  console.log('\n=== canonical layer ===');
  const hasCanon = await q(`select to_regclass('public.canonical_products') as t`);
  if (hasCanon[0].t) {
    console.table(await q(`select count(*) as canonicals from canonical_products`));
    console.log('\n=== price_history by store_name (canonical offers) ===');
    console.table(await q(`
      select store_name, count(*) as obs, count(distinct canonical_product_id) as canon,
             max(observed_at)::date as last_obs
      from price_history group by store_name order by obs desc limit 40`));
    console.log('\n=== canonicals with >=2 distinct stores (real comparisons) ===');
    console.table(await q(`
      select count(*) as multi_store_canonicals from (
        select canonical_product_id from price_history group by canonical_product_id having count(distinct store_name) >= 2
      ) x`));
  } else {
    console.log('(no canonical_products table)');
  }

  console.log('\n=== raw_observations by source/store (if present) ===');
  const hasRaw = await q(`select to_regclass('public.raw_observations') as t`);
  if (hasRaw[0].t) {
    const cols = await q(`select column_name from information_schema.columns where table_name='raw_observations'`);
    console.log('raw_observations columns:', cols.map(c => c.column_name).join(', '));
    // try store column
    const storeCol = cols.find(c => /store/i.test(c.column_name));
    if (storeCol) {
      console.table(await q(`select ${storeCol.column_name} as store, count(*) as n from raw_observations group by 1 order by 2 desc limit 40`));
    }
  } else console.log('(no raw_observations table)');

  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
