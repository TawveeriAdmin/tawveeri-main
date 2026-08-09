// src/lib/agent/counterfactual.ts
// COUNTERFACTUAL REASONING (2026-08-09, Unified Intelligence mission, Phase 4 · Section 12;
// fixed 2026-08-09, D→E mission, Section 1 — the founder's own production failure).
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
import type { AdvisorResponse, AdvisorRecommendation } from './advisor-api';

/**
 * MEASURED PRODUCTION FAILURE (2026-08-09, founder's own journey): «لو رفعت ميزانيتي إلى
 * 4000 ريال» ("if I raise my budget TO 4000 SAR") was parsed as a RELATIVE delta of +4000 —
 * the old shape only had `{direction, amount}`, and the "رفعت" (raise) marker fired before
 * anyone checked for "إلى" (TO — an absolute target, not an amount to add). On a 3000 SAR
 * baseline this computed 3000+4000=7000, a phantom budget the shopper never stated.
 * `kind: 'absolute'` vs `'relative'` makes the distinction impossible to skip — every caller
 * must handle both, not assume "amount" always means "add this much".
 *
 * `kind: 'cheapest'` (2026-08-10, D→E mission Part A/C — one of the founder's own named
 * example follow-ups, «طيب ارخص»). Deliberately NOT a budget delta at all: "give me
 * something cheaper" names no number, so forcing it through the increase/decrease parser
 * would mean guessing an amount — exactly the fabrication this file's own top comment
 * forbids. It re-ranks the SAME already-fetched, already-eligible candidate set by cost
 * instead (see `compareCheaperOption` below) — no new decision-engine call, no ranking
 * logic re-derived here.
 */
export type CounterfactualDelta =
  | { kind: 'absolute'; value: number }
  | { kind: 'relative'; direction: 'increase' | 'decrease'; amount: number }
  | { kind: 'cheapest' };

