import { CronExpressionParser } from 'cron-parser';
import { createServerClient } from '@/lib/database';
import { startRun } from './run-logger';

export interface DueSchedule {
  schedule_id: string;
  store_id: string;
  store_slug: string;
  job_type: 'discovery' | 'price_update';
  max_pages: number | null;
  max_products: number | null;
  older_than_hours: number | null;
  categories: string[] | null;
  cron_expression: string;
  coverage_mode: boolean;
  target_refresh_hours: number;
  chunk_size: number | null;
}

/**
 * Compute the next fire time for a cron expression. Falls back to +1h if parse fails.
 */
export function computeNextRunAt(cronExpression: string, from: Date = new Date()): Date {
  try {
    const iter = CronExpressionParser.parse(cronExpression, { currentDate: from });
    return iter.next().toDate();
  } catch {
    const fallback = new Date(from);
    fallback.setHours(fallback.getHours() + 1);
    return fallback;
  }
}

/**
 * Read enabled schedules whose next_run_at has passed (or is null).
 * Returns up to `limit` rows.
 */
export async function fetchDueSchedules(limit = 20): Promise<DueSchedule[]> {
  const supabase = createServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('scraping_schedules')
    .select(`
      id, store_id, job_type, max_pages, max_products, older_than_hours,
      categories, cron_expression, next_run_at, is_enabled,
      coverage_mode, target_refresh_hours, chunk_size,
      stores!inner(slug)
    `)
    .eq('is_enabled', true)
    .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
    .limit(limit);

  if (error || !data) {
    if (error) console.error('[dispatcher] fetchDueSchedules error:', error.message);
    return [];
  }

  return (data as unknown as Array<{
    id: string;
    store_id: string;
    job_type: 'discovery' | 'price_update';
    max_pages: number | null;
    max_products: number | null;
    older_than_hours: number | null;
    categories: string[] | null;
    cron_expression: string;
    coverage_mode: boolean;
    target_refresh_hours: number;
    chunk_size: number | null;
    stores: { slug: string };
  }>).map((row) => ({
    schedule_id: row.id,
    store_id: row.store_id,
    store_slug: row.stores.slug,
    job_type: row.job_type,
    max_pages: row.max_pages,
    max_products: row.max_products,
    older_than_hours: row.older_than_hours,
    categories: row.categories,
    cron_expression: row.cron_expression,
    coverage_mode: row.coverage_mode ?? true,
    target_refresh_hours: row.target_refresh_hours ?? 24,
    chunk_size: row.chunk_size,
  }));
}

/**
 * Is there already a 'running' or 'pending' scraping_run for this schedule?
 * Used to prevent overlapping runs when a previous invocation is still working.
 */
