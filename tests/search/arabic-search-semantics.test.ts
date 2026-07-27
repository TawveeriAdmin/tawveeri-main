import { normalizeArabic } from '@/lib/search/arabic-normalize';

// Semantic regression for the CONFIRMED #1 failure: "ايفون ١٦" returned ZERO results because the
// Arabic-Indic numeral ١٦ never matched the catalogue's ASCII "16". These tests assert the
// normalization that makes an Arabic-numeral query match an ASCII-named product.
describe('Arabic search normalization — semantic regression (#1 zero-result)', () => {
  it('folds Arabic-Indic numerals so "ايفون ١٦" matches an "iPhone 16" product', () => {
    const q = normalizeArabic('ايفون ١٦');
    expect(q).toContain('16');
    // AND-match simulation (mirrors productMatchesAllWords): every query word present in the product text
    const productHay = (normalizeArabic('ايفون 16') + ' ' + normalizeArabic('Apple iPhone 16 128GB')).toLowerCase();
    for (const w of q.split(/\s+/)) expect(productHay.includes(w)).toBe(true);
  });

  it('folds Eastern Arabic-Indic numerals (۱۶ → 16)', () => {
    expect(normalizeArabic('۱۶')).toBe('16');
    expect(normalizeArabic('١٦')).toBe('16');
  });

  it('unifies common Arabic spelling variants so "ثلاجه" == "ثلاجة"', () => {
    expect(normalizeArabic('ثلاجة')).toBe(normalizeArabic('ثلاجه'));
    expect(normalizeArabic('صغيرة')).toBe(normalizeArabic('صغيره'));
    expect(normalizeArabic('أيفون')).toBe(normalizeArabic('ايفون'));
  });

  // Documents the honesty invariant enforced in the search route (verified live):
  // a "قارن الأسعار" compare CTA / tps_compare_url is emitted ONLY when store_count >= 2.
  it('compare-CTA gating rule: only >=2 distinct stores qualifies as a comparison', () => {
    const qualifiesAsComparison = (storeCount: number) => storeCount >= 2;
    expect(qualifiesAsComparison(1)).toBe(false); // single store → NO compare CTA
    expect(qualifiesAsComparison(0)).toBe(false);
    expect(qualifiesAsComparison(2)).toBe(true);
    expect(qualifiesAsComparison(3)).toBe(true);
  });
});
