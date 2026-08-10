// src/lib/agent/clarify.ts
// P2-8 · UNIFIED SEARCH — "Ambiguous requests may ask ONE clarification question."
//
// CLASSIFICATION (settled before implementation, as with AdvisorAnswer):
// **FIXED SET, NOT GENERATED.** Every question and every answer label below is a literal in
// this file. Nothing is composed at runtime from customer input, and no model is involved —
// so a clarification question can be found by grep, corrected, and verified, exactly like
// every other customer-facing string. **F7 does not govern this surface.** If a question is
// ever produced by generation instead of selected from this table, it does, and F7's
// protections have to exist first.
//
// The rule that decides whether to ask at all is NOT here — it is in the decision, where it
// belongs (`shouldAsk` below is called by the decide route with the real candidate rows).
// The Constitution's condition is that *every clarification question must change the
// recommendation*, and a rule enforced at review time is a rule that eventually is not.
//
// NEED-DISCOVERY GENERALIZATION (2026-08-10, founder's own production gap: «وش أفضل لابتوب
// لاحتياجي وميزانيتي؟» fell through to an 83-result browse — see route-query.ts's
// `needSignals` for the routing half of this fix). Every category can now offer an ORDERED
// LIST of candidate questions instead of exactly one — value-of-information research
// (mixed-initiative dialogue / preference elicitation literature) converges on the same
// mechanism already built here for AC: greedily ask the single highest-value missing field,
// re-evaluate, ask again only if STILL needed. This file extends that mechanism to a second
// field per category (a categorical "use case" question for laptop/mobile/tv, alongside the
// pre-existing numeric field for AC/tablet) plus a BUDGET question usable for every advisable
// category (a hard, general lever via `applyBudgetGate` — it never needed decider-specific
// scoring proof the way storage/RAM did, only real price spread in the candidate set, so it
// generalizes to washing_machine/refrigerator too, which have no other structured field).
// Nothing here is asked unconditionally: `shouldAsk` still runs the identical "does the
// answer change the top pick, tested against the real candidate rows" gate for every
// candidate, in order, and returns the FIRST one that earns its place — never more than one
// question per turn.

import { decide, type ShoppingTask, type CanonicalRow } from './decision-engine';

/** A clarify answer is either a number (room size / storage / RAM / budget ceiling) or a
 *  set of priority strings (a categorical "use case" pick). The SAME generic override
 *  mechanism (`{...task, [field]: value}`) already handles both — see `shouldAsk` below. */
export type ClarifyValue = number | string[];

export interface ClarifyOption {
  /** The value written into the task when chosen. */
  value: ClarifyValue;
  label_ar: string;
  label_en: string;
}

export interface ClarifyQuestion {
  /** The task field this question fills. */
  field: 'room_size_m2' | 'storage_min' | 'ram_min' | 'budget_total' | 'priorities';
  question_ar: string;
  question_en: string;
  options: ClarifyOption[];
  /**
   * The two values used to test whether the answer can change anything.
   * Numeric fields: deliberately the extremes of the OFFERED range (min/max of `options`) —
   * if the recommendation is identical at both ends, no answer in between can move it either.
   * `priorities`: the two most differentiated real options (never the "general/other"
   * sentinel, which by definition changes nothing).
   */
  probes: [ClarifyValue, ClarifyValue];
}

const describeProbe = (v: ClarifyValue): string => (Array.isArray(v) ? (v.length ? v.join('+') : 'none') : String(v));

/** "Nice" rounding for a money figure derived from real data — never an arbitrary guess,
 *  just a human-friendly presentation of a real percentile from the candidate set. */
function roundNice(n: number): number {
  if (n < 500) return Math.round(n / 50) * 50;
  if (n < 2000) return Math.round(n / 100) * 100;
  if (n < 10000) return Math.round(n / 250) * 250;
  return Math.round(n / 500) * 500;
}

