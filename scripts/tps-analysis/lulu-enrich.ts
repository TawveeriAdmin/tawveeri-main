import { config } from 'dotenv'; config({ path: '.env.local' });
process.env.PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const GO = process.argv.includes('--go');
(async () => {
  const { LuluScraper } = await import('../../src/lib/scraping/stores/lulu-scraper');
  const { Client } = await import('pg'); const { toPoolerDbUrl } = require('../tps-core/pooler-url');
  const s: any = new LuluScraper();
  const cats = ['smartphone','laptop','tv','tablet','audio','wearable','kitchen','appliance','monitor'];
  const bySku = new Map<string, string>();
  for (const cat of cats) {
    try { const prods = await s.discoverProducts(cat, 2);
      for (const p of prods) { const img = (p.image_urls||[])[0]; if (p.sku && img) if(!bySku.has(p.sku)) bySku.set(p.sku, img); }
    } catch {}
  }
  console.log('lulu sku->image collected:', bySku.size);
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 }); await c.connect();
  const rows = (await c.query(`select p.id, (regexp_match(ps.product_url,'/p/([0-9]+)'))[1] sku from product_stores ps join products p on p.id=ps.product_id where ps.store_id=23 and p.is_active and (p.image_url is null or p.image_url='')`)).rows;
  let n = 0;
  for (const r of rows) { const img = r.sku && bySku.get(r.sku); if (!img) continue; if (GO) { try { await c.query(`update products set image_url=$1, image_urls=to_jsonb(array[$1::text]) where id=$2`, [img, r.id]); } catch {} } n++; }
  console.log(`lulu products matched to an image: ${n}${GO ? ' (APPLIED)' : ' (dry)'}`);
  await c.end(); process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
