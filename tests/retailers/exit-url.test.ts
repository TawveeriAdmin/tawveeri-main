/**
 * Merchant-destination truth (ADR-259).
 *
 * INVARIANT: Tawveeri never knowingly sends a consumer to a merchant's development or
 * staging host. Measured 2026-08-18: 49,918 normalized observations carried Almanea's
 * `m.dev-almanea.com`, which is the table `/go` resolves exits from, and on a live 8-URL
 * sample that host already returned 404 twice while the canonical shape returned 200
 * eight times out of eight.
 *
 * These cases are built from REAL production URLs (ids taken from tps_current_offers),
 * not invented ones, so a change in Almanea's URL shape fails here rather than in front
 * of a shopper.
 */

import { normalizeExitUrl, isNonProductionExitUrl } from '@/lib/retailers/exit-url';

describe('normalizeExitUrl — Almanea dev host (ADR-259)', () => {
  // Verified live 2026-08-18: dev host 404, canonical 200.
  it('rewrites a dev-host URL that is already dead to the canonical shape', () => {
    expect(
      normalizeExitUrl('https://m.dev-almanea.com/some-slug-p-170711802999019')
    ).toBe('https://www.almanea.sa/ar/product/p-170711802999019');
  });

  // Verified live 2026-08-18: dev host 200, canonical 200. Still rewritten — a working
  // dev host is a destination we decline to use, not a destination we accept.
  it('rewrites a dev-host URL that still resolves', () => {
    expect(
      normalizeExitUrl('https://m.dev-almanea.com/anker-soundcore-tws-k20i-a3994h11-black-p-170114260999001')
    ).toBe('https://www.almanea.sa/ar/product/p-170114260999001');
  });

  it('honours locale', () => {
    expect(
      normalizeExitUrl('https://m.dev-almanea.com/x-p-170114205999012', 'en')
    ).toBe('https://www.almanea.sa/en/product/p-170114205999012');
  });

  it('handles the short and long id forms both seen in production', () => {
    // Real ids observed: 1701118 (7), 1701005020 (10), 170111805999005 (15).
    expect(normalizeExitUrl('https://m.dev-almanea.com/apple-ipad-11pro-p-1701118'))
      .toBe('https://www.almanea.sa/ar/product/p-1701118');
    expect(normalizeExitUrl('https://m.dev-almanea.com/samsung-tab-p-1701005020'))
      .toBe('https://www.almanea.sa/ar/product/p-1701005020');
    expect(normalizeExitUrl('https://m.dev-almanea.com/earpods-p-170111805999005'))
      .toBe('https://www.almanea.sa/ar/product/p-170111805999005');
  });

  it('still repairs the live-host legacy shape it was originally written for', () => {
    expect(normalizeExitUrl('https://www.almanea.sa/aukey-charger-p-170114809999007'))
      .toBe('https://www.almanea.sa/ar/product/p-170114809999007');
  });

  it('leaves production URLs from every other retailer untouched', () => {
    const untouched = [
      'https://www.amazon.sa/-/en/dp/B0FN15LKGD/',
      'https://www.noon.com/saudi-en/split-ac-phantom-12-000-btu/p/',
      'https://www.extra.com/en-sa/mobiles-tablets/tablets/ipad/apple-ipad-air/',
      'https://www.jarir.com/sa-en/apple-iphone-16.html',
      'https://www.almanea.sa/ar/product/p-170114260999001', // already canonical
      'https://najm.store/product-x',
    ];
    for (const url of untouched) expect(normalizeExitUrl(url)).toBe(url);
  });

  it('is null/undefined safe', () => {
    expect(normalizeExitUrl(null)).toBeNull();
    expect(normalizeExitUrl(undefined)).toBeNull();
    // Empty string passes through as-is (pre-existing contract). /go rejects it a moment
    // later via its absolute-URL check, so it can never become a redirect target.
    expect(normalizeExitUrl('')).toBe('');
  });
});

describe('isNonProductionExitUrl — the exit-path refusal gate', () => {
  it('flags merchant dev/staging hosts', () => {
    const nonProd = [
      'https://m.dev-almanea.com/no-id-here',           // the 0.1% we cannot map
      'https://dev.example.com/product/1',
      'https://staging.merchant.sa/p/2',
      'https://shop.staging-merchant.com/p/3',
      'https://www.merchant.test.sa/p/4',
    ];
    for (const url of nonProd) expect(isNonProductionExitUrl(url)).toBe(true);
  });

  it('does not flag production hosts', () => {
    const prod = [
      'https://www.almanea.sa/ar/product/p-170114260999001',
      'https://www.amazon.sa/-/en/dp/B0FN15LKGD/',
      'https://www.noon.com/saudi-en/x/p/',
      'https://www.extra.com/en-sa/x/',
      'https://www.jarir.com/sa-en/x.html',
      // must not be tripped by the substring "dev" inside an ordinary word/host
      'https://www.developer-store.sa/p/1',
      'https://devices.example.sa/p/2',
    ];
    for (const url of prod) expect(isNonProductionExitUrl(url)).toBe(false);
  });

  it('a mapped dev URL is no longer refused — repair happens before the gate', () => {
    const mapped = normalizeExitUrl('https://m.dev-almanea.com/x-p-170114205999012');
    expect(isNonProductionExitUrl(mapped)).toBe(false);
  });

  it('is null/undefined safe', () => {
    expect(isNonProductionExitUrl(null)).toBe(false);
    expect(isNonProductionExitUrl(undefined)).toBe(false);
  });
});
