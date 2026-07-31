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

import { decide, type ShoppingTask, type CanonicalRow } from './decision-engine';

export interface ClarifyOption {
  /** The value written into the task when chosen. */
  value: number;
  label_ar: string;
  label_en: string;
}

export interface ClarifyQuestion {
  /** The task field this question fills. */
  field: 'room_size_m2';
  question_ar: string;
  question_en: string;
  options: ClarifyOption[];
  /**
   * The two values used to test whether the answer can change anything. Deliberately the
   * extremes of the offered range: if the recommendation is identical at both ends, no
   * answer in between can move it either.
   */
  probes: [number, number];
}

/**
 * One question per category, for the ONE field whose absence actually changes the answer.
 *
 * Only `air_conditioner` is here, and that is a measurement, not an oversight: room area is
 * the only unresolved field the parser reports (`task-parser.ts` pushes `room_size_m2` to
 * `unresolved`, nothing else) and the only one the engine converts into a hard requirement —
 * capacity in BTU. For every other category a missing field degrades ranking gracefully
 * rather than making the recommendation wrong, so asking would be friction.
 *
 * Adding a category here means proving the same two things first: the field is missing often,
 * and two different answers produce different recommendations.
 */
export const CLARIFY_BY_CATEGORY: Record<string, ClarifyQuestion> = {
  air_conditioner: {
    field: 'room_size_m2',
    question_ar: 'كم مساحة الغرفة تقريبًا؟ يحدد ذلك السعة المناسبة.',
    question_en: 'Roughly how large is the room? It decides the right capacity.',
    options: [
      { value: 15, label_ar: 'صغيرة (~15 م²)', label_en: 'Small (~15 m²)' },
      { value: 25, label_ar: 'متوسطة (~25 م²)', label_en: 'Medium (~25 m²)' },
      { value: 40, label_ar: 'كبيرة (~40 م²)', label_en: 'Large (~40 m²)' },
    ],
    probes: [15, 40],
  },
};

export interface ClarifyDecision {
  ask: boolean;
  /** Why — carried into the response so the choice is auditable, never inferred later. */
  reason: string;
  question?: ClarifyQuestion;
}

/**
 * Decide whether to ask, using the SAME engine and the SAME candidate rows that produced the
 * answer. Runs the decision at both ends of the offered range and compares the outcome.
 *
 * A question is asked only when the two ends disagree. If a shopper's answer cannot change
 * what we recommend, the question is pure friction and the Constitution forbids it:
 * *"questions that do not improve confidence are never asked."*
 *
 * Comparing the top pick's identity is the right test rather than comparing scores: the
 * customer experiences the RECOMMENDATION, not the arithmetic behind it. A question that
 * reshuffles confidence by a point while recommending the same machine has changed nothing
 * they can see.
 */
export function shouldAsk(task: ShoppingTask, rows: CanonicalRow[]): ClarifyDecision {
  const q = CLARIFY_BY_CATEGORY[task.category];
  if (!q) return { ask: false, reason: 'no question defined for this category' };

  // NEVER ask for something already given. The parser is the single source of truth for
  // what the shopper supplied, so this reads the task rather than re-reading the text.
  const present = (task as unknown as Record<string, unknown>)[q.field];
  if (present !== undefined && present !== null) {
    return { ask: false, reason: `${q.field} was already supplied (${String(present)})` };
  }
  if (!rows.length) return { ask: false, reason: 'no candidates to distinguish' };

  const [lo, hi] = q.probes;
  const at = (v: number) => {
    const r = decide({ ...task, [q.field]: v } as ShoppingTask, rows);
    return r.recommendations.find((x) => x.is_smart_pick) ?? r.recommendations[0] ?? null;
  };
  const a = at(lo);
  const b = at(hi);

  if (!a || !b) return { ask: false, reason: 'engine returned no pick at one or both probes' };
  if (a.canonical_id === b.canonical_id) {
    return { ask: false, reason: `same recommendation at ${lo} and ${hi} — the answer cannot change it` };
  }
  return { ask: true, reason: `recommendation differs at ${lo} vs ${hi}`, question: q };
}
