// Bounded Noon ingest into the storefront (product_stores) via the SAME orchestrator path the
// scheduler uses — reuses validation + product/product_stores creation (no reimplementation).
// Noon = Rakhys's #1 retailer; recovering it is the fastest parity increment. store_id=3.
// Usage: tsx ingest-noon.ts [--go]   (default is DRY RUN)
import { config } from 'dotenv';
config({ path: '.env.local' });

const GO = process.argv.includes('--go');

(async () => {
  const { ScrapingOrchestrator } = await import('../../src/lib/scraping/services/scraping-orchestrator');
  const CATS = ['smartphone', 'laptop', 'tv', 'tablet', 'headphones', 'smartwatch', 'monitor'];
  const orch = new ScrapingOrchestrator();
  console.log(`Noon ingest — ${GO ? 'LIVE WRITE' : 'DRY RUN'} — categories: ${CATS.join(', ')}`);
  const res = await orch.runDiscoveryJob({
    store_slug: 'noon',
    categories: CATS as any,
    max_pages: 2,
    dry_run: !GO,
  } as any);
  console.log('RESULT:', JSON.stringify(res, null, 2));
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
