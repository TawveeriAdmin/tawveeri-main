// src/lib/agent/counterfactual.ts
// COUNTERFACTUAL REASONING (2026-08-09, Unified Intelligence mission, Phase 4 · Section 12).
//
// The North Star's own example: «لو زدت الميزانية 500 وش بيتغير؟» — a shopper asking what
// changes if a constraint moves, WITHOUT restarting the conversation. `decision-intent.ts`
// already classifies this as COUNTERFACTUAL (Phase 2); this is what actually computes and
// explains the answer.
//
// Deliberately built on TWO REAL `askAdvisor` responses, never on re-deriving the decision
// engine's ranking here. Every field in the comparison below is read from responses the
// production decision engine already produced (fully evidence-cited, F7-guarded) — this
// module only diffs and phrases, exactly the "engines decide, this only compares" discipline
// the rest of `src/lib/agent/` follows. Deterministic and LLM-free (ADR-002).
import type { AdvisorResponse } from './advisor-api';

export interface CounterfactualDelta {
  direction: 'increase' | 'decrease';
  amount: number;
}

const ARABIC_INDIC = /[٠-٩۰-۹]/g;
const asciiDigits = (t: string) =>
  t.replace(ARABIC_INDIC, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
const norm = (t: string) => asciiDigits((t || '').toLowerCase());

/**
 * Extract a budget delta from counterfactual phrasing («لو زدت الميزانية 500», «لو رفعت
 * ٥٠٠», «if I raise it by 500»). Returns null when no delta is nameable — a counterfactual
 * intent with no parseable amount has nothing to compute, and guessing an amount would be
 * exactly the fabrication Section 0 forbids.
 */
export function parseCounterfactualDelta(text: string): CounterfactualDelta | null {
  const x = norm(text);
  const inc = x.match(/(?:زدت|زياده|زيادة|رفعت|زاد|increase|raise|add)\D{0,20}?(\d{2,6})/);
  if (inc) return { direction: 'increase', amount: Number(inc[1]) };
  const dec = x.match(/(?:نزلت|خفضت|قللت|نقصت|تنزيل|decrease|lower|reduce|drop)\D{0,20}?(\d{2,6})/);
  if (dec) return { direction: 'decrease', amount: Number(dec[1]) };
  return null;
}

/** The adjusted budget a counterfactual delta implies, never negative. */
export function applyCounterfactualDelta(currentBudget: number, delta: CounterfactualDelta): number {
  return delta.direction === 'increase'
    ? currentBudget + delta.amount
    : Math.max(0, currentBudget - delta.amount);
}

export interface CounterfactualComparison {
  changed: boolean;
  /** Was NOT within budget before, IS within budget after — the "unlocks a new option" case. */
  newlyUnlocked: boolean;
  before: { title_ar: string | null; title_en: string | null; unit_price: number | null; budget_satisfied: boolean };
  after: { title_ar: string | null; title_en: string | null; unit_price: number | null; budget_satisfied: boolean };
  price_delta: number | null;
  explanation_ar: string;
  explanation_en: string;
}

/**
 * Compare two REAL decision-engine answers (same category/constraints except the varied
 * budget) and explain what changed, in the shopper's own terms.
 *
 * Returns null when there is nothing to compare (no smart pick on either side) — an honest
 * "nothing to say" rather than a fabricated comparison.
 */
export function compareCounterfactual(
  before: AdvisorResponse,
  after: AdvisorResponse,
  newBudget: number,
): CounterfactualComparison | null {
  const b = before.smart_pick ?? null;
  const a = after.smart_pick ?? null;
  if (!b && !a) return null;

  const changed = b?.canonical_id !== a?.canonical_id;
  const beforeSatisfied = before.budget_satisfied ?? true;
  const afterSatisfied = after.budget_satisfied ?? true;
  const newlyUnlocked = !beforeSatisfied && afterSatisfied;
  const price_delta =
    a?.unit_price != null && b?.unit_price != null ? Math.round(a.unit_price - b.unit_price) : null;

  let explanation_ar: string;
  let explanation_en: string;
  if (!a) {
    explanation_ar = `لا يتوفر خيار موثّق بميزانية ${newBudget} ريال.`;
    explanation_en = `No documented option at a ${newBudget} SAR budget.`;
  } else if (!changed) {
    const title = a.title_ar ?? a.title_en ?? '';
    const titleEn = a.title_en ?? a.title_ar ?? '';
    explanation_ar = `لا يتغير الترشيح — "${title}" يبقى الأنسب حتى بميزانية ${newBudget} ريال.`;
    explanation_en = `The pick does not change — "${titleEn}" remains best even at a ${newBudget} SAR budget.`;
  } else if (newlyUnlocked) {
    const title = a.title_ar ?? a.title_en ?? '';
    const titleEn = a.title_en ?? a.title_ar ?? '';
    explanation_ar = `برفع الميزانية إلى ${newBudget} ريال، يصبح "${title}" متاحًا ضمن الميزانية (لم يكن هناك خيار مطابق قبل ذلك).`;
    explanation_en = `Raising the budget to ${newBudget} SAR brings "${titleEn}" within budget (no candidate fit before).`;
  } else {
    const title = a.title_ar ?? a.title_en ?? '';
    const titleEn = a.title_en ?? a.title_ar ?? '';
    const deltaAr = price_delta != null ? ` (${price_delta > 0 ? '+' : ''}${price_delta} ريال عن الخيار السابق)` : '';
    const deltaEn = price_delta != null ? ` (${price_delta > 0 ? '+' : ''}${price_delta} SAR vs the previous pick)` : '';
    explanation_ar = `بميزانية ${newBudget} ريال، يتغير الترشيح إلى "${title}"${deltaAr}.`;
    explanation_en = `At a ${newBudget} SAR budget, the pick changes to "${titleEn}"${deltaEn}.`;
  }

  return {
    changed,
    newlyUnlocked,
    before: { title_ar: b?.title_ar ?? null, title_en: b?.title_en ?? null, unit_price: b?.unit_price ?? null, budget_satisfied: beforeSatisfied },
    after: { title_ar: a?.title_ar ?? null, title_en: a?.title_en ?? null, unit_price: a?.unit_price ?? null, budget_satisfied: afterSatisfied },
    price_delta,
    explanation_ar,
    explanation_en,
  };
}
