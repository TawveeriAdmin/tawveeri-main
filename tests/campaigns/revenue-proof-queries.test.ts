// tests/campaigns/revenue-proof-queries.test.ts — pure-function coverage for the
// Revenue Proof dashboard's business-decision derivation and cost-coverage math
// (final program, Phase 2D/2E). DB-backed functions (getCampaignHeader,
// getTawveeriObserved, getMerchantReportedAmazon) are exercised indirectly through
// these pure functions' explicit inputs, matching this codebase's existing
// convention of not mocking a live NextRequest/route handler (see
// tests/campaigns/click-route-contract.test.ts).
import { deriveBusinessDecisionState, computeOperatingCostCoverage, deriveReconciliationStatus, isPaidOriginAcquisition, deriveDifferentiationBreakdown } from '@/lib/campaigns/revenue-proof-queries';
import type { TawveeriObserved, MerchantReportedAmazon } from '@/lib/campaigns/revenue-proof-queries';

const ZERO_OBSERVED: TawveeriObserved = {
  cleanEligibleExposures: 0, visibleImpressions: 0, cleanCampaignClicks: 0,
  uniqueClickingSessions: 0, clickThroughRate: null, testInternalExcluded: 0,
  botExcluded: 0, topSessionConcentration: null, campaignErrors: 0, paidOriginExcluded: 0,
};
const LIVE_OBSERVED: TawveeriObserved = { ...ZERO_OBSERVED, cleanEligibleExposures: 50, cleanCampaignClicks: 5, clickThroughRate: 0.1 };

const UNKNOWN_MERCHANT: MerchantReportedAmazon = { status: 'unknown' };
function knownMerchant(commissionSar: number): MerchantReportedAmazon {
  return {
    status: 'known', trackingId: 'tawveeri0f-tablet-21', networkReportedClicks: null,
    orderedItems: 1, shippedItems: 1, cancelledOrReturned: 0, qualifyingRevenueSar: 500,
    commissionSar, reportPeriodStart: '2026-09-01', reportPeriodEnd: '2026-09-30', lastImportedAt: '2026-10-01T00:00:00Z',
  };
}

