// Backfill Extra storefront product images from Extra's Unbxd search API (verified media.extra.com
// images, matched by SKU=uniqueId). No Puppeteer, no invention. Founder priority 2. --go to apply.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const KEY = '21705619e273429e5767eea44ccb1ad5';
const SITE = 'ss-unbxd-auk-extra-saudi-en-prod11541714990488';
const TERMS = ['refrigerator', 'washing machine', 'dishwasher', 'freezer', 'air conditioner', 'television',
  'microwave', 'oven', 'blender', 'vacuum', 'water heater', 'laptop', 'mobile', 'tablet', 'headphone',
  'monitor', 'printer', 'camera', 'smartwatch', 'cooker', 'dryer', 'kitchen'];

async function unbxd(term, start) {
  const url = `https://search.unbxd.io/${KEY}/${SITE}/search?q=${encodeURIComponent(term)}&rows=100&start=${start}&format=json&fields=uniqueId,imageUrl,productUrl`;
  const r = await fetch(url); return r.json();
}

(async () => {
  const GO = process.argv.includes('--go');
  const bySku = new Map();
  for (const term of TERMS) {
    for (let start = 0; start < 200; start += 100) {
      let d; try { d = await unbxd(term, start); } catch { break; }
      const prods = (d.response && d.response.products) || [];
      for (const p of prods) {
        const sku = String(p.uniqueId || '');
        let img = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
        if (sku && img && /^https?:/.test(img) && !bySku.has(sku)) bySku.set(sku, String(img));
      }
      if (prods.length < 100) break;
    }
  }
  console.log('extra sku->image collected:', bySku.size);

  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  const rows = (await c.query(`select p.id, (regexp_match(ps.product_url,'/p/([A-Za-z0-9]+)'))[1] sku
    from product_stores ps join products p on p.id=ps.product_id
    where ps.store_id=4 and p.is_active and (p.image_url is null or p.image_url='')`)).rows;
  let n = 0, ok = 0;
  for (const r of rows) { const img = r.sku && bySku.get(r.sku); if (!img) continue; n++; if (GO) { try { await c.query(`update products set image_url=$1, image_urls=to_jsonb(array[$1::text]) where id=$2`, [img, r.id]); ok++; } catch {} } }
  console.log(`extra products matched to an image: ${n}${GO ? ` (APPLIED ${ok})` : ' (dry)'}`);
  await c.end();
})().catch(e => { console.error(e.code || e.message); process.exit(1); });
