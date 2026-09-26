// tests/catalog/merge-same-listing-cards.test.ts — ADR-387.
// Live case (2026-09-26): «مكيف سامسونج 18000» returned THREE cards for ONE Extra listing
// (/p/100226575): a storefront `products` row (UUID slug, raw Extra URL), the TPS canonical
// `samsung|split|NO_SERIES|18000|Standard|NO_MODE` (a /go exit, raw URL only as evidence),
// and an identity-less "memory" canonical with the identical name and no link at all.
import { mergeSameListingCards, normalizeListingUrl } from '@/lib/catalog/merge-verified-canonical-search-results';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';

const EXTRA_URL = 'https://www.extra.com/en-sa/large-appliances-/air-conditioner/split-air-conditioner/samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold/p/100226575';

function offer(store: string, price: number, over: Partial<SearchProduct> = {}): SearchProduct {
  return {
    name_ar: 'x', name_en: 'x', brand: 'samsung', model: '', sku: null, current_price: price, original_price: null,
    availability: 'in_stock', product_url: '', image_urls: [], specifications: {}, category: 'air_conditioner',
    description_ar: null, description_en: null, is_free_delivery: false, delivery_time_days: null, delivery_cost: 0,
    is_deal: false, coupon_code: null, store, store_name: store, rating: null, review_count: null, ...over,
  } as unknown as SearchProduct;
}
function card(over: Partial<GroupedSearchProduct> & { stores: SearchProduct[] }): GroupedSearchProduct {
  const best = Math.min(...over.stores.map((s) => s.current_price));
  return { ...over.stores[0], best_price: best, current_price: best, store_count: over.stores.length, ...over } as GroupedSearchProduct;
}

describe('normalizeListingUrl', () => {
  it('equates the same listing across scheme/host case, tracking query, fragment and trailing slash', () => {
    expect(normalizeListingUrl(EXTRA_URL + '?ref=abc#top')).toBe(normalizeListingUrl('HTTPS://extra.com' + new URL(EXTRA_URL).pathname + '/'));
  });
  it('returns null for a /go link or empty value (never merges on an attributed exit)', () => {
    expect(normalizeListingUrl('/go/abc')).toBeNull();
    expect(normalizeListingUrl('')).toBeNull();
  });
});

