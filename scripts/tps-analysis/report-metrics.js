// READ-ONLY: gather Product Readiness Report metrics per active retailer.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const ACTIVE = { 1: 'jarir', 2: 'amazon', 3: 'noon', 4: 'extra', 5: 'almanea', 23: 'lulu', 24: 'sharafdg' };
const APPROVED = new Set(['amazon','أمازون','أمازون السعودية','noon','نون','jarir','جرير','مكتبة جرير','extra','اكسترا','إكسترا','almanea','المنيع','swsg','الشتاء والصيف','lulu','لولو هايبر ماركت','sharafdg','شرف دي جي']);

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = (s, p) => c.query(s, p).then(r => r.rows);

  console.log('=== per-retailer funnel (customer-visible storefront) ===');
  console.table(await q(`
    select ps.store_id,
      count(distinct p.id) products,
      count(*) filter (where p.image_url is not null) with_image,
      count(*) filter (where ps.current_price > 0) with_price,
      count(*) filter (where ps.availability='in_stock') in_stock,
      count(*) filter (where ps.updated_at > now() - interval '48 hours') fresh_48h,
      count(*) filter (where ps.product_url ~ '/(dp|p|product)/') has_clean_url
    from product_stores ps join products p on p.id=ps.product_id
    where ps.store_id = any($1) and p.is_active group by ps.store_id order by ps.store_id`,
    [Object.keys(ACTIVE).map(Number)]));

  console.log('\n=== category distribution (customer-visible) ===');
  console.table(await q(`
    select p.category, count(distinct p.id) n from product_stores ps join products p on p.id=ps.product_id
    where ps.store_id = any($1) and p.is_active group by 1 order by 2 desc`, [Object.keys(ACTIVE).map(Number)]));

  console.log('\n=== TPS comparisons: canonicals with >=N APPROVED stores ===');
  const ph = await q(`select canonical_product_id, store_name, cp.category from price_history ph join canonical_products cp on cp.id=ph.canonical_product_id where cp.is_active`);
  const byCanon = new Map();
  for (const r of ph) { if (!APPROVED.has((r.store_name||'').trim())) continue; if (!byCanon.has(r.canonical_product_id)) byCanon.set(r.canonical_product_id, { s: new Set(), cat: r.category }); byCanon.get(r.canonical_product_id).s.add((r.store_name||'').trim()); }
  let two = 0, three = 0, one = 0; const byCat = {};
  for (const [, v] of byCanon) { const n = v.s.size; if (n >= 3) three++; if (n >= 2) { two++; byCat[v.cat] = (byCat[v.cat]||0)+1; } else one++; }
  console.log(`canonicals (approved-store): >=2 stores = ${two}, >=3 stores = ${three}, single-store = ${one}`);
  console.log('>=2-store comparisons by category:', JSON.stringify(byCat));

  console.log('\n=== duplicates: (product_id, store_id) offer rows vs distinct ===');
  console.table(await q(`select count(*) rows, count(distinct (product_id,store_id)) distinct_offers from product_stores where store_id=any($1)`, [Object.keys(ACTIVE).map(Number)]));

  console.log('\n=== image coverage overall (visible) ===');
  console.table(await q(`select count(distinct p.id) visible, count(distinct p.id) filter (where p.image_url is not null) with_image from product_stores ps join products p on p.id=ps.product_id where ps.store_id=any($1) and p.is_active`, [Object.keys(ACTIVE).map(Number)]));

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
