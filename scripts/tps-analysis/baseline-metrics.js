// Before/after product-quality baseline (Founder product-recovery directive 2026-07-27).
// One connection, sequential. Outputs the founder's measured set per core category. Save the output
// to compare before vs after each fix.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const ACTIVE = [1, 2, 3, 4, 5, 23, 24];
const A = new Set(['amazon','أمازون','أمازون السعودية','noon','نون','jarir','جرير','مكتبة جرير','extra','اكسترا','إكسترا','almanea','المنيع','swsg','الشتاء والصيف','lulu','لولو هايبر ماركت','sharafdg','شرف دي جي']);
const arabicPct = `round(100.0*count(distinct p.id) filter (where p.name_ar ~ '[\\u0600-\\u06FF]' and p.name_ar !~ '[A-Za-z]{4,}')/nullif(count(distinct p.id),0))`;

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  const q = (s, p) => c.query(s, p).then(r => r.rows);
  console.log('SNAPSHOT', new Date().toISOString());

  console.log('\n=== A. storefront product-quality per category (visible / img% / spec% / arabicTitle% / brand%) ===');
  console.table(await q(`
    select p.category,
      count(distinct p.id) products,
      round(100.0*count(distinct p.id) filter (where p.image_url is not null and p.image_url<>'')/nullif(count(distinct p.id),0)) img_pct,
      round(100.0*count(distinct p.id) filter (where p.specifications is not null and p.specifications::text not in ('{}','null','[]'))/nullif(count(distinct p.id),0)) spec_pct,
      ${arabicPct} ar_title_pct,
      round(100.0*count(distinct p.id) filter (where p.brand is not null and p.brand<>'' and lower(p.brand)<>'unknown')/nullif(count(distinct p.id),0)) brand_pct
    from products p join product_stores ps on ps.product_id=p.id
    where ps.store_id = any($1) and p.is_active group by p.category order by products desc`, [ACTIVE]));

  console.log('\n=== B. per-retailer: distinct products, offers, fresh-price%, valid-URL% ===');
  console.table(await q(`
    select ps.store_id,
      count(distinct p.id) products,
      count(*) offers,
      round(100.0*count(*) filter (where ps.last_checked_at>now()-interval '48 hours' or ps.updated_at>now()-interval '48 hours')/nullif(count(*),0)) fresh_pct,
      round(100.0*count(*) filter (where ps.product_url ~ '/(dp|p|product)/|jarir\\.com/sa')/nullif(count(*),0)) url_pct
    from product_stores ps join products p on p.id=ps.product_id where ps.store_id=any($1) and p.is_active group by ps.store_id order by ps.store_id`, [ACTIVE]));

  console.log('\n=== C. canonical + comparison depth ===');
  const ph = await q(`select cp.category, ph.canonical_product_id cid, ph.store_name sn from price_history ph join canonical_products cp on cp.id=ph.canonical_product_id and cp.is_active`);
  const canon = new Map();
  for (const r of ph) { if (!A.has((r.sn || '').trim())) continue; if (!canon.has(r.cid)) canon.set(r.cid, { cat: r.category, s: new Set() }); canon.get(r.cid).s.add((r.sn || '').trim()); }
  let two = 0, three = 0; const byCat = {};
  for (const [, v] of canon) { const n = v.s.size; const cat = v.cat || 'other'; byCat[cat] = byCat[cat] || { c: 0, two: 0 }; byCat[cat].c++; if (n >= 2) { two++; byCat[cat].two++; } if (n >= 3) three++; }
  const totalCanon = (await q(`select count(*) n from canonical_products where is_active`))[0].n;
  console.log(`active canonicals: ${totalCanon} | comparable(>=2 approved): ${two} | (>=3): ${three}`);
  console.table(Object.fromEntries(Object.entries(byCat).sort((a, b) => b[1].two - a[1].two).slice(0, 14).map(([k, v]) => [k, `${v.two} comparable / ${v.c} canon`])));

  await c.end();
})().catch(e => { console.error(e.code || e.message); process.exit(1); });
