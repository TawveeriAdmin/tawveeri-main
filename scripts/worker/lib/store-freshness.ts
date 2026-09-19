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

/**
 * Closes any 'still_open' worker_browser_sessions row for this store — call
 * right after detecting a per-store/per-unit child's timeout/cancelled
 * outcome. WHY (found live, 2026-09-19, testing the Browserless fix itself):
 * proc-guard's SIGTERM to a timed-out child gives it no chance to run its own
 * cleanup()/recordSessionEnd() — the OS-level browser process IS correctly
 * killed (proven repeatedly this session), but the METRICS row is left
 * 'still_open' forever, silently undercounting exactly the stores that
 * consume a full timeout in checkDailyBrowserlessBudget()'s sum. Only ONE
 * session can be open per store-run at a time (sequential per-store
 * execution), so "the most recent still_open row for this store" is
 * unambiguous — no session-id needs to be threaded from base-scraper.ts.
 * Duration is estimated as (now - started_at); this is a metrics record, not
 * a safety mechanism, so an approximation here is acceptable — unlike
 * scraping_runs/samsung_delta_watch_runs, this table has no boot-time reaper,
 * since sessions are orphaned by ordinary per-store timeouts (routine, not
 * just container swaps) and closing them immediately here is more precise.
 */
export async function closeOrphanedBrowserSession(storeSlug: string, reason: string): Promise<void> {
  try {
    // worker_browser_sessions (migration 034) isn't in the generated
    // Supabase types (types.ts describes the legacy app database, not the
    // knowledge DB) — cast at the boundary, same convention as
    // base-scraper.ts's own session-tracking calls.
    const supabase = createServerClient() as any;
    const { data } = await supabase
      .from('worker_browser_sessions')
      .select('id, started_at')
      .eq('store_slug', storeSlug)
      .eq('outcome', 'still_open')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = data as { id?: number; started_at?: string } | null;
    if (!row?.id) return;
    const durationMs = row.started_at ? Date.now() - new Date(row.started_at).getTime() : null;
    await supabase
      .from('worker_browser_sessions')
      .update({ ended_at: new Date().toISOString(), duration_ms: durationMs, outcome: 'error', error_message: `orphaned_by_kill: ${reason}` })
      .eq('id', row.id);
  } catch { /* metrics-only, never fatal */ }
}

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
