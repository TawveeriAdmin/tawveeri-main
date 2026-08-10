// scripts/waffar-eval/corpus-dev.ts
// FINAL SEMANTIC INTELLIGENCE MISSION (2026-08-10) — the DEV/VISIBLE adversarial benchmark.
// This corpus was written and consulted WHILE deciding/implementing the semantic-fallback
// architecture — it is allowed to inform what gets fixed. `corpus-holdout.ts` is the sibling
// file that must NOT be looked at until the architecture is locked (Section 27's discipline).
//
// This measures MEANING convergence, not exact text: each case asserts what the parsed
// task/DecisionState SHOULD contain, using the same closed vocabularies the deterministic
// system already scores against (PRIORITY_KEYWORDS in task-parser.ts, category list in
// route-query.ts). A case with `expectCategoryNull: true` documents a KNOWN gap the pure
// keyword layer cannot close by construction — the point of this corpus is to measure that
// honestly, not to hide it.

export interface EvalCase {
  id: string;
  text: string;
  lang: 'ar' | 'en' | 'mixed';
  /** What a correct system (deterministic OR semantic-assisted) should ultimately produce. */
  expected: {
    category?: string | null;
    /** true = a numeric budget must resolve; a number = must resolve to exactly this value;
     *  'referenced' = the shopper referenced a budget without a value (no number to extract) */
    budget?: number | true | 'referenced' | null;
    prioritiesInclude?: string[];
    prioritiesExclude?: string[];
    deprioritizedInclude?: string[];
    excludedInclude?: string[];
    /** Should this route to advisory (NEEDS_DISCOVERY) rather than a bare browse/retrieval? */
    advisory?: boolean;
  };
  /** Documents a gap the CURRENT deterministic-only baseline is known/expected to miss —
   *  never silently "fixed" by loosening the assertion; the semantic fallback must close it. */
  knownDeterministicGap?: string;
  notes?: string;
}

