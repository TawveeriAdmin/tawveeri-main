// tests/compare/multi-compare-offer-facts.test.ts — ADR-388.
// The multi-product tool (/compare) states price, crown, store counts, spread and observation
// from ONE derivation per product. Fixture = the live ArtCool shape (2026-09-26): five rows,
// three eligible; the page used to read «5 متاجر متاحة» and a 720 spread (all rows), while
// /compare/[key] read 3 and 400 (eligible rows). Both must now agree.
import { deriveProductOfferFacts, selectBestPriceStore, type ProductStore } from '@/app/[locale]/(public)/compare/page';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const store = (id: string, price: number, over: Partial<ProductStore> = {}): ProductStore => ({
  id: `row-${id}`,
  current_price: price,
  original_price: null,
  availability: 'in_stock',
  delivery_time_days: null,
  delivery_cost: null,
  is_free_delivery: null,
  product_url: null,
  affiliate_url: null,
  observed_at: null,
  stores: { id, name_ar: id, name_en: id, slug: id, logo_url: null } as unknown as ProductStore['stores'],
  ...over,
});

const ARTCOOL: ProductStore[] = [
  store('amazon', 2949, { observed_at: daysAgo(12) }),
  store('alnakheel', 3269, { observed_at: daysAgo(1) }),
  store('noon', 3369, { observed_at: daysAgo(36) }),
  store('extra', 3469, { observed_at: daysAgo(2) }),
  store('jarir', 3669, { observed_at: daysAgo(0.5) }),
];

describe('deriveProductOfferFacts — ArtCool five-row shape', () => {
  const f = deriveProductOfferFacts(ARTCOOL, NOW);
  it('crowns the cheapest ELIGIBLE offer (3,269), not the stale 2,949', () => {
    expect(f.best?.current_price).toBe(3269);
    expect(f.bestIsEligible).toBe(true);
  });
  it('counts 3 eligible stores and 2 outside the comparison', () => {
    expect(f.eligibleStoreCount).toBe(3);
    expect(f.excludedStoreCount).toBe(2);
    expect(f.excluded.map((e) => e.reason)).toEqual(['stale', 'stale']);
  });
  it('spread = highest eligible − lowest eligible = 400 (was 720)', () => {
    expect(f.lowest).toBe(3269);
    expect(f.highest).toBe(3669);
    expect(f.spread).toBe(400);
  });
  it('selectBestPriceStore agrees with the facts', () => {
    expect(selectBestPriceStore(ARTCOOL)?.stores?.id).toBe('alnakheel');
  });
});

describe('deriveProductOfferFacts — edge shapes', () => {
  it('single eligible offer → count 1, spread null', () => {
    const f = deriveProductOfferFacts([store('alnakheel', 3269, { observed_at: daysAgo(1) }), store('amazon', 2949, { observed_at: daysAgo(12) })], NOW);
    expect(f.eligibleStoreCount).toBe(1);
    expect(f.spread).toBeNull();
    expect(f.best?.stores?.id).toBe('alnakheel');
  });

  it('no eligible offer → the cheapest known offer is shown as last observed, never crowned', () => {
    const f = deriveProductOfferFacts([store('amazon', 2949, { observed_at: daysAgo(12) }), store('noon', 3369, { observed_at: daysAgo(36) })], NOW);
    expect(f.eligibleStoreCount).toBe(0);
    expect(f.best?.stores?.id).toBe('amazon');
    expect(f.bestIsEligible).toBe(false);
    expect(f.spread).toBeNull();
  });

  it('out-of-stock offers never take part even when fresh', () => {
    const f = deriveProductOfferFacts([store('a', 100, { observed_at: daysAgo(1), availability: 'out_of_stock' }), store('b', 150, { observed_at: daysAgo(1) })], NOW);
    expect(f.eligibleStoreCount).toBe(1);
    expect(f.excluded[0].reason).toBe('out_of_stock');
    expect(f.best?.stores?.id).toBe('b');
  });

  it('legacy rows with no observation anywhere: availability alone decides, freshnessUnknown flagged', () => {
    const f = deriveProductOfferFacts([store('a', 200), store('b', 100)], NOW);
    expect(f.freshnessUnknown).toBe(true);
    expect(f.eligibleStoreCount).toBe(2);
    expect(f.best?.stores?.id).toBe('b');
    expect(f.spread).toBe(100);
  });

  it('a dated offer is never out-competed by an undated one on the same product', () => {
    const f = deriveProductOfferFacts([store('undated', 100), store('dated', 150, { observed_at: daysAgo(1) })], NOW);
    expect(f.best?.stores?.id).toBe('dated');
    expect(f.excluded[0].reason).toBe('unknown_age');
    expect(f.eligibleStoreCount).toBe(1);
  });

  it('distinct stores, not rows: two rows from one retailer count once', () => {
    const f = deriveProductOfferFacts([store('jarir', 3669, { observed_at: daysAgo(1) }), store('jarir', 3699, { id: 'row-jarir-2', observed_at: daysAgo(1) }), store('extra', 3469, { observed_at: daysAgo(1) })], NOW);
    expect(f.eligible).toHaveLength(3);
    expect(f.eligibleStoreCount).toBe(2);
  });

  it('old cached selection shape (no stores object, no observed_at) still derives safely', () => {
    const legacy = [{ id: 'x', current_price: 999, original_price: 1200, availability: 'in_stock', delivery_time_days: null, delivery_cost: null, is_free_delivery: null, product_url: 'https://x', affiliate_url: null, stores: null } as unknown as ProductStore];
    const f = deriveProductOfferFacts(legacy, NOW);
    expect(f.best?.current_price).toBe(999);
    expect(f.eligibleStoreCount).toBe(1);
    expect(f.freshnessUnknown).toBe(true);
  });

  it('empty input', () => {
    const f = deriveProductOfferFacts([], NOW);
    expect(f.best).toBeNull();
    expect(f.eligibleStoreCount).toBe(0);
    expect(f.spread).toBeNull();
  });
});
