import { createServerClient } from '@/lib/database';

export type ScrapingJobType = 'discovery' | 'price_update';
export type ScrapingRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';
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
export async function startRun(params: StartRunParams): Promise<number | null> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('scraping_runs')
      .insert({
        // NOT NULL columns, always supplied explicitly:
        store_name: params.store_name,
        run_type: params.job_type,
        status: 'running',
        started_at: new Date().toISOString(),
        // Optional / newer columns:
        store_id: params.store_id ?? null,
        job_type: params.job_type,
        schedule_id: params.schedule_id ?? null,
        triggered_by: params.triggered_by ?? 'manual',
        triggered_by_user_id: params.triggered_by_user_id ?? null,
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

    await supabase
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
