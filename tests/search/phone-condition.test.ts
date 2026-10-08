import { phoneCondition, phoneConditionPool } from '@/lib/search/phone-condition';
import { eligiblePhoneCard } from '@/lib/search/phone-offer-eligibility';
import { deriveComparisonSummary, partitionOffersByEligibility, type CompareOffer } from '@/lib/compare/get-comparison';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { MerchantCondition } from '@/lib/campaigns/condition';

const offer = (store: string, condition: MerchantCondition, price: number): CompareOffer => ({
  store_slug: store, store_name: store, raw_name: 'iPhone 16 Pro 256GB', phone_condition: condition,
  price, availability: 'in_stock', observed_at: new Date().toISOString(), product_url: `/go/${store}`,
  stale: false, confidence: 100, is_verified: true, campaign_eligibility: null,
});

describe('phone condition boundaries', () => {
  it('cannot claim a current phone price from a fresh timestamp with unknown availability', () => {
    const unknown = { ...offer('extra', 'UNKNOWN', 999), availability: null };
    const result = deriveComparisonSummary([unknown]);
    expect(result.summary.lowest_price).toBeNull();
    expect(result.summary.eligible_store_count).toBe(0);
    expect(result.message).toContain('لا يوجد حاليًا عرض موثوق');
    expect(partitionOffersByEligibility([unknown]).older).toEqual([unknown]);
  });
  it('never promotes absence of evidence or an unverified structured default to NEW', () => {
    expect(phoneCondition('iPhone 16 Pro')).toBe('UNKNOWN');
    expect(phoneCondition('iPhone 16 Pro', { structuredCondition: 'new' })).toBe('UNKNOWN');
    expect(phoneCondition('iPhone 16 Pro', { structuredCondition: 'new', structuredSourceVerifiedForNew: true })).toBe('NEW');
    expect(phoneCondition('Renewed Grade B iPhone 16 Pro')).toBe('RENEWED');
    expect(phoneCondition('Apple (Refurbished) iPhone 12')).toBe('REFURBISHED');
  });

  it.each(['RENEWED', 'REFURBISHED', 'UNKNOWN'] as const)('does not compare NEW against cheaper %s, even for identical model/storage', condition => {
    const offers = [offer('amazon', condition, 500), offer('extra', 'NEW', 3000), offer('noon', 'NEW', 3100)];
    const { summary } = deriveComparisonSummary(offers);
    expect(summary.lowest_price).toBe(3000);
    expect(summary.saving).toBe(100);
    expect(summary.eligible_store_count).toBe(2);
    expect(partitionOffersByEligibility(offers).older).toEqual([offers[0]]);
  });

  it('keeps unknown separate from renewed without calling it new', () => {
    const offers = [offer('amazon', 'RENEWED', 500), offer('noon', 'UNKNOWN', 3000)];
    expect(phoneConditionPool(offers, o => o.phone_condition!)).toEqual([offers[1]]);
    expect(deriveComparisonSummary(offers).summary.lowest_price).toBe(3000);
  });

  it('search and comparison choose the same condition pool and show its label', () => {
    const offers = [offer('amazon', 'REFURBISHED', 500), offer('noon', 'UNKNOWN', 3000)];
    const card = {
      name_ar: 'آيفون 16 برو 256', name_en: 'iPhone 16 Pro 256GB',
      stores: offers.map(o => ({ ...o, name_en: o.raw_name, store: o.store_slug, current_price: o.price })),
    } as unknown as GroupedSearchProduct;
    const result = eligiblePhoneCard(card)!;
    expect(result.best_price).toBe(deriveComparisonSummary(offers).summary.lowest_price);
    expect(result.store_count).toBe(1);
    expect(result.stores[0].phone_condition).toBe('UNKNOWN');
    expect(result.name_ar).toContain('الحالة غير مؤكدة');
  });
});
