/**
 * P0 incident 2026-08-05 — Amazon offer B0F8JHSMMD (LG OLED65C56LA) showed SAR 259 on
 * Best Deals against a real Amazon.sa price of SAR 8,699 (~98% off, single retailer, zero
 * corroboration). Root cause: the storefront price-refresh write path applied a scraped
 * price with no sanity check, and the Best Deals read path applied no outlier/corroboration
 * check before publishing a discount claim. These fixtures pin the two gates that close
 * that hole — see src/lib/intelligence/price-truth-gate.ts.
 */
import {
  assessPriceTransition,
  isExtremeUncorroboratedDiscount,
  classifyDealLabelTier,
  tierAllowsStrongDealBadge,
  dealLabelText,
  SANITY_MAX_RATIO,
  EXTREME_DISCOUNT_PCT,
  STABLE_BASELINE_MIN_OBSERVATIONS,
  STABLE_BASELINE_MIN_DISTINCT_DAYS,
} from '../../src/lib/intelligence/price-truth-gate';

describe('assessPriceTransition (write-time gate)', () => {
  it('a brand-new listing (no prior price) is always credible', () => {
    const r = assessPriceTransition({ newPrice: 259, priorPrice: null, pendingValue: null });
    expect(r.credible).toBe(true);
  });

  it('a normal price move within the sanity bound is credible', () => {
    const r = assessPriceTransition({ newPrice: 7999, priorPrice: 8699, pendingValue: null });
    expect(r.credible).toBe(true);
    expect(r.confirmsPending).toBe(false);
  });

  it('reproduces the incident: 259 vs a last-known 8699 is rejected, not written', () => {
    const r = assessPriceTransition({ newPrice: 259, priorPrice: 8699, pendingValue: null });
    expect(r.credible).toBe(false);
    expect(r.reason).toContain('sanity bound');
    expect(r.confirmsPending).toBe(false);
  });

  it('a lone anomalous read is held pending, not confirmed', () => {
    // Exactly at the accepted ratio bound: still credible.
    const atBound = assessPriceTransition({
      newPrice: 8699 / SANITY_MAX_RATIO,
      priorPrice: 8699,
      pendingValue: null,
    });
    expect(atBound.credible).toBe(true);

    // Just past it: rejected.
    const pastBound = assessPriceTransition({
      newPrice: 8699 / SANITY_MAX_RATIO - 1,
      priorPrice: 8699,
      pendingValue: null,
    });
    expect(pastBound.credible).toBe(false);
  });

  it('a SECOND consecutive observation agreeing with the pending value confirms a genuine move', () => {
    // First anomalous read would have set price_pending_value = 259 (not modeled here —
    // this call simulates the SECOND scrape, where the caller passes that pending value).
    const r = assessPriceTransition({ newPrice: 258, priorPrice: 8699, pendingValue: 259 });
    expect(r.credible).toBe(true);
    expect(r.confirmsPending).toBe(true);
  });

  it('a second anomalous read that does NOT agree with the pending value stays rejected', () => {
    // A different bad number on a second scrape must not confirm the first bad number.
    const r = assessPriceTransition({ newPrice: 400, priorPrice: 8699, pendingValue: 259 });
    expect(r.credible).toBe(false);
    expect(r.confirmsPending).toBe(false);
  });

  it('rejects non-positive or non-finite prices outright', () => {
    expect(assessPriceTransition({ newPrice: 0, priorPrice: 100, pendingValue: null }).credible).toBe(false);
    expect(assessPriceTransition({ newPrice: -5, priorPrice: 100, pendingValue: null }).credible).toBe(false);
    expect(assessPriceTransition({ newPrice: NaN, priorPrice: 100, pendingValue: null }).credible).toBe(false);
  });
});