async function hasActiveRun(scheduleId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('scraping_runs')
    .select('id')
    .eq('schedule_id', scheduleId)
    .in('status', ['running', 'pending'])
    .limit(1);
  if (error) {
    console.error('[dispatcher] hasActiveRun error:', error.message);
    return false; // fail open — prefer firing to deadlocking
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Compute how many products this price_update run should refresh so that the
 * entire catalog for this store gets checked within target_refresh_hours,
 * given the schedule's cron cadence.
 *
 * total_products / runs_per_window  = products per run
 * clamped by chunk_size if set.
 */
async function computeCoverageBatch(sched: DueSchedule): Promise<number> {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('product_stores')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', sched.store_id);

  const total = count ?? 0;
  if (total === 0) return sched.max_products ?? 100;

  // Estimate runs per target-refresh window from the cron expression.
  // Simplest approach: parse two consecutive fires and take the delta.
  let runsPerWindow = 1;
  try {
    const { CronExpressionParser } = await import('cron-parser');
    const iter = CronExpressionParser.parse(sched.cron_expression);
    const a = iter.next().toDate().getTime();
    const b = iter.next().toDate().getTime();
    const intervalHours = (b - a) / (1000 * 60 * 60);
    if (intervalHours > 0) {
      runsPerWindow = Math.max(1, Math.floor(sched.target_refresh_hours / intervalHours));
    }
  } catch {
    runsPerWindow = 1;
  }

  const perRun = Math.ceil(total / runsPerWindow);
  const capped = sched.chunk_size ? Math.min(perRun, sched.chunk_size) : perRun;
  // Always refresh at least 50 — avoids 0-product runs on new catalogs.
  return Math.max(50, capped);
}

/**
 * Claim a schedule for execution: advance next_run_at immediately so the next
 * dispatcher tick won't pick it up again. Returns true on success.
 */
export async function claimSchedule(scheduleId: string, cronExpression: string): Promise<boolean> {
  const supabase = createServerClient();
  const nextRunAt = computeNextRunAt(cronExpression).toISOString();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('scraping_schedules')
    .update({ next_run_at: nextRunAt, last_run_at: nowIso } as never)
    .eq('id', scheduleId);

  return !error;
}

/**
 * Fire a per-store cron route with run_id + schedule context. Does not await
 * the response — the called route updates scraping_runs itself.
 */
async function invokeCronRoute(params: {
  baseUrl: string;
  cronSecret: string;
  path: '/api/cron/discover-products' | '/api/cron/update-prices';
  body: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch(`${params.baseUrl}${params.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.cronSecret}`,
      },
      body: JSON.stringify(params.body),
    });
  } catch (err) {
    console.error('[dispatcher] invokeCronRoute failed:', err);
  }
}

export interface DispatchResult {
  due_count: number;
  dispatched: Array<{ schedule_id: string; store_slug: string; job_type: string; run_id: string | null }>;
}

/**
 * Main dispatch tick. Called every minute by the PM2 scheduler process.
 */
export async function dispatchDueSchedules(): Promise<DispatchResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const cronSecret = process.env.CRON_SECRET || '';

  const due = await fetchDueSchedules();
  const dispatched: DispatchResult['dispatched'] = [];

  for (const sched of due) {
    // Concurrency guard: if a previous run for this schedule is still 'running'
    // or 'pending', skip this tick. The next tick (1 min later) will try again.
    // Prevents double-scraping and hammering a store when a run exceeds its
    // cron interval.
    if (await hasActiveRun(sched.schedule_id)) {
      console.log(`[dispatcher] skip ${sched.store_slug}/${sched.job_type} — active run in progress`);
      continue;
    }

    const claimed = await claimSchedule(sched.schedule_id, sched.cron_expression);
    if (!claimed) continue;

    const runId = await startRun({
      store_id: sched.store_id,
      job_type: sched.job_type,
      schedule_id: sched.schedule_id,
      triggered_by: 'schedule',
    });

    const path: '/api/cron/discover-products' | '/api/cron/update-prices' =
      sched.job_type === 'discovery' ? '/api/cron/discover-products' : '/api/cron/update-prices';

    const body: Record<string, unknown> = {
      store_slug: sched.store_slug,
      run_id: runId,
      schedule_id: sched.schedule_id,
    };

    if (sched.job_type === 'discovery') {
      body.max_pages = sched.max_pages ?? 200;
      // Pass the full categories array; empty/null means "all categories".
      if (sched.categories && sched.categories.length > 0) {
        body.categories = sched.categories;
      }
    } else {
      // Coverage mode: compute batch so the whole catalog is refreshed within
      // target_refresh_hours given the cron cadence. Falls back to static
      // max_products if coverage_mode = false.
      const batch = sched.coverage_mode
        ? await computeCoverageBatch(sched)
        : (sched.max_products ?? 500);
      body.max_products = batch;
      body.older_than_hours = sched.older_than_hours ?? 24;
    }

    // Fire and forget — the cron route will update scraping_runs on completion.
    invokeCronRoute({ baseUrl, cronSecret, path, body }).catch(() => {});

    dispatched.push({
      schedule_id: sched.schedule_id,
      store_slug: sched.store_slug,
      job_type: sched.job_type,
      run_id: runId,
    });
  }

  return { due_count: due.length, dispatched };
}
