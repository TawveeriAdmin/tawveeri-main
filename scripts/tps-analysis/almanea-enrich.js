// Backfill Almanea storefront products with VERIFIED retailer Arabic names + images from the
// Almanea Algolia feed (matched by SKU). No invention: name_ar and image come straight from the
// retailer's own catalogue. Founder priorities 2 (images) + 4 (Arabic titles). Default DRY; --go applies.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const CFG = { appId: 'WCK19QC65I', apiKey: 'be7745237f5f94f715b088f48b1708b8', index: 'prod_headless_ar_products' };
const isArabic = (s) => /[؀-ۿ]/.test(s || '') && !/[A-Za-z]{4,}/.test(s || '');

// The search key can't browse; query multiple category terms (each up to the 1000 cap) to cover the
// whole storefront's categories. Empty query = top-1000; the terms pull deeper category subsets.
const TERMS = ['', 'جوال', 'ايفون', 'سامسونج', 'لابتوب', 'تابلت', 'ايباد', 'تلفزيون', 'شاشة', 'سماعة',
  'ثلاجة', 'فريزر', 'غسالة', 'نشافة', 'مكيف', 'مايكروويف', 'فرن', 'مكنسة', 'خلاط', 'قلاية', 'ساعة', 'كاميرا', 'طابعة'];
async function query(term, page) {
  const res = await fetch(`https://${CFG.appId}-dsn.algolia.net/1/indexes/${CFG.index}/query`, {
    method: 'POST', headers: { 'X-Algolia-Application-Id': CFG.appId, 'X-Algolia-API-Key': CFG.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ params: `hitsPerPage=1000&page=${page}&query=${encodeURIComponent(term)}` }),
  });
  return res.json();
}

(async () => {
  const GO = process.argv.includes('--go');
  // 1) Build SKU -> {name_ar, image} across many category queries.
  const bySku = new Map();
  for (const term of TERMS) {
    for (let page = 0; page < 2; page++) {
      const d = await query(term, page);
      const hits = d.hits || [];
      for (const h of hits) {
        const sku = String(h.sku || (String(h.url || '').match(/p-(\d+)/) || [])[1] || '');
        if (!sku) continue;
        const img = h.image_url || h.thumbnail_url || null;
        if (!bySku.has(sku)) bySku.set(sku, { name_ar: isArabic(h.name) ? h.name.trim() : null, image: img && /^https?:/.test(img) ? String(img) : null });
      }
      if (hits.length < 1000) break;
    }
  }
  console.log(`feed SKUs collected: ${bySku.size}`);

  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  const rows = (await c.query(`
    select p.id, p.name_ar, p.image_url, ps.product_url,
           (regexp_match(ps.product_url, 'p-([0-9]{6,})'))[1] sku
    from product_stores ps join products p on p.id=ps.product_id where ps.store_id=5 and p.is_active`)).rows;

  let matched = 0, willName = 0, willImg = 0;
  const updates = [];
  for (const r of rows) {
    const f = r.sku && bySku.get(r.sku);
    if (!f) continue;
    matched++;
    const needName = f.name_ar && (!r.name_ar || !isArabic(r.name_ar));
    const needImg = f.image && (!r.image_url || r.image_url === '');
    if (needName) willName++;
    if (needImg) willImg++;
    if (needName || needImg) updates.push({ id: r.id, name_ar: needName ? f.name_ar : null, image: needImg ? f.image : null });
  }
  console.log(`storefront almanea: ${rows.length} | SKU-matched to feed: ${matched} | will set arabic name: ${willName} | will set image: ${willImg}`);

  if (GO && updates.length) {
    let ok = 0, fail = 0;
    for (const u of updates) {
      try {
        // Image-only update is the safe majority; do it first. Skip name_ar if it would collide (trigger/slug).
        if (u.image) await c.query(`update products set image_url=$1, image_urls=to_jsonb(array[$1::text]) where id=$2`, [u.image, u.id]);
        if (u.name_ar) { try { await c.query(`update products set name_ar=$1 where id=$2`, [u.name_ar, u.id]); } catch { /* skip name collision */ } }
        ok++;
      } catch (e) { fail++; }
    }
    console.log(`APPLIED: ${ok} product image updates (${fail} failed).`);
  } else if (updates.length) console.log('(dry run — pass --go)');
  await c.end();
})().catch(e => { console.error(e.code || e.message); process.exit(1); });
