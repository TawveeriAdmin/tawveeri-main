/**
 * Detail-page enrichment pass for Amazon products.
 *
 * The full-coverage seed run scrapes ~30k Amazon products from search cards
 * only, leaving description_en=NULL, specifications={}, image_urls=[1], and
 * no merchant rating. This script walks each product's detail page and
 * fills in the missing fields via the AmazonScraper's scrapeProductPage
 * (invoked through updateProductPrice).
 *
 * Designed to be resumable across nights. Each successful product updates
 * products.enriched_at, and the next run's `WHERE enriched_at IS NULL`
 * query (plus the state file's last_product_id cursor) ensures we never
 * re-enrich the same product twice unless the user explicitly resets.
 *
 * Usage:
 *   # fill the next 6000 products (ETA ~10h at amazon pacing)
 *   ENRICH_LIMIT=6000 npx tsx scripts/enrich-amazon-products.ts
 *
 *   # restrict to specific categories
 *   ENRICH_CATEGORIES=kitchen,smart_home npx tsx scripts/enrich-amazon-products.ts
 *
 *   # start over
 *   ENRICH_RESET_STATE=true npx tsx scripts/enrich-amazon-products.ts
 *
 * Rate-limit safety: shares one AmazonScraper instance (and one RateLimiter)
 * across the entire run so the cool-off propagation from fetchPage's 429/503
 * handling covers every subsequent product.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Env bootstrap — mirrors seed-direct.ts. MUST happen before any project
// import because database/supabase.ts reads env at import time.
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

type EnrichState = {
  /** Row cursor — products are iterated in `id ASC` order. */
  last_product_id: string | null;
  /** Running total across resume sessions. */
  processed: number;
  /** IDs that failed (scrape returned null). User can re-target later. */
  failed_ids: string[];
  started_at: string;
};

