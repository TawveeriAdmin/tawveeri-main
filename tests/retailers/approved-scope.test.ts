import {
  isApprovedStore,
  isApprovedStoreId,
  resolveApprovedSlug,
  isDisplayableRetailer,
  APPROVED_RETAILERS,
} from '@/lib/retailers/approved-retailers';
import { normalizeStoreUrl } from '@/lib/catalog/normalizeStoreUrl';

// Founder Directive 2026-07-27: public scope = exactly the approved retailers.
describe('approved-retailer scope gate', () => {
  it('accepts approved retailers by slug and by Arabic display name', () => {
    for (const id of ['amazon', 'jarir', 'extra', 'almanea', 'noon']) {
      expect(isApprovedStore(id)).toBe(true);
    }
    // Arabic store_name variants seen in production data
    expect(isApprovedStore('المنيع')).toBe(true);   // almanea
    expect(isApprovedStore('اكسترا')).toBe(true);   // extra
    expect(isApprovedStore('أمازون')).toBe(true);   // amazon
    expect(resolveApprovedSlug('جرير')).toBe('jarir');
  });

  // BOUNDARY MOVED 2026-07-29 by founder directive (ADR-139). These three assertions
  // encoded the 2026-07-27 Rakhys-benchmark portfolio, which deliberately excluded
  // shaker / najm / alnakheelk. STANDING_DIRECTIVE.md supersedes that and names
  // alnakheelk and najm as onboarding targets on measured overlap. They were already
  // ingested; admitting them moves +137 canonicals from single-store to comparable.
  // sonyworld stays out — it is the reference case for a brand specialist producing 0.
  it('admits the three ingested multi-brand retailers (ADR-139)', () => {
    for (const id of ['najm', 'shaker', 'alnakheelk', 'samsung_ksa']) {
      expect(isApprovedStore(id)).toBe(true);
    }
    expect(isApprovedStore('شاكر')).toBe(true);
    expect(isApprovedStore('نجم الأجهزة')).toBe(true);
    expect(isApprovedStore('متجر النخيل')).toBe(true);
    // ADR-143 — admitted AFTER ingesting it and measuring the result, not before.
    expect(isApprovedStore('سامسونج السعودية')).toBe(true);
    expect(isApprovedStoreId(6)).toBe(true);
  });

  it('still rejects everything outside the approved set', () => {
    for (const id of ['hdf', 'sonyworld']) {
      expect(isApprovedStore(id)).toBe(false);
    }
    expect(isApprovedStore(null)).toBe(false);
    expect(isApprovedStore('')).toBe(false);
  });

  it('gates by numeric store id (approved 1,2,3,4,5,6,7,8,9,10,18)', () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18]) expect(isApprovedStoreId(id)).toBe(true);
    for (const id of [11, 22]) expect(isApprovedStoreId(id)).toBe(false);
    expect(isApprovedStoreId(null)).toBe(false);
  });

  /**
   * Founder decision 2026-08-02, standing rule: a retailer that cannot be ingested
   * legitimately is inactive AND hidden. lulu/sharafdg have no credential-free route and
   * must stay rejected at BOTH gates — re-admitting one silently is exactly the regression
   * this asserts against, because the harm (a price that only gets older) is invisible on
   * the surface.
   */
  it('keeps the two retired retailers fully hidden (lulu 23, sharafdg 24)', () => {
    // Both gates, because they answer different questions: the id gate is ingestion
    // approval, `isDisplayableRetailer` is whether a customer may be shown the retailer.
    for (const id of [23, 24]) expect(isApprovedStoreId(id)).toBe(false);
    for (const slug of ['lulu', 'sharafdg']) {
      expect(isDisplayableRetailer(slug)).toBe(false);
    }
  });

  /**
   * Black Box (blackbox, store 10) RECOVERED for ingestion 2026-08-06 — the earlier
   * "bot-walled" finding tested the wrong domain (blackboxksa.com, an unrelated merchant);
   * the real domain (blackbox.com.sa) sources credential-free. F3 still applies: ingestion
   * approval is NOT display approval. This must stay approved-but-hidden until a production
   * audit is recorded in docs/BLACKBOX-RETAILER-ONBOARDING.md — do not flip
   * isDisplayableRetailer('blackbox') to true without that audit.
   */
  it('approves blackbox (10) for ingestion but keeps it display-excluded pending audit', () => {
    expect(isApprovedStoreId(10)).toBe(true);
    expect(isApprovedStore('blackbox')).toBe(true);
    expect(isDisplayableRetailer('blackbox')).toBe(false);
  });

  it('lists 30 distinct approved merchants (26 portfolio + 4 admitted on overlap)', () => {
    expect(APPROVED_RETAILERS.length).toBe(30);
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
    expect(normalizeStoreUrl('amazon', bloated)).toBe('https://www.amazon.sa/dp/B0FGWKKFL5?tag=tawveeri0f-21');
  });
});
