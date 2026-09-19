// scripts/worker/lib/store-freshness.ts
//
// WHY (founder review, 2026-09-19, Browserless cost incident): price-update.ts
// and discovery.ts always attempt EVERY configured store/unit from scratch on
// every invocation. Under normal operation that's correct — jobDue()'s
// interval math means a fresh invocation only happens roughly once per
// interval anyway. But a REDEPLOY restarts the worker process, and
// scheduleJob()'s boot-kick checks jobDue() again within a few minutes of
// boot — if the JOB-LEVEL last_success_at hasn't advanced (e.g. one store in
// a prior attempt timed out, so the whole job never recorded a clean
// success), the boot-kick re-enqueues the WHOLE job, which then re-attempts
// EVERY store from the beginning — including stores that completed
// successfully moments ago in the previous, now-replaced container. Several
// redeploys in a short troubleshooting window compounds this into far more
// Browserless sessions (and scrape load generally) than the job's own
// interval ever intended.
//
// This is a per-STORE guard, checked before spawning a store's child
// process: skip a store whose most recent 'success' or 'partial'
// scraping_runs completion is more recent than the guard window. The window
// is deliberately much shorter than the job's own interval (default 45min
// vs. price_update's 6h / discovery's 12h) — its only purpose is to absorb
// a burst of redeploys within one troubleshooting session, not to change
// normal steady-state cadence.

import { createServerClient } from '../../../src/lib/database';

const DEFAULT_GUARD_MS = 45 * 60 * 1000;

export async function recentlyCompleted(
  storeSlug: string,
  jobType: 'price_update' | 'discovery',
  /** discovery only: scopes the check to one store×category unit via
   *  metadata.category (set by the caller on startRun) — scraping_runs has
   *  no dedicated category column, and a store-level-only check would
   *  incorrectly skip EVERY category once any one of them completes. */
  category?: string,
  guardMs: number = parseInt(process.env.WORKER_STORE_REFRESH_GUARD_MS || String(DEFAULT_GUARD_MS), 10),
): Promise<{ skip: boolean; finishedAt?: string }> {
  try {
    const supabase = createServerClient();
    const cutoff = new Date(Date.now() - guardMs).toISOString();
    let query = supabase
      .from('scraping_runs')
      .select('finished_at')
      .eq('store_name', storeSlug)
      .eq('job_type', jobType)
      .in('status', ['success', 'partial'])
      .gte('finished_at', cutoff);
    if (category) query = query.eq('metadata->>category', category);
    const { data } = await query.order('finished_at', { ascending: false }).limit(1).maybeSingle();
    const finishedAt = (data as { finished_at?: string } | null)?.finished_at;
    return { skip: !!finishedAt, finishedAt };
  } catch {
    // Fail open — a guard-check failure must never block a legitimate
    // attempt. Worst case on failure is the pre-existing behavior (re-attempt).
    return { skip: false };
  }
}
