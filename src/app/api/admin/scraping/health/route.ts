import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';

/**
 * GET /api/admin/scraping/health
 *
 * Per-store ingestion health, computed from tables that actually exist:
 * stores, scraping_runs, raw_observations, price_history, store_sync_status.
 *
 * This route previously read a `v_scraping_coverage` view. That view does not
 * exist on the knowledge database, so the endpoint returned 500. It is now
 * computed directly and depends on no database objects being created.
 *
 * Store-name matching note: ingestion paths do not yet agree on a store key —
 * raw_observations records Arabic display names while price_history mixes
 * Arabic and latin slugs. Until that is normalised, every store is matched
 * against a set of aliases and the aliases are returned so the inconsistency
 * is visible rather than silently under-counting.
 */

const STALE_HOURS = 24;
const CONSECUTIVE_FAILURE_ALERT = 2;

/**
 * Observed store_name values per slug.
 *
 * Three naming conventions are currently in use and none of them agree:
 *   - the slug            e.g. 'jarir'
 *   - stores.name         e.g. 'مكتبة جرير'
 *   - the value ingestion writes  e.g. 'جرير'
 *
 * Deriving aliases from `stores` alone makes actively-ingesting stores appear
 * as "never ingested" (Extra ingests ~1,200 observations a day but its display
 * name 'إكسترا' never matches the ingested 'اكسترا'). This map is a temporary
 * shim so the health view reports reality. It is removed by the store-identity
 * normalisation phase, which makes the slug the single key.
 */
const STORE_NAME_ALIASES: Record<string, string[]> = {
  jarir: ['jarir', 'جرير', 'مكتبة جرير'],
  extra: ['extra', 'اكسترا', 'إكسترا'],
  almanea: ['almanea', 'المنيع'],
  amazon: ['amazon', 'أمازون', 'أمازون السعودية'],
  noon: ['noon', 'نون'],
  samsung_ksa: ['samsung_ksa', 'سامسونج', 'سامسونج السعودية'],
  shaker: ['shaker', 'شاكر'],
  swsg: ['swsg', 'الشتاء والصيف'],
};

type RunRow = {
  id: number;
  store_name: string | null;
  store_id: number | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  products_discovered: number | null;
  products_new: number | null;
  products_updated: number | null;
  products_failed: number | null;
  price_changes_detected: number | null;
  errors_count: number | null;
  error_summary: unknown;
};

const hoursSince = (iso: string | null | undefined): number | null =>
  iso ? Math.round(((Date.now() - new Date(iso).getTime()) / 3_600_000) * 10) / 10 : null;

