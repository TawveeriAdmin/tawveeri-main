import {
  isApprovedStore,
  isApprovedStoreId,
  resolveApprovedSlug,
  APPROVED_RETAILERS,
} from '@/lib/retailers/approved-retailers';
import { normalizeStoreUrl } from '@/lib/catalog/normalizeStoreUrl';

// Founder Directive 2026-07-27: public scope = exactly the approved retailers.
describe('approved-retailer scope gate', () => {
  it('accepts approved retailers by slug and by Arabic display name', () => {
    for (const id of ['amazon', 'jarir', 'extra', 'almanea', 'swsg', 'noon']) {
      expect(isApprovedStore(id)).toBe(true);
    }
    // Arabic store_name variants seen in production data
    expect(isApprovedStore('المنيع')).toBe(true);   // almanea
    expect(isApprovedStore('اكسترا')).toBe(true);   // extra
    expect(isApprovedStore('أمازون')).toBe(true);   // amazon
    expect(isApprovedStore('الشتاء والصيف')).toBe(true); // Sheta & Saif (swsg)
    expect(resolveApprovedSlug('جرير')).toBe('jarir');
  });

  it('rejects non-approved stores (shaker, samsung, najm, alnakheel)', () => {
    for (const id of ['shaker', 'samsung_ksa', 'najm', 'alnakheelk', 'hdf', 'sonyworld']) {
      expect(isApprovedStore(id)).toBe(false);
    }
    expect(isApprovedStore('شاكر')).toBe(false);
    expect(isApprovedStore('نجم الأجهزة')).toBe(false);
    expect(isApprovedStore('سامسونج السعودية')).toBe(false);
    expect(isApprovedStore(null)).toBe(false);
    expect(isApprovedStore('')).toBe(false);
  });

  it('gates by numeric store id (approved 1,2,3,4,5,8,10; rejects 6,7,9)', () => {
    for (const id of [1, 2, 3, 4, 5, 8, 10]) expect(isApprovedStoreId(id)).toBe(true);
    for (const id of [6, 7, 9, 11, 22]) expect(isApprovedStoreId(id)).toBe(false);
    expect(isApprovedStoreId(null)).toBe(false);
  });

  it('lists the 26 distinct approved merchants (RedSea = ALJ, one entry)', () => {
    expect(APPROVED_RETAILERS.length).toBe(26);
  });
});

describe('normalizeStoreUrl — Jarir GCC-market → Saudi (sa-en)', () => {
  it('rewrites non-Saudi markets to sa-en, preserving path + childSku', () => {
    expect(normalizeStoreUrl('jarir', 'https://www.jarir.com/qa-ar/vivo-y04-smartphones-jpm1588.html?childSku=655910'))
      .toBe('https://www.jarir.com/sa-en/vivo-y04-smartphones-jpm1588.html?childSku=655910');
    expect(normalizeStoreUrl('جرير', 'https://www.jarir.com/kw-en/xiaomi-15t-smartphones-jpm1486.html?childSku=666038'))
      .toBe('https://www.jarir.com/sa-en/xiaomi-15t-smartphones-jpm1486.html?childSku=666038');
  });

  it('leaves an already-Saudi Jarir URL untouched (idempotent)', () => {
    const sa = 'https://www.jarir.com/sa-en/oppo-a3x-smartphones-jpm1495.html?childSku=641294';
    expect(normalizeStoreUrl('jarir', sa)).toBe(sa);
  });
});

describe('normalizeStoreUrl — Amazon canonical /dp/ASIN', () => {
  it('collapses a bloated search-referral URL to /dp/ASIN?tag', () => {
    const bloated = 'https://www.amazon.sa/-/en/HONOR-X6c-256GB/dp/B0FGWKKFL5/ref=sr_1_5?keywords=honor&qid=1&sr=1-5';
    expect(normalizeStoreUrl('amazon', bloated)).toBe('https://www.amazon.sa/dp/B0FGWKKFL5?tag=tawveeri-21');
  });
});
