import { writeFileSync } from 'fs';
import { SamsungKsaScraper } from '../../src/lib/scraping/stores/samsung-ksa-scraper';
async function main() {
  const urls = [
    'https://www.samsung.com/sa_en/lifestyle-tvs/the-frame/ls03d-55-inch-black-qa55ls03dauxsa/',
    'https://www.samsung.com/sa_en/audio-devices/soundbar/t400-black-hw-t400-zn/',
    'https://www.samsung.com/sa_en/audio-sound/others/samsung-type-c-earphones-black-eo-ic100bbegww/',
  ];
  const scraper = new SamsungKsaScraper();
  const evidence: any = { startedAt: new Date().toISOString(), rows: [] };
  for (const url of urls) {
    const row: any = { url, observedAt: new Date().toISOString() };
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'Mozilla/5.0' } });
      row.httpStatus = response.status; row.finalUrl = response.url;
      row.product = await scraper.updateProductPrice(url);
    } catch (error) { row.error = String(error); }
    evidence.rows.push(row);
  }
  evidence.completedAt = new Date().toISOString();
  writeFileSync('docs/evidence/samsung-recovery-legacy-source-recheck-2026-09-16.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence.rows.map((r: any) => ({ url: r.url, finalUrl: r.finalUrl, sku: r.product?.sku || null, error: r.error }))));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
