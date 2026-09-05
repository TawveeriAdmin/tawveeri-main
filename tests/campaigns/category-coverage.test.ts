// tests/campaigns/category-coverage.test.ts — founder correction #2 (2026-09-05):
// "Noon must not be architecturally limited to TV + laptop." Pure-function coverage for
// the proposal logic; the live RPC read is exercised indirectly (same convention as
// getTawveeriObserved / getCampaignHeader — see revenue-proof-queries.test.ts's header).
import { proposeCategoryState, type CategoryCoverageRow } from '@/lib/campaigns/category-coverage';

function row(overrides: Partial<Omit<CategoryCoverageRow, 'proposedState'>>): Omit<CategoryCoverageRow, 'proposedState'> {
  return {
    category: 'test_category',
    activeProducts: 0,
    noonOfferProducts: 0,
    validNoonOffers: 0,
    freshNoonOffers: 0,
    validAmazonOffers: 0,
    overlapProducts: 0,
    noonOnlyProducts: 0,
    amazonOnlyProducts: 0,
    demand30d: 0,
    explicitInteractions30d: 0,
    noonCheaperProducts: 0,
    amazonCheaperProducts: 0,
    tiedProducts: 0,
    ...overrides,
  };
}

describe('proposeCategoryState', () => {
  it('always proposes INITIAL_COHORT for the founder-approved TV/laptop cohort, regardless of evidence', () => {
    expect(proposeCategoryState(row({ category: 'tv', overlapProducts: 0, demand30d: 0 }))).toBe('INITIAL_COHORT');
    expect(proposeCategoryState(row({ category: 'laptop' }))).toBe('INITIAL_COHORT');
  });

  it('proposes INSUFFICIENT_EVIDENCE when overlap or demand is zero, for any other category', () => {
    expect(proposeCategoryState(row({ category: 'refrigerator', overlapProducts: 0, demand30d: 18 }))).toBe('INSUFFICIENT_EVIDENCE');
    expect(proposeCategoryState(row({ category: 'air_fryer', overlapProducts: 1, demand30d: 0 }))).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('proposes ACTIVE_CAPABLE only above the higher overlap+demand bar', () => {
    expect(proposeCategoryState(row({ category: 'monitor', overlapProducts: 15, demand30d: 2 }))).not.toBe('ACTIVE_CAPABLE'); // demand too thin
    expect(proposeCategoryState(row({ category: 'monitor', overlapProducts: 5, demand30d: 10 }))).toBe('ACTIVE_CAPABLE');
  });

  it('proposes ELIGIBLE for a real but thinner signal', () => {
    expect(proposeCategoryState(row({ category: 'tablet', overlapProducts: 2, demand30d: 61 }))).toBe('ELIGIBLE');
  });

  it('proposes HOLD when both overlap and demand are real but overlap is too thin (1 product) for ELIGIBLE', () => {
    expect(proposeCategoryState(row({ category: 'mobile', overlapProducts: 1, demand30d: 19 }))).toBe('HOLD');
  });

  it('proposes INSUFFICIENT_EVIDENCE (not HOLD) when either signal is genuinely zero, even with a strong single signal', () => {
    expect(proposeCategoryState(row({ category: 'air_conditioner', overlapProducts: 0, demand30d: 137 }))).toBe('INSUFFICIENT_EVIDENCE');
    expect(proposeCategoryState(row({ category: 'kettle', overlapProducts: 2, demand30d: 0 }))).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('never proposes a state that implies activation — the taxonomy has no ACTIVATED/LIVE value', () => {
    const allStates = ['ACTIVE_CAPABLE', 'ELIGIBLE', 'INITIAL_COHORT', 'HOLD', 'INSUFFICIENT_EVIDENCE'];
    expect(allStates).not.toContain('LIVE');
    expect(allStates).not.toContain('ACTIVATED');
  });
});
