// scripts/worker/jobs/price-update-store.ts
//
// Handles exactly ONE store's price update, as its own OS process, spawned
// by price-update.ts via proc-guard (real SIGTERM/SIGKILL-capable
// termination) rather than run in a shared loop inside one long-lived
// process. This is what gives every store a bounded, individually-killable
// execution unit — see price-update.ts's header comment for the "why"
// (found live, 2026-09-17: a single shared 45-minute timeout meant whichever
// store the loop reached first with real trouble — extra, then amazon on
// the next run — silently consumed the entire budget and starved every
// store after it).
//
// Same business logic as before (ScrapingOrchestrator.runPriceUpdateJob),
// zero duplication — only the execution boundary changed. The parent
// (price-update.ts) creates the scraping_runs row and passes its id in, so
// on a clean exit this process closes out the SAME row the parent is
// tracking; if this process is killed before finishing, the parent (not
// this file) marks the row as timed out/cancelled, since a killed process
// cannot run its own cleanup code.

import { ScrapingOrchestrator } from '../../../src/lib/scraping/services/scraping-orchestrator';
import type { PriceUpdateOptions } from '../../../src/lib/scraping/base/types';
import { finishRun, failRun } from '../../../src/lib/scraping/services/run-logger';

async function main() {
  const [, , slug, runIdArg, maxProductsArg, olderThanHoursArg] = process.argv;
  if (!slug || !runIdArg) {
    console.error('[worker:price-update-store] usage: price-update-store.ts <slug> <runId> <maxProducts> <olderThanHours>');
    process.exit(1);
  }
  const runId = Number(runIdArg);
  const options: PriceUpdateOptions = {
    store_slug: slug,
    max_products: parseInt(maxProductsArg || '300', 10),
    older_than_hours: parseInt(olderThanHoursArg || '12', 10),
  };

  try {
    const orchestrator = new ScrapingOrchestrator();
    const result = await orchestrator.runPriceUpdateJob(options);
    await finishRun({
      run_id: runId,
      status: result.success ? (result.errors > 0 ? 'partial' : 'success') : 'failed',
      products_updated: result.products_updated,
      price_changes_detected: result.price_changes,
      errors_count: result.errors,
    });
    console.log(`[worker:price-update] ${slug}: updated=${result.products_updated} changes=${result.price_changes} errors=${result.errors}`);
  } catch (err) {
    console.error(`[worker:price-update] ${slug} threw:`, err instanceof Error ? err.message : err);
    await failRun(runId, err);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
