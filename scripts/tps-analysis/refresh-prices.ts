// Bounded price refresh for a store via the orchestrator's runPriceUpdateJob (the reliable path;
// Extra uses the verified Puppeteer JSON-LD updateProductPrice). Usage: tsx refresh-prices.ts <slug> [max]
import { config } from 'dotenv';
config({ path: '.env.local' });
process.env.PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const slug = process.argv[2];
const max = parseInt(process.argv[3] || '80', 10);
(async () => {
  if (!slug) throw new Error('provide store slug');
  const { ScrapingOrchestrator } = await import('../../src/lib/scraping/services/scraping-orchestrator');
  console.log(`price refresh — ${slug} — max ${max}`);
  const r = await new ScrapingOrchestrator().runPriceUpdateJob({ store_slug: slug, max_products: max, older_than_hours: 0 } as any);
  console.log('RESULT:', JSON.stringify(r, null, 2));
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
