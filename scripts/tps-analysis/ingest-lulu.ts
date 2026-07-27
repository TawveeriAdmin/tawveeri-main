// Bounded LuLu ingest via the orchestrator (same path as Noon). store_id=23.
// Usage: tsx ingest-lulu.ts [--go]   (default DRY RUN)
import { config } from 'dotenv';
config({ path: '.env.local' });
// LuLu uses a single shared Puppeteer page → categories MUST run sequentially (concurrent goto detaches the frame).
process.env.DISCOVERY_CATEGORY_CONCURRENCY = '1';
process.env.PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const GO = process.argv.includes('--go');
(async () => {
  const { ScrapingOrchestrator } = await import('../../src/lib/scraping/services/scraping-orchestrator');
  const CATS = (process.env.LULU_CATS || 'smartphone,laptop,tv,tablet,audio,wearable,kitchen,appliance,monitor').split(',');
  const orch = new ScrapingOrchestrator();
  console.log(`LuLu ingest — ${GO ? 'LIVE WRITE' : 'DRY RUN'} — categories: ${CATS.join(', ')}`);
  const res = await orch.runDiscoveryJob({ store_slug: 'lulu', categories: CATS as any, max_pages: 3, dry_run: !GO } as any);
  console.log('RESULT:', JSON.stringify(res, null, 2));
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
