// src/lib/agent/follow-up-suggestions.ts
// SUGGESTED CONTEXTUAL FOLLOW-UPS (2026-08-09, D→E mission, Section 9).
//
// Research finding (OpenAI Shopping Research is the one vendor with public evidence of this
// pattern): removable/tappable chips showing what a follow-up WOULD ask, pre-filling the
// SAME input rather than requiring the shopper to phrase a mutation correctly from scratch.
// Every suggestion here is chosen because its EXACT phrasing is already proven to classify
// and execute correctly through `mutation-turn.ts` (multi-turn-missions.test.ts pins each
// one) — this file never suggests an action the pipeline cannot actually honor.
import type { DecisionState } from './decision-state';

export interface FollowUpSuggestion {
  key: string;
  label_ar: string;
  label_en: string;
  /** The exact text placed in the search composer when tapped — NOT auto-submitted (Baymard:
   *  a refinement should be an explicit, deliberate turn, not a live reinterpretation). */
  prefill_ar: string;
  prefill_en: string;
}

const BUDGET_BUMP = 500;

export function buildFollowUpSuggestions(state: DecisionState): FollowUpSuggestion[] {
  const suggestions: FollowUpSuggestion[] = [];

  if (typeof state.hard_constraints.budget_total === 'number') {
    const newBudget = state.hard_constraints.budget_total + BUDGET_BUMP;
    suggestions.push({
      key: 'raise_budget',
      label_ar: `لو رفعت الميزانية ${BUDGET_BUMP}؟`,
      label_en: `What if I raise the budget by ${BUDGET_BUMP}?`,
      prefill_ar: `لو رفعت الميزانية إلى ${newBudget} وش بيتغير؟`,
      prefill_en: `What if I raise the budget to ${newBudget}, what changes?`,
    });
  }

  suggestions.push({
    key: 'why', label_ar: 'ليش هذا أفضل؟', label_en: 'Why this one?',
    prefill_ar: 'ليش هذا أفضل؟', prefill_en: 'Why is this the best pick?',
  });

  suggestions.push({
    key: 'where', label_ar: 'وين أشتريه؟', label_en: 'Where do I buy it?',
    prefill_ar: 'وين أشتريه؟', prefill_en: 'Where can I buy it?',
  });

  return suggestions;
}
