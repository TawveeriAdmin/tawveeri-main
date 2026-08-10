// src/lib/agent/mutation-turn.ts
// THE SHARED MUTATION-TURN HANDLER (2026-08-09, D→E mission, Section 5).
//
// "Follow-up is a state mutation, not a search." This is the ONE function that decides what
// a continuation turn means and executes it — called by BOTH the primary search composer
// (State A, when a shopper types a follow-up into it out of habit — the founder's own
// production journey did exactly this) and the dedicated post-decision refinement composer
// (State B, Section 9). One function, two callers, never two independent implementations of
// "what does this follow-up mean" — that duplication IS the second brain Section 4 forbids.
//
// MEASURED PRODUCTION FAILURE this closes: «طيب لو رفعت ميزانيتي إلى 4000 ريال وش بيتغير؟»
// typed into the primary search box ran as a literal catalog-search sentence — 18 generic
// results, a phone-accessory cable ranked as a "recommendation", and (compounding a SEPARATE
// bug fixed in counterfactual.ts) a phantom SAR 7000 budget. This function is what makes sure
// a continuation turn NEVER reaches the plain product-catalog search at all.
import { classifyDecisionIntent, type DecisionIntent, type DecisionIntentResult } from './decision-intent';
import {
  readDecisionState, decisionStateToAdvisorBody, applyParsedTask, applyDecisionResult,
  isNewMissionSwitch, saveDecisionState, type DecisionState,
} from './decision-state';
import {
  parseCounterfactualDelta, applyCounterfactualDelta, compareCounterfactual, compareCheaperOption,
  type CounterfactualComparison,
} from './counterfactual';
import { askAdvisor, type AdvisorResponse } from './advisor-api';
import { parseShoppingTask } from './task-parser';

/**
 * Intents that continue an EXISTING mission rather than describing a fresh one. None of
 * these may ever be sent to the plain product-catalog search as a literal sentence — that
 * search is built for product names/categories, not full Arabic questions, and asking it one
 * is how a $49 cable ends up "recommended" for a phone budget question.
 */
const MUTATION_INTENTS: ReadonlySet<DecisionIntent> = new Set([
  'COUNTERFACTUAL', 'CONSTRAINT_CHANGE', 'DEAL_EVALUATION',
  'SAME_PRODUCT_VERIFICATION', 'MERCHANT_SELECTION',
  'FOLLOW_UP_REASONING', 'EXTERNAL_PRODUCT_REFERENCE',
]);

export function isMutationIntent(intent: DecisionIntent): boolean {
  return MUTATION_INTENTS.has(intent);
}

export type MutationOutcome =
  // FOLLOW_UP_REASONING/MERCHANT_SELECTION with an answer already on screen — the question is
  // already answered by content that exists right now; `reason` tells the caller WHICH part of
  // the existing answer to scroll to and highlight, rather than firing a redundant re-fetch
  // that (for MERCHANT_SELECTION especially — it parses to no new fields) would return the
  // identical recommendation and look like nothing happened.
  | { kind: 'noop'; reason: 'why' | 'where' }
  | { kind: 'external_reference_notice' } // a pasted URL — honest "can't verify yet"
  | { kind: 'counterfactual'; comparison: CounterfactualComparison; newState: DecisionState }
  | { kind: 'mutation'; advisorResult: AdvisorResponse; newState: DecisionState }
  | { kind: 'no_context' } // a mutation intent, but nothing nameable/no prior state to act on
  | { kind: 'not_a_mutation' }; // caller should fall through to the normal search/advisory flow

/**
 * Classify and, where possible, EXECUTE a continuation turn. Returns `not_a_mutation` for any
 * intent this function does not own (EXACT_PRODUCT, CATEGORY_BROWSE, NEEDS_DISCOVERY,
 * PRODUCT_COMPARISON, IMPOSSIBLE_REQUEST) — the caller's existing retrieval/advisory flow
 * handles those exactly as before, unchanged.
 */
