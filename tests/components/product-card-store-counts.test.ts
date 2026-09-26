// tests/components/product-card-store-counts.test.ts — ADR-389 §3.
// The search card's store pill: eligible vs total, distinct stores (never offer rows), and the
// «أفضل سعر» badge only across ≥2 ELIGIBLE stores. Live ArtCool shape: 5 known, 3 eligible.
import { cardStoreCounts, storePillLabel } from '@/components/products/product-card';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const ps = (slug: string, price: number, observed_at: string | null, availability = 'in_stock') => ({
  id: `store-${slug}-1`, current_price: price, original_price: null, availability: availability as 'in_stock', observed_at,
  stores: { id: slug, slug, name_ar: slug, name_en: slug, logo_url: null },
});

describe('cardStoreCounts', () => {
  it('ArtCool: 5 known stores, 3 eligible, 2 excluded', () => {
    const c = cardStoreCounts([ps('amazon', 2949, daysAgo(12)), ps('alnakheelk', 3269, daysAgo(0.2)), ps('shaker', 3299, daysAgo(0.2)), ps('noon', 3369, daysAgo(36)), ps('extra', 3669, daysAgo(2))], NOW);
    expect(c).toEqual({ total: 5, eligible: 3, excluded: 2 });
    expect(storePillLabel(c, 'ar')).toBe('3 مؤهلة من 5');
    expect(storePillLabel(c, 'en')).toBe('3 eligible of 5');
  });
  it('all eligible → the plain total', () => {
    const c = cardStoreCounts([ps('a', 1, daysAgo(1)), ps('b', 2, daysAgo(1))], NOW);
    expect(storePillLabel(c, 'ar')).toBe('2');
  });
  it('distinct stores, not rows', () => {
    const c = cardStoreCounts([ps('jarir', 1, daysAgo(1)), { ...ps('jarir', 2, daysAgo(1)), id: 'store-jarir-2' }, ps('extra', 3, daysAgo(1))], NOW);
    expect(c.total).toBe(2);
    expect(c.eligible).toBe(2);
  });
  it('out of stock is excluded even when fresh; not-stated availability is not', () => {
    const c = cardStoreCounts([ps('a', 1, daysAgo(1), 'out_of_stock'), { ...ps('b', 2, daysAgo(1)), availability: null as unknown as 'in_stock' }], NOW);
    expect(c).toEqual({ total: 2, eligible: 1, excluded: 1 });
  });
  it('legacy rows with no observation data anywhere keep availability-only counting', () => {
    const c = cardStoreCounts([ps('a', 1, null), ps('b', 2, null)], NOW);
    expect(c).toEqual({ total: 2, eligible: 2, excluded: 0 });
  });
});