async function main(): Promise<void> {
  // ── Config ───────────────────────────────────────────────────────────────
  const LIMIT = parseInt(process.env.ENRICH_LIMIT || '6000', 10);
  // Products are enriched sequentially — the AmazonScraper rate limiter is
  // process-wide, so parallel fan-out would just queue against it anyway and
  // only makes the session look more bot-like to Amazon. No BATCH_SIZE env.
  const ONLY_MISSING = (process.env.ENRICH_ONLY_MISSING ?? 'true').toLowerCase() === 'true';
  const RESUME = (process.env.ENRICH_RESUME ?? 'true').toLowerCase() === 'true';
  const RESET_STATE = (process.env.ENRICH_RESET_STATE || 'false').toLowerCase() === 'true';
  const STATE_FILE = process.env.ENRICH_STATE_FILE
    || path.join(__dirname, '..', '.scrape-state', 'amazon-enrich.json');
  const CATEGORIES = (process.env.ENRICH_CATEGORIES || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  // Extra sleep after a detected cooldown wave. BaseScraper.fetchPage already
  // cools off 30s–480s on each 429/503, so this is an OPTIONAL top-up for
  // when the scraper returns null repeatedly (likely anti-bot page, not just
  // a transient 5xx).
  const COOLDOWN_MS = parseInt(process.env.ENRICH_COOLDOWN_MS || '120000', 10);
  // After this many consecutive null returns, take a COOLDOWN_MS nap before
  // continuing. Tune up if Amazon is particularly grumpy.
  const MAX_CONSECUTIVE_NULLS = parseInt(process.env.ENRICH_MAX_CONSECUTIVE_NULLS || '3', 10);

  // ── Lazy imports (after env boot) ────────────────────────────────────────
  const { AmazonScraper } = await import('../src/lib/scraping/stores/amazon-scraper');
  const { ProductService } = await import('../src/lib/scraping/services/product-service');
  const { createServerClient } = await import('../src/lib/database');

  const supabase = createServerClient();

  // ── Resolve Amazon store id ──────────────────────────────────────────────
  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', 'amazon')
    .single();
  if (storeErr || !storeRow) {
    console.error(`Could not resolve amazon store: ${storeErr?.message || 'not found'}`);
    process.exit(1);
  }
  const amazonStoreId = (storeRow as { id: string }).id;

  // ── Load resume state ────────────────────────────────────────────────────
  const state: EnrichState = loadState(STATE_FILE, RESET_STATE);
  const scriptStart = Date.now();

  // ── One scraper for the whole run so rate limiter + cooldown are shared ──
  const scraper = new AmazonScraper();
  const productService = new ProductService();

  // ── Counters (this-run) ──────────────────────────────────────────────────
  let processedNow = 0;
  let succeeded = 0;
  let failed = 0;
  let cooldownsHit = 0;
  let consecutiveNulls = 0;

  const stamp = () => new Date().toISOString().slice(11, 19);
  console.log(
    `[${stamp()}] enrich-amazon-products starting — limit=${LIMIT} only_missing=${ONLY_MISSING} resume=${RESUME}`
    + (CATEGORIES.length > 0 ? ` categories=${CATEGORIES.join(',')}` : '')
  );
  if (state.last_product_id && RESUME) {
    console.log(`[${stamp()}] resuming after product id=${state.last_product_id} (${state.processed} already processed)`);
  }

  // ── Main loop ────────────────────────────────────────────────────────────
  // Pulls rows in pages of 500 (cheap Supabase range) and processes
  // sequentially. After LIMIT rows or end-of-stream, we stop.
  const PAGE_SIZE = 500;
  let cursor: string | null = RESUME ? state.last_product_id : null;
  let done = false;

  try {
    while (!done && processedNow < LIMIT) {
      const rows = await fetchBatch(supabase, amazonStoreId, {
        cursor,
        onlyMissing: ONLY_MISSING,
        categories: CATEGORIES,
        limit: Math.min(PAGE_SIZE, LIMIT - processedNow),
      });

      if (rows.length === 0) {
        done = true;
        break;
      }

      for (const row of rows) {
        if (processedNow >= LIMIT) {
          done = true;
          break;
        }

        const rowStart = Date.now();
        try {
          const scraped = await scraper.updateProductPrice(row.product_url);
          if (!scraped) {
            // updateProductPrice swallows internal errors and returns null.
            // Treat as soft-failure: record id, continue, and back off if
            // nulls are piling up (likely anti-bot page wall).
            failed++;
            state.failed_ids.push(row.id);
            consecutiveNulls++;
            console.log(`[${stamp()}] · ${row.id.slice(0, 8)}… null after scrape (${Math.round((Date.now() - rowStart) / 1000)}s) — ${shortCat(row.category)}`);
            if (consecutiveNulls >= MAX_CONSECUTIVE_NULLS) {
              cooldownsHit++;
              console.log(`[${stamp()}] ${consecutiveNulls} consecutive nulls → sleeping ${Math.round(COOLDOWN_MS / 1000)}s`);
              await sleep(COOLDOWN_MS);
              consecutiveNulls = 0;
            }
          } else {
            // Feed the enriched scraped product through the writer. The
            // writer will stamp enriched_at and merge the detail-page
            // fields over whatever exists.
            await productService.updateEnrichedFields(row.id, scraped);
            succeeded++;
            consecutiveNulls = 0;
            console.log(
              `[${stamp()}] ✓ ${row.id.slice(0, 8)}… ${shortCat(row.category)}`
              + ` rating=${scraped.merchant_rating ?? 'n/a'}`
              + ` reviews=${scraped.merchant_review_count ?? 0}`
              + ` imgs=${scraped.image_urls.length}`
              + ` specs=${Object.keys(scraped.specifications || {}).length}`
              + ` (${Math.round((Date.now() - rowStart) / 1000)}s)`
            );
          }
        } catch (err) {
          // A thrown error here would be something updateProductPrice didn't
          // catch (e.g. a DB write failure in updateEnrichedFields). Record
          // and keep going; don't let one bad row end the night.
          failed++;
          state.failed_ids.push(row.id);
          console.log(`[${stamp()}] ✗ ${row.id.slice(0, 8)}… ${err instanceof Error ? err.message : String(err)}`);
        }

        // Advance cursor + counters regardless of success so the next batch
        // pulls the NEXT id, not the same one. Failed ids are in failed_ids
        // and can be re-processed by a targeted follow-up run.
        cursor = row.id;
        state.last_product_id = row.id;
        state.processed++;
        processedNow++;

        if (processedNow % 25 === 0) {
          saveState(STATE_FILE, state);
        }
      }
    }
  } finally {
    // Always persist state and clean up Puppeteer, even on Ctrl-C /
    // exception. Without cleanup the Chromium child process leaks.
    saveState(STATE_FILE, state);
    await scraper.cleanup().catch(() => {});
  }

  const elapsed = Date.now() - scriptStart;
  console.log(`\n${'─'.repeat(70)}\nENRICH SUMMARY\n${'─'.repeat(70)}`);
  console.log(
    `  processed=${processedNow}  succeeded=${succeeded}  failed=${failed}`
    + `  cooldowns=${cooldownsHit}  elapsed=${Math.round(elapsed / 1000)}s`
    + ` (${Math.round(elapsed / 60000)}m)`
  );
  console.log(`  state → ${STATE_FILE}`);
  console.log(`  state.processed (all-time) = ${state.processed}`);
  console.log(`  state.failed_ids           = ${state.failed_ids.length}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────

type EnrichRow = {
  id: string;
  category: string;
  product_url: string;
};

async function fetchBatch(
  supabase: ReturnType<typeof import('../src/lib/database').createServerClient>,
  amazonStoreId: string,
  opts: { cursor: string | null; onlyMissing: boolean; categories: string[]; limit: number },
): Promise<EnrichRow[]> {
  // product_stores holds the per-retailer URL, so we join through it.
  // Supabase .select() w/ embedded joins returns a nested shape we flatten
  // before returning.
  let query = supabase
    .from('product_stores')
    .select('product_id, product_url, products!inner(id, category, enriched_at)')
    .eq('store_id', amazonStoreId)
    .order('product_id', { ascending: true })
    .limit(opts.limit);

  if (opts.cursor) {
    query = query.gt('product_id', opts.cursor);
  }
  if (opts.onlyMissing) {
    // Only rows where products.enriched_at IS NULL.
    query = query.is('products.enriched_at', null);
  }
  if (opts.categories.length > 0) {
    query = query.in('products.category', opts.categories);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`fetchBatch failed: ${error.message}`);
  }
  if (!data) return [];

  const rows: EnrichRow[] = [];
  for (const r of data as unknown as Array<{
    product_id: string;
    product_url: string;
    products: { id: string; category: string; enriched_at: string | null };
  }>) {
    // `products!inner` is an array in some Supabase client versions; handle
    // both shapes defensively.
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    if (!p) continue;
    // The onlyMissing filter happens server-side, but guard against stale
    // cache returning a row that's already been enriched mid-batch.
    if (opts.onlyMissing && p.enriched_at) continue;
    if (!r.product_url) continue;
    rows.push({ id: r.product_id, category: p.category, product_url: r.product_url });
  }
  return rows;
}

function loadState(file: string, reset: boolean): EnrichState {
  if (reset || !fs.existsSync(file)) {
    return { last_product_id: null, processed: 0, failed_ids: [], started_at: new Date().toISOString() };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      last_product_id: typeof parsed?.last_product_id === 'string' ? parsed.last_product_id : null,
      processed: typeof parsed?.processed === 'number' ? parsed.processed : 0,
      failed_ids: Array.isArray(parsed?.failed_ids) ? parsed.failed_ids : [],
      started_at: typeof parsed?.started_at === 'string' ? parsed.started_at : new Date().toISOString(),
    };
  } catch {
    return { last_product_id: null, processed: 0, failed_ids: [], started_at: new Date().toISOString() };
  }
}

function saveState(file: string, state: EnrichState): void {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortCat(category: string): string {
  return category.length > 12 ? `${category.slice(0, 11)}…` : category.padEnd(12, ' ');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
