import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
(async () => {
  const { ScrapingOrchestrator } = await import('../src/lib/scraping/services/scraping-orchestrator');
  const orch = new ScrapingOrchestrator();
  const cases: [string, string][] = [
    ['noon', 'https://www.noon.com/saudi-en/galaxy-a17-dual-sim-4g-light-blue-4gb-ram-128gb-middle-east-version/N70214272V/p/'],
    ['lulu', 'https://gcc.luluhypermarket.com/en-sa/jbl-wireless-in-earbud-headphone-jblt215btwht/p/2187088/'],
    ['sharafdg', 'https://saudi.sharafdg.com/en/product/samsung-galaxy-tab-a11-tablet-wifi-256gb-8gb-ram-11inch-silver-sm-x230nzsemea/'],
  ];
  for (const [slug, url] of cases) {
    const s = orch.getScraperForStore(slug);
    if (!s) { console.log(`RESULT ${slug}: NO SCRAPER`); continue; }
    try {
      const r = await s.updateProductPrice(url);
      console.log(`RESULT ${slug}: ${r ? `OK price=${r.current_price} avail=${r.availability}` : 'NULL RETURNED'}`);
    } catch (e) {
      console.log(`RESULT ${slug}: THREW ${e instanceof Error ? e.message.slice(0,220) : e}`);
    }
  }
  process.exit(0);
})();
