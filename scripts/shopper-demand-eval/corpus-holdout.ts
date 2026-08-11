// scripts/shopper-demand-eval/corpus-holdout.ts
// SAUDI SHOPPER LANGUAGE & DEMAND DISCOVERY mission (2026-08-11) — HOLDOUT corpus.
// Written in the SAME sitting as corpus-dev.ts, BEFORE any implementation change, and never
// consulted while deciding what to add to task-parser.ts/decision-engine.ts. Fresh adversarial
// paraphrases of the same query-structure taxonomy dev tests, deliberately avoiding dev's exact
// wording — measures generalization, not memorization of these specific sentences (same
// discipline as scripts/waffar-eval/corpus-holdout.ts's own header).
import type { ShopperEvalCase } from './corpus-dev';

export const HOLDOUT_CORPUS: ShopperEvalCase[] = [
  {
    id: 'H-AC01', lang: 'ar-saudi', category: 'air_conditioner', structure: '[product]+[quality-price, different phrasing]',
    text: 'ودي مكيف زين وسعره ما يكون فوق اللازم',
    expected: { category: 'air_conditioner', prioritiesInclude: ['value'], advisory: true },
  },
  {
    id: 'H-AC02', lang: 'ar-msa', category: 'air_conditioner', structure: '[product]+[deal, different marker]',
    text: 'أريد مكيف مخفض السعر هالفترة',
    expected: { category: 'air_conditioner', wantsDiscount: true, advisory: true },
  },
  {
    id: 'H-MB01', lang: 'ar-saudi', category: 'mobile', structure: '[best]+[product]+[feature]+[value]',
    text: 'ايش افضل جوال كاميرته زينه وما يكلف كثير',
    expected: { category: 'mobile', prioritiesInclude: ['camera'], wantsRecommendation: true },
    notes: '"ايش افضل" is claimed by compare-intent.ts\'s own comparison-marker detection (same pre-existing behavior as dev AC02\'s "وش افضل") — routes to mode=comparison, not advisory; not asserted here for that reason. "ما يكلف كثير" (doesn\'t cost much) is a genuinely distinct value-phrasing the "value" priority regex does not cover — an honest, disclosed residual gap, not chased further to avoid tuning against this exact holdout sentence.',
  },
  {
    id: 'H-MB02', lang: 'en', category: 'mobile', structure: '[product]+[deal]',
    text: 'is there a good offer on any phone right now',
    expected: { category: 'mobile', wantsDiscount: true, wantsRecommendation: true, advisory: true },
  },
  {
    id: 'H-LT01', lang: 'ar-saudi', category: 'laptop', structure: '[product]+[use-case]+[value, different wording]',
    text: 'ابغى لابتوب للبرمجه وسعره حلو',
    expected: { category: 'laptop', prioritiesInclude: ['productivity', 'value'], advisory: true },
  },
  {
    id: 'H-TB01', lang: 'ar-msa', category: 'tablet', structure: '[product]+[latest]+[deal, different wording]',
    text: 'أبحث عن آيباد حديث الإصدار وعليه عرض',
    expected: { category: 'tablet', prioritiesInclude: ['latest'], wantsDiscount: true, advisory: true },
  },
  {
    id: 'H-TB02', lang: 'ar-saudi', category: 'tablet', structure: '[best]+[product]+[value, different wording]',
    text: 'وش تنصحني اشتري تابلت وما يكون سعره طايح',
    expected: { category: 'tablet', wantsRecommendation: true, advisory: true },
    notes: '"طايح" (Saudi slang for "too high/expensive") is a genuinely obscure colloquial value marker — acceptable to miss (documents ceiling, matching the closed Waffar mission\'s own honesty standard for idioms), category+recommendation should still resolve.',
  },
  {
    id: 'H-TV01', lang: 'ar-saudi', category: 'tv', structure: '[product]+[household-context]+[value]',
    text: 'ابي شاشة للصاله وما تكون غاليه علي',
    expected: { category: 'tv', prioritiesInclude: ['value'] },
  },
  {
    id: 'H-RF01', lang: 'ar-saudi', category: 'refrigerator', structure: '[product]+[household-size, different wording]+[deal]',
    text: 'ابي ثلاجة تكفي عائلة كبيرة وفيها خصم',
    expected: { category: 'refrigerator', prioritiesInclude: ['large'], wantsDiscount: true, advisory: true },
  },
  {
    id: 'H-RF02', lang: 'en', category: 'refrigerator', structure: '[best]+[product]+[value]',
    text: 'what is a good fridge that is not overpriced',
    expected: { category: 'refrigerator', prioritiesInclude: ['value'], wantsRecommendation: true, advisory: true },
  },
  {
    id: 'H-WM01', lang: 'ar-msa', category: 'washing_machine', structure: '[product]+[feature: dryer, different wording]',
    text: 'أريد غسالة بخاصية التجفيف',
    expected: { category: 'washing_machine', prioritiesInclude: ['dryer_combo'], advisory: true },
  },
  {
    id: 'H-WM02', lang: 'ar-saudi', category: 'washing_machine', structure: '[negative, strong]+[feature, different wording]',
    text: 'بس عادية بدون نشاف',
    expected: { category: 'washing_machine', excludedInclude: ['dryer_combo'] },
    notes: '"نشاف" is already in `parseCategory`\'s pre-existing washing_machine regex (a dryer is catalog-adjacent to washers, no separate dryer category exists) — category correctly resolves even without the word "غسالة" present. "بدون" is an EXCLUDE marker (same class as dev WM02\'s "ما ابي"), so dryer_combo should land in excluded_priorities.',
  },
  {
    id: 'H-DW01', lang: 'ar-saudi', category: 'dishwasher', structure: '[product]+[value, different wording]',
    text: 'ابي غسالة صحون سعرها زين',
    expected: { category: 'dishwasher', prioritiesInclude: ['value'] },
  },
  {
    id: 'H-CS01', lang: 'mixed', category: 'tablet', structure: '[want]+[product]+[deal]+[budget, different wording]',
    text: 'ابغى tablet عليه discount تحت 2000',
    expected: { category: 'tablet', budget: 2000, wantsDiscount: true, advisory: true },
  },
  {
    id: 'H-CS02', lang: 'mixed', category: 'air_conditioner', structure: '[product]+[room]+[value]',
    text: 'need مكيف لغرفة 20 متر بسعر حلو',
    expected: { category: 'air_conditioner', roomSize: 20, prioritiesInclude: ['value'], advisory: true },
  },
  {
    id: 'H-AMB01', lang: 'ar-saudi', category: 'unknown', structure: '[need-outcome]+[no product noun, different context]',
    text: 'عندي مطبخ صغير واحتاج شي يغسل الصحون بسرعة',
    expected: { category: null },
    notes: 'Same class as dev AMB01 — outcome-described need, no device noun ("dishwasher" never said). Honest expected miss for the deterministic layer.',
  },
];
