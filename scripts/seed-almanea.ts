/**
 * Seed Almanea products by querying their Algolia catalog index directly.
 *
 * Unlike Amazon/Extra/Samsung which each need their own page-crawling
 * approach, Almanea's consumer site is a Next.js SPA backed by Algolia
 * for catalog browse. The search-only API key is shipped in the public
 * JS bundle, so calling Algolia the same way the browser does is fair
 * game and gives us the entire catalog (~3.9K products as of this writing)
 * in ~40 paginated queries — finishes in a few minutes.
 *
 * The scraper (`src/lib/scraping/stores/almanea-scraper.ts`) does the
 * Algolia paginate+merge (AR titles from prod_headless_ar_products, EN
 * titles from prod_headless_en_products by SKU). Electronics-only filter
 * via `classifyFromTitle` drops any non-electronics that slip through.
 *
 * Usage:
 *   npx tsx scripts/seed-almanea.ts                    # full run (50 pages max)
 *   SEED_MAX_PAGES=5 npx tsx scripts/seed-almanea.ts   # smoke test
 *   SEED_RESET_STATE=true npx tsx scripts/seed-almanea.ts   # discard resume state
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

type SeedState = {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  started_at: string;
};

async function main(): Promise<void> {
  const MAX_PAGES = parseInt(process.env.SEED_MAX_PAGES || '50', 10);
  const RESET_STATE = (process.env.SEED_RESET_STATE || 'false').toLowerCase() === 'true';
  const STATE_FILE = process.env.SEED_STATE_FILE
    || path.join(__dirname, '..', '.scrape-state', 'almanea-seed.json');

  const { AlmaneaScraper } = await import('../src/lib/scraping/stores/almanea-scraper');
  const { ProductService } = await import('../src/lib/scraping/services/product-service');
  const { createServerClient } = await import('../src/lib/database');

  const supabase = createServerClient();

  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', 'almanea')
    .single();
  if (storeErr || !storeRow) {
    console.error(`Could not resolve almanea store: ${storeErr?.message || 'not found'}`);
    process.exit(1);
  }
  const storeId = (storeRow as { id: string }).id;

  const state: SeedState = loadState(STATE_FILE, RESET_STATE);
  const scriptStart = Date.now();
  const stamp = () => new Date().toISOString().slice(11, 19);

  console.log(`[${stamp()}] seed-almanea starting — max_pages_per_index=${MAX_PAGES}`);

  const scraper = new AlmaneaScraper();
  const productService = new ProductService();

  try {
    // `category` is ignored by the Algolia discovery — a single sweep
    // grabs every product across every category in the Almanea catalog.
    const scraped = await scraper.discoverProducts('accessories', MAX_PAGES);
    console.log(`[${stamp()}] discovery done — ${scraped.length} products passed electronics filter`);

    let created = 0;
    let updated = 0;
    let failed = 0;
    let seen = 0;

    for (const product of scraped) {
      seen++;
      try {
        const { created: wasCreated } = await productService.createOrUpdateProduct(
          product as Parameters<typeof productService.createOrUpdateProduct>[0],
          storeId,
        );
        if (wasCreated) created++;
        else updated++;
        state.processed++;

        if (seen % 50 === 0) {
          console.log(`[${stamp()}] progress ${seen}/${scraped.length}: +${created} new, ↻${updated} updated, ✗${failed} failed`);
          state.created = created;
          state.updated = updated;
          state.failed = failed;
          saveState(STATE_FILE, state);
        }
      } catch (err) {
        failed++;
        state.failed++;
        console.log(`[${stamp()}]   ✗ ${(product.name_en || product.name_ar || '').slice(0, 60)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    state.created = created;
    state.updated = updated;
    state.failed = failed;
  } finally {
    saveState(STATE_FILE, state);
    await scraper.cleanup().catch(() => {});
  }

  const elapsed = Date.now() - scriptStart;
  console.log(`\n${'─'.repeat(70)}\nSEED SUMMARY\n${'─'.repeat(70)}`);
  console.log(
    `  processed=${state.processed}  created=${state.created}  updated=${state.updated}`
    + `  failed=${state.failed}`
    + `  elapsed=${Math.round(elapsed / 60000)}m`
  );
  console.log(`  state → ${STATE_FILE}`);
}

function loadState(file: string, reset: boolean): SeedState {
  const empty: SeedState = {
    processed: 0, created: 0, updated: 0, failed: 0,
    started_at: new Date().toISOString(),
  };
  if (reset || !fs.existsSync(file)) return empty;
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<SeedState>;
    return {
      processed: typeof p.processed === 'number' ? p.processed : 0,
      created: typeof p.created === 'number' ? p.created : 0,
      updated: typeof p.updated === 'number' ? p.updated : 0,
      failed: typeof p.failed === 'number' ? p.failed : 0,
      started_at: typeof p.started_at === 'string' ? p.started_at : empty.started_at,
    };
  } catch {
    return empty;
  }
}

function saveState(file: string, state: SeedState): void {
  const dir = path.dirname(file);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    console.warn(`  [state] failed to persist ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