export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const supabase = createServerClient();
  const sinceIso = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const [storesRes, runsRes, syncRes] = await Promise.all([
    // types.ts describes the legacy application database, whose stores table has
    // name_ar/name_en. The knowledge database has a single `name` column.
    (supabase as any).from('stores').select('id, name, slug'),
    (supabase as any)
      .from('scraping_runs')
      .select(
        'id, store_name, store_id, status, started_at, finished_at, duration_ms, products_discovered, products_new, products_updated, products_failed, price_changes_detected, errors_count, error_summary'
      )
      .order('started_at', { ascending: false })
      .limit(500),
    (supabase as any).from('store_sync_status').select('*'),
  ]);

  if (storesRes.error) {
    return NextResponse.json({ error: storesRes.error.message }, { status: 500 });
  }

  const stores = (storesRes.data ?? []) as Array<{ id: number; name: string; slug: string }>;
  const runs = (runsRes.data ?? []) as RunRow[];
  const syncStates = (syncRes.data ?? []) as Array<Record<string, any>>;

  const perStore = await Promise.all(
    stores.map(async (store) => {
      const aliases = Array.from(
        new Set([...(STORE_NAME_ALIASES[store.slug] ?? []), store.slug, store.name].filter(Boolean))
      );

      const storeRuns = runs.filter(
        (r) => r.store_id === store.id || (r.store_name != null && aliases.includes(r.store_name))
      );

      const lastRun = storeRuns[0] ?? null;
      const lastSuccess = storeRuns.find((r) => r.status === 'success') ?? null;
      const lastFailure = storeRuns.find((r) => r.status === 'failed') ?? null;

      // Consecutive failures: walk newest-first until a non-failure terminal run.
      let consecutiveFailures = 0;
      for (const r of storeRuns) {
        if (r.status === 'running' || r.status === 'pending') continue;
        if (r.status === 'failed') consecutiveFailures++;
        else break;
      }

      const runs24h = storeRuns.filter((r) => r.started_at && r.started_at >= sinceIso);
      const zeroResultRuns24h = runs24h.filter((r) => (r.products_discovered ?? 0) === 0).length;

      const sum = (k: keyof RunRow) =>
        runs24h.reduce((a, r) => a + (Number(r[k]) || 0), 0);

      // Freshness and written volumes, counted per alias then summed.
      let rawNewest: string | null = null;
      let priceNewest: string | null = null;
      let rawWritten24h = 0;
      let priceWritten24h = 0;

      for (const alias of aliases) {
        const [rawNew, priceNew, rawCount, priceCount] = await Promise.all([
          (supabase as any)
            .from('raw_observations')
            .select('scraped_at')
            .eq('store_name', alias)
            .order('scraped_at', { ascending: false })
            .limit(1),
          (supabase as any)
            .from('price_history')
            .select('observed_at')
            .eq('store_name', alias)
            .order('observed_at', { ascending: false })
            .limit(1),
          (supabase as any)
            .from('raw_observations')
            .select('id', { count: 'exact', head: true })
            .eq('store_name', alias)
            .gte('scraped_at', sinceIso),
          (supabase as any)
            .from('price_history')
            .select('id', { count: 'exact', head: true })
            .eq('store_name', alias)
            .gte('observed_at', sinceIso),
        ]);

        const rn = rawNew.data?.[0]?.scraped_at ?? null;
        const pn = priceNew.data?.[0]?.observed_at ?? null;
        if (rn && (!rawNewest || rn > rawNewest)) rawNewest = rn;
        if (pn && (!priceNewest || pn > priceNewest)) priceNewest = pn;
        rawWritten24h += rawCount.count ?? 0;
        priceWritten24h += priceCount.count ?? 0;
      }

      const syncState = syncStates.find((s) => aliases.includes(s.store_name)) ?? null;

      const freshestIngestion =
        rawNewest && priceNewest ? (rawNewest > priceNewest ? rawNewest : priceNewest) : rawNewest ?? priceNewest;
      const ingestionAgeHours = hoursSince(freshestIngestion);

      const alerts: string[] = [];
      if (ingestionAgeHours === null) alerts.push('never_ingested');
      else if (ingestionAgeHours > STALE_HOURS) alerts.push('stale_ingestion');
      if (consecutiveFailures >= CONSECUTIVE_FAILURE_ALERT) alerts.push('consecutive_failures');
      if (runs24h.length > 0 && zeroResultRuns24h === runs24h.length) alerts.push('all_runs_zero_result');
      if (runs24h.length === 0 && storeRuns.length > 0) alerts.push('no_runs_last_24h');
      if (syncState?.last_error) alerts.push('adapter_error');

      return {
        store_id: store.id,
        slug: store.slug,
        name: store.name,
        store_name_aliases: aliases,

        // Freshness
        last_raw_observation_at: rawNewest,
        last_price_observation_at: priceNewest,
        ingestion_age_hours: ingestionAgeHours,
        is_stale: ingestionAgeHours === null || ingestionAgeHours > STALE_HOURS,

        // Run outcomes
        last_run_at: lastRun?.started_at ?? null,
        last_run_status: lastRun?.status ?? null,
        last_successful_run_at: lastSuccess?.finished_at ?? lastSuccess?.started_at ?? null,
        last_failed_run_at: lastFailure?.finished_at ?? lastFailure?.started_at ?? null,
        last_error: (lastFailure?.error_summary as any)?.message ?? syncState?.last_error ?? null,
        last_run_duration_ms: lastRun?.duration_ms ?? null,
        avg_run_duration_ms:
          runs24h.length > 0
            ? Math.round(runs24h.reduce((a, r) => a + (r.duration_ms ?? 0), 0) / runs24h.length)
            : null,
        consecutive_failures: consecutiveFailures,

        // Volumes over the last 24h. `inserted` counts NEW products only and is
        // NOT a success rate — `persisted` is inserted + updated.
        runs_last_24h: runs24h.length,
        failed_runs_last_24h: runs24h.filter((r) => r.status === 'failed').length,
        zero_result_runs_last_24h: zeroResultRuns24h,
        fetched_last_24h: sum('products_discovered'),
        inserted_last_24h: sum('products_new'),
        updated_last_24h: sum('products_updated'),
        failed_last_24h: sum('products_failed'),
        persisted_last_24h: sum('products_new') + sum('products_updated'),
        price_rows_last_24h: sum('price_changes_detected'),
        raw_observations_written_last_24h: rawWritten24h,
        price_history_written_last_24h: priceWritten24h,

        // Adapter paging state (adapter-driven stores only)
        adapter_status: syncState?.status ?? null,
        adapter_next_page: syncState?.next_page ?? null,
        adapter_total_fetched: syncState?.total_fetched ?? null,
        adapter_total_new_products: syncState?.total_saved ?? null,

        alerts,
      };
    })
  );

  const totals = {
    stores: perStore.length,
    ingesting_stores: perStore.filter((s) => !s.is_stale).length,
    stale_stores: perStore.filter((s) => s.is_stale).length,
    stores_with_alerts: perStore.filter((s) => s.alerts.length > 0).length,
    runs_last_24h: perStore.reduce((a, s) => a + s.runs_last_24h, 0),
    failed_runs_last_24h: perStore.reduce((a, s) => a + s.failed_runs_last_24h, 0),
    zero_result_runs_last_24h: perStore.reduce((a, s) => a + s.zero_result_runs_last_24h, 0),
    fetched_last_24h: perStore.reduce((a, s) => a + s.fetched_last_24h, 0),
    inserted_last_24h: perStore.reduce((a, s) => a + s.inserted_last_24h, 0),
    updated_last_24h: perStore.reduce((a, s) => a + s.updated_last_24h, 0),
    failed_last_24h: perStore.reduce((a, s) => a + s.failed_last_24h, 0),
    raw_observations_written_last_24h: perStore.reduce((a, s) => a + s.raw_observations_written_last_24h, 0),
    price_history_written_last_24h: perStore.reduce((a, s) => a + s.price_history_written_last_24h, 0),
  };

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    thresholds: { stale_hours: STALE_HOURS, consecutive_failure_alert: CONSECUTIVE_FAILURE_ALERT },
    metric_notes: {
      fetched: 'offers returned by the source',
      skipped: 'discarded before persistence (missing name, or duplicate within batch)',
      inserted: 'products created for the first time — NOT a success rate',
      updated: 'existing products whose store offer was rewritten',
      persisted: 'inserted + updated — the real success count',
      failed: 'offers that errored during persistence',
    },
    stores: perStore,
    totals,
  });
}
