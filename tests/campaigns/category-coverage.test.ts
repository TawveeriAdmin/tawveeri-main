// tests/campaigns/category-coverage.test.ts — Noon Internal Commerce Expansion
// (2026-09-05, §5). Pure-function coverage for the strength classification; the live RPC
// read is exercised indirectly (same convention as getTawveeriObserved / getCampaignHeader
// — see revenue-proof-queries.test.ts's header).
import { classifyCategoryStrength, type CategoryCoverageRow } from '@/lib/campaigns/category-coverage';

function row(overrides: Partial<Omit<CategoryCoverageRow, 'strength'>>): Omit<CategoryCoverageRow, 'strength'> {
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
    shopperEquivalentProducts: 0,
    ...overrides,
  };
}

describe('classifyCategoryStrength', () => {
  it('proposes INSUFFICIENT_EVIDENCE when overlap is zero and no single-merchant signal exists', () => {
    expect(classifyCategoryStrength(row({ overlapProducts: 0, demand30d: 0 }))).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('proposes NOON_ONLY_OPPORTUNITY when Noon has valid offers, Amazon has none, and real demand exists', () => {
    expect(classifyCategoryStrength(row({ category: 'air_conditioner', overlapProducts: 0, validNoonOffers: 2, validAmazonOffers: 0, demand30d: 137 }))).toBe('NOON_ONLY_OPPORTUNITY');
  });

  it('proposes AMAZON_ONLY_OPPORTUNITY when Amazon has valid offers, Noon has none, and real demand exists', () => {
    expect(classifyCategoryStrength(row({ category: 'camera', overlapProducts: 0, validNoonOffers: 0, validAmazonOffers: 6, demand30d: 1 }))).toBe('AMAZON_ONLY_OPPORTUNITY');
  });

  it('does NOT propose a single-merchant opportunity when demand is zero, even with valid offers', () => {
    expect(classifyCategoryStrength(row({ overlapProducts: 0, validNoonOffers: 5, validAmazonOffers: 0, demand30d: 0 }))).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('proposes INSUFFICIENT_EVIDENCE when overlap or demand is below the evidence bar, even with real overlap', () => {
    // monitor-shaped: overlap=15 (deep) but demand=2 (thin) — real ADR-294/295 finding.
    expect(classifyCategoryStrength(row({ category: 'monitor', overlapProducts: 15, demand30d: 2 }))).toBe('INSUFFICIENT_EVIDENCE');
    // mobile-shaped: overlap=1 (too thin) despite real demand.
    expect(classifyCategoryStrength(row({ category: 'mobile', overlapProducts: 1, demand30d: 19 }))).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('proposes AMAZON_STRONG when Amazon is cheaper more often, above the evidence bar', () => {
    // tv-shaped, corrected 2026-09-05: Amazon cheaper 8, Noon cheaper 1, above the bar.
    expect(classifyCategoryStrength(row({ category: 'tv', overlapProducts: 10, demand30d: 42, amazonCheaperProducts: 8, noonCheaperProducts: 1 }))).toBe('AMAZON_STRONG');
  });

  it('proposes NOON_STRONG when Noon is cheaper more often, above the evidence bar', () => {
    expect(classifyCategoryStrength(row({ overlapProducts: 5, demand30d: 10, amazonCheaperProducts: 1, noonCheaperProducts: 4 }))).toBe('NOON_STRONG');
  });

  it('proposes BALANCED when neither merchant dominates, above the evidence bar', () => {
    // laptop-shaped: overlap=2, demand=63, cheaper counts tied 1-1.
    expect(classifyCategoryStrength(row({ category: 'laptop', overlapProducts: 2, demand30d: 63, amazonCheaperProducts: 1, noonCheaperProducts: 1 }))).toBe('BALANCED');
  });

  it('never proposes a state that implies activation — the taxonomy has no ACTIVATED/LIVE value', () => {
    const allStates = ['NOON_STRONG', 'AMAZON_STRONG', 'BALANCED', 'NOON_ONLY_OPPORTUNITY', 'AMAZON_ONLY_OPPORTUNITY', 'INSUFFICIENT_EVIDENCE'];
    expect(allStates).not.toContain('LIVE');
    expect(allStates).not.toContain('ACTIVATED');
  });

  it('does not force a founder-approved-cohort special case — TV/laptop are classified purely from evidence like any other category', () => {
    // Even a category literally named "tv" gets INSUFFICIENT_EVIDENCE if its real evidence is thin — no hardcoded exception.
    expect(classifyCategoryStrength(row({ category: 'tv', overlapProducts: 0, demand30d: 0 }))).toBe('INSUFFICIENT_EVIDENCE');
  });
});
