// tests/compare/comparison-summary-eligible-count.test.ts — ADR-388.
// The public comparison summary now names the ELIGIBLE store set alongside the full known
// set: `store_count` (coverage, everything known) vs `eligible_store_count` (distinct
// retailers behind lowest/highest/saving) vs `excluded_offer_count`. Live ArtCool shape.
import { deriveComparisonSummary, type CompareOffer } from '@/lib/compare/get-comparison';

const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const offer = (store_slug: string, price: number, observed_at: string, availability = 'in_stock'): CompareOffer => ({
  store_slug, store_name: store_slug, raw_name: 'x', price, availability, product_url: `/go/${store_slug}`, observed_at,
  stale: false, confidence: 1, is_verified: true, campaign_eligibility: null,
});

const ARTCOOL = [
  offer('amazon', 2949, daysAgo(12)),
  offer('alnakheelk', 3269, daysAgo(0.1)),
  offer('shaker', 3299.35, daysAgo(0.1)),
  offer('noon', 3369, daysAgo(36)),
  offer('extra', 3669, daysAgo(2)),
];

describe('deriveComparisonSummary — eligible vs known counts', () => {
  it('ArtCool: 5 known, 3 eligible, 2 excluded; lowest/highest/saving from the eligible set', () => {
    const { summary } = deriveComparisonSummary(ARTCOOL);
    expect(summary.store_count).toBe(5);
    expect(summary.eligible_store_count).toBe(3);
    expect(summary.excluded_offer_count).toBe(2);
    expect(summary.lowest_price).toBe(3269);
    expect(summary.highest_price).toBe(3669);
    expect(summary.saving).toBe(400);
  });

  it('eligible_store_count counts distinct retailers, not offer rows', () => {
    const { summary } = deriveComparisonSummary([offer('extra', 3669, daysAgo(1)), offer('extra', 3699, daysAgo(1)), offer('shaker', 3299, daysAgo(1))]);
    expect(summary.eligible_store_count).toBe(2);
    expect(summary.store_count).toBe(3);
  });

  it('nothing eligible → 0 eligible, all excluded, no lowest price, message set', () => {
    const r = deriveComparisonSummary([offer('amazon', 2949, daysAgo(12)), offer('noon', 3369, daysAgo(36))]);
    expect(r.summary.eligible_store_count).toBe(0);
    expect(r.summary.excluded_offer_count).toBe(2);
    expect(r.summary.lowest_price).toBeNull();
    expect(r.message).toBeTruthy();
  });

  it('out of stock at last observation is excluded even when fresh', () => {
    const { summary } = deriveComparisonSummary([offer('extra', 3000, daysAgo(1), 'out_of_stock'), offer('shaker', 3299, daysAgo(1))]);
    expect(summary.eligible_store_count).toBe(1);
    expect(summary.excluded_offer_count).toBe(1);
    expect(summary.lowest_price).toBe(3299);
  });
});
