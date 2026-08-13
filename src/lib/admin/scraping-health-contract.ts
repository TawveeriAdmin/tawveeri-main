// Scraping-health page contract (founder mission 2026-08-13).
//
// The /api/admin/scraping/health payload and the health page drifted apart
// once before: the API was rebuilt around real tables while the page kept
// rendering the retired v_scraping_coverage shape, so `totals.total_products`
// was undefined and `.toLocaleString()` crashed the whole route in production
// (Sentry: "undefined is not an object (evaluating 'v.total_products.toLocaleString')").
//
// This module is the single normalization boundary between the API payload and
// the UI. Every field is coerced here, exactly once, into an explicit shape
// where `null` ALWAYS means "not measured / unknown" and `0` is only ever a
// measured zero. A malformed, partial, or legacy record degrades to nulls —
// it can never throw during render.

export interface StoreHealthView {
  storeId: string;
  slug: string;
  name: string;
  /** Hours since the newest raw/price observation; null = never ingested or unknown. */
  ingestionAgeHours: number | null;
  /** null = unknown (missing field), not "fresh". */
  isStale: boolean | null;
  lastIngestionAt: string | null;
  lastRunStatus: string | null;
  lastSuccessfulRunAt: string | null;
  lastError: string | null;
  consecutiveFailures: number | null;
  runsLast24h: number | null;
  failedRunsLast24h: number | null;
  persistedLast24h: number | null;
  rawWrittenLast24h: number | null;
  priceWrittenLast24h: number | null;
  alerts: string[];
}

export interface HealthTotalsView {
  stores: number | null;
  ingestingStores: number | null;
  staleStores: number | null;
  storesWithAlerts: number | null;
  runsLast24h: number | null;
  failedRunsLast24h: number | null;
  rawWrittenLast24h: number | null;
  priceWrittenLast24h: number | null;
}

/** Finite number or null — never NaN, never a crash on a missing field. */
export function asCount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asText(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function normalizeStoreHealth(raw: unknown): StoreHealthView | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const slug = asText(r.slug) ?? asText(r.store_slug);
  const storeId = r.store_id != null ? String(r.store_id) : slug;
  if (!storeId) return null; // no identity at all — drop the row, never crash
  const ingestionAgeHours = asCount(r.ingestion_age_hours);
  return {
    storeId,
    slug: slug ?? storeId,
    name: asText(r.name) ?? asText(r.store_name_en) ?? slug ?? storeId,
    ingestionAgeHours,
    isStale: typeof r.is_stale === 'boolean' ? r.is_stale : null,
    lastIngestionAt:
      asText(r.last_price_observation_at) ?? asText(r.last_raw_observation_at) ?? null,
    lastRunStatus: asText(r.last_run_status),
    lastSuccessfulRunAt: asText(r.last_successful_run_at),
    lastError: asText(r.last_error),
    consecutiveFailures: asCount(r.consecutive_failures),
    runsLast24h: asCount(r.runs_last_24h),
    failedRunsLast24h: asCount(r.failed_runs_last_24h),
    persistedLast24h: asCount(r.persisted_last_24h),
    rawWrittenLast24h: asCount(r.raw_observations_written_last_24h),
    priceWrittenLast24h: asCount(r.price_history_written_last_24h),
    alerts: Array.isArray(r.alerts) ? r.alerts.filter((a): a is string => typeof a === 'string') : [],
  };
}

export function normalizeHealthTotals(raw: unknown): HealthTotalsView | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    stores: asCount(r.stores),
    ingestingStores: asCount(r.ingesting_stores),
    staleStores: asCount(r.stale_stores),
    storesWithAlerts: asCount(r.stores_with_alerts),
    runsLast24h: asCount(r.runs_last_24h),
    failedRunsLast24h: asCount(r.failed_runs_last_24h),
    rawWrittenLast24h: asCount(r.raw_observations_written_last_24h),
    priceWrittenLast24h: asCount(r.price_history_written_last_24h),
  };
}

/**
 * Render a count honestly: a measured number (incl. true 0) formats as a
 * number; null/unknown renders as "—" — never as 0.
 */
export function fmtCount(v: number | null): string {
  return v === null ? '—' : v.toLocaleString();
}

/** Attention order: most alerts first, then stale before fresh, then oldest ingestion first. */
export function sortStoresByAttention(stores: StoreHealthView[]): StoreHealthView[] {
  return [...stores].sort((a, b) => {
    if (a.alerts.length !== b.alerts.length) return b.alerts.length - a.alerts.length;
    const aStale = a.isStale === true ? 1 : 0;
    const bStale = b.isStale === true ? 1 : 0;
    if (aStale !== bStale) return bStale - aStale;
    const aAge = a.ingestionAgeHours ?? Number.POSITIVE_INFINITY;
    const bAge = b.ingestionAgeHours ?? Number.POSITIVE_INFINITY;
    return bAge - aAge;
  });
}
