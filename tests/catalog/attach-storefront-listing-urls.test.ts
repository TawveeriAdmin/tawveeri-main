// tests/catalog/attach-storefront-listing-urls.test.ts — ADR-389.
// Live recurrence (2026-09-26 evening): «مكيف سامسونج 18000» returned the TPS canonical AND the
// identity-less "memory" canonical (`f9fa9c5a…`, no URL, no image) because the storefront row it
// was written from was not in the candidate set this time, so the ghost had no URL to merge on.
// discover-firecrawl creates that canonical keyed on the products row's EXACT `name_ar`
// (`sb.from('canonical_products').select('id').eq('name_ar', nameAr)`), so an exact-name match
// against an active products row is the writer's own key — not a similarity guess. The
// storefront row's listing URL is attached as `listing_url`; the URL lane then merges it.
import { attachStorefrontListingUrls, mergeSameListingCards } from '@/lib/catalog/merge-verified-canonical-search-results';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';

const EXTRA_URL = 'https://www.extra.com/en-sa/large-appliances-/air-conditioner/split-air-conditioner/samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold/p/100226575';
function offer(store: string, price: number, over: Partial<SearchProduct> = {}): SearchProduct {
  return { name_ar: 'x', name_en: 'x', brand: 'samsung', model: '', sku: null, current_price: price, original_price: null, availability: 'in_stock', product_url: '', image_urls: [], specifications: {}, category: 'air_conditioner', description_ar: null, description_en: null, is_free_delivery: false, delivery_time_days: null, delivery_cost: 0, is_deal: false, coupon_code: null, store, store_name: store, rating: null, review_count: null, ...over } as unknown as SearchProduct;
}
function card(over: Partial<GroupedSearchProduct> & { stores: SearchProduct[] }): GroupedSearchProduct {
  const best = Math.min(...over.stores.map((s) => s.current_price));
  return { ...over.stores[0], best_price: best, current_price: best, store_count: over.stores.length, ...over } as GroupedSearchProduct;
}
const NAME_AR = 'Samsung Split AC 18000 BTU Rotary Compressor Heat and Cold';
const ghost = card({ product_id: 'f9fa9c5a', product_slug: '', name_ar: NAME_AR, name_en: 'Samsung Split AC, 18000 BTU,Rotary Compressor,Heat and Cold', stores: [offer('extra', 1155, { product_url: '' })] });
const tps = card({ product_id: 'eea9c4f2', product_slug: 'samsung-split-18000-standard-no_mode', tps_identity_key: 'samsung|split|NO_SERIES|18000|Standard|NO_MODE', name_ar: 'مكيف سبليت سامسونج، 18000 وحدة، عادي', name_en: 'Samsung Split AC 18000 BTU Standard', stores: [offer('extra', 1155, { product_url: '/go/71047ca4', listing_url: EXTRA_URL })] });
const storefrontRows = [{ id: 'c938d587', name_ar: NAME_AR, product_stores: [{ store_id: 4, product_url: EXTRA_URL }] }];

describe('attachStorefrontListingUrls', () => {
  it('attaches the storefront listing URL to an identity-less, URL-less card whose name_ar equals the products row (same store)', () => {
    const out = attachStorefrontListingUrls([ghost, tps], storefrontRows);
    expect(out[0].stores[0].listing_url).toBe(EXTRA_URL);
    expect(out[0].stores[0].product_url).toBe(''); // the exit is never fabricated
    expect(out[1]).toBe(tps); // identity-bearing cards untouched
  });
  it('then the same-listing lane merges the ghost into the TPS card — one card, TPS representative', () => {
    const merged = mergeSameListingCards(attachStorefrontListingUrls([tps, ghost], storefrontRows));
    expect(merged).toHaveLength(1);
    expect(merged[0].tps_identity_key).toBe('samsung|split|NO_SERIES|18000|Standard|NO_MODE');
    expect(merged[0].stores).toHaveLength(1);
    expect(merged[0].stores[0].product_url).toBe('/go/71047ca4');
  });
  it('a different store, a different name, or a row without a URL attaches nothing', () => {
    expect(attachStorefrontListingUrls([ghost], [{ id: 'x', name_ar: NAME_AR, product_stores: [{ store_id: 2, product_url: 'https://www.amazon.sa/dp/B1' }] }])[0].stores[0].listing_url).toBeUndefined();
    expect(attachStorefrontListingUrls([ghost], [{ id: 'x', name_ar: NAME_AR + ' Pro', product_stores: [{ store_id: 4, product_url: EXTRA_URL }] }])[0].stores[0].listing_url).toBeUndefined();
    expect(attachStorefrontListingUrls([ghost], [{ id: 'x', name_ar: NAME_AR, product_stores: [{ store_id: 4, product_url: null }] }])[0].stores[0].listing_url).toBeUndefined();
  });
  it('a card that already has a URL or an identity key is never touched', () => {
    const withUrl = card({ product_id: 'w', name_ar: NAME_AR, name_en: 'w', stores: [offer('extra', 1155, { product_url: 'https://www.extra.com/p/other' })] });
    const out = attachStorefrontListingUrls([withUrl, tps], storefrontRows);
    expect(out[0]).toBe(withUrl);
    expect(out[1]).toBe(tps);
  });
  it('two identity-less cards with the same name_ar but DIFFERENT storefront rows are not conflated: each gets only its own row URL', () => {
    const other = card({ product_id: 'g2', product_slug: '', name_ar: 'Other AC', name_en: 'Other AC', stores: [offer('extra', 999, { product_url: '' })] });
    const out = attachStorefrontListingUrls([ghost, other], [...storefrontRows, { id: 'o', name_ar: 'Other AC', product_stores: [{ store_id: 4, product_url: 'https://www.extra.com/p/999' }] }]);
    expect(out[0].stores[0].listing_url).toBe(EXTRA_URL);
    expect(out[1].stores[0].listing_url).toBe('https://www.extra.com/p/999');
    expect(mergeSameListingCards(out)).toHaveLength(2);
  });
});
