import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';
import { createNotification } from '@/lib/auth/notifications';
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

export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('scraping_schedules')
    .select(`
      id, store_id, job_type, cron_expression, is_enabled,
      max_pages, max_products, older_than_hours, categories,
      is_live_search_enabled,
      last_run_at, last_success_at, next_run_at,
      created_at, updated_at,
      stores:store_id (id, slug, name_ar, name_en, logo_url)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedules: data ?? [] });
}

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    store_id,
    job_type,
    cron_expression = '0 */6 * * *',
    is_enabled = false,
    max_pages = 10,
    max_products = 100,
    older_than_hours = 24,
    categories = null,
    is_live_search_enabled = false,
  } = body;

  if (!store_id || !job_type) {
    return NextResponse.json({ error: 'store_id and job_type are required' }, { status: 400 });
  }
  if (job_type !== 'discovery' && job_type !== 'price_update') {
    return NextResponse.json({ error: 'Invalid job_type' }, { status: 400 });
  }
  if (!isValidCron(cron_expression)) {
    return NextResponse.json({ error: 'Invalid cron_expression' }, { status: 400 });
  }

  const supabase = createServerClient();
  const nextRunAt = is_enabled ? computeNextRunAt(cron_expression).toISOString() : null;

  const { data, error } = await supabase
    .from('scraping_schedules')
    .insert({
      store_id,
      job_type,
      cron_expression,
      is_enabled,
      max_pages,
      max_products,
      older_than_hours,
      categories,
      is_live_search_enabled,
      next_run_at: nextRunAt,
      created_by: admin.id,
    } as never)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  createAuditLog({
    user_id: admin.id,
    action: AUDIT_ACTIONS.SCRAPING_SCHEDULE_CREATED,
    entity_type: 'scraping_schedule',
    entity_id: (data as { id: string }).id,
    details: { store_id, job_type, cron_expression, is_enabled },
  }).catch(() => {});

  createNotification({
    user_id: admin.id,
    type: 'system',
    title_ar: 'تم إنشاء جدولة السكرابر',
    title_en: 'Scraping schedule created',
    message_ar: `تم إنشاء جدولة ${job_type} جديدة.`,
    message_en: `A new ${job_type} schedule was created.`,
  }).catch(() => {});

  return NextResponse.json({ schedule: data }, { status: 201 });
}
