// scripts/worker/jobs/price-update.ts
//
// Direct replacement for scheduler.js's runPriceUpdate() loop, which used to
// call POST https://tawveeri.com/api/cron/update-prices per store — the
// self-hairpin that ran real scraping/Puppeteer work inside tawveeri-main.
//
// CHANGED (found live, 2026-09-17, two consecutive real validation runs):
// this used to call ScrapingOrchestrator.runPriceUpdateJob for every store
// in-process, sequentially, under ONE shared 45-minute outer timeout owned
// by the worker supervisor. Both live runs hit that ceiling — first stuck on
// 'extra', then (after unrelated fixes) on 'amazon' — and in both cases
// every store AFTER the stuck one got zero attempts that cycle. A shared
// timeout with no per-store boundary structurally starves whichever stores
// happen to sort later behind a slow one; it isn't specific to any one
// merchant.
//
// Fix: each store now runs as its OWN spawned process
// (price-update-store.ts), bounded by its OWN timeout via proc-guard's
// SIGTERM-then-SIGKILL process-group termination — the same real,
// already-proven termination mechanism, just applied one level deeper. A
// store that times out is killed, its scraping_runs row is closed as
// 'timeout' by THIS file (the child died before it could close it), and the
// loop moves on immediately — no store can ever again consume more than its
// own bounded slice of the run.
//
// Merchant caps and pricing semantics are UNCHANGED — max_products,
// older_than_hours, and NOON_PRICE_MAX_PRODUCTS are passed through exactly
// as before; only the execution boundary changed.

import { createServerClient } from '../../../src/lib/database';
import { startRun, finishRun } from '../../../src/lib/scraping/services/run-logger';
import { effectiveScraperStores } from '../lib/store-sets';
import { runGuarded } from '../lib/proc-guard';
import path from 'path';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TSX_BIN = require.resolve('tsx/cli');
const STORE_JOB = path.join(__dirname, 'price-update-store.ts');

// WHY: each per-store child is spawned via runGuarded, which uses `detached:
// true` to give it its OWN process group (so it can be killed independently
// without taking this process down with it). That means if the OUTER,
// whole-job timeout (owned by the worker supervisor, one level up) ever
// fires and SIGTERMs *this* process, that signal does NOT automatically
// reach whichever per-store child is currently running — it's in a
// different group. This process must forward the signal itself before
// exiting, or a killed outer job would leave an untracked, unbounded orphan
// running — exactly the failure class this whole migration exists to close.
let activeCancel: ((reason: string) => void) | null = null;
process.on('SIGTERM', () => {
  console.error('[worker:price-update] received SIGTERM — cascading to active per-store child, if any');
  if (activeCancel) activeCancel('parent price-update received SIGTERM');
  else process.exit(0);
});

async function lookupStoreId(storeSlug: string): Promise<number | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stores').select('id').eq('slug', storeSlug).single();
  return (data as { id?: number } | null)?.id ?? null;
}

async function main() {
  const stores = effectiveScraperStores(
    process.env.WORKER_INGEST_STORES || '',
    process.env.WORKER_FEED_STORES || '',
  );
  if (!stores.length) {
    console.log('[worker:price-update] no stores configured — nothing to do');
    return;
  }
  const staggerMs = parseInt(process.env.WORKER_STAGGER_MS || '20000', 10);
  const noonMax = parseInt(process.env.NOON_PRICE_MAX_PRODUCTS || '15', 10);
  const defaultMax = parseInt(process.env.INGEST_PRICE_MAX_PRODUCTS || '300', 10);
  const olderThanHours = 12;
  // Per-store bound: generous enough for a real full cycle on a healthy
  // store (observed live: noon 32s, sharafdg/almanea ~5-9min for a full
  // pass), short enough that one bad store cannot consume the whole run.
  // Reversible via env var without a code change.
  const perStoreTimeoutMs = parseInt(process.env.WORKER_PRICE_UPDATE_PER_STORE_TIMEOUT_MS || String(8 * 60 * 1000), 10);

  console.log(`[worker:price-update] starting — stores=[${stores.join(',')}] perStoreTimeoutMs=${perStoreTimeoutMs}`);
  const summary: string[] = [];

  for (const slug of stores) {
    const maxProducts = slug === 'noon' ? noonMax : defaultMax;

    const runId = await startRun({
      store_name: slug,
      store_id: await lookupStoreId(slug),
      job_type: 'price_update',
      triggered_by: 'schedule',
    });

    if (!runId) {
      console.error(`[worker:price-update] ${slug}: could not create scraping_runs row — skipping`);
      summary.push(`${slug}=no_run_row`);
      await sleep(staggerMs);
      continue;
    }

    const guarded = runGuarded(
      process.execPath,
      [TSX_BIN, STORE_JOB, slug, String(runId), String(maxProducts), String(olderThanHours)],
      { timeoutMs: perStoreTimeoutMs, jobName: `price-update:${slug}`, env: process.env },
    );
    activeCancel = guarded.cancel;
    const result = await guarded.result;
    activeCancel = null;

    if (result.outcome === 'timeout' || result.outcome === 'cancelled' || result.outcome === 'spawn_error') {
      // The child was killed (or never started) before it could close its
      // own row — close it here so nothing is left permanently 'running',
      // exactly the failure mode that orphaned samsung_delta_watch_runs #10.
      //
      // WHY status: 'failed' and not 'timeout'/'cancelled' as the literal
      // value (found live, 2026-09-17, same session): scraping_runs.status
      // has a live CHECK constraint allowing only pending/running/success/
      // partial/failed — 'pending' was already known to be rejected (the
      // reason the run-now migration was held back); this file made the
      // SAME mistake with 'timeout'/'cancelled', and the Supabase client's
      // .update() call does not surface a constraint-violation error (no
      // exception thrown, {error} never inspected) — the row simply never
      // got closed, silently, which is exactly how this was caught: the
      // very first live timeout under this code left its row stuck
      // 'running' with finished_at=null. Using the real distinction only in
      // error_summary.reason keeps this accurate and queryable without
      // writing a status value the database does not yet accept.
      await finishRun({
        run_id: runId,
        status: 'failed',
        errors_count: 1,
        error_summary: { reason: result.outcome, tail: result.tail.slice(-500) },
      });
      console.error(`[worker:price-update] ${slug}: ${result.outcome} after ${(result.durationMs / 1000).toFixed(0)}s — moving on`);
    }
    summary.push(`${slug}=${result.outcome}`);

    // This process itself was SIGTERM'd (by the outer, whole-job timeout, or
    // by the supervisor shutting down) and cascaded that into the per-store
    // child above — do not start another store, this process is exiting.
    if (result.outcome === 'cancelled') {
      console.log(`[worker:price-update] stopping after cascade — ${summary.join(' ')}`);
      process.exit(0);
    }

    await sleep(staggerMs);
  }

  console.log(`[worker:price-update] done — ${summary.join(' ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[worker:price-update] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
