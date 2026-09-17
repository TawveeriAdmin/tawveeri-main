import { createServerClient } from '@/lib/database';

export type ScrapingJobType = 'discovery' | 'price_update';
// 'timeout'/'cancelled' added 2026-09-17 (isolated-worker migration) so the
// worker's proc-guard outcomes are recorded accurately instead of collapsing
// into 'failed'. scraping_runs.status is a plain unconstrained text column —
// this is a type-annotation widening, not a database schema change.
export type ScrapingRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial' | 'timeout' | 'cancelled';
export type ScrapingTriggerSource = 'schedule' | 'manual' | 'api';

export interface StartRunParams {
  /** NOT NULL in scraping_runs — always supplied explicitly, never left to a default. */
  store_name: string;
  /** FK to stores.id (integer). Optional: not every ingestion path resolves a store row. */
  store_id?: number | null;
  job_type: ScrapingJobType;
  schedule_id?: string | null;
  triggered_by?: ScrapingTriggerSource;
  triggered_by_user_id?: string | null;
  /** Defaults to 'running' (the existing behavior — every prior caller starts
   *  a run it immediately executes). Pass 'pending' to enqueue a run for the
   *  isolated worker to pick up instead of executing it in the caller's own
   *  process — see src/app/api/admin/scraping/schedules/[id]/run-now/route.ts. */
  status?: 'pending' | 'running';
  /** Reuses the existing scraping_runs.metadata jsonb column (no schema
   *  change) to carry the original request options (max_pages, categories,
   *  max_products, older_than_hours) so a 'pending' row is fully self-
   *  describing for whichever process later executes it. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Overlap protection. Returns true if the store already has a run in a
 * non-terminal state (`running` or `pending`) that started recently.
 *
 * A run older than `staleAfterMinutes` is treated as dead (the process crashed
 * without a terminal status) and does NOT block a new run, so a single stuck
 * row can never freeze a store's ingestion permanently.
 *
 * Fails open (returns false) on query error: preventing a legitimate run is
 * worse than a rare double-run, which the per-store sync state tolerates.
 */
export async function hasActiveRun(storeId: number, staleAfterMinutes = 120): Promise<boolean> {
  try {
    const supabase = createServerClient();
    const cutoff = new Date(Date.now() - staleAfterMinutes * 60_000).toISOString();
    const { data, error } = await (supabase as any)
      .from('scraping_runs')
      .select('id')
      .eq('store_id', storeId)
      .in('status', ['running', 'pending'])
      .gte('started_at', cutoff)
      .limit(1);
    if (error) {
      console.error('[run-logger] hasActiveRun error:', error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.error('[run-logger] hasActiveRun threw:', err);
    return false;
  }
}

export interface FinishRunParams {
  /** scraping_runs.id is bigint. */
  run_id: number;
  status: ScrapingRunStatus;
  products_discovered?: number;
  products_new?: number;
  products_updated?: number;
  products_failed?: number;
  price_changes_detected?: number;
  errors_count?: number;
  error_summary?: unknown;
}

/**
 * Insert a scraping_runs row with status=pending and return its id.
 * Never throws — if logging fails, the caller should proceed and rely on
 * orchestrator-level error handling.
 */
/**
 * Close out runs this store left in `running`/`pending` past the point where they could
 * still be alive, marking them `failed` with a reason.
 *
 * WHY. A run row is opened before the scrape and closed after it. If the process dies,
 * is redeployed, or the request times out, the row is never closed and stays `running`
 * forever. Measured 2026-08-02: **60 such rows**, the oldest 266 hours old — noon 30,
 * jarir 15, extra 8. Two concrete harms, both silent:
 *   1. `hasActiveRun` treats a corpse as a live run for its 120-minute window, so the
 *      store is skipped ("active run in progress") and cannot be re-attempted.
 *   2. platform-health FAILs on stuck scheduled runs, so a real stuck run is
 *      indistinguishable from the accumulated debris and nobody can act on either.
 *
 * Reaping on `startRun` keeps this self-healing with no new cron and no new table: the
 * next attempt for a store cleans up that store's corpses first.
 */
export async function reapStaleRuns(storeId: number | null, staleAfterMinutes = 120): Promise<number> {
  if (storeId == null) return 0;
  try {
    const supabase = createServerClient();
    const cutoff = new Date(Date.now() - staleAfterMinutes * 60_000).toISOString();
    const { data, error } = await (supabase as any)
      .from('scraping_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: `run never completed — reaped after ${staleAfterMinutes}m`,
      })
      .eq('store_id', storeId)
      .in('status', ['running', 'pending'])
      .lt('started_at', cutoff)
      .select('id');
    if (error) { console.error('[run-logger] reapStaleRuns error:', error.message); return 0; }
    const n = data?.length ?? 0;
    if (n) console.log(`[run-logger] reaped ${n} stale run(s) for store ${storeId}`);
    return n;
  } catch (err) {
    console.error('[run-logger] reapStaleRuns threw:', err);
    return 0;
  }
}

export async function startRun(params: StartRunParams): Promise<number | null> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('scraping_runs')
      .insert({
        // NOT NULL columns, always supplied explicitly:
        store_name: params.store_name,
        run_type: params.job_type,
        status: params.status ?? 'running',
        // A 'pending' row has no started_at yet (see run-logger.ts's own
        // comment: this timestamp is used to compute duration_ms on finish,
        // which should measure execution time, not queue wait time).
        started_at: params.status === 'pending' ? null : new Date().toISOString(),
        // Optional / newer columns:
        store_id: params.store_id ?? null,
        job_type: params.job_type,
        schedule_id: params.schedule_id ?? null,
        triggered_by: params.triggered_by ?? 'manual',
        triggered_by_user_id: params.triggered_by_user_id ?? null,
        metadata: params.metadata ?? null,
      } as never)
      .select('id')
      .single();

    if (error || !data) {
      console.error('[run-logger] startRun failed:', error?.message);
      return null;
    }
    return Number((data as { id: number | string }).id);
  } catch (err) {
    console.error('[run-logger] startRun threw:', err);
    return null;
  }
}

