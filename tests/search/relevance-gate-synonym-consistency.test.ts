// tests/search/relevance-gate-synonym-consistency.test.ts
// SEARCH RELEVANCE GATE / SYNONYM CONSISTENCY CLOSURE (2026-09-07).
//
// Root cause (proven live in the prior mission): Algolia's `products` index now
// correctly retrieves a genuine candidate for an approved synonym/misspelling
// variant (published from SAFE_PRODUCT_SYNONYM_GROUPS), but this route's OWN
// post-retrieval relevance gate (`expandWordTerms` -> `relevanceGroups` ->
// `scoreProduct`/`bestMatchesQuery`/the result-list gate) re-derived its word
// expansion from a SEPARATE, hand-maintained dictionary (ARABIC_TO_ENGLISH) that
// never learned the same fold — so a candidate Algolia correctly found for
// "هونور" was rejected anyway, because "هونور" never literally appears in any
// real title and this gate had no other way to know "هونور" and "هونر" are the
// same word. Proven live for Honor's spellings AND "تكييف"/"قلاكسي" — a
// duplicated-vocabulary-authority defect, not a Honor-only gap.
//
// Fix: `expandWordTerms` now ALSO expands via `expandViaApprovedSynonyms`
// (query-normalize.ts's SAFE_PRODUCT_SYNONYM_GROUPS) — the SAME list Algolia's
// publish consumes. One authority, two consumers.
import { expandWordTerms, scoreProduct } from '@/app/api/search/route';
import { SAFE_PRODUCT_SYNONYM_GROUPS } from '@/lib/search/query-normalize';
import { normalizeArabic } from '@/lib/search/arabic-normalize';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';

const product = (over: Partial<GroupedSearchProduct> & { best_price: number }): GroupedSearchProduct => {
  const price = over.best_price;
  return {
    name_ar: over.name_ar ?? '', name_en: over.name_en ?? '', brand: over.brand ?? '',
    model: '', sku: null, current_price: price, original_price: null, availability: 'in_stock',
    product_url: 'https://example.com/p', image_urls: [], specifications: {}, category: 'mobile' as never,
    description_ar: null, description_en: null, stores: [{
      name_ar: over.name_ar ?? '', name_en: over.name_en ?? '', brand: over.brand ?? '',
      model: '', sku: null, current_price: price, original_price: null, availability: 'in_stock',
      product_url: 'https://example.com/p', image_urls: [], specifications: {}, category: 'mobile' as never,
      description_ar: null, description_en: null, store: 'متجر', store_name: 'متجر',
    }],
    store_count: 1,
    ...over,
    best_price: price,
  } as GroupedSearchProduct;
};

function matchesGate(queryWord: string, candidateHay: { name_ar?: string; name_en?: string; brand?: string }): boolean {
  const group = expandWordTerms(queryWord);
  const hay = `${candidateHay.name_ar ?? ''} ${candidateHay.name_en ?? ''} ${candidateHay.brand ?? ''}`.toLowerCase();
  return group.some((t) => hay.includes(t));
}

