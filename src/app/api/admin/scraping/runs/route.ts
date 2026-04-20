import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const url = new URL(request.url);
  const storeId = url.searchParams.get('store_id');
  const status = url.searchParams.get('status');
  const jobType = url.searchParams.get('job_type');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const supabase = createServerClient();
  let query = supabase
    .from('scraping_runs')
    .select(`
      id, schedule_id, store_id, job_type, status,
      started_at, finished_at, duration_ms,
      products_discovered, products_updated, price_changes_detected,
      errors_count, error_summary, triggered_by, triggered_by_user_id,
      created_at,
      stores:store_id (slug, name_ar, name_en)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (storeId) query = query.eq('store_id', storeId);
  if (status) query = query.eq('status', status as never);
  if (jobType) query = query.eq('job_type', jobType as never);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [], total: count ?? 0 });
}
