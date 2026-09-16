import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { SamsungKsaScraper } from '../../src/lib/scraping/stores/samsung-ksa-scraper';
config({ path: '.env.local', quiet: true });

async function main() {
  const snapshot = JSON.parse(readFileSync('docs/evidence/samsung-coverage-before-2026-09-16.json', 'utf8'));
  const scraper = new SamsungKsaScraper();
  const rows = [];
  for (const row of snapshot.queries.sample.rows) {
    const observedAt = new Date().toISOString();
    try {
      const live = await scraper.updateProductPrice(row.url);
      rows.push({ ...row, measured_at: observedAt, live, price_equal: live?.current_price != null ? Number(row.price) === Number(live.current_price) : null });
      console.log(row.category, row.price, live?.current_price, live?.original_price);
    } catch (e) {
      rows.push({ ...row, measured_at: observedAt, error: String(e) });
    }
    writeFileSync('docs/evidence/samsung-price-sample-2026-09-16.json', JSON.stringify({ sampling: '10 rows ORDER BY random() from valid positive-priced Samsung TPS offers; frozen before fetching', rows }, null, 2) + '\n');
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
