// Truth Hardening Final Closure mission (2026-09-05), ADR-292. Pure-logic tests for the
// product-recovery worker's plausibility gate (Part 10/16) — no provider call, no DB write.
import { significantTokens, isPlausibleCandidate, matchesAnyCanonicalName } from '@/app/api/cron/product-recovery/route';
import type { SearchProduct } from '@/lib/scraping/search/types';

function product(over: Partial<SearchProduct>): SearchProduct {
  return {
    name_ar: '', name_en: '', brand: '', model: '', sku: null, current_price: 100, original_price: null,
    availability: 'in_stock', product_url: '', image_urls: [], specifications: {},
    ...over,
  } as SearchProduct;
}

describe('significantTokens', () => {
  it('strips generic want-verbs/stopwords, keeps the identity-bearing tokens', () => {
    expect(significantTokens('ابي Galaxy S27 Ultra 512GB')).toEqual(['galaxy', 's27', 'ultra', '512gb']);
  });
});

describe('isPlausibleCandidate — Part 16 wrong-variant protection', () => {
  const queryTokens = significantTokens('Galaxy S27 Ultra 512GB');

  it('accepts a candidate whose title contains every significant query token', () => {
    expect(isPlausibleCandidate(product({ name_en: 'Samsung Galaxy S27 Ultra 512GB Titanium' }), queryTokens)).toBe(true);
  });

  it('rejects a candidate missing the requested capacity — a 256GB unit must never satisfy a 512GB request', () => {
    expect(isPlausibleCandidate(product({ name_en: 'Samsung Galaxy S27 Ultra 256GB Titanium' }), queryTokens)).toBe(false);
  });

  it('rejects a candidate missing the requested variant name (Ultra vs base)', () => {
    expect(isPlausibleCandidate(product({ name_en: 'Samsung Galaxy S27 512GB' }), queryTokens)).toBe(false);
  });

  it('rejects an accessory even when it names every token (case cover, not the device)', () => {
    expect(isPlausibleCandidate(product({ name_en: 'Case for Samsung Galaxy S27 Ultra 512GB, Clear' }), queryTokens)).toBe(false);
  });

  it('rejects an unrelated product that happens to share no tokens', () => {
    expect(isPlausibleCandidate(product({ name_en: 'Sony WH-1000XM5 Headphones' }), queryTokens)).toBe(false);
  });
});

describe('matchesAnyCanonicalName — ADR-292 POST-DEPLOYMENT PROOF CLOSURE Product Truth check', () => {
  // Reproduces the live-proven defect: the real "Samsung Galaxy Tab S11 Ultra" recovery matched
  // canonical_products id d3a4fc66 (identity_key "samsung|galaxy tab s11 ultra|NO_GEN|256|wifi|
  // 14.6"), which already existed a month before the "recovery" ran.
  it('matches an already-active canonical row naming the same product (real production case)', () => {
    const tokens = significantTokens('Samsung Galaxy Tab S11 Ultra');
    const rows = [{ name_ar: 'تابلت سامسونج Galaxy Tab S11 Ultra 256GB Wi-Fi', name_en: 'Samsung Galaxy Tab S11 Ultra 14.6" 256GB Wi-Fi' }];
    expect(matchesAnyCanonicalName(rows, tokens)).toBe(true);
  });

  it('does not match when no canonical row contains every token (genuinely new)', () => {
    const tokens = significantTokens('Samsung Galaxy Tab S12 Ultra');
    const rows = [{ name_ar: 'تابلت سامسونج Galaxy Tab S11 Ultra 256GB Wi-Fi', name_en: 'Samsung Galaxy Tab S11 Ultra 14.6" 256GB Wi-Fi' }];
    expect(matchesAnyCanonicalName(rows, tokens)).toBe(false);
  });

  it('returns false for an empty canonical row set (nothing to match against)', () => {
    expect(matchesAnyCanonicalName([], significantTokens('iPhone 17 Air 2TB'))).toBe(false);
  });
});
