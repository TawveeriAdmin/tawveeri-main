/**
 * Regression tests for the scraping-health page contract (founder mission
 * 2026-08-13, Sentry: "undefined is not an object (evaluating
 * 'v.total_products.toLocaleString')").
 *
 * The health page crashed in production because it rendered a retired API
 * shape. These tests pin the normalization boundary: a valid record, a
 * measured zero, a null/undefined field, a partial/legacy record, and an
 * empty dataset must all normalize without throwing, and unknown must never
 * collapse into zero.
 */
import {
  normalizeStoreHealth,
  normalizeHealthTotals,
  sortStoresByAttention,
  fmtCount,
  asCount,
} from '@/lib/admin/scraping-health-contract';

const fullRecord = {
  store_id: 7,
  slug: 'jarir',
  name: 'جرير',
  ingestion_age_hours: 2.5,
  is_stale: false,
  last_raw_observation_at: '2026-08-13T06:00:00Z',
  last_price_observation_at: '2026-08-13T07:00:00Z',
  last_run_status: 'success',
  last_successful_run_at: '2026-08-13T07:00:00Z',
  last_error: null,
  consecutive_failures: 0,
  runs_last_24h: 4,
  failed_runs_last_24h: 0,
  persisted_last_24h: 120,
  raw_observations_written_last_24h: 300,
  price_history_written_last_24h: 280,
  alerts: [],
};

describe('normalizeStoreHealth', () => {
  it('valid positive numbers survive normalization', () => {
    const v = normalizeStoreHealth(fullRecord)!;
    expect(v.name).toBe('جرير');
    expect(v.persistedLast24h).toBe(120);
    expect(v.ingestionAgeHours).toBe(2.5);
    expect(v.isStale).toBe(false);
    expect(fmtCount(v.persistedLast24h)).toBe('120');
  });

  it('measured zero stays a zero, not unknown', () => {
    const v = normalizeStoreHealth({ ...fullRecord, persisted_last_24h: 0, runs_last_24h: 0 })!;
    expect(v.persistedLast24h).toBe(0);
    expect(fmtCount(v.persistedLast24h)).toBe('0');
  });

  it('null/undefined counts become UNKNOWN (null → "—"), never 0', () => {
    const v = normalizeStoreHealth({
      ...fullRecord,
      persisted_last_24h: null,
      runs_last_24h: undefined,
      ingestion_age_hours: null,
    })!;
    expect(v.persistedLast24h).toBeNull();
    expect(v.runsLast24h).toBeNull();
    expect(v.ingestionAgeHours).toBeNull();
    expect(fmtCount(v.persistedLast24h)).toBe('—');
    expect(fmtCount(v.persistedLast24h)).not.toBe('0');
  });

  it('a partial/legacy record (e.g. the retired total_products shape) degrades to unknowns without throwing', () => {
    const legacy = {
      store_id: 'x1',
      store_slug: 'legacy-store',
      store_name_en: 'Legacy Store',
      total_products: 500, // retired field — must be ignored, not crash
    };
    const v = normalizeStoreHealth(legacy)!;
    expect(v.slug).toBe('legacy-store');
    expect(v.name).toBe('Legacy Store');
    expect(v.persistedLast24h).toBeNull();
    expect(v.alerts).toEqual([]);
    // The original crash: totals.total_products.toLocaleString(). fmtCount can never throw.
    expect(() => fmtCount(v.persistedLast24h)).not.toThrow();
  });

  it('garbage rows are dropped, not rendered', () => {
    expect(normalizeStoreHealth(null)).toBeNull();
    expect(normalizeStoreHealth('nope')).toBeNull();
    expect(normalizeStoreHealth({})).toBeNull(); // no identity
  });
});

describe('normalizeHealthTotals', () => {
  it('empty dataset: missing totals object is null, missing fields are unknown', () => {
    expect(normalizeHealthTotals(undefined)).toBeNull();
    const t = normalizeHealthTotals({ stores: 24 })!;
    expect(t.stores).toBe(24);
    expect(t.staleStores).toBeNull();
    expect(fmtCount(t.staleStores)).toBe('—');
  });

  it('the retired totals shape (total_products) cannot crash', () => {
    const t = normalizeHealthTotals({ total_products: 9000, refreshed_last_24h: 100 })!;
    expect(t.stores).toBeNull();
    expect(() => fmtCount(t.stores)).not.toThrow();
  });
});

describe('asCount', () => {
  it('accepts finite numbers and numeric strings, rejects everything else', () => {
    expect(asCount(5)).toBe(5);
    expect(asCount('12')).toBe(12);
    expect(asCount(0)).toBe(0);
    expect(asCount(NaN)).toBeNull();
    expect(asCount(Infinity)).toBeNull();
    expect(asCount('')).toBeNull();
    expect(asCount(undefined)).toBeNull();
    expect(asCount({})).toBeNull();
  });
});

describe('sortStoresByAttention', () => {
  it('alerting stores come first, then stale, then oldest ingestion', () => {
    const mk = (over: Record<string, unknown>) => normalizeStoreHealth({ ...fullRecord, ...over })!;
    const healthy = mk({ store_id: 1, slug: 'a' });
    const stale = mk({ store_id: 2, slug: 'b', is_stale: true, ingestion_age_hours: 90 });
    const alerting = mk({ store_id: 3, slug: 'c', alerts: ['consecutive_failures'] });
    const sorted = sortStoresByAttention([healthy, stale, alerting]);
    expect(sorted.map((s) => s.slug)).toEqual(['c', 'b', 'a']);
  });
});
