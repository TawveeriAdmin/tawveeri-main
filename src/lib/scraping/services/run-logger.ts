import { createServerClient } from '@/lib/database';

export type ScrapingJobType = 'discovery' | 'price_update';
export type ScrapingRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';
export type ScrapingTriggerSource = 'schedule' | 'manual' | 'api';

export interface StartRunParams {
  store_id: string;
  job_type: ScrapingJobType;
  schedule_id?: string | null;
  triggered_by?: ScrapingTriggerSource;
  triggered_by_user_id?: string | null;
}

export interface FinishRunParams {
  run_id: string;
  status: ScrapingRunStatus;
  products_discovered?: number;
  products_updated?: number;
  price_changes_detected?: number;
  errors_count?: number;
  error_summary?: unknown;
}

/**
 * Insert a scraping_runs row with status=pending and return its id.
 * Never throws — if logging fails, the caller should proceed and rely on
 * orchestrator-level error handling.
 */
export async function startRun(params: StartRunParams): Promise<string | null> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('scraping_runs')
      .insert({
        store_id: params.store_id,
        job_type: params.job_type,
        schedule_id: params.schedule_id ?? null,
        status: 'running',
        started_at: new Date().toISOString(),
        triggered_by: params.triggered_by ?? 'manual',
        triggered_by_user_id: params.triggered_by_user_id ?? null,
      } as never)
      .select('id')
      .single();

    if (error || !data) {
      console.error('[run-logger] startRun failed:', error?.message);
      return null;
    }
    return (data as { id: string }).id;
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
      .eq('id', params.run_id)
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
        products_updated: params.products_updated ?? 0,
        price_changes_detected: params.price_changes_detected ?? 0,
        errors_count: params.errors_count ?? 0,
        error_summary: (params.error_summary as never) ?? null,
      } as never)
      .eq('id', params.run_id);

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

export async function failRun(runId: string, error: unknown): Promise<void> {
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
