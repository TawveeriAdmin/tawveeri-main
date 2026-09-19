// scripts/worker/jobs/discovery.ts
//
// Direct replacement for scheduler.js's runDiscovery() loop (was an HTTP
// self-call per store×category to /api/cron/discover-products). Calls
// ScrapingOrchestrator.runDiscoveryJob directly — same business logic, same
// per-store overlap guard (hasActiveRun/reapStaleRuns from run-logger, which
// is DB-backed and therefore already correct regardless of trigger path).
//
// Category map and Samsung's wider max_pages override are copied verbatim
// from scripts/scheduler.js (see that file's own comments for the "why" on
// each — not re-derived here to avoid drifting from the reasoning already on
// record).
//
// BOUNDED PER UNIT (fixed 2026-09-17, before this job was ever enabled — see
// discovery-store-category.ts's header): each store x category unit now runs
// as its own spawned, individually-timed process via proc-guard, exactly
// like price-update.ts's per-store fix. Same SIGTERM-cascade requirement
// applies: the outer job-level timeout (owned by the worker supervisor) can
// only reach whichever unit is currently active by this process forwarding
// its own SIGTERM into the active child's detached process group.

import { createServerClient } from '../../../src/lib/database';
import type { ProductCategory } from '../../../src/lib/database/types';
import { startRun, finishRun, hasActiveRun, reapStaleRuns } from '../../../src/lib/scraping/services/run-logger';
import { effectiveScraperStores } from '../lib/store-sets';
import { runGuarded } from '../lib/proc-guard';
import { recentlyCompleted, closeOrphanedBrowserSession } from '../lib/store-freshness';
import path from 'path';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TSX_BIN = require.resolve('tsx/cli');
const STORE_CATEGORY_JOB = path.join(__dirname, 'discovery-store-category.ts');

const INGEST_CATEGORIES: Record<string, ProductCategory[]> = {
  shaker: ['tv', 'appliance', 'kitchen'] as ProductCategory[],
  samsung_ksa: ['smartphone', 'tablet', 'tv', 'monitor', 'audio', 'appliance', 'wearable', 'vacuum', 'accessories'] as ProductCategory[],
  swsg: ['tv', 'appliance', 'kitchen', 'smartphone'] as ProductCategory[],
  noon: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'monitor', 'gaming', 'appliance', 'camera'] as ProductCategory[],
  lulu: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'kitchen', 'appliance', 'monitor'] as ProductCategory[],
  sharafdg: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'appliance', 'monitor', 'camera'] as ProductCategory[],
};

// Same SIGTERM-cascade pattern as price-update.ts — see that file's header
// for why this is required (per-unit children are detached process groups,
// so the outer timeout's SIGTERM to THIS process does not automatically
// reach whichever child is currently running).
let activeCancel: ((reason: string) => void) | null = null;
process.on('SIGTERM', () => {
  console.error('[worker:discovery] received SIGTERM — cascading to active per-unit child, if any');
  if (activeCancel) activeCancel('parent discovery received SIGTERM');
  else process.exit(0);
});

async function lookupStoreId(storeSlug: string): Promise<number | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stores').select('id').eq('slug', storeSlug).maybeSingle();
  return (data as { id?: number } | null)?.id ?? null;
}

async function main() {
  const stores = effectiveScraperStores(
    process.env.WORKER_INGEST_STORES || '',
    process.env.WORKER_FEED_STORES || '',
  );
  if (!stores.length) {
    console.log('[worker:discovery] no stores configured — nothing to do');
    return;
  }
  const staggerMs = parseInt(process.env.WORKER_STAGGER_MS || '20000', 10);
  // Per-unit bound: discovery units are typically fast (a handful of search
  // pages); generous headroom over any observed real run while still short
  // enough that a stuck unit cannot consume the outer budget or exceed the
  // 20min boot-time orphan-reap threshold. Reversible via env var.
  const perUnitTimeoutMs = parseInt(process.env.WORKER_DISCOVERY_PER_UNIT_TIMEOUT_MS || String(6 * 60 * 1000), 10);

  console.log(`[worker:discovery] starting — stores=[${stores.join(',')}] perUnitTimeoutMs=${perUnitTimeoutMs}`);
  const summary: string[] = [];

  outer:
  for (const slug of stores) {
    const categories = INGEST_CATEGORIES[slug] || (['tv'] as ProductCategory[]);
    const storeId = await lookupStoreId(slug);
    await reapStaleRuns(storeId);

    for (const cat of categories) {
      if (storeId !== null && (await hasActiveRun(storeId))) {
        console.log(`[worker:discovery] ${slug}/${cat}: skipped — active run already in progress`);
        continue;
      }

      // Redeploy-dedup guard (2026-09-19, Browserless cost incident) — see
      // store-freshness.ts's header. Scoped to this exact store×category unit
      // via metadata.category, not the whole store.
      const freshness = await recentlyCompleted(slug, 'discovery', cat);
      if (freshness.skip) {
        console.log(`[worker:discovery] ${slug}/${cat}: skipped — completed ${freshness.finishedAt} (within the redeploy-dedup guard window)`);
        summary.push(`${slug}/${cat}=skipped_fresh`);
        continue;
      }

      const maxPages = slug === 'samsung_ksa'
        ? parseInt(process.env.SAMSUNG_DISCOVERY_MAX_PAGES || '18', 10)
        : 2;

      const runId = await startRun({
        store_name: slug,
        store_id: storeId,
        job_type: 'discovery',
        triggered_by: 'schedule',
        metadata: { category: cat },
      });

      if (!runId) {
        console.error(`[worker:discovery] ${slug}/${cat}: could not create scraping_runs row — skipping`);
        summary.push(`${slug}/${cat}=no_run_row`);
        await sleep(staggerMs);
        continue;
      }

      const guarded = runGuarded(
        process.execPath,
        [TSX_BIN, STORE_CATEGORY_JOB, slug, cat, String(runId), String(maxPages)],
        // WORKER_CURRENT_JOB_TYPE: read by base-scraper.ts's session tracking
        // (worker_browser_sessions.job_type) — see migration 034.
        { timeoutMs: perUnitTimeoutMs, jobName: `discovery:${slug}/${cat}`, env: { ...process.env, WORKER_CURRENT_JOB_TYPE: 'discovery' } },
      );
      activeCancel = guarded.cancel;
      const result = await guarded.result;
      activeCancel = null;

      if (result.outcome === 'timeout' || result.outcome === 'cancelled' || result.outcome === 'spawn_error') {
        // Same reasoning as price-update.ts: status must be a value the live
        // CHECK constraint accepts ('failed'), with the real outcome recorded
        // in error_summary.reason, not as a literal status value.
        await finishRun({
          run_id: runId,
          status: 'failed',
          errors_count: 1,
          error_summary: { reason: result.outcome, tail: result.tail.slice(-500) },
        });
        // See price-update.ts's identical call for why — found live,
        // 2026-09-19, testing the Browserless fix itself.
        await closeOrphanedBrowserSession(slug, result.outcome);
        console.error(`[worker:discovery] ${slug}/${cat}: ${result.outcome} after ${(result.durationMs / 1000).toFixed(0)}s — moving on`);
      }
      summary.push(`${slug}/${cat}=${result.outcome}`);

      if (result.outcome === 'cancelled') {
        console.log(`[worker:discovery] stopping after cascade — ${summary.join(' ')}`);
        break outer;
      }

      await sleep(staggerMs);
    }
  }

  console.log(`[worker:discovery] done — ${summary.join(' ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[worker:discovery] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
