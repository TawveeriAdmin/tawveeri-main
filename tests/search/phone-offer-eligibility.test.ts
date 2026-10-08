import { eligiblePhoneCard } from '@/lib/search/phone-offer-eligibility';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';

const now = new Date().toISOString();
const old = '2020-01-01T00:00:00Z';
const card = (stores: unknown[]) => ({
  name_en: 'Redmi Note 14 256GB', tps_identity_key: 'xiaomi|Redmi Note|14|Standard|256',
  best_price: 72.49, current_price: 72.49, store_count: 2, has_tps_comparison: true,
  tps_compare_url: '/ar/compare/example', stores,
}) as GroupedSearchProduct;
const offer = (store: string, price: number, availability = 'in_stock', date = now) => ({
  store, store_name: store, current_price: price, availability, observed_at: date, product_url: `/go/${store}`,
});

describe('phone offer eligibility', () => {
  it('cannot present an out-of-stock 72.49 offer as the Noon 699 price', () => {
    const result = eligiblePhoneCard(card([offer('jarir', 72.49, 'out_of_stock'), offer('noon', 699)]))!;
    expect(result.best_price).toBe(699);
    expect(result.store).toBe('noon');
    expect(result.product_url).toBe('/go/noon');
    expect(result.store_count).toBe(1);
    expect(result.has_tps_comparison).toBe(false);
    expect(result.tps_compare_url).toBeUndefined();
  });
  it('does not revive stale, missing-time, unknown-availability, or invalid-price offers', () => {
    expect(eligiblePhoneCard(card([offer('noon', 699, 'in_stock', old), offer('amazon', 1, 'unknown'), offer('extra', 0), offer('jarir', 100, 'in_stock', '')]))).toBeNull();
  });
  it('preserves the stated preorder status and counts each retailer once', () => {
    const result = eligiblePhoneCard(card([offer('amazon', 1000, 'pre_order'), offer('أمازون السعودية', 1100), offer('noon', 1200, 'limited_stock')]))!;
    expect(result.availability).toBe('pre_order');
    expect(result.store_count).toBe(2);
    expect(result.has_tps_comparison).toBe(true);
  });
});
