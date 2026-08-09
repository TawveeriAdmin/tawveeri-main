// src/lib/agent/decision-intent.ts
// ONE ORCHESTRATION CONTRACT (2026-08-09, Unified Intelligence mission, Phase 2 · Section 5).
//
// `route-query.ts` already decides retrieval vs advisory vs comparison — that three-way
// split is correct and stays exactly as-is (untouched: every existing caller, and all 1486
// passing tests, keep working unmodified). This file does NOT replace it. It WRAPS it: the
// mission's full taxonomy (EXACT_PRODUCT, CATEGORY_BROWSE, NEEDS_DISCOVERY,
// PRODUCT_COMPARISON, DEAL_EVALUATION, SAME_PRODUCT_VERIFICATION, MERCHANT_SELECTION,
// FOLLOW_UP_REASONING, COUNTERFACTUAL, CONSTRAINT_CHANGE, IMPOSSIBLE_REQUEST,
// EXTERNAL_PRODUCT_REFERENCE) is a REFINEMENT of routeQuery's three modes, not a
// competing classifier. `routeQuery`'s comparison/advisory/retrieval decision is always
// computed first and carried in the result (`route`) so nothing downstream has to
// re-derive it — one classification, read by every surface.
//
// Deterministic and LLM-free (ADR-002), matching `route-query.ts` and `compare-intent.ts`.
import { routeQuery, type QueryRoute } from './route-query';
import { normalizeAr } from './compare-intent';

export type DecisionIntent =
  | 'EXACT_PRODUCT'
  | 'CATEGORY_BROWSE'
  | 'NEEDS_DISCOVERY'
  | 'PRODUCT_COMPARISON'
  | 'DEAL_EVALUATION'
  | 'SAME_PRODUCT_VERIFICATION'
  | 'MERCHANT_SELECTION'
  | 'FOLLOW_UP_REASONING'
  | 'COUNTERFACTUAL'
  | 'CONSTRAINT_CHANGE'
  | 'IMPOSSIBLE_REQUEST'
  | 'EXTERNAL_PRODUCT_REFERENCE';

export interface DecisionIntentContext {
  /** True when a DecisionState already exists for this journey/category (Section 6). Several
   *  intents (follow-up, counterfactual, constraint-change) are only coherent WITH prior
   *  context — asking "why?" with nothing to explain is not a follow-up, it is unclassifiable. */
  hasActiveDecisionState?: boolean;
}

export interface DecisionIntentResult {
  intent: DecisionIntent;
  reason: string;
  /** The underlying routeQuery() classification — always computed, never discarded, so a
   *  caller that only needs retrieval/advisory/comparison can read it without re-parsing. */
  route: QueryRoute;
}

const URL_PATTERN = /https?:\/\/[^\s]+/i;

// Markers below are Arabic-normalized (see compare-intent.ts's normalizeAr — أ/إ/آ→ا,
// ة→ه, ى→ي) and checked against normalized text, same discipline as compare-intent.ts.
const COUNTERFACTUAL_MARKERS = [
  'لو زدت', 'لو رفعت', 'لو نزلت', 'لو خفضت', 'لو غيرت الميزانيه', 'لو زاد', 'ايش يتغير لو',
  'وش يتغير لو', 'ماذا لو', 'اذا رفعت', 'اذا زدت', 'what if', 'if i increase', 'if i raise',
];
/**
 * "طيب ارخص" / "وش أتنازل عنه لو أبي أوفر" (2026-08-10, D→E mission Part A/C — two of the
 * founder's own named example follow-ups). Classified as COUNTERFACTUAL, answered by
 * `parseCounterfactualDelta`'s `kind: 'cheapest'` branch and `compareCheaperOption`.
 *
 * DELIBERATELY NOT added to COUNTERFACTUAL_MARKERS above and checked WITHOUT
 * `ctx.hasActiveDecisionState`, unlike "لو زدت"/"لو رفعت": those markers describe a
 * hypothetical that only makes sense against an existing baseline. "أرخص" does not — «ابي
 * جوال ارخص من 2000 ريال» is a perfectly ordinary FRESH need description (task-parser.ts's
 * bare number+«ريال» fallback already extracts budget_total=2000 from it with no marker
 * involved) that must keep routing to NEEDS_DISCOVERY like any other first turn. Gating this
 * on an active mission is what tells the two apart.
 */
