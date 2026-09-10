// tests/admin/scraping-health-success-rate.test.ts — Noon Commerce Data Truth & Recovery
// mission (2026-09-10). Regression coverage for the observability gap this mission found:
// a near-total price_update failure can still show `is_stale: false` and
// `consecutive_failures: 0` indefinitely, because both derive from the single freshest
// observation and the run's own status — and a run that succeeds on even 1 of hundreds of
// attempts is recorded `status: 'partial'`, never advancing the failure counter, while that
// one success keeps `ingestion_age_hours` looking fresh. Measured live 2026-09-10: Noon's
// price_update runs succeeded on 2 of ~900 attempts in 24h (0.2%) while every existing
// signal read healthy. computePriceUpdateSuccessRate + the low_price_update_success_rate
// alert close that gap.
import { computePriceUpdateSuccessRate } from '@/app/api/admin/scraping/health/route';

function run(overrides: Partial<{ run_type: string | null; products_new: number | null; products_updated: number | null; errors_count: number | null }> = {}) {
  return {
    run_type: 'price_update',
    products_new: 0,
    products_updated: 0,
    errors_count: 0,
    ...overrides,
  };
}

describe('computePriceUpdateSuccessRate', () => {
  it('MEASURED regression case: Noon 2026-09-10 — 2 succeeded of ~900 attempts (0.2%) is a real, low rate, not null', () => {
    const runs = [
      run({ products_updated: 2, errors_count: 898 }),
    ];
    const rate = computePriceUpdateSuccessRate(runs);
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0.01);
  });

  it('a healthy store (Jarir-shaped: 29% measured the same day) computes correctly and is well above the alert threshold', () => {
    const runs = [
      run({ products_updated: 261, errors_count: 639 }),
    ];
    const rate = computePriceUpdateSuccessRate(runs);
    expect(rate).toBeCloseTo(0.29, 2);
  });

  it('sums products_new AND products_updated as success — a newly-discovered product counts too', () => {
    const runs = [run({ products_new: 10, products_updated: 20, errors_count: 30 })];
    expect(computePriceUpdateSuccessRate(runs)).toBeCloseTo(30 / 60, 5);
  });

  it('discovery runs are excluded entirely, even if present in the same 24h window', () => {
    const runs = [
      run({ run_type: 'discovery', products_new: 500, errors_count: 0 }),
      run({ run_type: 'price_update', products_updated: 1, errors_count: 99 }),
    ];
    expect(computePriceUpdateSuccessRate(runs)).toBeCloseTo(0.01, 2);
  });

  it('below the minimum sample size returns null (no signal), never a misleading rate', () => {
    const runs = [run({ products_updated: 1, errors_count: 1 })]; // only 2 attempts
    expect(computePriceUpdateSuccessRate(runs)).toBeNull();
  });

  it('zero price_update runs in the window returns null, not a divide-by-zero or false 0%', () => {
    expect(computePriceUpdateSuccessRate([])).toBeNull();
  });

  it('a run with zero attempts (0 success, 0 errors) does not corrupt an otherwise-valid rate', () => {
    const runs = [
      run({ products_updated: 0, errors_count: 0 }),
      run({ products_updated: 90, errors_count: 10 }),
    ];
    expect(computePriceUpdateSuccessRate(runs)).toBeCloseTo(0.9, 5);
  });
});