export async function handleMutationTurn(
  text: string,
  currentAdvisorResult: AdvisorResponse | null,
  opts?: { signal?: AbortSignal },
): Promise<{ intent: DecisionIntentResult; outcome: MutationOutcome }> {
  const state = readDecisionState();
  const decisionIntent = classifyDecisionIntent(text, { hasActiveDecisionState: !!state });
  const intent = decisionIntent.intent;

  if (intent === 'FOLLOW_UP_REASONING') {
    // The answer already on screen (the smart pick's own "chosen over X because…") already
    // answers a "why" question — a genuine no-op, not "nothing happened by accident".
    return { intent: decisionIntent, outcome: currentAdvisorResult ? { kind: 'noop', reason: 'why' } : { kind: 'not_a_mutation' } };
  }
  if (intent === 'EXTERNAL_PRODUCT_REFERENCE') {
    return { intent: decisionIntent, outcome: { kind: 'external_reference_notice' } };
  }
  if (!isMutationIntent(intent)) {
    return { intent: decisionIntent, outcome: { kind: 'not_a_mutation' } };
  }
  if (!state) {
    // A mutation-shaped sentence with nothing established yet to mutate — honest "nothing to
    // act on" rather than guessing a category/budget that was never stated.
    return { intent: decisionIntent, outcome: { kind: 'no_context' } };
  }
  if (intent === 'MERCHANT_SELECTION' && currentAdvisorResult) {
    // MEASURED (2026-08-10, follow-up-continuation mission): «وين أشتريه؟» was falling into
    // the generic merge-and-reask path below, which — per that path's OWN comment — "parses to
    // no new fields at all", so the re-fetch returns the IDENTICAL recommendation. A real
    // network round-trip that changes nothing on screen looks exactly like a dead control, the
    // same complaint this whole fix addresses for the OTHER chips. The store/price/CTA info is
    // already rendered; scroll to and highlight it instead of re-asking a question the page
    // already answered. Guarded on `currentAdvisorResult` (not just `state`) so the pinned
    // "no prior context" test below (state=null too) is unaffected — falls through to it
    // exactly as before when there's nothing on screen to point to.
    return { intent: decisionIntent, outcome: { kind: 'noop', reason: 'where' } };
  }

  if (intent === 'COUNTERFACTUAL') {
    const delta = parseCounterfactualDelta(text);
    if (!delta) return { intent: decisionIntent, outcome: { kind: 'no_context' } };

    if (delta.kind === 'cheapest') {
      // "طيب ارخص" (2026-08-10, D→E mission Part A/C). Re-ranks the recommendations already
      // on screen (or re-fetches the SAME structured body once if nothing is cached) — no
      // new eligibility/ranking logic, `compareCheaperOption` only diffs what `decide()`
      // already vetted. Deliberately NON-COMMITTING: unlike a real budget change, "show me
      // cheaper" does not alter the shopper's stated budget or priorities, so the cheaper
      // pick does NOT replace the smart pick in state — doing so would silently redefine
      // "best pick" as "cheapest pick", exactly the price-over-eligibility inversion Part B
      // forbids in the other direction.
      const baseBody = decisionStateToAdvisorBody(state);
      if (!baseBody) return { intent: decisionIntent, outcome: { kind: 'no_context' } };
      const current = currentAdvisorResult ?? await askAdvisor(baseBody, { signal: opts?.signal, limit: 4 });
      const comparison = compareCheaperOption(current);
      if (!comparison) return { intent: decisionIntent, outcome: { kind: 'no_context' } };
      return { intent: decisionIntent, outcome: { kind: 'counterfactual', comparison, newState: state } };
    }

    const currentBudget = typeof state.hard_constraints.budget_total === 'number' ? state.hard_constraints.budget_total : null;
    const baseBody = decisionStateToAdvisorBody(state);
    if (currentBudget == null || !baseBody) return { intent: decisionIntent, outcome: { kind: 'no_context' } };
    const newBudget = applyCounterfactualDelta(currentBudget, delta);
    const [before, after] = await Promise.all([
      askAdvisor(baseBody, { signal: opts?.signal, limit: 4 }),
      askAdvisor({ ...baseBody, budget_total: newBudget }, { signal: opts?.signal, limit: 4 }),
    ]);
    const comparison = compareCounterfactual(before, after, newBudget);
    if (!comparison) return { intent: decisionIntent, outcome: { kind: 'no_context' } };
    // The counterfactual's "after" world becomes the new state — a shopper who asked "what if
    // I raise it to 4000" and liked the answer should not have to restate 4000 again.
    const mutatedState = { ...state, hard_constraints: { ...state.hard_constraints, budget_total: newBudget } };
    const newState = applyDecisionResult(mutatedState, {
      recommendations: after.recommendations, smart_pick: after.smart_pick, budget_satisfied: after.budget_satisfied,
    });
    saveDecisionState(newState);
    return { intent: decisionIntent, outcome: { kind: 'counterfactual', comparison, newState } };
  }

  // CONSTRAINT_CHANGE / DEAL_EVALUATION / SAME_PRODUCT_VERIFICATION / MERCHANT_SELECTION:
  // merge this turn's parsed task into the SAME DecisionState (queries like «وين أشتريه؟»
  // parse to no new fields at all — a safe no-op merge, not a special case), then re-ask with
  // the merged structured body — never as an independent literal catalog search.
  // `ParsedTask.budget_total`/`quantity` are typed `number | null | undefined` (via
  // ShoppingTask); `AdvisorParsed`'s equivalents are `number | undefined` — parseShoppingTask
  // never actually returns null in practice, only the wider ShoppingTask type allows it (the
  // same normalization the real API response already performs implicitly via its JSON
  // round-trip — see multi-turn-missions.test.ts's identical note).
  const rawParsed = parseShoppingTask(text);
  // MEASURED FAILURE (2026-08-09, D→E mission Section 11 category sweep — 5 of 6 categories
  // hit this independently): a mutation turn's own text often names no category at all
  // («غير الميزانية إلى 4000» — the category was already established by the mission this turn
  // is continuing). `parseShoppingTask` has no knowledge of `state` and unconditionally flags
  // "category" as unresolved whenever ITS OWN text lacks one — every one of those turns then
  // spuriously carried `unresolved_questions:["category"]` into a mission whose category was
  // never actually in question. Stripped here, once: this whole branch only runs when `state`
  // is truthy and (checked below) this is NOT a category switch, so the active mission's
  // category is already resolved by definition.
  const parsed = {
    ...rawParsed,
    budget_total: rawParsed.budget_total ?? undefined,
    quantity: rawParsed.quantity ?? undefined,
    unresolved: rawParsed.unresolved?.filter((u) => u !== 'category'),
  };
  if (isNewMissionSwitch(state, parsed)) {
    // A genuine category switch mid-refinement ("طيب ابي مكيف للصالة") is a NEW mission, not
    // a mutation of this one — the caller's normal primary-search flow should handle it.
    return { intent: decisionIntent, outcome: { kind: 'not_a_mutation' } };
  }
  const nextState = applyParsedTask(state, parsed, intent);
  const body = decisionStateToAdvisorBody(nextState);
  if (!body) return { intent: decisionIntent, outcome: { kind: 'no_context' } };
  const res = await askAdvisor(body, { signal: opts?.signal, limit: 4 });
  if (res.error || res.count === 0) return { intent: decisionIntent, outcome: { kind: 'no_context' } };
  const newState = applyDecisionResult(nextState, {
    recommendations: res.recommendations, smart_pick: res.smart_pick, budget_satisfied: res.budget_satisfied,
  });
  saveDecisionState(newState);
  return { intent: decisionIntent, outcome: { kind: 'mutation', advisorResult: res, newState } };
}