const CHEAPER_MARKERS = ['ارخص', 'أرخص', 'اوفر', 'أوفر', 'اتنازل', 'أتنازل', 'cheaper', 'cheapest'];
const CONSTRAINT_CHANGE_MARKERS = [
  'بدل كذا', 'بدل الميزانيه', 'غير الميزانيه', 'غير المدينه', 'خليها', 'خليه', 'شيل شرط',
  'احذف شرط', 'الغي شرط', 'عدل الطلب', 'change the budget', 'remove the constraint', 'update my budget',
];
const FOLLOW_UP_MARKERS = [
  'ليش', 'ليه', 'وضح اكثر', 'وضح لي', 'why', 'explain more', 'ماذا تقصد', 'وش تقصد',
];
const DEAL_EVALUATION_MARKERS = [
  'هل هذا العرض', 'هل العرض', 'يستاهل', 'يستحق الشراء', 'هل السعر كويس', 'هل هذا السعر',
  'خصم حقيقي', 'is this a good deal', 'is this deal', 'worth buying', 'good price',
];
const SAME_PRODUCT_MARKERS = [
  'نفس المنتج', 'نفس الموديل', 'نفس الجهاز', 'هل هذا نفسه', 'هل هو نفس', 'same product',
  'same model', 'is this the same',
];
const MERCHANT_SELECTION_MARKERS = [
  'وين اشتري', 'وين اطلب', 'من وين اشتري', 'من وين اطلب', 'اي متجر افضل', 'اي متجر ارخص',
  'where do i buy', 'where can i buy', 'which store', 'which retailer',
];

function matchesAny(normalized: string, markers: string[]): string | null {
  for (const m of markers) if (normalized.includes(m)) return m;
  return null;
}

/**
 * Classify the FULL decision intent of a query.
 *
 * Order is the rule (mirrors route-query.ts's own documented-order discipline):
 *   1. A pasted URL                          → EXTERNAL_PRODUCT_REFERENCE. Structural, checked
 *      first — a URL can appear inside any other kind of sentence, and verifying an external
 *      reference is a different job than any of the below (Section 21, research+design this
 *      mission — classification only, no verification flow built yet).
 *   2. Counterfactual markers                → COUNTERFACTUAL ("لو زدت 500 وش بيتغير؟").
 *   3. Constraint-change markers, WITH active state → CONSTRAINT_CHANGE. Without active state
 *      there is nothing to change, so it falls through to be classified on its own terms.
 *   4. Follow-up markers, WITH active state  → FOLLOW_UP_REASONING ("طيب ليش هذا أفضل؟").
 *      Without active state, "ليش" alone names nothing — falls through.
 *   5. Deal-evaluation markers               → DEAL_EVALUATION.
 *   6. Same-product verification markers     → SAME_PRODUCT_VERIFICATION.
 *   7. Merchant-selection markers            → MERCHANT_SELECTION ("وين أشتريه؟").
 *   8. routeQuery says comparison            → PRODUCT_COMPARISON (delegates entirely).
 *   9. routeQuery says retrieval + a named model → EXACT_PRODUCT.
 *  10. routeQuery says advisory              → NEEDS_DISCOVERY.
 *  11. Otherwise (retrieval, category or not) → CATEGORY_BROWSE — the safe default; a bare
 *      category or an unclassifiable query is a browse, not a failure.
 *
 * IMPOSSIBLE_REQUEST is deliberately NOT reachable from text alone here — see
 * `refineIntentFromOutcome` below for why, and how it is reached honestly.
 */
