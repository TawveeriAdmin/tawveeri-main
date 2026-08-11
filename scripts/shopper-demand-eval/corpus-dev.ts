// scripts/shopper-demand-eval/corpus-dev.ts
// SAUDI SHOPPER LANGUAGE & DEMAND DISCOVERY mission (2026-08-11) — DEV/VISIBLE corpus.
// Distinct from scripts/waffar-eval/ (that corpus is the closed Waffar semantic-fallback
// mission's own artifact — laptop/mobile-skewed, tests category+priority+budget resolution
// for the LLM-fallback architecture). This corpus tests the DETERMINISTIC query→task shape
// across ALL 8 categories this mission was asked to cover, weighted toward the categories the
// repo audit found thinnest (AC, refrigerator, washing_machine, tablet, TV, dishwasher), and
// specifically exercises the NEW structural gaps this mission's research+audit found:
//   - "value" priority (رخيص / سعره مناسب / سعره كويس / جودته عالية) — previously unrecognized
//     anywhere; distinct from CHEAPEST_MARKER (sort-to-lowest) and from a numeric budget.
//   - `wants_discount` (عليه عرض / عليه تخفيض / فيه خصم) — previously unrecognized; a
//     first-turn deal-seeking signal, distinct from the existing follow-up DEAL_EVALUATION
//     intent ("is THIS specific deal good?").
//   - "dryer_combo" priority for washing machines — previously only a raw-text regex bypassing
//     the priorities[]/negation system entirely.
// This measures MEANING/STRUCTURE convergence, exactly like scripts/waffar-eval/corpus-dev.ts's
// own EvalCase contract — see that file's header for the shared design rationale. A case with
// `knownGap` documents something the CURRENT (pre-mission) implementation is expected to miss;
// it is not silently loosened, it is the honest baseline this mission measures before changing
// anything.

export interface ShopperEvalCase {
  id: string;
  text: string;
  lang: 'ar-saudi' | 'ar-msa' | 'en' | 'mixed';
  category: string; // which of the 8 mission categories this case represents
  structure: string; // the query-structure hypothesis this case tests (see the mission's own taxonomy)
  expected: {
    category?: string | null;
    budget?: number | true | 'referenced' | null;
    prioritiesInclude?: string[];
    prioritiesExclude?: string[];
    deprioritizedInclude?: string[];
    excludedInclude?: string[];
    wantsDiscount?: boolean;
    wantsCheapest?: boolean;
    wantsRecommendation?: boolean;
    roomSize?: number;
    advisory?: boolean;
  };
  /** Documents a gap the PRE-MISSION baseline is expected to miss — measured, not hidden. */
  knownGap?: string;
  notes?: string;
}

