// tests/search/category-resolution-regression-matrix.test.ts
// Amazon Campaign V1 delivery-gap fix — regression matrix (read-only investigation §6).
// Exercises the exact chain the /api/search response now performs:
//   query -> parseShoppingTask().category (classifier) -> toStorefrontCategory() (mapping)
// This IS what the API's new `resolvedCategory` field returns for a given query, without
// needing to run the full route handler (which is DB/Algolia-dependent).
import { parseShoppingTask } from '@/lib/agent/task-parser';
import { toStorefrontCategory } from '@/lib/search/canonical-category';

function resolve(query: string): string | null {
  return toStorefrontCategory(parseShoppingTask(query).category || null);
}

describe('category resolution regression matrix', () => {
  describe('TABLET', () => {
    it.each([
      'تابلت', 'تابلت هونر', 'هونر تابلت', 'ايباد', 'آيباد', 'تابلت للجامعة',
    ])('"%s" resolves to tablet', (q) => {
      expect(resolve(q)).toBe('tablet');
    });
  });

  describe('SMARTPHONE (classifier resolves "mobile", mapped to storefront "smartphone")', () => {
    it.each([
      'جوال', 'ايفون', 'آيفون', 'سامسونج جوال', 'جوال بميزانية 2000',
    ])('"%s" resolves to smartphone', (q) => {
      // "آيفون" (madda-alef spelling): FIXED in the multi-category Amazon expansion patch
      // (Sept 2026) — this test previously pinned it as a known NULL gap, explicitly
      // deliberately left unfixed while the delivery-wiring patch stayed narrow. Now that
      // smartphone is an approved first-wave campaign category, the founder authorized
      // fixing task-parser.ts's mobile regex (added "آيفون" alongside "ايفون", same pattern
      // its own tablet regex already used for ايباد/آيباد). Flipping this from NULL to PASS
      // here is exactly the "visible, not silent" transition the original pin intended.
      expect(resolve(q)).toBe('smartphone');
    });
  });

  describe('LAPTOP', () => {
    it('"لابتوب" resolves to laptop', () => expect(resolve('لابتوب')).toBe('laptop'));
    it('"لابتوب للجامعة" resolves to laptop', () => expect(resolve('لابتوب للجامعة')).toBe('laptop'));
    it('"ماك بوك" (spaced Arabic transliteration) is a KNOWN, documented classifier gap — stays null, never wrong', () => {
      // Not fixed by this patch (out of scope — the classifier itself, not the delivery
      // wiring, would need a new regex alternative). Pinned here so a future classifier fix
      // is visible as a test going from NULL to PASS, not a silent behavior change.
      expect(resolve('ماك بوك')).toBeNull();
    });
  });

  describe('TV', () => {
    it.each(['تلفزيون', 'شاشة سامسونج', 'تلفزيون 65 بوصة'])('"%s" resolves to tv', (q) => {
      expect(resolve(q)).toBe('tv');
    });
  });

  describe('AIR_CONDITIONER', () => {
    it.each(['مكيف', 'مكيف سبليت'])('"%s" resolves to air_conditioner', (q) => {
      expect(resolve(q)).toBe('air_conditioner');
    });
  });

  it('an ambiguous/unrecognized query resolves to null, never a fabricated category', () => {
    expect(resolve('شيء غريب لا معنى له')).toBeNull();
  });
});
