import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
import { SamsungKsaScraper } from '../../src/lib/scraping/stores/samsung-ksa-scraper';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
const { Client } = require('pg');

async function main() {
  const frozen = JSON.parse(readFileSync('docs/evidence/samsung-coverage-before-2026-09-16.json', 'utf8')).queries.sample.rows;
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const scraper = new SamsungKsaScraper();
  const result: any = { startedAt: new Date().toISOString(), sampling: 'Original frozen ORDER BY random() ten-row cohort; no reselection', rows: [] };
  try {
    for (const before of frozen) {
      const row: any = { before, measuredAt: new Date().toISOString() };
      try {
        row.source = await scraper.updateProductPrice(before.url);
        const identity = row.source?.sku ? `samsung|MODEL:${row.source.sku}` : before.identity_key;
        row.production = (await pg.query(`select identity_key,price,payload,observed_at,url,status from tps_current_offers
          where store_id=6 and identity_key=$1 and status='valid'`, [identity])).rows;
        const offer = row.production[0];
        row.currentPriceEqual = offer && row.source?.current_price != null ? Number(offer.price) === Number(row.source.current_price) : null;
        row.originalPriceEqual = offer && row.source ? (Number(offer.payload?._original_price) || null) === row.source.original_price : null;
        row.availabilityEqual = offer && row.source ? offer.payload?._availability === row.source.availability : null;
      } catch (error) { row.error = String(error); }
      result.rows.push(row);
      console.log(row.source?.sku, row.currentPriceEqual, row.availabilityEqual, row.error || '');
      writeFileSync('docs/evidence/samsung-recovery-live-prices-2026-09-16.json', JSON.stringify(result, null, 2));
    }
    result.completedAt = new Date().toISOString();
    result.summary = { tested: result.rows.length, currentPriceEqual: result.rows.filter((r: any) => r.currentPriceEqual).length,
      originalPriceEqual: result.rows.filter((r: any) => r.originalPriceEqual).length,
      availabilityEqual: result.rows.filter((r: any) => r.availabilityEqual).length, errors: result.rows.filter((r: any) => r.error).length };
    writeFileSync('docs/evidence/samsung-recovery-live-prices-2026-09-16.json', JSON.stringify(result, null, 2));
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