export const DEV_CORPUS: ShopperEvalCase[] = [
  // ══════════════════════════ AIR CONDITIONER ══════════════════════════════════════════
  {
    id: 'AC01', lang: 'ar-saudi', category: 'air_conditioner', structure: '[want]+[product]+[room-size]+[quality-price]',
    text: 'ابي مكيف لغرفة 25 متر وسعره مناسب',
    expected: { category: 'air_conditioner', roomSize: 25, prioritiesInclude: ['value'], advisory: true },
    knownGap: 'No "value" priority key exists pre-mission — "سعره مناسب" resolves to nothing.',
  },
  {
    id: 'AC02', lang: 'ar-saudi', category: 'air_conditioner', structure: '[best]+[product]+[quality-price chain]',
    text: 'وش افضل مكيف وسعره رخيص جيد مناسب',
    expected: { category: 'air_conditioner', prioritiesInclude: ['value'] },
    knownGap: 'Founder\'s own illustrative example. "رخيص" bare + "مناسب" both unrecognized pre-mission.',
    notes: '"وش افضل" is claimed by compare-intent.ts\'s own comparison-marker detection (pre-existing, tested — same class as EXP02\'s "أرخص لابتوب"), so this routes to mode=comparison, not advisory — a different, already-correct path this mission does not touch. `advisory`/`wantsRecommendation` deliberately not asserted here for that reason.',
  },
  {
    id: 'AC03', lang: 'ar-msa', category: 'air_conditioner', structure: '[product]+[deal-seeking]',
    text: 'ابحث عن مكيف عليه عرض حاليا',
    expected: { category: 'air_conditioner', wantsDiscount: true, advisory: true },
    knownGap: 'No deal-seeking signal exists pre-mission anywhere in the first-turn parse.',
  },
  {
    id: 'AC04', lang: 'ar-saudi', category: 'air_conditioner', structure: '[product]+[use-case: quiet, indirect]',
    text: 'ابي مكيف هادي وما يصرف كهرب كثير',
    expected: { category: 'air_conditioner', prioritiesInclude: ['quiet', 'low_electricity'], advisory: true },
    notes: 'Should already pass — regression guard for the already-mature AC priority set.',
  },
  {
    id: 'AC05', lang: 'en', category: 'air_conditioner', structure: '[product]+[room-context]',
    text: 'need an AC for a big living room, quiet please',
    expected: { category: 'air_conditioner', prioritiesInclude: ['quiet'], advisory: true },
  },

  // ══════════════════════════ MOBILE ═══════════════════════════════════════════════════
  {
    id: 'MB01', lang: 'ar-saudi', category: 'mobile', structure: '[product]+[feature]+[quality-price]',
    text: 'ابي جوال تصويره ممتاز وسعره كويس',
    expected: { category: 'mobile', prioritiesInclude: ['camera', 'value'], advisory: true },
    knownGap: 'Founder\'s own illustrative example (camera+price-quality). "سعره كويس" unrecognized pre-mission.',
  },
  {
    id: 'MB02', lang: 'mixed', category: 'mobile', structure: '[product]+[deal]+[budget]',
    text: 'ابي iPhone فيه خصم تحت 3000',
    expected: { category: 'mobile', budget: 3000, wantsDiscount: true, advisory: true },
  },
  {
    id: 'MB03', lang: 'en', category: 'mobile', structure: '[comparative]',
    text: 'which is better for photos, a used iPhone or a new mid-range Android?',
    expected: { category: 'mobile', prioritiesInclude: ['camera'] },
    knownGap: 'Comparative A-vs-B structure with no single product noun and an implicit budget signal ("used" vs "new mid-range") — category should still resolve from "iPhone"/"Android" context; used/new distinction has nowhere to land (out of scope, documented not fixed).',
  },

  // ══════════════════════════ LAPTOP ════════════════════════════════════════════════════
  {
    id: 'LT01', lang: 'ar-saudi', category: 'laptop', structure: '[want]+[product]+[use-case]',
    text: 'ابي لابتوب للجامعه',
    expected: { category: 'laptop', prioritiesInclude: ['productivity'], advisory: true },
    notes: 'Regression guard — this exact phrase is the closed workstream\'s own acceptance case (Checkpoint #70). Must not regress.',
  },
  {
    id: 'LT02', lang: 'ar-saudi', category: 'laptop', structure: '[product]+[use-case]+[quality-price]',
    text: 'احتاج لابتوب للتصميم وما يكون غالي',
    expected: { category: 'laptop', prioritiesInclude: ['design', 'value'], advisory: true },
    knownGap: 'Founder\'s own illustrative example. "ما يكون غالي" (not expensive) unrecognized pre-mission.',
  },

  // ══════════════════════════ TABLET ════════════════════════════════════════════════════
  {
    id: 'TB01', lang: 'ar-saudi', category: 'tablet', structure: '[want]+[product]+[use-case]',
    text: 'ابي ايباد للدراسه',
    expected: { category: 'tablet', prioritiesInclude: ['productivity'], advisory: true },
  },
  {
    id: 'TB02', lang: 'ar-saudi', category: 'tablet', structure: '[product]+[latest]+[deal]',
    text: 'ابي ايباد جديد وعليه تخفيض',
    expected: { category: 'tablet', prioritiesInclude: ['latest'], wantsDiscount: true, advisory: true },
    knownGap: 'Founder\'s own illustrative example (verbatim). wants_discount unrecognized pre-mission.',
  },
  {
    id: 'TB03', lang: 'ar-msa', category: 'tablet', structure: '[best]+[product]+[quality-price]',
    text: 'وش افضل ايباد بسعر معقول',
    expected: { category: 'tablet', prioritiesInclude: ['value'] },
    knownGap: 'Founder\'s own illustrative example. "بسعر معقول" unrecognized pre-mission.',
    notes: 'Same "وش افضل" → mode=comparison routing as AC02 — not asserting advisory/wantsRecommendation for the same reason.',
  },

  // ══════════════════════════ TV ════════════════════════════════════════════════════════
  {
    id: 'TV01', lang: 'ar-saudi', category: 'tv', structure: '[product]+[use-case]',
    text: 'ابي تلفزيون كبير للمباريات',
    expected: { category: 'tv', prioritiesInclude: ['sports', 'large'] },
  },
  {
    id: 'TV02', lang: 'en', category: 'tv', structure: '[product]+[deal]+[budget]',
    text: 'looking for a TV on sale under 2500',
    expected: { category: 'tv', budget: 2500, wantsDiscount: true, advisory: true },
  },
  {
    id: 'TV03', lang: 'ar-saudi', category: 'tv', structure: '[best]+[product]+[quality-price]',
    text: 'وش افضل شاشة وسعرها مناسب',
    expected: { category: 'tv', prioritiesInclude: ['value'] },
    notes: 'Same "وش افضل" → mode=comparison routing as AC02 — not asserting advisory/wantsRecommendation for the same reason.',
  },

  // ══════════════════════════ REFRIGERATOR ═════════════════════════════════════════════
  {
    id: 'RF01', lang: 'ar-saudi', category: 'refrigerator', structure: '[best]+[product]+[household-size]+[quality-price]',
    text: 'افضل ثلاجه كبيره للعائله وسعرها كويس',
    expected: { category: 'refrigerator', prioritiesInclude: ['large', 'value'], wantsRecommendation: true, advisory: true },
    knownGap: 'Founder\'s own illustrative example (adapted). "سعرها كويس" unrecognized pre-mission; "كبيره"/"للعائله" already resolve via the existing "large" key (regression guard).',
  },
  {
    id: 'RF02', lang: 'ar-msa', category: 'refrigerator', structure: '[product]+[low-cost-operation]',
    text: 'ابي ثلاجة موفرة للكهرباء ومو غالية',
    expected: { category: 'refrigerator', prioritiesInclude: ['low_electricity', 'value'], advisory: true },
  },
  {
    id: 'RF03', lang: 'en', category: 'refrigerator', structure: '[product]+[deal]',
    text: 'any fridge deals right now, big family size',
    expected: { category: 'refrigerator', prioritiesInclude: ['large'], wantsDiscount: true, advisory: true },
  },

  // ══════════════════════════ WASHING MACHINE ═══════════════════════════════════════════
  {
    id: 'WM01', lang: 'ar-saudi', category: 'washing_machine', structure: '[product]+[feature: dryer combo]',
    text: 'ابي غسالة فيها نشافة',
    expected: { category: 'washing_machine', prioritiesInclude: ['dryer_combo'], advisory: true },
    knownGap: 'Pre-mission, "dryer_combo" is not a real priority key — decideWashingMachine reads it only via a raw-text regex bypassing priorities[]/negation entirely, so it never appears in the parsed task itself.',
  },
  {
    id: 'WM02', lang: 'ar-saudi', category: 'washing_machine', structure: '[negative, strong]+[product]+[feature]',
    text: 'ابي غسالة عادية ما ابي نشافة',
    expected: { category: 'washing_machine', excludedInclude: ['dryer_combo'] },
    knownGap: 'Cannot be expressed at all pre-mission — no keyword exists for the negation system to act on. "ما ابي" is an EXCLUDE marker (stronger than de-prioritize), so the correct target is excluded_priorities, not deprioritized_priorities.',
  },
  {
    id: 'WM03', lang: 'ar-msa', category: 'washing_machine', structure: '[product]+[household-size]+[deal]',
    text: 'ابي غسالة كبيرة للعائلة وعليها تخفيض',
    expected: { category: 'washing_machine', prioritiesInclude: ['large'], wantsDiscount: true, advisory: true },
  },

  // ══════════════════════════ DISHWASHER ════════════════════════════════════════════════
  {
    id: 'DW01', lang: 'ar-saudi', category: 'dishwasher', structure: '[want]+[product]+[quality-price]',
    text: 'ابي غسالة صحون رخيصة وحلوة',
    expected: { category: 'dishwasher', prioritiesInclude: ['value'], advisory: true },
    knownGap: 'Category resolves fine (already mature); "value" priority is the new gap.',
  },
  {
    id: 'DW02', lang: 'en', category: 'dishwasher', structure: '[product]+[quiet]',
    text: 'quiet dishwasher please, we have an open kitchen',
    expected: { category: 'dishwasher', prioritiesInclude: ['quiet'] },
  },

  // ══════════════════════════ CROSS-CATEGORY: AMBIGUITY / CLARIFY-WORTHY ═══════════════
  {
    id: 'AMB01', lang: 'ar-saudi', category: 'unknown', structure: '[need-outcome]+[no product noun]',
    text: 'ابي شي يبرد الغرفة بسرعة',
    expected: { category: null },
    knownGap: 'No category noun at all — "يبرد الغرفة" (cools the room) implies AC but the deterministic parser cannot infer a category from an outcome description. Documents an honest, accepted limitation (the semantic-fallback layer built in the closed Waffar mission is the intended answer for this class, not a new keyword).',
  },
  {
    id: 'AMB02', lang: 'ar-saudi', category: 'unknown', structure: '[best]+[budget-only, no product]',
    text: 'وش تنصحوني نشتري بميزانية 2000',
    expected: { category: null, budget: 2000, wantsRecommendation: true },
    notes: 'No product noun — correct behavior is to ask what product, not guess.',
  },

  // ══════════════════════════ CODE-SWITCHING / EN-AR MIX ════════════════════════════════
  {
    id: 'CS01', lang: 'mixed', category: 'laptop', structure: '[want]+[product]+[deal]+[budget]',
    text: 'ابي laptop فيه offer تحت 4000',
    expected: { category: 'laptop', budget: 4000, wantsDiscount: true, advisory: true },
  },
  {
    id: 'CS02', lang: 'mixed', category: 'tv', structure: '[product]+[size]+[quality-price]',
    text: 'ابي 55 inch TV بسعر معقول',
    expected: { category: 'tv', prioritiesInclude: ['value'], advisory: true },
  },
];