describe('deriveBusinessDecisionState', () => {
  it('everything PENDING before any exposure/click exists', () => {
    const state = deriveBusinessDecisionState({
      observed: ZERO_OBSERVED, merchant: UNKNOWN_MERCHANT, distinctCommissionDates: 0, coveragePct: null, consecutiveCoveredMonths: 0,
    });
    expect(state.mechanicsProof).toBe('PENDING');
    expect(state.revenueProof).toBe('PENDING');
    expect(state.repeatabilitySignal).toBe('PENDING');
    expect(state.repeatableMonetization).toBe('PENDING');
    expect(state.incrementality).toBe('NOT_YET_TESTED');
  });

  it('mechanics proof CONFIRMED once exposures and clicks both exist, independent of merchant data', () => {
    const state = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: UNKNOWN_MERCHANT, distinctCommissionDates: 0, coveragePct: null, consecutiveCoveredMonths: 0,
    });
    expect(state.mechanicsProof).toBe('CONFIRMED');
    expect(state.revenueProof).toBe('PENDING'); // report still not imported — UNKNOWN, not zero, never inferred as proof
  });

  it('revenue proof requires a merchant report with commission > 0 — an UNKNOWN report never counts as proof', () => {
    const stateUnknown = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: UNKNOWN_MERCHANT, distinctCommissionDates: 0, coveragePct: null, consecutiveCoveredMonths: 0,
    });
    const stateZeroCommission = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: knownMerchant(0), distinctCommissionDates: 0, coveragePct: null, consecutiveCoveredMonths: 0,
    });
    const stateConfirmed = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: knownMerchant(25.5), distinctCommissionDates: 1, coveragePct: null, consecutiveCoveredMonths: 0,
    });
    expect(stateUnknown.revenueProof).toBe('PENDING');
    expect(stateZeroCommission.revenueProof).toBe('PENDING');
    expect(stateConfirmed.revenueProof).toBe('CONFIRMED');
  });

  it('a single commission date is EARLY, never CONFIRMED repeatability — order #2 is not a business model', () => {
    const state = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: knownMerchant(25.5), distinctCommissionDates: 1, coveragePct: null, consecutiveCoveredMonths: 0,
    });
    expect(state.repeatabilitySignal).toBe('EARLY');
  });

  it('two or more distinct commission dates confirms repeatability', () => {
    const state = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: knownMerchant(60), distinctCommissionDates: 2, coveragePct: null, consecutiveCoveredMonths: 0,
    });
    expect(state.repeatabilitySignal).toBe('CONFIRMED');
    expect(state.repeatableMonetization).toBe('CONFIRMED'); // clicks still flowing
  });

  it('sustainability stays PENDING until cost coverage is even configured', () => {
    const state = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: knownMerchant(9999), distinctCommissionDates: 5, coveragePct: null, consecutiveCoveredMonths: 0,
    });
    expect(state.sustainability).toBe('PENDING');
  });

  it('sustainability is COVERED only after >=2 consecutive covered months, not on a single good month', () => {
    const partial = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: knownMerchant(500), distinctCommissionDates: 3, coveragePct: 150, consecutiveCoveredMonths: 1,
    });
    const covered = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: knownMerchant(500), distinctCommissionDates: 3, coveragePct: 150, consecutiveCoveredMonths: 2,
    });
    expect(partial.sustainability).toBe('PARTIAL');
    expect(covered.sustainability).toBe('COVERED');
  });

  it('incrementality is always NOT_YET_TESTED in V1, regardless of every other input', () => {
    const state = deriveBusinessDecisionState({
      observed: LIVE_OBSERVED, merchant: knownMerchant(999999), distinctCommissionDates: 99, coveragePct: 500, consecutiveCoveredMonths: 12,
    });
    expect(state.incrementality).toBe('NOT_YET_TESTED');
  });
});

describe('deriveReconciliationStatus — Amazon Decision Layer V2 §8 founder portfolio view', () => {
  it('is NOT_YET_AVAILABLE, never a fabricated zero, when no report has been imported for this tracking id', () => {
    expect(deriveReconciliationStatus(UNKNOWN_MERCHANT)).toBe('NOT_YET_AVAILABLE');
  });

  it('is CONFIRMED once at least one item has been ordered or shipped', () => {
    expect(deriveReconciliationStatus(knownMerchant(25.5))).toBe('CONFIRMED');
  });

  it('is PARTIAL when a report exists for this tracking id but shows zero ordered/shipped items', () => {
    const noItems: MerchantReportedAmazon = {
      status: 'known', trackingId: 'tawveeri0f-tablet-21', networkReportedClicks: null,
      orderedItems: 0, shippedItems: 0, cancelledOrReturned: 0, qualifyingRevenueSar: null,
      commissionSar: 0, reportPeriodStart: '2026-09-01', reportPeriodEnd: '2026-09-30', lastImportedAt: '2026-10-01T00:00:00Z',
    };
    expect(deriveReconciliationStatus(noItems)).toBe('PARTIAL');
  });
});

describe('isPaidOriginAcquisition — Amazon Decision Layer V2 §1D paid-search segmentation', () => {
  it('is false when no acquisition cookie exists (organic, the common case)', () => {
    expect(isPaidOriginAcquisition(null)).toBe(false);
    expect(isPaidOriginAcquisition(undefined)).toBe(false);
  });

  it('is false for an organic/referral utm_medium', () => {
    expect(isPaidOriginAcquisition({ utm_source: 'google', utm_medium: 'organic' })).toBe(false);
    expect(isPaidOriginAcquisition({ utm_source: 'tiktok', utm_medium: 'social' })).toBe(false);
  });

  it('is true for a recognized paid-medium value, case-insensitively', () => {
    expect(isPaidOriginAcquisition({ utm_source: 'google', utm_medium: 'cpc' })).toBe(true);
    expect(isPaidOriginAcquisition({ utm_source: 'google', utm_medium: 'CPC' })).toBe(true);
    expect(isPaidOriginAcquisition({ utm_source: 'meta', utm_medium: 'paid_social' })).toBe(true);
  });
});

