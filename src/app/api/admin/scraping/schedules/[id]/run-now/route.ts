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

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured. Set it before running scrapers manually.' },
      { status: 503 },
    );
  }

  const runId = await startRun({
    store_name: s.stores.slug,
    store_id: Number(s.store_id), // stores.id is integer on the knowledge DB
    job_type: s.job_type,
    schedule_id: s.id,
    triggered_by: 'manual',
    triggered_by_user_id: admin.id,
  });

  const path = s.job_type === 'discovery' ? '/api/cron/discover-products' : '/api/cron/update-prices';
  const body: Record<string, unknown> = {
    store_slug: s.stores.slug,
    run_id: runId,
    schedule_id: s.id,
    triggered_by_user_id: admin.id,
  };
  if (s.job_type === 'discovery') {
    body.max_pages = s.max_pages ?? 10;
    if (s.categories && s.categories.length > 0) body.categories = s.categories;
  } else {
    body.max_products = s.max_products ?? 100;
    body.older_than_hours = s.older_than_hours ?? 24;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

  // Fire-and-forget.
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cronSecret}` },
    body: JSON.stringify(body),
  }).catch((err) => console.error('[run-now] fetch failed:', err));

  createAuditLog({
    user_id: admin.id,
    action: AUDIT_ACTIONS.SCRAPING_RUN_TRIGGERED,
    entity_type: 'scraping_schedule',
    entity_id: id,
    details: { run_id: runId, job_type: s.job_type, store_slug: s.stores.slug },
  }).catch(() => {});

  return NextResponse.json({ ok: true, run_id: runId });
}