describe('mergeSameListingCards — the Samsung 18000 triple', () => {
  const storefront = card({ product_id: 'c938d587-65b2-4474-8a51-507060668aa0', product_slug: 'c938d587-65b2-4474-8a51-507060668aa0',
    name_ar: 'Samsung Split AC 18000 BTU Rotary Compressor Heat and Cold', name_en: 'Samsung Split AC, 18000 BTU,Rotary Compressor,Heat and Cold',
    stores: [offer('اكسترا', 1155, { product_url: EXTRA_URL })] });
  const tps = card({ product_id: 'eea9c4f2-69a6-4116-b59e-1282cc7715a1', product_slug: 'samsung-split-18000-standard-no_mode',
    tps_identity_key: 'samsung|split|NO_SERIES|18000|Standard|NO_MODE', name_ar: 'مكيف سبليت سامسونج، 18000 وحدة، عادي', name_en: 'Samsung Split AC 18000 BTU Standard',
    stores: [offer('extra', 1155, { product_url: '/go/71047ca4', listing_url: EXTRA_URL, observed_at: '2026-09-24T00:04:10Z' })] });
  const ghost = card({ product_id: 'f9fa9c5a-9e82-45fa-8967-63402b73d93b', product_slug: '',
    name_ar: 'Samsung Split AC 18000 BTU Rotary Compressor Heat and Cold', name_en: 'Samsung Split AC, 18000 BTU,Rotary Compressor,Heat and Cold',
    stores: [offer('extra', 1155, { product_url: '' })] });

  it('collapses the three representations into ONE card, represented by the identity-bearing TPS canonical', () => {
    const out = mergeSameListingCards([storefront, tps, ghost]);
    expect(out).toHaveLength(1);
    expect(out[0].tps_identity_key).toBe('samsung|split|NO_SERIES|18000|Standard|NO_MODE');
    expect(out[0].product_slug).toBe('samsung-split-18000-standard-no_mode');
    expect(out[0].store_count).toBe(1); // one Extra offer, not three
    expect(out[0].best_price).toBe(1155);
  });

  it('ADR-388: the live array order (TPS canonical injected FIRST, then storefront and ghost) also collapses to one card', () => {
    const out = mergeSameListingCards([tps, storefront, ghost]);
    expect(out).toHaveLength(1);
    expect(out[0].tps_identity_key).toBe('samsung|split|NO_SERIES|18000|Standard|NO_MODE');
    expect(out[0].stores).toHaveLength(1);
    // the representative keeps the /go exit; the raw listing URL stays as evidence only
    expect(out[0].stores[0].product_url).toBe('/go/71047ca4');
    expect(out[0].stores[0].listing_url).toBe(EXTRA_URL);
  });

  it('ADR-388: the storefront card alone with the ghost (no TPS card present yet) folds the link-less ghost into the linked card', () => {
    const out = mergeSameListingCards([storefront, ghost]);
    expect(out).toHaveLength(1);
    expect(out[0].stores.some((s) => s.product_url === EXTRA_URL)).toBe(true);
  });

  it('does NOT merge two identity-bearing canonicals that merely share a title', () => {
    const a = card({ product_id: 'a', tps_identity_key: 'k1', name_ar: 'نفس الاسم', name_en: 'same', stores: [offer('extra', 100, { product_url: '/go/1', listing_url: 'https://www.extra.com/p/1' })] });
    const b = card({ product_id: 'b', tps_identity_key: 'k2', name_ar: 'نفس الاسم', name_en: 'same', stores: [offer('extra', 120, { product_url: '/go/2', listing_url: 'https://www.extra.com/p/2' })] });
    expect(mergeSameListingCards([a, b])).toHaveLength(2);
  });

  it('does NOT merge different listings at the same store, nor the same path at different stores', () => {
    const a = card({ product_id: 'a', name_ar: 'a', name_en: 'a', stores: [offer('extra', 100, { product_url: 'https://www.extra.com/p/1' })] });
    const b = card({ product_id: 'b', name_ar: 'b', name_en: 'b', stores: [offer('extra', 100, { product_url: 'https://www.extra.com/p/2' })] });
    const c = card({ product_id: 'c', name_ar: 'c', name_en: 'c', stores: [offer('noon', 100, { product_url: 'https://www.noon.com/p/1' })] });
    expect(mergeSameListingCards([a, b, c])).toHaveLength(3);
  });

  it('merges a storefront card into a TPS card that shares a listing URL and keeps BOTH stores when they differ', () => {
    const sf = card({ product_id: 'p1', product_slug: 'p1-slug', name_ar: 'sf', name_en: 'sf', stores: [offer('اكسترا', 1155, { product_url: EXTRA_URL }), offer('أمازون', 1200, { product_url: 'https://www.amazon.sa/dp/B1' })] });
    const t = card({ product_id: 'c1', tps_identity_key: 'k', product_slug: 'k-slug', name_ar: 't', name_en: 't', stores: [offer('extra', 1155, { product_url: '/go/x', listing_url: EXTRA_URL })] });
    const out = mergeSameListingCards([sf, t]);
    expect(out).toHaveLength(1);
    expect(out[0].tps_identity_key).toBe('k');
    expect(out[0].stores.map((s) => s.store).sort()).toEqual(['extra', 'أمازون']);
    expect(out[0].store_count).toBe(2);
  });

  it('returns the input untouched when nothing shares a listing or a shadow name', () => {
    const a = card({ product_id: 'a', tps_identity_key: 'ka', name_ar: 'a', name_en: 'a', stores: [offer('extra', 1, { listing_url: 'https://www.extra.com/p/1' })] });
    const b = card({ product_id: 'b', tps_identity_key: 'kb', name_ar: 'b', name_en: 'b', stores: [offer('noon', 2, { listing_url: 'https://www.noon.com/p/2' })] });
    const input = [a, b];
    expect(mergeSameListingCards(input)).toBe(input);
  });
});
