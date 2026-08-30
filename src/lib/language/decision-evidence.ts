// Shared Saudi-shopping decision-evidence primitives (integrated review, 2026-08-30).
// ONE canonical set of phrase lists/detectors — extracted from
// src/lib/growth/demand-radar/shadow/policy-v2.ts so a second bounded-context
// consumer (Founder Intelligence's need-signal extraction) never re-derives
// its own copy. Pure, deterministic, no side effects, no database access.
//
// This is a language FACT (what Saudi decision-stage shoppers write), not a
// Radar/Shadow policy — it belongs in a neutral shared location precisely so
// it can be reused outside the Demand Radar bounded context without implying
// any coupling to Radar 1/Shadow's isolation contracts (which govern writes
// and table access, not reuse of pure text-classification helpers).

const norm = (s: string) => s.toLowerCase();

/** Recommendation/comparison-seeking phrasing — the shape both Checkpoint 5's
 *  widened experiment and the 30-day production study independently found
 *  correlating with genuine decision-stage buyers. */
export const RECOMMENDATION_PHRASES = [
  'وش تنصحون', 'وش تنصحوني', 'تنصحوني بـ', 'وش ترشحون', 'افيدوني', 'أفيدوني',
  'محتار بين', 'محتارة بين', 'وش افضل', 'وش أفضل', 'ايش افضل', 'إيش افضل',
  'مين افضل', 'مين أفضل',
];

/** "Is this specific thing in stock" — buying-stage language. Traced to the
 *  one real Radar 1 accept, which no formula scored until this addition. */
export const AVAILABILITY_MARKERS = ['هل موجود', 'متوفر', 'متوفره', 'موجود لديكم', 'عندكم', 'يتوفر'];

export const BUDGET_PATTERN = /\d[\d,]*\s*(ريال|ريالات|sar)/i;
export const USE_CASE_MARKERS = ['للجامعة', 'للدراسة', 'للألعاب', 'للتصميم', 'للأعمال', 'للتخصص', 'دراسة', 'مشاريع', 'مشروع'];
// "اليوم" (today) deliberately excluded on its own — it false-positives inside
// "اليوم الوطني" (National Day) and any other ordinary mention of "today/day";
// only compound phrases specific enough to mean "I need this urgently" qualify.
export const URGENCY_MARKERS = ['الحين', 'احتاجه اليوم', 'ابغاه اليوم', 'بسرعة', 'urgent', 'asap', 'ضروري'];
export const REPLACEMENT_MARKERS = ['بدل', 'أبدل', 'ابدل', 'استبدال', 'بديل'];
// Whole-word tokens, matched via containsWholeWord() below — never a JS `\b`
// regex, which cannot match beside Arabic letters (the codebase's own
// bilingual-matching invariant; a `\b`-based version of this exact check
// silently never fired on "او"/"أو" until this module's own test caught it).
export const COMPARISON_TOKENS = ['بين', 'او', 'أو'];
export const DECLARATIVE_WANT = ['ابي', 'أبي', 'ابغى', 'أبغى', 'ابغا', 'ودي', 'احتاج', 'أحتاج'];

// Arabic-safe whole-token matching (same technique as shadow-exclusion.ts's
// containsWholeWord) — splits on non-letter/non-digit runs, never a `\b`
// regex boundary.
const WORD_SPLIT = /[^\p{L}\p{N}]+/u;
function tokenize(text: string): string[] {
  return text.split(WORD_SPLIT).filter(Boolean);
}
export function containsWholeWord(text: string, words: string[]): boolean {
  const tokens = tokenize(text);
  return words.some((w) => tokens.includes(w));
}

export const BRAND_TOKENS = [
  'ايفون', 'أيفون', 'iphone', 'سامسونج', 'samsung', 'جالاكسي', 'galaxy',
  'هواوي', 'huawei', 'هونر', 'honor', 'شاومي', 'xiaomi', 'ايباد', 'ipad',
  'ماك بوك', 'macbook', 'asus', 'acer', 'dell', 'hp', 'lenovo', 'tcl',
];

export function countBrandMentions(text: string): number {
  const t = norm(text);
  return new Set(BRAND_TOKENS.filter((b) => t.includes(norm(b)))).size;
}

export interface DecisionEvidenceSignals {
  recommendationRequest: boolean;
  explicitComparison: boolean;
  budgetStated: boolean;
  useCaseStated: boolean;
  namedCompetingProducts: boolean;
  urgency: boolean;
  replacement: boolean;
  availabilityQuestion: boolean;
  declarativeWantOnly: boolean;
}

/** Detect every signal independently — the caller decides how to weight or
 *  gate on them (rank.ts/policy-v2.ts's real formula; need-signals.ts's
 *  category-level aggregate share; any future consumer). This function makes
 *  no scoring decision of its own — only "one canonical set of facts about a
 *  piece of text," matching the codebase's own "one governed definition"
 *  discipline for parseShoppingTask/normalizeSearchQuery. */
export function detectDecisionEvidence(text: string): DecisionEvidenceSignals {
  const t = norm(text);
  const hasRecommendationRequest = RECOMMENDATION_PHRASES.some((p) => t.includes(norm(p)));
  const explicitComparison = containsWholeWord(t, COMPARISON_TOKENS) && countBrandMentions(text) >= 1;
  const budgetStated = BUDGET_PATTERN.test(text);
  const useCaseStated = USE_CASE_MARKERS.some((m) => t.includes(norm(m)));
  const namedCompetingProducts = countBrandMentions(text) >= 2;
  const urgency = URGENCY_MARKERS.some((m) => t.includes(norm(m)));
  const replacement = REPLACEMENT_MARKERS.some((m) => t.includes(norm(m)));
  const availabilityQuestion = AVAILABILITY_MARKERS.some((m) => t.includes(norm(m)));
  const anyPositive = hasRecommendationRequest || explicitComparison || budgetStated || useCaseStated
    || namedCompetingProducts || urgency || replacement || availabilityQuestion;
  const declarativeWantOnly = !anyPositive && DECLARATIVE_WANT.some((m) => t.includes(norm(m)));
  return {
    recommendationRequest: hasRecommendationRequest,
    explicitComparison,
    budgetStated,
    useCaseStated,
    namedCompetingProducts,
    urgency,
    replacement,
    availabilityQuestion,
    declarativeWantOnly,
  };
}

/** True when the text carries ANY genuine decision-evidence signal beyond a
 *  bare declarative want — the exact distinction the HIGH-threshold audit
 *  found the current Demand Radar formula does not make. */
export function hasDecisionEvidence(text: string): boolean {
  const s = detectDecisionEvidence(text);
  return s.recommendationRequest || s.explicitComparison || s.budgetStated || s.useCaseStated
    || s.namedCompetingProducts || s.urgency || s.replacement || s.availabilityQuestion;
}
