// scripts/worker/jobs/price-update.ts
//
// Direct replacement for scheduler.js's runPriceUpdate() loop, which used to
// call POST https://tawveeri.com/api/cron/update-prices per store — the
// self-hairpin that ran real scraping/Puppeteer work inside tawveeri-main.
//
// This calls the EXACT SAME business logic the route calls
// (ScrapingOrchestrator.runPriceUpdateJob + run-logger's startRun/finishRun),
// just as a direct in-process call instead of an HTTP round-trip. Zero
// scraping/matching/pricing logic is duplicated or reimplemented — this file
// only owns the per-store loop, staggering, and scraping_runs bookkeeping
// that the route already did.
//
// Run as its own OS process (spawned by the worker supervisor via
// proc-guard.runGuarded) so it is a real, killable execution unit — not a
// function call the supervisor can only "Promise.race" against.
//
// Exit code: 0 if the loop completed (individual store failures are recorded
// per-store in scraping_runs, exactly as before, and do not fail the whole
// job — this matches the pre-existing behavior of the HTTP-loop version).
// Non-zero only on an unexpected crash.

import { ScrapingOrchestrator } from '../../../src/lib/scraping/services/scraping-orchestrator';
import type { PriceUpdateOptions } from '../../../src/lib/scraping/base/types';
import { createServerClient } from '../../../src/lib/database';
import { startRun, finishRun, failRun } from '../../../src/lib/scraping/services/run-logger';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookupStoreId(storeSlug: string): Promise<number | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stores').select('id').eq('slug', storeSlug).single();
  return (data as { id?: number } | null)?.id ?? null;
}

async function main() {
  const storesArg = process.env.WORKER_INGEST_STORES || '';
  const stores = storesArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (!stores.length) {
    console.log('[worker:price-update] no stores configured — nothing to do');
    return;
  }
  const staggerMs = parseInt(process.env.WORKER_STAGGER_MS || '20000', 10);
  const noonMax = parseInt(process.env.NOON_PRICE_MAX_PRODUCTS || '15', 10);
  const defaultMax = parseInt(process.env.INGEST_PRICE_MAX_PRODUCTS || '300', 10);

  console.log(`[worker:price-update] starting — stores=[${stores.join(',')}]`);
  let anyProcessed = false;

  for (const slug of stores) {
    const maxProducts = slug === 'noon' ? noonMax : defaultMax;
    const options: PriceUpdateOptions = { store_slug: slug, max_products: maxProducts, older_than_hours: 12 };

    let runId: number | null = null;
    try {
      runId = await startRun({
        store_name: slug,
        store_id: await lookupStoreId(slug),
        job_type: 'price_update',
        triggered_by: 'schedule',
      });

      const orchestrator = new ScrapingOrchestrator();
      const result = await orchestrator.runPriceUpdateJob(options);
      anyProcessed = true;

      if (runId) {
        await finishRun({
          run_id: runId,
          status: result.success ? (result.errors > 0 ? 'partial' : 'success') : 'failed',
          products_updated: result.products_updated,
          price_changes_detected: result.price_changes,
          errors_count: result.errors,
        });
      }
      console.log(`[worker:price-update] ${slug}: updated=${result.products_updated} changes=${result.price_changes} errors=${result.errors}`);
    } catch (err) {
      console.error(`[worker:price-update] ${slug} threw:`, err instanceof Error ? err.message : err);
      if (runId) await failRun(runId, err);
    }

    await sleep(staggerMs);
  }

  console.log(`[worker:price-update] done — processed=${anyProcessed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[worker:price-update] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