describe('isExtremeUncorroboratedDiscount (Best Deals read-time gate)', () => {
  it('reproduces the incident: ~98% off from a single store must not publish', () => {
    expect(isExtremeUncorroboratedDiscount({ discountPct: 98, corroboratingStoreCount: 1 })).toBe(true);
  });

  it('the same extreme discount, corroborated by a second store, is allowed', () => {
    expect(isExtremeUncorroboratedDiscount({ discountPct: 98, corroboratingStoreCount: 2 })).toBe(false);
  });

  it('an ordinary discount below the extreme threshold is allowed from a single store', () => {
    expect(isExtremeUncorroboratedDiscount({ discountPct: EXTREME_DISCOUNT_PCT - 1, corroboratingStoreCount: 1 })).toBe(false);
  });

  it('exactly at the threshold from a single store is blocked', () => {
    expect(isExtremeUncorroboratedDiscount({ discountPct: EXTREME_DISCOUNT_PCT, corroboratingStoreCount: 1 })).toBe(true);
  });
});

/**
 * ADR-211 bounded closeout (2026-08-05) — the smallest truthful public-label rule.
 * A "best price"/"strong deal" claim is a superiority claim and requires evidence:
 * either a second corroborating retailer, or a reproducible, stable price-history
 * baseline for that exact listing. A bare single-retailer offer with neither gets
 * only "available at [store]" — never "best price" / "strong deal".
 */
describe('classifyDealLabelTier / tierAllowsStrongDealBadge / dealLabelText', () => {
  it('a single retailer with no price history is tier "single" — the weakest claim', () => {
    const tier = classifyDealLabelTier({
      corroboratingStoreCount: 1,
      priceHistoryObservationCount: 0,
      priceHistoryDistinctDays: 0,
    });
    expect(tier).toBe('single');
    expect(tierAllowsStrongDealBadge(tier)).toBe(false);
    const label = dealLabelText(tier, 'Amazon SA');
    expect(label.ar).toBe('السعر المتاح لدى Amazon SA');
    expect(label.en).toBe('Available at Amazon SA');
    // Never the forbidden superiority phrases for this tier.
    expect(label.ar).not.toContain('أفضل سعر');
    expect(label.en.toLowerCase()).not.toContain('best price');
  });

  it('two or more corroborating retailers is tier "multi_store" regardless of history', () => {
    const tier = classifyDealLabelTier({
      corroboratingStoreCount: 2,
      priceHistoryObservationCount: 0,
      priceHistoryDistinctDays: 0,
    });
    expect(tier).toBe('multi_store');
    expect(tierAllowsStrongDealBadge(tier)).toBe(true);
    const label = dealLabelText(tier, 'irrelevant');
    expect(label.ar).toBe('أقل سعر بين المتاجر المتاحة');
    expect(label.en).toBe('Lowest among available retailers');
  });

  it('a single retailer WITH a reproducible, stable baseline earns "lower than usual"', () => {
    const tier = classifyDealLabelTier({
      corroboratingStoreCount: 1,
      priceHistoryObservationCount: STABLE_BASELINE_MIN_OBSERVATIONS,
      priceHistoryDistinctDays: STABLE_BASELINE_MIN_DISTINCT_DAYS,
    });
    expect(tier).toBe('single_stable_baseline');
    expect(tierAllowsStrongDealBadge(tier)).toBe(true);
    const label = dealLabelText(tier, 'irrelevant');
    expect(label.ar).toBe('سعر منخفض عن المعتاد');
    expect(label.en).toBe('Lower than usual');
  });

  it('below the stable-baseline threshold on EITHER axis stays tier "single"', () => {
    const shortOnObs = classifyDealLabelTier({
      corroboratingStoreCount: 1,
      priceHistoryObservationCount: STABLE_BASELINE_MIN_OBSERVATIONS - 1,
      priceHistoryDistinctDays: STABLE_BASELINE_MIN_DISTINCT_DAYS,
    });
    expect(shortOnObs).toBe('single');

    const shortOnDays = classifyDealLabelTier({
      corroboratingStoreCount: 1,
      priceHistoryObservationCount: STABLE_BASELINE_MIN_OBSERVATIONS,
      priceHistoryDistinctDays: STABLE_BASELINE_MIN_DISTINCT_DAYS - 1,
    });
    expect(shortOnDays).toBe('single');
  });
});
