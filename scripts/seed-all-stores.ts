/**
 * Seed script — runs discovery once per store. The orchestrator now iterates
 * every product category internally, so a single call per store covers the
 * entire catalog. Invoked manually after migration 16:
 *
 *   npx tsx scripts/seed-all-stores.ts
 *
 * Each run lands a single scraping_runs row with aggregated stats.
 */

import 'dotenv/config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('CRON_SECRET is required. Set it in .env.local and re-run.');
  process.exit(1);
}

const STORES = [
  'amazon', 'noon', 'jarir', 'extra', 'almanea', 'shaker', 'samsung_ksa', 'swsg',
];

const DELAY_BETWEEN_STORES_MS = parseInt(process.env.SEED_DELAY_MS || '30000', 10);
const MAX_PAGES = parseInt(process.env.SEED_MAX_PAGES || '3', 10);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runOne(store: string) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/cron/discover-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      // No `category` / `categories` → orchestrator walks all 8 categories.
      body: JSON.stringify({ store_slug: store, max_pages: MAX_PAGES }),
    });
    const json = await res.json();
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(
      `  [${store}] ${elapsed}s — discovered=${json.products_discovered ?? 0}, created=${json.products_created ?? 0}, linked=${json.products_linked ?? 0}, errors=${json.errors ?? 0}${json.run_id ? ` (run ${json.run_id})` : ''}`
    );
  } catch (err) {
    console.error(`  [${store}] FAILED:`, err);
  }
}

(async () => {
  console.log(`Seeding ${STORES.length} stores — all categories per store`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Max pages per category: ${MAX_PAGES}, delay between stores: ${DELAY_BETWEEN_STORES_MS}ms`);
  console.log('');

  for (const store of STORES) {
    console.log(`=== ${store} ===`);
    await runOne(store);
    await sleep(DELAY_BETWEEN_STORES_MS);
  }

  console.log('\nSeed complete. Check /admin/scraping/runs for status per store.');
})();
