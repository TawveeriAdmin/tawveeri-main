// Radar 2.0 Phase 2 — Checkpoint 5: the ONE approved widened family
// (founder decision 2026-08-29). PRODUCT_RECOMMENDATION × {mobile, laptop,
// air_conditioner} ONLY — exactly the query strings already published and
// character-counted in the architecture doc §S (266–302 chars, self-serve
// 512-char limit). No other category, no other family exists here.
//
// This is a NEW, isolated vocabulary file — saudi-lexicon.ts (Radar 1's own
// CATEGORY_LEXICONS) is not modified or extended.

export const PRODUCT_RECOMMENDATION_QUERY_FAMILY = 'PRODUCT_RECOMMENDATION';

const RECOMMENDATION_PHRASES = [
  'وش تنصحون', 'وش تنصحوني', 'تنصحوني بـ', 'وش ترشحون', 'افيدوني', 'أفيدوني',
  'محتار بين', 'محتارة بين', 'وش افضل', 'وش أفضل', 'ايش افضل', 'إيش افضل',
  'مين افضل', 'مين أفضل',
];

const CATEGORY_NOUNS: Record<string, string[]> = {
  mobile: ['جوال', 'موبايل', 'ايفون', 'آيفون', 'سامسونج', 'جالكسي'],
  laptop: ['لابتوب', 'لاب توب', 'ماك بوك', 'ماكبوك'],
  air_conditioner: ['مكيف', 'مكيفات', 'سبليت'],
};

function buildQuery(categoryNouns: string[]): string {
  const rec = '(' + RECOMMENDATION_PHRASES.map((p) => `"${p}"`).join(' OR ') + ')';
  const nouns = '(' + categoryNouns.map((n) => `"${n}"`).join(' OR ') + ')';
  return `${rec} ${nouns}`;
}

export interface ShadowQuerySpec {
  category: string;
  query: string;
}

export const PRODUCT_RECOMMENDATION_QUERIES: ShadowQuerySpec[] = Object.entries(CATEGORY_NOUNS).map(
  ([category, nouns]) => ({ category, query: buildQuery(nouns) })
);