export function classifyDecisionIntent(text: string, ctx: DecisionIntentContext = {}): DecisionIntentResult {
  const raw = (text || '').trim();
  const route = routeQuery(raw);

  if (!raw) return { intent: 'CATEGORY_BROWSE', reason: 'empty query', route };

  if (URL_PATTERN.test(raw)) {
    return { intent: 'EXTERNAL_PRODUCT_REFERENCE', reason: 'query contains a URL', route };
  }

  const x = normalizeAr(raw);

  const cf = matchesAny(x, COUNTERFACTUAL_MARKERS);
  if (cf) return { intent: 'COUNTERFACTUAL', reason: `counterfactual marker: ${cf}`, route };

  if (ctx.hasActiveDecisionState) {
    // "أرخص"/"اوفر" — see CHEAPER_MARKERS' own comment for why this is gated here and not
    // folded into the unconditional COUNTERFACTUAL_MARKERS check above.
    const cheaper = matchesAny(x, CHEAPER_MARKERS);
    if (cheaper) return { intent: 'COUNTERFACTUAL', reason: `cheaper marker: ${cheaper}`, route };

    const cc = matchesAny(x, CONSTRAINT_CHANGE_MARKERS);
    if (cc) return { intent: 'CONSTRAINT_CHANGE', reason: `constraint-change marker: ${cc}`, route };

    const fu = matchesAny(x, FOLLOW_UP_MARKERS);
    if (fu) return { intent: 'FOLLOW_UP_REASONING', reason: `follow-up marker: ${fu}`, route };
  }

  const deal = matchesAny(x, DEAL_EVALUATION_MARKERS);
  if (deal) return { intent: 'DEAL_EVALUATION', reason: `deal-evaluation marker: ${deal}`, route };

  const same = matchesAny(x, SAME_PRODUCT_MARKERS);
  if (same) return { intent: 'SAME_PRODUCT_VERIFICATION', reason: `same-product marker: ${same}`, route };

  const merchant = matchesAny(x, MERCHANT_SELECTION_MARKERS);
  if (merchant) return { intent: 'MERCHANT_SELECTION', reason: `merchant-selection marker: ${merchant}`, route };

  if (route.mode === 'comparison') {
    return { intent: 'PRODUCT_COMPARISON', reason: route.reason, route };
  }

  if (route.mode === 'retrieval' && route.reason === 'query names a specific model') {
    return { intent: 'EXACT_PRODUCT', reason: route.reason, route };
  }

  if (route.mode === 'advisory') {
    return { intent: 'NEEDS_DISCOVERY', reason: route.reason, route };
  }

  return { intent: 'CATEGORY_BROWSE', reason: route.reason, route };
}

/**
 * Upgrade a NEEDS_DISCOVERY/EXACT_PRODUCT classification to IMPOSSIBLE_REQUEST — but only
 * from what the decision ENGINE actually found, never from a text-only guess at a "realistic"
 * price. Section 0's rule ("never fabricate") rules out a hardcoded per-category price floor
 * here: what is possible depends on the real catalog, which `decide()` already checked. A
 * request is impossible when the engine found products for the category but genuinely NONE
 * satisfy the stated hard constraint (budget) — not merely "the smart pick happens to be
 * over budget" (that case already has an honest `budget_note`, and is still answerable).
 */
export function refineIntentFromOutcome(
  prior: DecisionIntentResult,
  outcome: { supported: boolean; count: number; anyWithinBudget?: boolean | null; hadBudgetConstraint: boolean },
): DecisionIntentResult {
  if (
    (prior.intent === 'NEEDS_DISCOVERY' || prior.intent === 'EXACT_PRODUCT') &&
    outcome.supported &&
    outcome.count > 0 &&
    outcome.hadBudgetConstraint &&
    outcome.anyWithinBudget === false
  ) {
    return {
      intent: 'IMPOSSIBLE_REQUEST',
      reason: 'engine found candidates for the category but none satisfy the stated budget',
      route: prior.route,
    };
  }
  return prior;
}
