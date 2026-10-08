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
