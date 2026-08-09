/**
 * COUNTERFACTUAL REASONING (Unified Intelligence mission, Section 12 — 2026-08-09; fixed
 * 2026-08-09, D→E mission Section 1 — the founder's own production failure).
 *
 * MEASURED PRODUCTION FAILURE: «طيب لو رفعت ميزانيتي إلى 4000 ريال وش بيتغير؟» on a 3000 SAR
 * baseline produced a phantom SAR 7000 budget. "رفعت" (raise) is a RELATIVE marker, but
 * "إلى 4000" (TO 4000) states an ABSOLUTE target — the old parser only understood relative
 * deltas, so it added 4000 to the existing 3000. These tests pin the fix: absolute markers
 * ("إلى") must win over relative ones in the same sentence, and every caller must handle
 * both kinds — there is no single "amount" that always means "add this much" anymore.
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

describe("parseCounterfactualDelta — absolute vs relative, never guesses an amount", () => {
  it("THE FOUNDER'S EXACT FAILURE: «رفعت ميزانيتي إلى 4000» is ABSOLUTE, not relative +4000", () => {
    const delta = parseCounterfactualDelta("طيب لو رفعت ميزانيتي إلى 4000 ريال وش بيتغير؟ وهل يستاهل أدفع الزيادة؟");
    expect(delta).toEqual({ kind: "absolute", value: 4000 });
    // The regression check: applying this to a 3000 baseline must yield 4000, never 7000.
    expect(applyCounterfactualDelta(3000, delta!)).toBe(4000);
  });

  it("parses a genuine RELATIVE increase (no \"إلى\"): «لو زدت الميزانية 500 وش بيتغير؟»", () => {
    expect(parseCounterfactualDelta("لو زدت الميزانية 500 وش بيتغير؟")).toEqual({ kind: "relative", direction: "increase", amount: 500 });
  });
  it("parses a RELATIVE increase: «لو رفعت 300» (no target stated, no \"إلى\")", () => {
    expect(parseCounterfactualDelta("لو رفعت 300 وش الفرق")).toEqual({ kind: "relative", direction: "increase", amount: 300 });
  });
  it("parses a RELATIVE decrease: «لو نزلت الميزانية 200»", () => {
    expect(parseCounterfactualDelta("لو نزلت الميزانية 200")).toEqual({ kind: "relative", direction: "decrease", amount: 200 });
  });
  it("parses an ABSOLUTE target via «خليها»: «خليها 3500»", () => {
    expect(parseCounterfactualDelta("خليها 3500")).toEqual({ kind: "absolute", value: 3500 });
  });
  it("handles Arabic-Indic digits: «لو زدت ٥٠٠»", () => {
    expect(parseCounterfactualDelta("لو زدت ٥٠٠")).toEqual({ kind: "relative", direction: "increase", amount: 500 });
  });
  it("English: «what if I increase it by 500»", () => {
    expect(parseCounterfactualDelta("what if I increase it by 500")).toEqual({ kind: "relative", direction: "increase", amount: 500 });
  });
  it("returns null when no amount is nameable — never guesses", () => {
    expect(parseCounterfactualDelta("لو زدت الميزانية شوي")).toBeNull();
    expect(parseCounterfactualDelta("مكيف لغرفة 30 متر")).toBeNull();
  });
});

describe("applyCounterfactualDelta", () => {
  it("relative: increases the budget", () => {
    expect(applyCounterfactualDelta(4000, { kind: "relative", direction: "increase", amount: 500 })).toBe(4500);
  });
  it("relative: decreases the budget, never below zero", () => {
    expect(applyCounterfactualDelta(400, { kind: "relative", direction: "decrease", amount: 500 })).toBe(0);
  });
  it("absolute: sets the budget outright, ignoring the current value", () => {
    expect(applyCounterfactualDelta(3000, { kind: "absolute", value: 4000 })).toBe(4000);
    expect(applyCounterfactualDelta(9000, { kind: "absolute", value: 4000 })).toBe(4000);
  });
  it("absolute: never negative", () => {
    expect(applyCounterfactualDelta(3000, { kind: "absolute", value: -100 })).toBe(0);
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
    expect(cmp.worth_it).toBeNull(); // nothing changed — no worth-it question to answer
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

  it("\"هل يستاهل؟\" — worth_it is true only when the new pick has a reason the old pick did not (a real new capability)", () => {
    const before = resp({ smart_pick: pick({ canonical_id: "c1", unit_price: 2000, reasons_ar: ["سعر موثوق"] }), budget_satisfied: true });
    const after = resp({ smart_pick: pick({ canonical_id: "c2", unit_price: 2600, reasons_ar: ["سعر موثوق", "كاميرا أفضل"] }), budget_satisfied: true });
    const cmp = compareCounterfactual(before, after, 4500)!;
    expect(cmp.worth_it).toBe(true);
    expect(cmp.worth_it_reasons_ar).toContain("كاميرا أفضل");
  });

  it("worth_it is false when the pick changed but nothing NEW was gained (e.g. just a name/spec swap with no qualifying reason)", () => {
    const before = resp({ smart_pick: pick({ canonical_id: "c1", unit_price: 2000, reasons_ar: ["سعر موثوق"] }), budget_satisfied: true });
    const after = resp({ smart_pick: pick({ canonical_id: "c2", unit_price: 2600, reasons_ar: ["سعر موثوق"] }), budget_satisfied: true });
    const cmp = compareCounterfactual(before, after, 4500)!;
    expect(cmp.worth_it).toBe(false);
  });
});
