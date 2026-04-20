import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { computeNextRunAt } from '@/lib/scraping/services/schedule-dispatcher';
import { CronExpressionParser } from 'cron-parser';

function isValidCron(expr: string): boolean {
  try {
    CronExpressionParser.parse(expr);
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(
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

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  const allowed = [
    'cron_expression',
    'is_enabled',
    'max_pages',
    'max_products',
    'older_than_hours',
    'categories',
    'is_live_search_enabled',
    'coverage_mode',
    'target_refresh_hours',
    'chunk_size',
  ];
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (typeof update.cron_expression === 'string' && !isValidCron(update.cron_expression)) {
    return NextResponse.json({ error: 'Invalid cron_expression' }, { status: 400 });
  }

  // If enabling or changing cadence, recompute next_run_at.
  if ('is_enabled' in update || 'cron_expression' in update) {
    const supabase = createServerClient();
    const { data: current } = await supabase
      .from('scraping_schedules')
      .select('cron_expression, is_enabled')
      .eq('id', id)
      .single();

    const effectiveCron = (update.cron_expression as string | undefined) ??
      (current as { cron_expression?: string } | null)?.cron_expression ?? '0 */6 * * *';
    const effectiveEnabled = (update.is_enabled as boolean | undefined) ??
      (current as { is_enabled?: boolean } | null)?.is_enabled ?? false;

    update.next_run_at = effectiveEnabled ? computeNextRunAt(effectiveCron).toISOString() : null;
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('scraping_schedules')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  createAuditLog({
    user_id: admin.id,
    action: AUDIT_ACTIONS.SCRAPING_SCHEDULE_UPDATED,
    entity_type: 'scraping_schedule',
    entity_id: id,
    details: update,
  }).catch(() => {});

  return NextResponse.json({ schedule: data });
}

export async function DELETE(
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
  const { error } = await supabase.from('scraping_schedules').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  createAuditLog({
    user_id: admin.id,
    action: AUDIT_ACTIONS.SCRAPING_SCHEDULE_DELETED,
    entity_type: 'scraping_schedule',
    entity_id: id,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