const ARABIC_INDIC = /[٠-٩۰-۹]/g;
const asciiDigits = (t: string) =>
  t.replace(ARABIC_INDIC, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
const norm = (t: string) => asciiDigits((t || '').toLowerCase());

/**
 * Extract a budget change from counterfactual phrasing. Returns null when no amount is
 * nameable — a counterfactual intent with no parseable target has nothing to compute, and
 * guessing an amount would be exactly the fabrication Section 0 forbids.
 *
 * ABSOLUTE ("إلى"/"الى" — TO a stated total) is checked FIRST and wins over the relative
 * markers below it, because «رفعت ميزانيتي إلى 4000» contains BOTH "رفعت" (raise, a relative
 * marker) AND "إلى 4000" (to 4000, the actual absolute target) in the same sentence — the
 * founder's own production phrasing. Absolute markers also cover «خليها 4000» / «خليتها
 * 4000» ("make it 4000") — a target stated without "raise/lower" at all.
 */
export function parseCounterfactualDelta(text: string): CounterfactualDelta | null {
  const x = norm(text);

  const abs = x.match(/(?:الى|إلى|خليها|خليتها|خله|خلها|تكون)\D{0,10}?(\d{2,6})/);
  if (abs) return { kind: 'absolute', value: Number(abs[1]) };

  const inc = x.match(/(?:زدت|زياده|زيادة|رفعت|زاد|increase|raise|add)\D{0,20}?(\d{2,6})/);
  if (inc) return { kind: 'relative', direction: 'increase', amount: Number(inc[1]) };

  const dec = x.match(/(?:نزلت|خفضت|قللت|نقصت|تنزيل|decrease|lower|reduce|drop)\D{0,20}?(\d{2,6})/);
  if (dec) return { kind: 'relative', direction: 'decrease', amount: Number(dec[1]) };

  // "cheapest", checked ONLY after every number-bearing form fails to match — a sentence
  // that names an actual amount always means that amount, never a vague "cheaper" fallback.
  if (/ارخص|أرخص|اوفر|أوفر|cheaper|cheapest/.test(x)) return { kind: 'cheapest' };

  return null;
}

/**
 * The adjusted budget a counterfactual delta implies, never negative.
 *
 * Never actually called with `kind: 'cheapest'` — `mutation-turn.ts` branches to
 * `compareCheaperOption` before reaching this function, since "cheaper" re-ranks existing
 * candidates rather than computing a new budget at all. The explicit branch below exists
 * only so this stays exhaustive for the type checker rather than silently falling through.
 */
export function applyCounterfactualDelta(currentBudget: number, delta: CounterfactualDelta): number {
  if (delta.kind === 'absolute') return Math.max(0, delta.value);
  if (delta.kind === 'cheapest') return currentBudget;
  return delta.direction === 'increase'
    ? currentBudget + delta.amount
    : Math.max(0, currentBudget - delta.amount);
}

export interface CounterfactualComparison {
  /** Which question this comparison answers — the card needs it to pick the right header and
   *  whether a "what do you give up" section applies at all (2026-08-10, Part A/C). */
  kind: 'budget' | 'cheapest';
  changed: boolean;
  /** Was NOT within budget before, IS within budget after — the "unlocks a new option" case. */
  newlyUnlocked: boolean;
  before: { title_ar: string | null; title_en: string | null; unit_price: number | null; budget_satisfied: boolean };
  after: { title_ar: string | null; title_en: string | null; unit_price: number | null; budget_satisfied: boolean };
  price_delta: number | null;
  /**
   * "وهل يستاهل؟" (is it worth it?) — Section 8's own required framing. `null` when the
   * pick did not change (nothing to weigh) or a priority-linked benefit cannot be
   * evidence-backed; NEVER guessed from category stereotypes ("phones are usually better
   * with more budget") — only from a REASON the engine itself attached to the new pick that
   * ALSO matches a priority the shopper stated. See `worthItReasons` below for exactly which
   * evidence qualifies.
   */
  worth_it: boolean | null;
  worth_it_reasons_ar: string[];
  /**
   * "وش أتنازل عنه لو أبي أوفر؟" (what do I give up if I want to save money?) — one of the
   * founder's own named example follow-ups (2026-08-10). Only meaningful for `kind:
   * 'cheapest'`; always `[]` for a budget comparison. Populated ONLY from reasons the engine
   * itself attached to the BEFORE pick that it did NOT also attach to the cheaper AFTER pick
   * — never guessed. An empty array on a CHANGED cheaper pick is a real, distinct signal
   * (see `compareCheaperOption`): the caller must render an honest "not enough evidence"
   * caveat, not silence.
   */
  giveUp_reasons_ar: string[];
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

  // MEASURED (2026-08-09, D→E mission Section 11 laptop journey — isolated, reproducible, NOT
  // the cross-fork contamination first suspected): a category/query the decision engine has
  // not reached smart-pick confidence for (this exact gaming-laptop budget+priority
  // combination returned 4 real recommendations, none flagged `is_smart_pick`) made this
  // function return null for EVERY counterfactual turn regardless of phrasing — an engine-
  // confidence gap, not a parser bug. Returning null here left "what if I lower my budget?"
  // completely unanswered: `mutation-turn.ts`'s `no_context` outcome leaves the screen exactly
  // as it was, which reads as "nothing happened", not as the honest disclosure Section 0
  // requires. The honest answer is not silence — it is the same "no confident single pick yet"
  // disclosure the plain results view already gives via «خيارات أخرى مناسبة» (other suitable
  // options, no hero pick), now surfaced through the counterfactual panel too.
  if (!b && !a) {
    return {
      kind: 'budget',
      changed: false,
      newlyUnlocked: false,
      before: { title_ar: null, title_en: null, unit_price: null, budget_satisfied: before.budget_satisfied ?? true },
      after: { title_ar: null, title_en: null, unit_price: null, budget_satisfied: after.budget_satisfied ?? true },
      price_delta: null,
      worth_it: null,
      worth_it_reasons_ar: [],
      giveUp_reasons_ar: [],
      explanation_ar: `لا نملك ترشيحًا واثقًا بما يكفي للمقارنة بين الميزانيتين — نعرض كل الخيارات المتاحة بدلًا من ترشيح واحد.`,
      explanation_en: `We don't have a single confident pick yet to compare the two budgets — every available option is shown instead of one recommendation.`,
    };
  }

  const changed = b?.canonical_id !== a?.canonical_id;
  const beforeSatisfied = before.budget_satisfied ?? true;
  const afterSatisfied = after.budget_satisfied ?? true;
  const newlyUnlocked = !beforeSatisfied && afterSatisfied;
  const price_delta =
    a?.unit_price != null && b?.unit_price != null ? Math.round(a.unit_price - b.unit_price) : null;

  // "هل يستاهل؟" — ONLY from reasons the engine itself already attached to the new pick that
  // it did NOT also attach to the old pick (a genuinely NEW capability the extra budget
  // bought), never a category-stereotype guess. `reasons_ar` already carries provenance
  // (identity/fit/spec/evidence/estimate/caution, ADR-187) — this reads it, never invents it.
  const newReasons = changed
    ? (a?.reasons_ar ?? []).filter((r) => !(b?.reasons_ar ?? []).includes(r))
    : [];
  const worthItReasons = newReasons.filter((r) => /fit|أفضل|أوفر|أعلى|أكبر|أسرع|كاميرا|بطارية|شاشة|كرت شاشة/.test(r));
  const worth_it = changed ? worthItReasons.length > 0 : null;

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
    kind: 'budget',
    changed,
    newlyUnlocked,
    before: { title_ar: b?.title_ar ?? null, title_en: b?.title_en ?? null, unit_price: b?.unit_price ?? null, budget_satisfied: beforeSatisfied },
    after: { title_ar: a?.title_ar ?? null, title_en: a?.title_en ?? null, unit_price: a?.unit_price ?? null, budget_satisfied: afterSatisfied },
    price_delta,
    worth_it,
    worth_it_reasons_ar: worthItReasons,
    giveUp_reasons_ar: [],
    explanation_ar,
    explanation_en,
  };
}

