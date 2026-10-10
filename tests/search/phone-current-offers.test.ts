import { eligiblePhoneCurrentOffers, loadPhoneOfferPools, type PhoneCurrentOffer } from '@/lib/search/phone-current-offers';
import { hasAmazonAsinConflict } from '@/lib/scraping/utils/amazon-asin';

const row = (extra: Partial<PhoneCurrentOffer> = {}): PhoneCurrentOffer => ({
  identity_key: 'apple|iPhone|18|Pro|256', store_id: 2, raw_obs_id: 1,
  name: 'iPhone 18 Pro 256GB', price: 5699, status: 'valid', observed_at: new Date().toISOString(),
  payload: { _availability: 'in_stock' }, ...extra,
});
describe('phone current-state integrity', () => {
  it('never restores quarantined or retired historical offers', () => {
    expect(eligiblePhoneCurrentOffers([
      row({payload:{_availability:'in_stock',_identity_quarantine:'asin_conflict'}}),
      row({payload:{_availability:'in_stock',_superseded_by_identity:'other'}}),
      row({status:'invalid'}),
    ])).toEqual([]);
  });
  it('requires explicit availability and a fresh positive price', () => {
    expect(eligiblePhoneCurrentOffers([row({payload:{}}),row({price:0}),row({observed_at:'2020-01-01'}),row({payload:{_availability:'out_of_stock'}})])).toEqual([]);
    expect(eligiblePhoneCurrentOffers([row()])).toHaveLength(1);
  });
  it('keeps a cheap refurbished listing out of the unspecified-condition pool', () => {
    const unspecified = row({store_id:3});
    expect(eligiblePhoneCurrentOffers([row({name:'Refurbished iPhone 18 Pro 256GB',price:500}),unspecified])).toEqual([unspecified]);
  });
  it.each([
    ['B0HJ9ZYZQR','B0HJB3HBM8'],['B0DLBDMG2Q','B0CQ2NFQ5Q'],['B0CQ2RM6TX','B0CQ2LYYWV'],
    ['B0DLBDMG2Q','B0CQ2Q2QDB'],['B08X1RMTR3','B0CQ2S4G3C'],
  ])('blocks audited URL/SKU conflict %s / %s independently of slug', (requested,selected) => {
    expect(hasAmazonAsinConflict(`https://www.amazon.sa/completely-misleading-title/dp/${requested}?tag=unchanged`,selected)).toBe(true);
    expect(hasAmazonAsinConflict(`https://www.amazon.sa/dp/${requested}`,requested)).toBe(false);
  });
  it('fails closed if current evidence cannot be loaded', async () => {
    const db = {from:()=>({select:()=>({eq:()=>({in:async()=>({data:null,error:{message:'timeout'}})})})})};
    expect((await loadPhoneOfferPools(db,['x'])).size).toBe(0);
  });
});

describe('ADR-408: the normalizer\'s Amazon ASIN conflict predicate is category-free and store-scoped', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isAmazonAsinConflictRow } = require('@/lib/scraping/utils/amazon-asin');
  it('refuses a conflicting Amazon row whatever it is (the predicate takes no category)', () => {
    expect(isAmazonAsinConflictRow(2, 'https://www.amazon.sa/dp/B0DLJF6B54', 'B0DLHG1PK8')).toBe(true);
    expect(isAmazonAsinConflictRow('2', 'https://www.amazon.sa/Apple-MacBook-Pro/dp/B0DLJF6B54/ref=sr_1_3?tag=x', 'b0dlhg1pk8')).toBe(true);
  });
  it('keeps matching ASINs, rows with no SKU, non-ASIN SKUs and every other merchant', () => {
    expect(isAmazonAsinConflictRow(2, 'https://www.amazon.sa/dp/B0DLJF6B54', 'B0DLJF6B54')).toBe(false);
    expect(isAmazonAsinConflictRow(2, 'https://www.amazon.sa/dp/B0DLJF6B54', null)).toBe(false);
    expect(isAmazonAsinConflictRow(2, 'https://www.amazon.sa/dp/B0DLJF6B54', 'MQTP3AE/A')).toBe(false);
    expect(isAmazonAsinConflictRow(1, 'https://www.jarir.com/sa-en/x.html', 'B0DLHG1PK8')).toBe(false);
  });
});
