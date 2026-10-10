/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '@/app/go/[offerId]/route';

const mockInsert = jest.fn().mockResolvedValue({error:null});
let mockRows: Record<string, unknown>;
jest.mock('@supabase/supabase-js', () => ({createClient: () => ({from: (table: string) => ({
  select() { return this; }, eq() { return this; },
  maybeSingle: async () => ({data:mockRows[table],error:null}), insert:mockInsert,
})})}));
jest.mock('@/lib/providers', () => ({getProviderByStoreId:jest.fn(),buildOfferExitLink:jest.fn()}));
const id = '733e87fa-7fcb-4738-84d7-d7eaf98998af';
const url = 'https://www.amazon.sa/dp/B0HJ9ZYZQR';
beforeEach(() => {
  mockInsert.mockClear();
  mockRows = {
    normalized_product_observations:{id,store_id:'2',canonical_product_id:'canonical',normalized_payload:{_url:url,_raw_id:3206948,family:'iPhone'}},
    canonical_products:{tps_identity_key:'apple|iPhone|18|Pro|1024'},
    tps_current_offers:{payload:{}},raw_observations:{payload:{sku:'B0HJB3HBM8'}},
  };
});
const request = () => GET(new NextRequest(`https://tawveeri.com/go/${id}`,{headers:{'user-agent':'Googlebot'}}),{params:Promise.resolve({offerId:id})});
it('blocks historical exits of a quarantined canonical/store before recording a click', async () => {
  mockRows.tps_current_offers={payload:{_identity_quarantine:'asin_url_sku_conflict'}};
  const response=await request();
  expect(response.status).toBe(410);
  expect(response.headers.get('location')).toBeNull();
  expect(mockInsert).not.toHaveBeenCalled();
});
it('independently blocks a raw URL/SKU conflict even without a quarantine marker', async () => {
  expect((await request()).status).toBe(410);
  expect(mockInsert).not.toHaveBeenCalled();
});
it('preserves the verified destination and the existing non-affiliate bot policy', async () => {
  mockRows.raw_observations={payload:{sku:'B0HJ9ZYZQR'}};
  const response=await request();
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe(url);
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({is_test:true,affiliate_program:'direct',affiliate_tag:null}));
});

describe('ADR-408: the raw URL/SKU check covers every Amazon exit, not only phone families', () => {
  const tvUrl = 'https://www.amazon.sa/dp/B0F9KSYSP2';
  const tv = (sku: string) => { mockRows = {
    normalized_product_observations:{id,store_id:'2',canonical_product_id:'canonical',normalized_payload:{_url:tvUrl,_raw_id:3303344,family:null}},
    raw_observations:{payload:{sku}},
  }; };
  it('blocks a TV exit whose raw capture describes another ASIN (410, no click recorded)', async () => {
    tv('B0F8VY1F91');
    const response = await request();
    expect(response.status).toBe(410);
    expect(response.headers.get('location')).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });
  it('lets the same TV exit through when the capture describes the requested ASIN', async () => {
    tv('B0F9KSYSP2');
    const response = await request();
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(tvUrl);
  });
  it('does not apply to another merchant', async () => {
    tv('B0F8VY1F91');
    (mockRows.normalized_product_observations as { store_id: string }).store_id = '1';
    expect((await request()).status).not.toBe(410);
  });
});
