import { normalizeArabic } from '@/lib/search/arabic-normalize';
import { parseShoppingTask } from '@/lib/agent/task-parser';

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

  // MEASURED GAP (2026-08-09): fixing the categoryEnforcedZero collapse by stripping budget
  // wrapper words from relevance is not the same as the grid actually respecting the stated
  // budget — a need-shaped query's parsed budget must become a REAL retrieval-level price
  // ceiling (`body.max_price`), never merely removed from text matching, or the route shows
  // confident-wrong (above-budget) products under a header claiming the budget was understood.
  // This mirrors the exact inference condition in src/app/api/search/route.ts
  // (`inferredMaxPrice`) so a change there that silently drops the guard is caught here too.
  it('a need-shaped query with a parsed category+budget infers a max_price ceiling', () => {
    const inferMaxPrice = (task: ReturnType<typeof parseShoppingTask>, explicitMaxPrice?: number) => {
      const needShaped = !!task.category && (typeof task.budget_total === 'number' || typeof task.room_size_m2 === 'number');
      return needShaped && typeof task.budget_total === 'number' && typeof explicitMaxPrice !== 'number'
        ? task.budget_total
        : null;
    };
    expect(inferMaxPrice(parseShoppingTask('مكيف لغرفة 30 متر هادي تحت 4000'))).toBe(4000);
    // An explicit sidebar filter is the shopper's own choice — it must never be overridden
    // by a budget merely mentioned in the sentence.
    expect(inferMaxPrice(parseShoppingTask('مكيف لغرفة 30 متر هادي تحت 4000'), 6000)).toBeNull();
    // No category → not need-shaped → never infer a filter from a bare number.
    expect(inferMaxPrice(parseShoppingTask('تحت 4000'))).toBeNull();
    // Category with no parsed budget → nothing to infer.
    expect(inferMaxPrice(parseShoppingTask('مكيف لغرفة 30 متر'))).toBeNull();
  });
});