/**
 * BUDGET (2026-08-10, need-discovery mission). Unlike storage/RAM, this needed NO per-
 * category scoring proof to justify existing — `applyBudgetGate` (decision-engine.ts) is a
 * hard, GENERAL mechanism: any category with real price spread among its candidates can have
 * its top pick change under a different budget ceiling, by construction. So this is the one
 * candidate question offered to EVERY advisable category, including washing_machine/
 * refrigerator, which have no other structured field to ask about at all.
 *
 * The ranges are DERIVED from the real candidate rows (33rd/66th percentile of actual
 * prices), never a guessed category price band — "unknown beats incorrect" applies to a
 * clarify question's own OPTIONS just as much as to a recommendation.
 *
 * Returns null (not applicable) when: fewer than 4 priced candidates exist (no meaningful
 * distribution), the spread is too narrow to matter (<30% between the 33rd and 66th
 * percentile), or the shopper already asked for the cheapest option (P1's `wants_cheapest` —
 * asking "what's your budget" when they explicitly want the lowest possible price is
 * redundant, not helpful).
 */
function buildBudgetQuestion(task: ShoppingTask, rows: CanonicalRow[]): ClarifyQuestion | null {
  if ((task as ShoppingTask & { wants_cheapest?: boolean }).wants_cheapest) return null;
  const prices = rows.map((r) => r.lowest_price).filter((p): p is number => p != null && p > 0).sort((a, b) => a - b);
  if (prices.length < 4) return null;
  const pctl = (p: number) => prices[Math.min(prices.length - 1, Math.floor(prices.length * p))];
  const lo = roundNice(pctl(0.33));
  const hi = roundNice(pctl(0.66));
  if (hi <= lo * 1.3) return null;
  const openEnded = roundNice(prices[prices.length - 1] * 1.1);
  return {
    field: 'budget_total',
    question_ar: 'وكم تقريبًا ميزانيتك؟',
    question_en: "Roughly what's your budget?",
    options: [
      { value: lo, label_ar: `أقل من ${lo} ريال`, label_en: `Under ${lo} SAR` },
      { value: hi, label_ar: `أقل من ${hi} ريال`, label_en: `Under ${hi} SAR` },
      { value: openEnded, label_ar: 'ميزانية مفتوحة', label_en: 'No strict limit' },
    ],
    probes: [lo, hi],
  };
}

// ── Static categorical "use case" questions — verified against the real scoring branches
//    each decider uses (decision-engine.ts), not invented. Every non-general option maps to
//    a `priorities` value the relevant decider genuinely rewards; the "شيء ثاني / عام" option
//    maps to an empty array (a real, honest "no positive priority" state — never omitted just
//    to fill a 3rd/4th slot). ──

const LAPTOP_USE_CASE_Q: ClarifyQuestion = {
  field: 'priorities',
  question_ar: 'وش استخدامك الأساسي للابتوب؟',
  question_en: 'What will you mainly use the laptop for?',
  options: [
    { value: ['gaming'], label_ar: '🎮 ألعاب', label_en: '🎮 Gaming' },
    { value: ['productivity'], label_ar: '💼 دراسة وعمل وبرمجة', label_en: '💼 Study / work / coding' },
    { value: ['portability'], label_ar: '🎒 أخف للتنقل', label_en: '🎒 Light for travel' },
    { value: [], label_ar: 'شيء ثاني / عام', label_en: 'Something else / general' },
  ],
  probes: [['gaming'], ['productivity']],
};

const MOBILE_USE_CASE_Q: ClarifyQuestion = {
  field: 'priorities',
  question_ar: 'وش الأهم لك بالجوال؟',
  question_en: 'What matters most to you in a phone?',
  options: [
    { value: ['camera'], label_ar: '📷 التصوير', label_en: '📷 Camera' },
    { value: ['battery'], label_ar: '🔋 بطارية تدوم', label_en: '🔋 Long battery' },
    { value: ['gaming'], label_ar: '🎮 الألعاب', label_en: '🎮 Gaming' },
    { value: [], label_ar: 'شيء ثاني / عام', label_en: 'Something else / general' },
  ],
  probes: [['camera'], ['gaming']],
};

