// Read-only PDP validation of the independently frozen finder universe.
// Resumable evidence, never a database writer.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { SamsungKsaScraper } from '../../src/lib/scraping/stores/samsung-ksa-scraper';

async function main() {
  const input = process.argv[2] || 'docs/evidence/samsung-recovery-finder-2026-09-16.json';
  const output = process.argv[3] || 'docs/evidence/samsung-recovery-pdps-2026-09-16.json';
  const source = JSON.parse(readFileSync(input, 'utf8'));
  const evidence = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : { startedAt: new Date().toISOString(), input, rows: [] };
  const done = new Set(evidence.rows.map((r: { model: string; url: string }) => `${r.model}|${r.url}`));
  const scraper = new SamsungKsaScraper();
  for (const item of source.products) {
    const observation = item.observations.find((o: { site: string }) => o.site === 'sa_en') || item.observations[0];
    // pdpUrl can point to a family marketing page; originPdpUrl is the variant.
    const url = new URL(observation.originPdpUrl || observation.pdpUrl, 'https://www.samsung.com').href;
    if (done.has(`${item.model}|${url}`)) continue;
    const row: Record<string, unknown> = { model: item.model, type: observation.type, url, observedAt: new Date().toISOString() };
    try {
      const product = await scraper.updateProductPrice(url);
      row.product = product;
      row.identityMatches = product?.sku?.toUpperCase() === item.model.toUpperCase();
      row.finderCurrentPrice = Number(observation.promotionPrice || observation.price) || null;
      row.priceMatches = product?.current_price === row.finderCurrentPrice;
    } catch (error) { row.error = error instanceof Error ? error.message : String(error); }
    evidence.rows.push(row);
    evidence.updatedAt = new Date().toISOString();
    writeFileSync(output, JSON.stringify(evidence, null, 2));
    console.log(`${evidence.rows.length}/${source.products.length}`, item.model, row.error || (row.identityMatches ? 'IDENTIFIED' : 'IDENTITY_MISMATCH'));
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
