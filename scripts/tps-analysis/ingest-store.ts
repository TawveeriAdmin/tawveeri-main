// Generic bounded store ingest via the orchestrator (same path the scheduler uses).
// Usage: tsx ingest-store.ts <slug> [--go] [--cats=a,b,c] [--pages=N] [--cc=N]
import { config } from 'dotenv';
config({ path: '.env.local' });
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const GO = args.includes('--go');
const cats = (args.find((a) => a.startsWith('--cats='))?.split('=')[1] || 'smartphone,laptop,tv,tablet,audio,wearable,kitchen,appliance,monitor,camera').split(',');
const pages = parseInt(args.find((a) => a.startsWith('--pages='))?.split('=')[1] || '2', 10);
const cc = args.find((a) => a.startsWith('--cc='))?.split('=')[1];
if (cc) process.env.DISCOVERY_CATEGORY_CONCURRENCY = cc;
process.env.PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  if (!slug) throw new Error('provide a store slug');
  const { ScrapingOrchestrator } = await import('../../src/lib/scraping/services/scraping-orchestrator');
  console.log(`${slug} ingest — ${GO ? 'LIVE' : 'DRY'} — cats: ${cats.join(',')} pages=${pages} cc=${cc || 'default'}`);
  const res = await new ScrapingOrchestrator().runDiscoveryJob({ store_slug: slug, categories: cats as any, max_pages: pages, dry_run: !GO } as any);
  console.log('RESULT:', JSON.stringify(res, null, 2));
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