// Only 2 meaningfully distinct chips + general — `decideTv` scores gaming AND sports through
// the SAME refresh-rate branch (decision-engine.ts), so offering both as separate options
// would be decorative, not a real second bucket.
const TV_USE_CASE_Q: ClarifyQuestion = {
  field: 'priorities',
  question_ar: 'وش استخدامك الأساسي للتلفزيون؟',
  question_en: 'What will you mainly use the TV for?',
  options: [
    { value: ['gaming'], label_ar: '🎮 ألعاب ورياضة', label_en: '🎮 Gaming / sports' },
    { value: ['movies'], label_ar: '🎬 أفلام ومسلسلات', label_en: '🎬 Movies / shows' },
    { value: [], label_ar: 'استخدام عام', label_en: 'General use' },
  ],
  probes: [['gaming'], ['movies']],
};

const AC_ROOM_SIZE_Q: ClarifyQuestion = {
  field: 'room_size_m2',
  question_ar: 'كم مساحة الغرفة تقريبًا؟ يحدد ذلك السعة المناسبة.',
  question_en: 'Roughly how large is the room? It decides the right capacity.',
  options: [
    { value: 15, label_ar: 'صغيرة (~15 م²)', label_en: 'Small (~15 m²)' },
    { value: 25, label_ar: 'متوسطة (~25 م²)', label_en: 'Medium (~25 m²)' },
    { value: 40, label_ar: 'كبيرة (~40 م²)', label_en: 'Large (~40 m²)' },
  ],
  probes: [15, 40],
};

const STORAGE_Q: ClarifyQuestion = {
  field: 'storage_min',
  question_ar: 'كم مساحة التخزين التي تحتاجها؟ يؤثر ذلك على السعر والخيار الأنسب.',
  question_en: 'How much storage do you need? It affects price and which option fits best.',
  options: [
    { value: 64, label_ar: '64 جيجا', label_en: '64 GB' },
    { value: 128, label_ar: '128 جيجا', label_en: '128 GB' },
    { value: 256, label_ar: '256 جيجا فأكثر', label_en: '256 GB or more' },
  ],
  probes: [64, 256],
};

const RAM_Q: ClarifyQuestion = {
  field: 'ram_min',
  question_ar: 'كم رام (ذاكرة) تحتاج تقريبًا؟ يحدد ذلك مدى مناسبة الجهاز لاستخدامك.',
  question_en: 'Roughly how much RAM do you need? It decides how well the laptop fits your use.',
  options: [
    { value: 8, label_ar: '8 جيجا', label_en: '8 GB' },
    { value: 16, label_ar: '16 جيجا', label_en: '16 GB' },
    { value: 32, label_ar: '32 جيجا فأكثر', label_en: '32 GB or more' },
  ],
  probes: [8, 32],
};

type QuestionBuilder = (task: ShoppingTask, rows: CanonicalRow[]) => ClarifyQuestion | null;

/**
 * Per category, an ORDERED list of candidate questions — earlier entries are tried first.
 * `shouldAsk` returns the FIRST one that (a) is not already answered and (b) provably changes
 * the outcome; it never returns more than one. Order encodes which unknown is usually more
 * decision-critical for that category: AC's room size is a hard BTU requirement (checked
 * first, unchanged from the original single-question design); laptop/mobile/tv ask about USE
 * first, budget second (understand the goal before narrowing by spend — matches both the
 * founder's own hypothesis and mixed-initiative dialogue research: ask about goals before
 * constraints); tablet keeps its proven storage-first question. washing_machine/refrigerator
 * have ONLY budget — their "large household" signal is free-text regex, not a structured
 * field (see the git history for why that was deliberately not forced into a fake question).
 */