export const DEV_CORPUS: EvalCase[] = [
  // ── From the mission brief verbatim (Section 8) ──────────────────────────────────────
  {
    id: 'M01', lang: 'ar', text: 'أبي جهاز يكرف معي بالدوام وما يثقل علي وأنا متنقل',
    expected: { category: 'laptop', prioritiesInclude: ['productivity', 'portability'], advisory: true },
    knownDeterministicGap: '"يكرف معي" (colloquial "keeps up with me") and "ما يثقل علي" (not a burden) are not in PRIORITY_KEYWORDS; only "متنقل"-adjacent portability words exist, and "جهاز" alone does not resolve to laptop category without "لابتوب"/"كمبيوتر".',
  },
  {
    id: 'M02', lang: 'ar', text: 'ما أفهم بالمواصفات أبي شي سريع وما يعلق',
    expected: { category: null },
    notes: 'No category named at all — must not guess a category from "سريع" alone (verified: the semantic layer correctly returns category=null here). `advisory` deliberately not asserted: `routeQuery`\'s descriptive-text heuristic (>=5 words) now routes this to the decision engine for an honest attempt rather than a silent unrelated browse — a deliberate, safer tradeoff (one extra round-trip, same "cannot resolve" outcome for the shopper), not a defect.',
  },
  {
    id: 'M03', lang: 'ar', text: 'أبي جوال أصور فيه العيال بالليل وما أبي أشحنه كل شوي',
    expected: { category: 'mobile', prioritiesInclude: ['camera', 'battery'], advisory: true },
    knownDeterministicGap: '"أصور فيه العيال بالليل" (low-light photography) only matches the generic camera keyword group, losing the low-light nuance entirely — acceptable degradation (camera priority still fires) but the low-light signal itself has nowhere to land in the current schema.',
  },
  {
    id: 'M04', lang: 'ar', text: 'أبي شي للوالدة استخدامه بسيط',
    expected: { category: null },
    notes: '"شي" names no category — correct behavior is to ask what product, not guess (verified: semantic layer returns null). `advisory` not asserted, same reasoning as M02.',
  },
  {
    id: 'M05', lang: 'ar', text: 'أبي لابتوب للجامعة يعيش معي كم سنة',
    expected: { category: 'laptop', prioritiesInclude: ['productivity'], advisory: true },
    notes: '"يعيش معي كم سنة" (should last me years) implies durability/longevity — no matching priority key exists today; acceptable to drop silently rather than fabricate, but flagged here.',
  },
  {
    id: 'M06', lang: 'ar', text: 'نومي خفيف والمكيف الحالي يزعجني',
    expected: { category: 'air_conditioner', prioritiesInclude: ['quiet'], advisory: true },
    knownDeterministicGap: '"نومي خفيف" (I\'m a light sleeper) + "يزعجني" (bothers me) never mention "هادئ"/"صامت" — the deterministic quiet-keyword group cannot infer noise-sensitivity from this indirect phrasing.',
  },
  {
    id: 'M07', lang: 'ar', text: 'عيالي كثير والغسالة عندنا شغالة طول اليوم',
    expected: { category: 'washing_machine', prioritiesInclude: ['large'], advisory: true },
    knownDeterministicGap: '"عيالي كثير" (many kids) + "شغالة طول اليوم" (running all day) implies heavy-duty/large-capacity but never says "عائلة كبيرة" literally.',
  },
  {
    id: 'M08', lang: 'ar', text: 'المجلس إضاءته قوية وأكثر شيء أشوف مباريات',
    expected: { category: 'tv', prioritiesInclude: ['bright_room', 'sports'], advisory: true },
    knownDeterministicGap: 'No literal "تلفزيون"/"شاشة" token — category must be INFERRED from "أشوف مباريات" (I watch matches), which pure keyword matching cannot do.',
  },
  {
    id: 'M09', lang: 'ar', text: 'ودي بشي ممتاز بس ما أبي أدفع على مواصفات ما أحتاجها',
    expected: { category: null },
    notes: 'No category, no product signal at all beyond "value for money" — must clarify, never guess (verified: semantic layer returns null). `advisory` not asserted, same reasoning as M02.',
  },
  {
    id: 'M10', lang: 'en', text: 'I need something light for university but I occasionally code.',
    expected: { category: 'laptop', prioritiesInclude: ['portability', 'productivity'], advisory: true },
    knownDeterministicGap: '"something" names no category at all — laptop must be INFERRED from "university"+"code" context, which the category regex (keyed on literal product nouns) cannot do.',
  },
  {
    id: 'M11', lang: 'en', text: 'Budget around 3k, camera matters more than gaming.',
    expected: { budget: 3000, prioritiesInclude: ['camera'] },
    notes: 'Category deliberately not asserted — camera-vs-gaming tradeoff is genuinely consistent with either "camera" or "mobile" as the product; a real system may reasonably ask rather than guess.',
    knownDeterministicGap: '"3k" shorthand is not matched by the digit-only budget regex.',
  },
  {
    id: 'M12', lang: 'en', text: "I don't understand laptop specs — help me choose.",
    expected: { category: 'laptop', advisory: true },
  },

  // ── Section 21/22 — code-switching ────────────────────────────────────────────────────
  { id: 'CS01', lang: 'mixed', text: 'أبي laptop gaming تحت 5000', expected: { category: 'laptop', budget: 5000, prioritiesInclude: ['gaming'], advisory: true } },
  { id: 'CS02', lang: 'mixed', text: 'أبي iPhone بطارية قوية under 3000', expected: { category: 'mobile', budget: 3000, prioritiesInclude: ['battery'], advisory: true } },
  { id: 'CS03', lang: 'mixed', text: 'ابي laptop خفيف للجامعة battery حقته قوية', expected: { category: 'laptop', prioritiesInclude: ['portability', 'productivity', 'battery'], advisory: true } },
  { id: 'CS04', lang: 'mixed', text: 'أبي TV للمباريات 65 inch', expected: { category: 'tv', prioritiesInclude: ['sports'], advisory: true } },
  { id: 'CS05', lang: 'mixed', text: 'ابي 16GB ram بس budget حول 4000', expected: { budget: 4000 }, notes: 'RAM signal only resolves for laptop category once category is known; category/advisory deliberately not asserted — "16GB ram" alone is genuinely ambiguous (could reasonably resolve to laptop or stay null pending clarification).' },

  // ── Section 22 — same meaning, different words (battery endurance paraphrase group) ──
  { id: 'PARA01', lang: 'ar', text: 'جوال بطاريته قوية', expected: { category: 'mobile', prioritiesInclude: ['battery'], advisory: true } },
  { id: 'PARA02', lang: 'ar', text: 'جوال ما أبي أشحنه كل شوي', expected: { category: 'mobile', prioritiesInclude: ['battery'], advisory: true }, knownDeterministicGap: 'No literal "بطارية" token — pure keyword match fails; only a semantic layer can equate "لا أشحنه كل شوي" with battery endurance.' },
  { id: 'PARA03', lang: 'ar', text: 'جوال أبيه يكمل معي من الصباح لليل', expected: { category: 'mobile', prioritiesInclude: ['battery'], advisory: true }, knownDeterministicGap: 'Same class as PARA02 — indirect endurance phrasing, no battery keyword present.' },

  // ── Negation / exclusion regression (must NOT break) ─────────────────────────────────
  { id: 'NEG01', lang: 'ar', text: 'ابي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000 ريال وما يهمني الألعاب', expected: { category: 'mobile', budget: 3000, prioritiesInclude: ['camera', 'battery'], prioritiesExclude: ['gaming'], advisory: true } },
  { id: 'NEG02', lang: 'ar', text: 'ما أبي سامسونج', expected: { category: null, excludedInclude: [], advisory: false }, notes: 'Brand exclusion — current parser has no brand field at all (out of scope for this mission per Section 11 "do not add fields without material benefit"; brands are not in PRIORITY_KEYWORDS). Documents the gap honestly rather than silently dropping it.' },
  { id: 'NEG03', lang: 'en', text: "Gaming doesn't matter to me.", expected: { category: null, prioritiesExclude: ['gaming'] } },
  { id: 'NEG04', lang: 'ar', text: 'ما أبي 5G', expected: { category: null, advisory: false }, notes: 'Hard exclusion on connectivity spec — 5G is not modeled as an excludable field today (out of scope; documents gap).' },

  // ── Explicit constraints (must remain deterministic-fast, no LLM needed) ─────────────
  { id: 'EXP01', lang: 'ar', text: 'أبي لابتوب ألعاب قوي تحت 5000', expected: { category: 'laptop', budget: 5000, prioritiesInclude: ['gaming'], advisory: true } },
  { id: 'EXP02', lang: 'ar', text: 'أرخص لابتوب', expected: { category: 'laptop', advisory: true } },
  { id: 'EXP03', lang: 'ar', text: 'أبي مكيف لغرفة النوم ونومي خفيف', expected: { category: 'air_conditioner', prioritiesInclude: ['quiet'], advisory: true }, knownDeterministicGap: 'Same indirect-noise-sensitivity gap as M06.' },
  { id: 'EXP04', lang: 'ar', text: 'أبي غسالة لعائلة كبيرة وتتحمل الاستخدام الكثير', expected: { category: 'washing_machine', prioritiesInclude: ['large'], advisory: true } },
  { id: 'EXP05', lang: 'ar', text: 'لو زدت الميزانية 500 وش بيتغير؟', expected: { category: null }, notes: 'COUNTERFACTUAL intent — in the real app this is intercepted by mutation-turn.ts BEFORE routeQuery\'s mode matters (classifyDecisionIntent checks COUNTERFACTUAL markers first, returns no_context with no active state); `advisory` not asserted here since this eval calls routeQuery directly, bypassing that upstream interception.' },

  // ── Ambiguity handling — SHOULD clarify vs should NOT ────────────────────────────────
  { id: 'AMB01', lang: 'ar', text: 'أبي لابتوب', expected: { category: 'laptop', advisory: false }, notes: 'Bare category, no need signal — a browse, not a need. Must NOT force a clarify question (Section 12: do not ask because a field is empty).' },
  { id: 'AMB02', lang: 'ar', text: 'وش أفضل لابتوب لاحتياجي وميزانيتي', expected: { category: 'laptop', budget: 'referenced', advisory: true }, notes: 'Need-discovery reference without values — SHOULD trigger clarification (already proven working).' },

  // ── Typos / unusual word order (robustness, not a new capability) ───────────────────
  { id: 'TYPO01', lang: 'ar', text: 'ابي لابتوب لالعاب تحت خمسه الاف', expected: { category: 'laptop', prioritiesInclude: ['gaming'], advisory: true }, knownDeterministicGap: 'Spelled-out number "خمسه الاف" (five thousand) is not parsed by the numeric-only budget regex — budget will not resolve.' },
  { id: 'TYPO02', lang: 'en', text: 'i need a gaming laoptp under 5000', expected: { category: 'laptop', budget: 5000, prioritiesInclude: ['gaming'], advisory: true }, knownDeterministicGap: 'Misspelled "laoptp" does not match the laptop category regex under the deterministic parser alone — closed by the semantic fallback\'s typo tolerance (verified).' },
];
