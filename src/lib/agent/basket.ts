// src/lib/agent/basket.ts
// Multi-unit ("basket") HONESTY layer — the recorded treatment of quantity + aggregate
// budget (Founder directive 2026-08-04; baseline docs/baselines/2026-08-04-ac-basket-query).
//
// The decision engine prices and ranks ONE unit. When a shopper asks for N units with a
// total budget, pretending an individually-priced product answers the request is a
// fabricated fulfilment. This module does the two honest minimums, deterministically:
//   1. derive the per-unit ceiling (total ÷ N) so the engine reasons against a budget
//      that is actually available per device;
//   2. compose the acknowledgement the customer must see: quantity, category, total
//      budget, approximate per-unit ceiling, and what remains UNKNOWN (installation /
//      delivery inclusion). Unknown beats incorrect — nothing here estimates a basket.
// Full basket optimisation (mixed sets, per-room capacities) is deliberately OUT of
// scope — see the Basket Intent scoping note in DECISIONS.md.
import { categoryLabel } from "./advisor-api";

export interface BasketSummary {
  quantity: number;
  total_budget: number | null;
  per_unit_ceiling: number | null;
  note_ar: string;
  note_en: string;
}

/**
 * Build the basket acknowledgement for a task with quantity ≥ 2, or null when the
 * request is single-unit. Pure and template-only: every figure is supplied, none invented.
 */
export function buildBasketSummary(
  quantity: number | null | undefined,
  totalBudget: number | null | undefined,
  categorySlug: string,
): BasketSummary | null {
  const qty = typeof quantity === "number" && Number.isFinite(quantity) ? Math.floor(quantity) : null;
  if (!qty || qty < 2) return null;
  const budget = typeof totalBudget === "number" && Number.isFinite(totalBudget) && totalBudget > 0 ? totalBudget : null;
  const perUnit = budget ? Math.floor(budget / qty) : null;
  const catAr = categoryLabel(categorySlug, "ar") || "المنتج المطلوب";
  const catEn = categoryLabel(categorySlug, "en") || "the requested product";

  const note_ar = budget
    ? `فهمنا أنك تريد ${qty} × ${catAr} بميزانية إجمالية ${budget.toLocaleString("en-US")} ريال — أي نحو ${perUnit!.toLocaleString("en-US")} ريال للجهاز الواحد. الخيارات أدناه أسعار لجهاز واحد وليست سلة ${qty} أجهزة مؤكّدة، وشمول التركيب والتوصيل في السعر غير مؤكّد.`
    : `فهمنا أنك تريد ${qty} × ${catAr}. الخيارات أدناه أسعار لجهاز واحد وليست سلة مؤكّدة، وشمول التركيب والتوصيل في السعر غير مؤكّد.`;
  const note_en = budget
    ? `We understood you want ${qty} × ${catEn} with a total budget of ${budget.toLocaleString("en-US")} SAR — about ${perUnit!.toLocaleString("en-US")} SAR per unit. The options below are single-unit prices, not a verified ${qty}-unit basket, and whether installation/delivery is included is not confirmed.`
    : `We understood you want ${qty} × ${catEn}. The options below are single-unit prices, not a verified basket, and whether installation/delivery is included is not confirmed.`;

  return { quantity: qty, total_budget: budget, per_unit_ceiling: perUnit, note_ar, note_en };
}