describe('deriveDifferentiationBreakdown — Amazon Decision Layer V2.1 §10', () => {
  it('groups exposures/clicks by mode and computes CTR per mode', () => {
    const result = deriveDifferentiationBreakdown(
      ['exact_product', 'exact_product', 'model_search', 'category', 'category', 'category'],
      ['exact_product', 'category'],
      [],
    );
    const byMode = Object.fromEntries(result.byMode.map((s) => [s.mode, s]));
    expect(byMode.exact_product).toEqual({ mode: 'exact_product', exposures: 2, clicks: 1, ctr: 0.5 });
    expect(byMode.model_search).toEqual({ mode: 'model_search', exposures: 1, clicks: 0, ctr: 0 });
    expect(byMode.category).toEqual({ mode: 'category', exposures: 3, clicks: 1, ctr: 1 / 3 });
  });

  it('omits a mode entirely from byMode when it has zero exposures AND zero clicks', () => {
    const result = deriveDifferentiationBreakdown(['category'], [], []);
    expect(result.byMode.map((s) => s.mode)).not.toContain('exact_product');
    expect(result.byMode.map((s) => s.mode)).not.toContain('model_search');
  });

  it('computes categoryOnlyPct as the share of exposures that were plain category routing', () => {
    const result = deriveDifferentiationBreakdown(
      ['exact_product', 'category', 'category', 'category'],
      [],
      [],
    );
    expect(result.categoryOnlyPct).toBe(75);
  });

  it('categoryOnlyPct is null with zero exposures — never a fabricated 0%', () => {
    const result = deriveDifferentiationBreakdown([], [], []);
    expect(result.categoryOnlyPct).toBeNull();
  });

  it('counts and ranks reason codes, most frequent first, ignoring nulls', () => {
    const result = deriveDifferentiationBreakdown(
      [],
      [],
      ['exact_product_verified', 'exact_product_blocked:offer_stale_or_unknown', 'exact_product_blocked:offer_stale_or_unknown', null, 'no_model_search_term'],
    );
    expect(result.reasonCodeCounts[0]).toEqual({ reasonCode: 'exact_product_blocked:offer_stale_or_unknown', count: 2 });
    expect(result.reasonCodeCounts.some((r) => r.reasonCode === 'exact_product_verified')).toBe(true);
    expect(result.reasonCodeCounts.reduce((sum, r) => sum + r.count, 0)).toBe(4); // null excluded
  });
});

describe('computeOperatingCostCoverage', () => {
  const originalEnv = process.env.TAWVEERI_MONTHLY_CASH_COST_SAR;
  afterEach(() => { process.env.TAWVEERI_MONTHLY_CASH_COST_SAR = originalEnv; });

  it('reports NOT CONFIGURED when the env var is unset', () => {
    delete process.env.TAWVEERI_MONTHLY_CASH_COST_SAR;
    const result = computeOperatingCostCoverage(100);
    expect(result.configured).toBe(false);
    expect(result.coveragePct).toBeNull();
  });

  it('computes coverage % correctly when configured', () => {
    process.env.TAWVEERI_MONTHLY_CASH_COST_SAR = '1000';
    const result = computeOperatingCostCoverage(250);
    expect(result.configured).toBe(true);
    expect(result.monthlyCostSar).toBe(1000);
    expect(result.coveragePct).toBe(25);
  });

  it('coveragePct is null when the merchant-reported commission is itself UNKNOWN (null)', () => {
    process.env.TAWVEERI_MONTHLY_CASH_COST_SAR = '1000';
    const result = computeOperatingCostCoverage(null);
    expect(result.coveragePct).toBeNull();
  });

  it('never divides by zero or a negative configured cost', () => {
    process.env.TAWVEERI_MONTHLY_CASH_COST_SAR = '0';
    const result = computeOperatingCostCoverage(100);
    expect(result.configured).toBe(false);
  });
});
