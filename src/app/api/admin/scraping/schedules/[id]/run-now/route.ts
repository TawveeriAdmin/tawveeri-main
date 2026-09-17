import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { startRun } from '@/lib/scraping/services/run-logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let admin;
  try {
    admin = await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data: schedule, error } = await supabase
    .from('scraping_schedules')
    .select(`
      id, store_id, job_type, max_pages, max_products, older_than_hours, categories,
      stores:store_id (slug)
    `)
    .eq('id', id)
    .single();

  if (error || !schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  }

  const s = schedule as unknown as {
    id: string;
    store_id: string;
    job_type: 'discovery' | 'price_update';
    max_pages: number | null;
    max_products: number | null;
    older_than_hours: number | null;
    categories: string[] | null;
    stores: { slug: string };
  };

  // CHANGED 2026-09-17 (isolated-worker migration, SEV-1 follow-up): this
  // route used to fire-and-forget an HTTP POST to /api/cron/discover-products
  // or /api/cron/update-prices — running real scraping (Puppeteer/Browserless
  // included) directly inside tawveeri-main's process, invisibly to the
  // caller. That is exactly the pattern the migration exists to eliminate,
  // and it applied to admin-triggered runs just as much as the old scheduler.
  //
  // Instead of executing anything here, this now DELEGATES to the isolated
  // worker: it enqueues a 'pending' scraping_runs row (an existing, already-
  // supported status — see run-logger.ts's ScrapingRunStatus) with the
  // request options stashed in the existing `metadata` jsonb column (no
  // schema change). scripts/worker/jobs/manual-trigger.ts polls for these
  // and executes them through the SAME ScrapingOrchestrator methods the
  // scheduled jobs use, under the same global lock and timeout guard.
  //
  // If the worker is down, this row simply waits — it does NOT silently fall
  // back to running in tawveeri-main.
  const options: Record<string, unknown> =
    s.job_type === 'discovery'
      ? { max_pages: s.max_pages ?? 10, categories: s.categories && s.categories.length > 0 ? s.categories : undefined }
      : { max_products: s.max_products ?? 100, older_than_hours: s.older_than_hours ?? 24 };

  const runId = await startRun({
    store_name: s.stores.slug,
    store_id: Number(s.store_id), // stores.id is integer on the knowledge DB
    job_type: s.job_type,
    schedule_id: s.id,
    triggered_by: 'manual',
    triggered_by_user_id: admin.id,
    status: 'pending',
    metadata: { options, enqueued_via: 'admin_run_now' },
  });

  createAuditLog({
    user_id: admin.id,
    action: AUDIT_ACTIONS.SCRAPING_RUN_TRIGGERED,
    entity_type: 'scraping_schedule',
    entity_id: id,
    details: { run_id: runId, job_type: s.job_type, store_slug: s.stores.slug, execution: 'delegated_to_isolated_worker' },
  }).catch(() => {});

  return NextResponse.json({ ok: true, run_id: runId, execution: 'delegated_to_isolated_worker' });
}