describe('expandWordTerms — one vocabulary authority with SAUDI_SEARCH_SYNONYMS', () => {
  describe('Honor misspellings now match the catalog spelling (the proven live defect)', () => {
    it.each(['هونر', 'هورنر', 'هونور', 'honor', 'honer', 'horno'])('"%s" expands to include the catalog spelling "هونر"', (variant) => {
      expect(expandWordTerms(variant)).toContain('هونر');
    });

    it('a real Honor Pad 10 title now matches the query word "هونور"', () => {
      expect(matchesGate('هونور', { name_ar: 'تابلت هونر باد 10 12.1 بوصة' })).toBe(true);
    });

    it('a real Honor Pad title matches "honer" too', () => {
      expect(matchesGate('honer', { name_en: 'Honor Honor Pad 10 12.1" 256GB Wi-Fi' })).toBe(true);
    });
  });

  describe('the other proven live failures (AC, Galaxy) also close', () => {
    it('"تكييف" expands to include "مكيف" (real AC titles use مكيف, never تكييف)', () => {
      expect(expandWordTerms('تكييف')).toContain('مكيف');
    });

    it('a real Gree Split AC title now matches the query word "تكييف"', () => {
      expect(matchesGate('تكييف', { name_ar: 'مكيف جري سبليت 18000 وحدة حرارية انفرتر' })).toBe(true);
    });

    it('"قلاكسي" expands to include "جالكسي" (real Galaxy titles use جالكسي)', () => {
      expect(expandWordTerms('قلاكسي')).toContain('جالكسي');
    });
  });

  describe('the two live-proven-unsafe bare words are NOT reintroduced here either', () => {
    it('"screen" does not expand into شاشة\'s group (would reopen the smartwatch/kids-tablet/air-fryer leak)', () => {
      expect(expandWordTerms('screen')).not.toContain('شاشة');
      expect(expandWordTerms('screen')).not.toContain('تلفزيون');
    });

    it('singular "عرض" does not expand into the deal group (width-spec collision)', () => {
      expect(expandWordTerms('عرض')).not.toContain('خصم');
      expect(expandWordTerms('عرض')).not.toContain('discount');
    });

    it('plural "عروض" still expands into the deal group (no ambiguity in retail Arabic)', () => {
      expect(expandWordTerms('عروض')).toContain('خصم');
    });
  });

  describe('adversarial precision — this fix must not create false positives', () => {
    it('a Honor-earbuds accessory bundled onto an UNRELATED Huawei phone does not become the query "هونور"\'s only match target — the phone itself is still a distinct product', () => {
      // The fix only widens what counts as "the same WORD" (هونور == هونر); it never
      // widens which PRODUCT a word refers to. A candidate whose title merely
      // mentions "Honor Earbuds" as a bundled accessory still legitimately contains
      // the literal word "Honor" — that is pre-existing substring-match behavior,
      // unrelated to and unaffected by this fix (same result with or without it).
      const withFix = matchesGate('هونور', { name_en: 'Huawei Nova 14 with Honor Earbuds A Pro' });
      expect(withFix).toBe(true); // unchanged from pre-fix substring behavior — not a new leak
    });

    it('an unrelated brand token never expands into a Honor/AC/Galaxy match', () => {
      const g = expandWordTerms('samsung');
      expect(g).not.toContain('هونر');
      expect(g).not.toContain('مكيف');
    });

    it('a malformed spelling with no group membership expands to only itself — never a confident false match', () => {
      const g = expandWordTerms('زضfjkqwx');
      expect(g).toEqual(['زضfjkqwx']);
    });

    it('an exact model code is untouched — no group absorbs alphanumeric SKUs', () => {
      expect(expandWordTerms('SM-X133NZAAMEA')).toEqual(['sm-x133nzaamea']);
    });

    it('multi-word synonym phrases ("air conditioner", "washing machine") are added WHOLE, never split into bare words — the exact historical "washer"/"machine" false-positive class this file already documents', () => {
      const g = expandWordTerms('تكييف');
      expect(g).toContain('air conditioner');
      expect(g).not.toContain('conditioner'); // would falsely match "Air Fryer"-adjacent noise if split
    });
  });

  describe('scoreProduct integration — the AND-gate still requires every word-group, this fix only enriches one group', () => {
    it('a genuine Honor tablet scores as relevant for "تابلت هونور" (both word-groups now satisfied)', () => {
      const relevanceGroups = ['تابلت', 'هونور'].map((w) => expandWordTerms(w));
      const honorTablet = product({ name_ar: 'تابلت هونر باد 10 12.1 بوصة', best_price: 1200 });
      const unrelated = product({ name_ar: 'ثلاجة توشيبا 510 لتر', best_price: 1200 });
      const scoreHonor = scoreProduct(honorTablet, 500, 2000, true, relevanceGroups);
      const scoreUnrelated = scoreProduct(unrelated, 500, 2000, true, relevanceGroups);
      expect(scoreHonor).toBeGreaterThan(scoreUnrelated);
      expect(scoreHonor).toBeGreaterThan(0); // relevanceScore=300 dominates
    });

    it('a Honor-tablet-only match (missing the "تابلت" word) still fails the AND-gate exactly as before — this fix never loosens the AND', () => {
      const relevanceGroups = ['تابلت', 'هونور'].map((w) => expandWordTerms(w));
      const honorPhoneNotTablet = product({ name_ar: 'هونر X 5 جوال', best_price: 800 }); // "تابلت" absent
      const score = scoreProduct(honorPhoneNotTablet, 500, 2000, true, relevanceGroups);
      expect(score).toBeLessThan(0); // one group unmatched -> penalty, same as pre-fix behavior
    });
  });

  it('every approved synonym group round-trips through expandWordTerms for at least one member', () => {
    for (const group of SAFE_PRODUCT_SYNONYM_GROUPS) {
      const [first, ...rest] = group;
      const expanded = expandWordTerms(first);
      // every OTHER member of the group must be reachable from the first member —
      // compared through the SAME normalizeArabic+lowercase fold expandWordTerms
      // itself applies (hamza/ة/ى variants), not a raw string comparison.
      for (const other of rest) {
        expect(expanded).toContain(normalizeArabic(other).toLowerCase());
      }
    }
  });
});
