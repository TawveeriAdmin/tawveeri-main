/**
 * COUNTERFACTUAL REASONING (Unified Intelligence mission, Section 12 — 2026-08-09). The
 * North Star's own example: «لو زدت الميزانية 500 وش بيتغير؟». Pins the parser (never
 * guesses an amount) and the comparison (built ONLY from two real decision-engine answers,
 * never fabricates a comparison from nothing).
 */
import { parseCounterfactualDelta, applyCounterfactualDelta, compareCounterfactual } from "@/lib/agent/counterfactual";
import type { AdvisorResponse, AdvisorRecommendation } from "@/lib/agent/advisor-api";

const pick = (over: Partial<AdvisorRecommendation> = {}): AdvisorRecommendation => ({
  canonical_id: "c1", tps_identity_key: "k", title_ar: "مكيف أ", title_en: "AC A",
  brand: "gree", unit_price: 2000, total_cost_estimate: 2500,
  cost_breakdown: { unit: 2000, installation: 350, annual_electricity: 150 },
  store_count: 2, comparison_available: true, suitability_score: 0.8, confidence: 80,
  is_smart_pick: true, reasons_ar: [], dna: {}, go_offer_hint: "c1", go_url: "/go/1", ...over,
});

const resp = (over: Partial<AdvisorResponse> = {}): AdvisorResponse => ({
  version: "v1", task: { category: "air_conditioner" }, supported: true, count: 1,
  recommendations: [], smart_pick: null, budget_satisfied: true, ...over,
});

describe("parseCounterfactualDelta — never guesses an amount", () => {
  it("parses an increase: «لو زدت الميزانية 500 وش بيتغير؟»", () => {
    expect(parseCounterfactualDelta("لو زدت الميزانية 500 وش بيتغير؟")).toEqual({ direction: "increase", amount: 500 });
  });
  it("parses an increase: «لو رفعت 300»", () => {
    expect(parseCounterfactualDelta("لو رفعت 300 وش الفرق")).toEqual({ direction: "increase", amount: 300 });
  });
  it("parses a decrease: «لو نزلت الميزانية 200»", () => {
    expect(parseCounterfactualDelta("لو نزلت الميزانية 200")).toEqual({ direction: "decrease", amount: 200 });
  });
  it("handles Arabic-Indic digits: «لو زدت ٥٠٠»", () => {
    expect(parseCounterfactualDelta("لو زدت ٥٠٠")).toEqual({ direction: "increase", amount: 500 });
  });
  it("English: «what if I increase it by 500»", () => {
    expect(parseCounterfactualDelta("what if I increase it by 500")).toEqual({ direction: "increase", amount: 500 });
  });
  it("returns null when no amount is nameable — never guesses", () => {
    expect(parseCounterfactualDelta("لو زدت الميزانية شوي")).toBeNull();
    expect(parseCounterfactualDelta("مكيف لغرفة 30 متر")).toBeNull();
  });
});

describe("applyCounterfactualDelta", () => {
  it("increases the budget", () => {
    expect(applyCounterfactualDelta(4000, { direction: "increase", amount: 500 })).toBe(4500);
  });
  it("decreases the budget, never below zero", () => {
    expect(applyCounterfactualDelta(400, { direction: "decrease", amount: 500 })).toBe(0);
  });
});

describe("compareCounterfactual — built ONLY from two real decision-engine answers", () => {
  it("returns null when neither side has a smart pick — never fabricates a comparison", () => {
    expect(compareCounterfactual(resp(), resp(), 4500)).toBeNull();
  });

  it("detects no change — the same pick wins at both budgets", () => {
    const before = resp({ smart_pick: pick({ canonical_id: "c1", unit_price: 2000 }), budget_satisfied: true });
    const after = resp({ smart_pick: pick({ canonical_id: "c1", unit_price: 2000 }), budget_satisfied: true });
    const cmp = compareCounterfactual(before, after, 4500)!;
    expect(cmp.changed).toBe(false);
    expect(cmp.newlyUnlocked).toBe(false);
    expect(cmp.explanation_ar).toMatch(/لا يتغير الترشيح/);
  });

  it("detects a newly-unlocked option (was not within budget, now is)", () => {
    const before = resp({ smart_pick: pick({ canonical_id: "cheap", unit_price: 3800 }), budget_satisfied: false });
    const after = resp({ smart_pick: pick({ canonical_id: "better", title_ar: "مكيف ب", unit_price: 4400 }), budget_satisfied: true });
    const cmp = compareCounterfactual(before, after, 4500)!;
    expect(cmp.changed).toBe(true);
    expect(cmp.newlyUnlocked).toBe(true);
    expect(cmp.explanation_ar).toMatch(/يصبح.*متاحًا ضمن الميزانية/);
  });

  it("detects a changed pick with a price delta, when both were already within budget", () => {
    const before = resp({ smart_pick: pick({ canonical_id: "c1", title_ar: "مكيف أ", unit_price: 2000 }), budget_satisfied: true });
    const after = resp({ smart_pick: pick({ canonical_id: "c2", title_ar: "مكيف ب", unit_price: 2600 }), budget_satisfied: true });
    const cmp = compareCounterfactual(before, after, 4500)!;
    expect(cmp.changed).toBe(true);
    expect(cmp.newlyUnlocked).toBe(false);
    expect(cmp.price_delta).toBe(600);
    expect(cmp.explanation_ar).toMatch(/\+600 ريال/);
  });

  it("honestly says no option exists when the 'after' side has no smart pick", () => {
    const before = resp({ smart_pick: pick({ canonical_id: "c1" }), budget_satisfied: true });
    const after = resp({ smart_pick: null });
    const cmp = compareCounterfactual(before, after, 1000)!;
    expect(cmp.explanation_ar).toMatch(/لا يتوفر خيار موثّق/);
  });
});