/**
 * Update the run row with final stats and status. Computes duration_ms.
 * Also updates the parent schedule's last_run_at / last_success_at.
 */
export async function finishRun(params: FinishRunParams): Promise<void> {
  try {
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from('scraping_runs')
      .select('started_at, schedule_id')
      .eq('id', params.run_id as unknown as string)
      .single();

    const startedAt = (existing as { started_at?: string } | null)?.started_at;
    const finishedAt = new Date();
    const durationMs = startedAt ? finishedAt.getTime() - new Date(startedAt).getTime() : null;

    const { error: updateError } = await supabase
      .from('scraping_runs')
      .update({
        status: params.status,
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
        products_discovered: params.products_discovered ?? 0,
        products_new: params.products_new ?? 0,
        products_updated: params.products_updated ?? 0,
        products_failed: params.products_failed ?? 0,
        price_changes_detected: params.price_changes_detected ?? 0,
        errors_count: params.errors_count ?? 0,
        error_summary: (params.error_summary as never) ?? null,
      } as never)
      // types.ts still describes the legacy application database (uuid keys).
      // scraping_runs.id is bigint in the knowledge database; cast at the boundary
      // until types are regenerated post-consolidation.
      .eq('id', params.run_id as unknown as string);

    // WHY check this now (found live, 2026-09-17): Supabase's .update() does
    // NOT throw on a DB-level rejection (e.g. a CHECK constraint violation)
    // — it resolves normally with {error} set. This call previously never
    // looked at that, so a write that the database silently refused (e.g.
    // an out-of-range `status` value) left the row exactly as it was —
    // still 'running', finished_at still null — with zero signal anywhere.
    // That is precisely how the first live per-store timeout under the
    // isolated worker went undetected: the row never closed, the process
    // exited cleanly, and nothing looked wrong until someone queried the
    // row directly. Logging (not throwing — see the function's own
    // "never throws" contract below) at least makes the failure visible.
    if (updateError) {
      console.error('[run-logger] finishRun update rejected by DB:', updateError.message, 'run_id=', params.run_id, 'status=', params.status);
    }

    const scheduleId = (existing as { schedule_id?: string | null } | null)?.schedule_id;
    if (scheduleId) {
      const update: Record<string, unknown> = { last_run_at: finishedAt.toISOString() };
      if (params.status === 'success' || params.status === 'partial') {
        update.last_success_at = finishedAt.toISOString();
      }
      await supabase.from('scraping_schedules').update(update as never).eq('id', scheduleId);
    }
  } catch (err) {
    console.error('[run-logger] finishRun threw:', err);
  }
}

export async function failRun(runId: number, error: unknown): Promise<void> {
  const summary = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  await finishRun({
    run_id: runId,
    status: 'failed',
    errors_count: 1,
    error_summary: summary,
  });
}