const CLARIFY_CANDIDATES: Record<string, QuestionBuilder[]> = {
  air_conditioner: [() => AC_ROOM_SIZE_Q, buildBudgetQuestion],
  laptop: [() => LAPTOP_USE_CASE_Q, buildBudgetQuestion, () => RAM_Q],
  mobile: [() => MOBILE_USE_CASE_Q, buildBudgetQuestion, () => STORAGE_Q],
  tablet: [() => STORAGE_Q, buildBudgetQuestion],
  tv: [() => TV_USE_CASE_Q, buildBudgetQuestion],
  washing_machine: [buildBudgetQuestion],
  refrigerator: [buildBudgetQuestion],
};

/** Back-compat export: the previous single-question-per-category map, derived from the new
 *  candidate lists using category-agnostic (no-rows-needed) builders only. Kept because
 *  existing tests/UI assert basic structural properties (labels present, probes bracket the
 *  options) across "every defined question" without needing real candidate rows. */
export const CLARIFY_BY_CATEGORY: Record<string, ClarifyQuestion> = Object.fromEntries(
  Object.entries(CLARIFY_CANDIDATES)
    .map(([cat, builders]) => [cat, builders[0](({ category: cat } as ShoppingTask), [])])
    .filter((entry): entry is [string, ClarifyQuestion] => entry[1] != null),
);

export interface ClarifyDecision {
  ask: boolean;
  /** Why — carried into the response so the choice is auditable, never inferred later. */
  reason: string;
  question?: ClarifyQuestion;
}

/**
 * Decide whether to ask, and WHICH question, using the SAME engine and the SAME candidate
 * rows that produced the answer. For each candidate question in category order: build it
 * (some are static, some — budget — are computed from the real rows and may not apply),
 * skip if already answered, then run the decision at both probe values and compare the
 * outcome. The first candidate that both applies and provably changes the top pick wins;
 * everything after it is never even evaluated, so at most one question is ever asked.
 *
 * A question is asked only when its two probes disagree. If a shopper's answer cannot change
 * what we recommend, the question is pure friction and the Constitution forbids it:
 * *"questions that do not improve confidence are never asked."*
 *
 * Comparing the top pick's identity is the right test rather than comparing scores: the
 * customer experiences the RECOMMENDATION, not the arithmetic behind it.
 */
export function shouldAsk(task: ShoppingTask, rows: CanonicalRow[]): ClarifyDecision {
  const candidates = CLARIFY_CANDIDATES[task.category];
  if (!candidates || candidates.length === 0) return { ask: false, reason: 'no question defined for this category' };
  if (!rows.length) return { ask: false, reason: 'no candidates to distinguish' };

  for (const build of candidates) {
    const q = build(task, rows);
    if (!q) continue; // not applicable for this candidate set (e.g. budget: too little price spread, or cheapest mode)

    // NEVER ask for something already given. The parser is the single source of truth for
    // what the shopper supplied, so this reads the task rather than re-reading the text.
    // `priorities` uses presence (not truthiness) so an explicit "general/no preference"
    // answer (an empty array, not undefined) correctly counts as already-answered.
    const present = (task as unknown as Record<string, unknown>)[q.field];
    if (present !== undefined && present !== null) continue;

    const [probeA, probeB] = q.probes;
    const at = (v: ClarifyValue) => {
      const r = decide({ ...task, [q.field]: v } as ShoppingTask, rows);
      return r.recommendations.find((x) => x.is_smart_pick) ?? r.recommendations[0] ?? null;
    };
    const a = at(probeA);
    const b = at(probeB);
    if (!a || !b) continue; // engine returned no pick at one or both probes — try the next candidate
    if (a.canonical_id === b.canonical_id) continue; // doesn't change the outcome — try the next candidate

    return { ask: true, reason: `recommendation differs at ${describeProbe(probeA)} vs ${describeProbe(probeB)}`, question: q };
  }
  return { ask: false, reason: 'no missing field would change the recommendation' };
}
