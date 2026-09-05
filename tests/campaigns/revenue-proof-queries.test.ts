// tests/campaigns/revenue-proof-queries.test.ts — pure-function coverage for the
// Revenue Proof dashboard's business-decision derivation and cost-coverage math
// (final program, Phase 2D/2E). DB-backed functions (getCampaignHeader,
// getTawveeriObserved, getMerchantReportedAmazon) are exercised indirectly through
// these pure functions' explicit inputs, matching this codebase's existing
// convention of not mocking a live NextRequest/route handler (see
// tests/campaigns/click-route-contract.test.ts).
import { deriveBusinessDecisionState, computeOperatingCostCoverage, deriveReconciliationStatus, isPaidOriginAcquisition, deriveDifferentiationBreakdown, summarizeByMerchant, compareByCategory, filterEligibleClicks } from '@/lib/campaigns/revenue-proof-queries';
import type { TawveeriObserved, MerchantReportedAmazon, PortfolioRow } from '@/lib/campaigns/revenue-proof-queries';

const ZERO_OBSERVED: TawveeriObserved = {
  cleanEligibleExposures: 0, visibleImpressions: 0, cleanCampaignClicks: 0,
  uniqueClickingSessions: 0, clickThroughRate: null, testInternalExcluded: 0,
  botExcluded: 0, topSessionConcentration: null, campaignErrors: 0, paidOriginExcluded: 0,
  unknownOriginExcluded: 0,
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

describe('filterEligibleClicks — founder mission §4/§5 correction (2026-09-05)', () => {
  const organic = { session_id: 's1', acquisition_campaign: null };
  const paid = { session_id: 's2', acquisition_campaign: { utm_source: 'google', utm_medium: 'cpc' } };
  const unknownSource = { session_id: 's3', acquisition_campaign: { utm_source: 'mystery_network', utm_medium: 'banner' } };

  it('without a merchant, preserves the original paid-only exclusion unchanged', () => {
    const result = filterEligibleClicks([organic, paid, unknownSource]);
    // Backward-compatible branch: only the paid row is excluded; "unknown" is NOT excluded
    // here (that is exactly the gap this correction closes when a merchant IS passed).
    expect(result.clickRows).toEqual([organic, unknownSource]);
    expect(result.paidOriginExcluded).toBe(1);
    expect(result.unknownOriginExcluded).toBe(0);
  });

  it('with a merchant, excludes BOTH paid and genuinely unknown provenance, counted separately', () => {
    const result = filterEligibleClicks([organic, paid, unknownSource], 'amazon');
    expect(result.clickRows).toEqual([organic]);
    expect(result.paidOriginExcluded).toBe(1);
    expect(result.unknownOriginExcluded).toBe(1);
  });

  it('never treats unknown as eligible for either merchant', () => {
    expect(filterEligibleClicks([unknownSource], 'amazon').clickRows).toHaveLength(0);
    expect(filterEligibleClicks([unknownSource], 'noon').clickRows).toHaveLength(0);
  });

  it('keeps organic_direct (no campaign cookie at all) eligible for both merchants', () => {
    expect(filterEligibleClicks([organic], 'amazon').clickRows).toEqual([organic]);
    expect(filterEligibleClicks([organic], 'noon').clickRows).toEqual([organic]);
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

// Noon Wave 1 (2026-09-05) — Amazon × Noon comparison aggregation, pure over
// getPortfolioSummary()'s already-generalized output (no live DB needed).
function row(overrides: Partial<PortfolioRow>): PortfolioRow {
  return {
    campaignId: 'c1', merchant: 'amazon', category: 'tablet', trackingId: 'x', enabled: true,
    tawveeriClicks30d: 0, tawveeriExposures30d: 0, merchantStatus: 'unknown',
    merchantOrderedItems: null, merchantCommissionSar: null, merchantReportPeriodEnd: null,
    reconciliation: 'NOT_YET_AVAILABLE', ...overrides,
  };
}

describe('summarizeByMerchant', () => {
  it('always returns exactly one row per merchant, in amazon-then-noon order, even with zero campaigns', () => {
    const result = summarizeByMerchant([]);
    expect(result.map((r) => r.merchant)).toEqual(['amazon', 'noon']);
    expect(result[0].campaignCount).toBe(0);
    expect(result[0].anyReportImported).toBe(false);
  });

  it('sums exposures/clicks per merchant and computes CTR', () => {
    const rows = [
      row({ campaignId: 'a1', merchant: 'amazon', tawveeriExposures30d: 100, tawveeriClicks30d: 10 }),
      row({ campaignId: 'a2', merchant: 'amazon', tawveeriExposures30d: 50, tawveeriClicks30d: 5 }),
      row({ campaignId: 'n1', merchant: 'noon', tawveeriExposures30d: 20, tawveeriClicks30d: 4 }),
    ];
    const [amazon, noon] = summarizeByMerchant(rows);
    expect(amazon.eligibleExposures30d).toBe(150);
    expect(amazon.cleanClicks30d).toBe(15);
    expect(amazon.clickThroughRate).toBeCloseTo(0.1);
    expect(noon.eligibleExposures30d).toBe(20);
    expect(noon.clickThroughRate).toBeCloseTo(0.2);
  });

  it('an unimported report (merchantStatus unknown) never contributes a fabricated 0 commission — stays null, not 0', () => {
    const rows = [row({ merchant: 'noon', merchantStatus: 'unknown', merchantCommissionSar: null })];
    const [, noon] = summarizeByMerchant(rows);
    expect(noon.anyReportImported).toBe(false);
    expect(noon.commissionSarKnown).toBeNull();
    expect(noon.revenuePer100Exposures).toBeNull();
  });

  it('a known report contributes real commission and a computed revenue-per-100-exposures rate', () => {
    const rows = [row({ merchant: 'amazon', merchantStatus: 'known', merchantCommissionSar: 50, tawveeriExposures30d: 200 })];
    const [amazon] = summarizeByMerchant(rows);
    expect(amazon.anyReportImported).toBe(true);
    expect(amazon.commissionSarKnown).toBe(50);
    expect(amazon.revenuePer100Exposures).toBeCloseTo(25); // 50 / 200 * 100
  });
});

describe('compareByCategory', () => {
  it('NO_EVIDENCE when neither merchant has ever had commission/clicks for a category', () => {
    const rows = [row({ merchant: 'amazon', category: 'laptop', merchantCommissionSar: null, tawveeriClicks30d: 0 })];
    const result = compareByCategory(rows);
    expect(result[0].winner).toBe('NO_EVIDENCE');
  });

  it('NOT_COMPARABLE when both merchants have a campaign but neither has a known commission figure', () => {
    const rows = [
      row({ merchant: 'amazon', category: 'tv', merchantStatus: 'unknown', merchantCommissionSar: null }),
      row({ merchant: 'noon', category: 'tv', merchantStatus: 'unknown', merchantCommissionSar: null }),
    ];
    const result = compareByCategory(rows);
    expect(result[0].winner).toBe('NOT_COMPARABLE');
  });

  it('picks the merchant with strictly higher reported commission for that category', () => {
    const rows = [
      row({ merchant: 'amazon', category: 'tv', merchantStatus: 'known', merchantCommissionSar: 10 }),
      row({ merchant: 'noon', category: 'tv', merchantStatus: 'known', merchantCommissionSar: 40 }),
    ];
    const result = compareByCategory(rows);
    expect(result[0].winner).toBe('NOON');
  });

  it('equal known commission on both sides → NOT_COMPARABLE, never an arbitrary tie-break here', () => {
    const rows = [
      row({ merchant: 'amazon', category: 'tv', merchantStatus: 'known', merchantCommissionSar: 25 }),
      row({ merchant: 'noon', category: 'tv', merchantStatus: 'known', merchantCommissionSar: 25 }),
    ];
    const result = compareByCategory(rows);
    expect(result[0].winner).toBe('NOT_COMPARABLE');
  });
});
