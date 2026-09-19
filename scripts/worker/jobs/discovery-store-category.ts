// scripts/worker/jobs/discovery-store-category.ts
//
// Handles exactly ONE store x category discovery unit, as its own OS
// process, spawned by discovery.ts via proc-guard — same pattern and same
// reason as price-update-store.ts (see that file's header): discovery.ts's
// loop previously ran every store x category sequentially in-process under
// ONE shared outer timeout (60min), so a single stuck category could consume
// the whole budget and starve every store/category after it, AND any
// scraping_runs row it held open could legitimately approach that 60min
// ceiling — well past the worker's 20min boot-time orphan-reap threshold
// (job-state.ts's reapOrphanedRuns), which was sized for price_update's
// proven ~8.5min per-store ceiling, not an unbounded discovery row. Found by
// code review during the production-recovery mandate's reapOrphanedRuns
// threshold audit (2026-09-17), before discovery was ever enabled — not a
// live incident.
//
// Same business logic as before (ScrapingOrchestrator.runDiscoveryJob), zero
// duplication — only the execution boundary changed. The parent
// (discovery.ts) creates the scraping_runs row and passes its id in.

import { ScrapingOrchestrator } from '../../../src/lib/scraping/services/scraping-orchestrator';
import type { DiscoveryOptions } from '../../../src/lib/scraping/base/types';
import type { ProductCategory } from '../../../src/lib/database/types';
import { finishRun, failRun } from '../../../src/lib/scraping/services/run-logger';
import { BrowserlessQuotaError } from '../../../src/lib/scraping/base/base-scraper';
import { closeOrphanedBrowserSession } from '../lib/store-freshness';

async function main() {
  const [, , slug, category, runIdArg, maxPagesArg] = process.argv;
  if (!slug || !category || !runIdArg) {
    console.error('[worker:discovery-store-category] usage: discovery-store-category.ts <slug> <category> <runId> <maxPages>');
    process.exit(1);
  }
  const runId = Number(runIdArg);
  const options: DiscoveryOptions = {
    store_slug: slug,
    category: category as ProductCategory,
    max_pages: parseInt(maxPagesArg || '2', 10),
  };

  let exitCode = 0;
  try {
    const orchestrator = new ScrapingOrchestrator();
    const result = await orchestrator.runDiscoveryJob(options, runId);
    await finishRun({
      run_id: runId,
      status: result.success ? (result.errors > 0 ? 'partial' : 'success') : 'failed',
      products_discovered: result.products_discovered,
      products_updated: result.products_linked,
      errors_count: result.errors,
      error_summary: result.error_messages?.length ? result.error_messages : undefined,
    });
    console.log(`[worker:discovery] ${slug}/${category}: discovered=${result.products_discovered} created=${result.products_created} linked=${result.products_linked}`);
  } catch (err) {
    // Browserless cost incident, 2026-09-19: a quota/rate-limit signal is not
    // a scraping defect — log and record it distinctly so it reads as
    // "deferred: browserless quota" rather than a generic discovery failure.
    if (err instanceof BrowserlessQuotaError) {
      console.error(`[worker:discovery] ${slug}/${category}: deferred — Browserless quota/rate-limit signal: ${err.message}`);
      await finishRun({ run_id: runId, status: 'failed', errors_count: 0, error_summary: { reason: 'deferred_browserless_quota', detail: err.message } });
    } else {
      console.error(`[worker:discovery] ${slug}/${category} threw:`, err instanceof Error ? err.message : err);
      await failRun(runId, err);
      exitCode = 1;
    }
  } finally {
    // See price-update-store.ts's identical call for why — found live,
    // 2026-09-19, testing the Browserless fix itself.
    await closeOrphanedBrowserSession(slug, 'process_completed').catch(() => {});
  }
  process.exit(exitCode);
}

main();
