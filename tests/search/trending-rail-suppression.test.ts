// Regression coverage for the "أبي تليفزيون ب 250ريال" defect (2026-08-20): the search
// results empty state fell through to a "Trending products" rail (unfiltered last-8-inserted
// products, no relation to the query or its budget) even when the API had already returned an
// honest `categoryEnforcedZero` for a query that named an explicit budget — making a luxury TV
// look like an answer to a 250 SAR ask. Fix pins suppression to BOTH signals together so a plain
// no-budget empty search keeps its (deliberate, useful) trending fallback.
import { shouldSuppressTrendingRail } from '@/app/[locale]/(public)/search/search-client';

describe('shouldSuppressTrendingRail', () => {
  it('suppresses the trending rail when the zero is budget-caused', () => {
    // categoryEnforcedZero:true + an explicit budget parsed from the query text.
    expect(shouldSuppressTrendingRail(true, 250)).toBe(true);
  });

  it('keeps the trending rail for a plain empty search with no stated budget', () => {
    // categoryEnforcedZero:true but no budget was ever parsed from the query — an ordinary
    // "no results" case where the trending fallback is deliberate and useful.
    expect(shouldSuppressTrendingRail(true, null)).toBe(false);
  });

  it('keeps the trending rail when a budget exists but the zero was not category-enforced', () => {
    expect(shouldSuppressTrendingRail(false, 250)).toBe(false);
  });

  it('keeps the trending rail when neither signal is present', () => {
    expect(shouldSuppressTrendingRail(false, null)).toBe(false);
  });
});
