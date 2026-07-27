// Deep product-layer quality audit across the focus categories (Founder directive 2026-07-27).
// Measures, per category: customer-visible products, image %, brand %, model-number %, title quality,
// spec availability, and comparison coverage. READ-ONLY, single connection.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const ACTIVE = [1, 2, 3, 4, 5, 23, 24];

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  const q = (s, p) => c.query(s, p).then(r => r.rows);

  // does products have a specifications column?
  const cols = (await q(`select column_name from information_schema.columns where table_name='products'`)).map(r => r.column_name);
  const hasSpecs = cols.includes('specifications');
  console.log('products columns of interest:', cols.filter(x => /spec|model|image|title|name|brand|slug/.test(x)).join(', '));

  console.log('\n=== per-category product-quality (customer-visible, active stores) ===');
  console.table(await q(`
    select p.category,
      count(distinct p.id) products,
      round(100.0*count(distinct p.id) filter (where p.image_url is not null and p.image_url<>'')/nullif(count(distinct p.id),0)) img_pct,
      round(100.0*count(distinct p.id) filter (where p.brand is not null and p.brand<>'' and lower(p.brand)<>'unknown')/nullif(count(distinct p.id),0)) brand_pct,
      round(avg(length(coalesce(p.name_en,p.name_ar)))) avg_title_len
      ${hasSpecs ? `, round(100.0*count(distinct p.id) filter (where p.specifications is not null and p.specifications::text not in ('{}','null','[]'))/nullif(count(distinct p.id),0)) spec_pct` : ''}
    from products p join product_stores ps on ps.product_id=p.id
    where ps.store_id = any($1) and p.is_active
    group by p.category order by products desc`, [ACTIVE]));

  console.log('\n=== canonical/comparison coverage per category (approved-store) ===');
  const A = new Set(['amazon','أمازون','أمازون السعودية','noon','نون','jarir','جرير','مكتبة جرير','extra','اكسترا','إكسترا','almanea','المنيع','swsg','الشتاء والصيف','lulu','لولو هايبر ماركت','sharafdg','شرف دي جي']);
  const ph = await q(`select cp.category, ph.canonical_product_id cid, ph.store_name sn from price_history ph join canonical_products cp on cp.id=ph.canonical_product_id and cp.is_active`);
  const byCat = {};
  const canon = new Map();
  for (const r of ph) { if (!A.has((r.sn || '').trim())) continue; const k = r.cid; if (!canon.has(k)) canon.set(k, { cat: r.category, s: new Set() }); canon.get(k).s.add((r.sn || '').trim()); }
  for (const [, v] of canon) { const cat = v.cat || 'other'; byCat[cat] = byCat[cat] || { total: 0, multi: 0 }; byCat[cat].total++; if (v.s.size >= 2) byCat[cat].multi++; }
  console.table(Object.fromEntries(Object.entries(byCat).sort((a, b) => b[1].multi - a[1].multi).map(([k, v]) => [k, `${v.multi} comparisons / ${v.total} canonicals`])));

  // model-number coverage (specs proxy) from canonical layer
  console.log('\n=== canonical model_number coverage (specs proxy) ===');
  console.table(await q(`select category, count(*) canon, round(100.0*count(*) filter (where model_number is not null and model_number<>'')/nullif(count(*),0)) model_pct from canonical_products where is_active group by category order by canon desc limit 12`));
  await c.end();
})().catch(e => { console.error(e.code || e.message); process.exit(1); });
