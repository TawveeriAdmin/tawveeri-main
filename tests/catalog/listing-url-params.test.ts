// tests/catalog/listing-url-params.test.ts — ADR-389 §8.
// Same-listing merging strips TRACKING parameters only. A parameter that can select a
// different variant or seller is kept, so two such listings are never equated.
import { normalizeListingUrl, mergeSameListingCards } from '@/lib/catalog/merge-verified-canonical-search-results';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';

const BASE = 'https://www.extra.com/en-sa/x/p/100226575';

function offer(store: string, price: number, over: Partial<SearchProduct> = {}): SearchProduct {
  return { name_ar: 'x', name_en: 'x', brand: 'samsung', model: '', sku: null, current_price: price, original_price: null, availability: 'in_stock', product_url: '', image_urls: [], specifications: {}, category: 'air_conditioner', description_ar: null, description_en: null, is_free_delivery: false, delivery_time_days: null, delivery_cost: 0, is_deal: false, coupon_code: null, store, store_name: store, rating: null, review_count: null, ...over } as unknown as SearchProduct;
}
function card(over: Partial<GroupedSearchProduct> & { stores: SearchProduct[] }): GroupedSearchProduct {
  const best = Math.min(...over.stores.map((s) => s.current_price));
  return { ...over.stores[0], best_price: best, current_price: best, store_count: over.stores.length, ...over } as GroupedSearchProduct;
}

describe('normalizeListingUrl — parameter policy', () => {
  it('tracking parameters are stripped (utm_*, ref, gclid, fbclid, srsltid, tag, Amazon dib/qid/sr/pd_rd_*)', () => {
    expect(normalizeListingUrl(`${BASE}?utm_source=x&utm_medium=y&ref=abc&gclid=1&fbclid=2&srsltid=3`)).toBe(normalizeListingUrl(BASE));
    expect(normalizeListingUrl('https://www.amazon.sa/dp/B0F945GXKC/ref=sr_1_41?dib=abc&dib_tag=se&keywords=lg&qid=1&sr=8-41&pd_rd_w=x&tag=t-21'))
      .toBe(normalizeListingUrl('https://www.amazon.sa/dp/B0F945GXKC/ref=sr_1_41'));
  });
  it('variant / seller / colour / size / sku selectors are KEPT and distinguish listings', () => {
    expect(normalizeListingUrl(`${BASE}?variant=256gb`)).not.toBe(normalizeListingUrl(`${BASE}?variant=128gb`));
    expect(normalizeListingUrl(`${BASE}?seller=A`)).not.toBe(normalizeListingUrl(`${BASE}?seller=B`));
    expect(normalizeListingUrl(`${BASE}?color=black`)).not.toBe(normalizeListingUrl(BASE));
    expect(normalizeListingUrl(`${BASE}?sku=1`)).not.toBe(normalizeListingUrl(`${BASE}?sku=2`));
    expect(normalizeListingUrl('https://www.amazon.sa/dp/B1?th=1&psc=1')).not.toBe(normalizeListingUrl('https://www.amazon.sa/dp/B1?th=1&psc=2'));
  });
  it('kept parameters are order-insensitive', () => {
    expect(normalizeListingUrl(`${BASE}?variant=1&color=red`)).toBe(normalizeListingUrl(`${BASE}?color=red&variant=1&utm_source=z`));
  });
});

describe('mergeSameListingCards — versions and sellers stay apart', () => {
  it('two cards on the same path that differ only by a variant parameter are NOT merged', () => {
    const a = card({ product_id: 'a', name_ar: 'ايفون 16 128', name_en: 'iPhone 16 128', stores: [offer('extra', 2239, { product_url: `${BASE}?variant=128gb` })] });
    const b = card({ product_id: 'b', name_ar: 'ايفون 16 256', name_en: 'iPhone 16 256', stores: [offer('extra', 2639, { product_url: `${BASE}?variant=256gb` })] });
    expect(mergeSameListingCards([a, b])).toHaveLength(2);
  });
  it('two cards on the same path that differ only by a seller parameter are NOT merged', () => {
    const a = card({ product_id: 'a', name_ar: 'x', name_en: 'x', stores: [offer('noon', 100, { product_url: 'https://www.noon.com/p/1?seller=s1' })] });
    const b = card({ product_id: 'b', name_ar: 'y', name_en: 'y', stores: [offer('noon', 100, { product_url: 'https://www.noon.com/p/1?seller=s2' })] });
    expect(mergeSameListingCards([a, b])).toHaveLength(2);
  });
  it('the same listing reached with and without tracking parameters IS merged', () => {
    const a = card({ product_id: 'a', product_slug: 'a', name_ar: 'x', name_en: 'x', stores: [offer('extra', 1155, { product_url: `${BASE}?utm_source=tawveeri&ref=card` })] });
    const b = card({ product_id: 'b', tps_identity_key: 'k', product_slug: 'k', name_ar: 'y', name_en: 'y', stores: [offer('extra', 1155, { product_url: '/go/1', listing_url: BASE })] });
    const out = mergeSameListingCards([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].tps_identity_key).toBe('k');
  });
});