/**
 * "طيب ارخص" / "وش أتنازل عنه لو أبي أوفر؟" (2026-08-10, D→E mission Part A/C — two of the
 * founder's own named example follow-ups). Deliberately built on the SAME already-fetched
 * `AdvisorResponse.recommendations` array a shopper is already looking at — no new
 * decision-engine call, no re-derived eligibility or ranking. Every candidate in that array
 * already cleared `decide()`'s own eligibility gate; this only re-sorts by cost and diffs
 * two ALREADY-VETTED picks, exactly the "engines decide, this only compares" discipline
 * `compareCounterfactual` above follows for a budget change.
 *
 * Returns null only when there is truly nothing prices to compare (no candidate carries a
 * cost at all) — an honest "nothing to say", never a fabricated one.
 */
export function compareCheaperOption(current: AdvisorResponse): CounterfactualComparison | null {
  const b = current.smart_pick ?? null;
  const candidates = current.recommendations ?? [];
  const costOf = (r: AdvisorRecommendation) => r.total_cost_estimate ?? r.unit_price ?? null;
  const withCost = candidates.filter((r) => costOf(r) != null);
  if (!withCost.length) return null;
  const a = withCost.reduce((min, r) => (costOf(r)! < costOf(min)! ? r : min), withCost[0]);

  const changed = b?.canonical_id !== a.canonical_id;
  const price_delta = a.unit_price != null && b?.unit_price != null ? Math.round(a.unit_price - b.unit_price) : null;

  // "وش أتنازل عنه؟" — ONLY reasons the engine attached to the pick being LEFT (before) that
  // it did NOT also attach to the cheaper pick (after) — the mirror image of `worthItReasons`
  // above. An empty array on a changed pick is a real, distinct signal: the engine's own
  // evidence does not name a specific tradeoff, so the caller must say so honestly rather
  // than stay silent or invent one ("smaller screen", "less RAM") that was never measured.
  const lostReasons = changed
    ? (b?.reasons_ar ?? []).filter((r) => !a.reasons_ar.includes(r))
    : [];
  const giveUpReasons = lostReasons.filter((r) => /fit|أفضل|أوفر|أعلى|أكبر|أسرع|كاميرا|بطارية|شاشة|كرت شاشة|سعة/.test(r));

  let explanation_ar: string;
  let explanation_en: string;
  if (!changed) {
    const title = a.title_ar ?? a.title_en ?? '';
    const titleEn = a.title_en ?? a.title_ar ?? '';
    explanation_ar = `"${title}" هو بالفعل الأرخص ضمن خياراتك الموثّقة — لا يوجد خيار أوفر منه.`;
    explanation_en = `"${titleEn}" is already the cheapest of your documented options — nothing cheaper is available.`;
  } else {
    const title = a.title_ar ?? a.title_en ?? '';
    const titleEn = a.title_en ?? a.title_ar ?? '';
    const deltaAr = price_delta != null ? ` — أوفر بـ${Math.abs(price_delta)} ريال` : '';
    const deltaEn = price_delta != null ? ` — ${Math.abs(price_delta)} SAR cheaper` : '';
    explanation_ar = `الأرخص ضمن خياراتك الموثّقة هو "${title}"${deltaAr}، لكنه ليس بالضرورة الأنسب لاستخدامك.`;
    explanation_en = `The cheapest of your documented options is "${titleEn}"${deltaEn} — not necessarily the best fit for your use.`;
  }

  return {
    kind: 'cheapest',
    changed,
    newlyUnlocked: false,
    before: { title_ar: b?.title_ar ?? null, title_en: b?.title_en ?? null, unit_price: b?.unit_price ?? null, budget_satisfied: current.budget_satisfied ?? true },
    after: { title_ar: a.title_ar ?? null, title_en: a.title_en ?? null, unit_price: a.unit_price ?? null, budget_satisfied: current.budget_satisfied ?? true },
    price_delta,
    worth_it: null, // "worth it" only applies to a benefit gained by spending MORE — not this direction
    worth_it_reasons_ar: [],
    giveUp_reasons_ar: giveUpReasons,
    explanation_ar,
    explanation_en,
  };
}
