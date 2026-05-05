import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

/**
 * GET /api/admin/scraping/health
 * Returns per-store coverage snapshot used by the health dashboard.
 * Backed by the v_scraping_coverage view defined in migration 17.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const supabase = createServerClient();

  // Per-store coverage from the view.
  const { data: coverage, error: covErr } = await (supabase as any)
    .from('v_scraping_coverage')
    .select('*')
    .order('total_products', { ascending: false });

  if (covErr) {
    return NextResponse.json({ error: covErr.message }, { status: 500 });
  }

  // Last-24h run stats so the UI can surface recent failure rate.
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data: runs } = await supabase
    .from('scraping_runs')
    .select('store_id, status, errors_count, products_updated')
    .gte('created_at', since.toISOString());

  const runStats: Record<string, { runs: number; failed: number; updated: number; errors: number }> = {};
  for (const r of (runs ?? []) as Array<{
    store_id: string;
    status: string;
    errors_count: number;
    products_updated: number;
  }>) {
    const s = (runStats[r.store_id] ||= { runs: 0, failed: 0, updated: 0, errors: 0 });
    s.runs += 1;
    if (r.status === 'failed') s.failed += 1;
    s.updated += r.products_updated || 0;
    s.errors += r.errors_count || 0;
  }

  const stores = (coverage ?? []).map((row: any) => ({
    ...row,
    runs_last_24h: runStats[row.store_id]?.runs ?? 0,
    failed_runs_last_24h: runStats[row.store_id]?.failed ?? 0,
    products_updated_last_24h: runStats[row.store_id]?.updated ?? 0,
    total_errors_last_24h: runStats[row.store_id]?.errors ?? 0,
    coverage_pct_24h: row.total_products > 0
      ? Math.round((row.refreshed_last_24h / row.total_products) * 100)
      : null,
  }));

  const totals = stores.reduce(
    (acc: any, s: any) => ({
      total_products: acc.total_products + (s.total_products || 0),
      refreshed_last_24h: acc.refreshed_last_24h + (s.refreshed_last_24h || 0),
      stale_over_48h: acc.stale_over_48h + (s.stale_over_48h || 0),
      chronic_failures: acc.chronic_failures + (s.chronic_failures || 0),
    }),
    { total_products: 0, refreshed_last_24h: 0, stale_over_48h: 0, chronic_failures: 0 }
  );

  return NextResponse.json({ stores, totals });
}
