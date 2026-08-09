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
import { parseCounterfactualDelta, applyCounterfactualDelta, compareCounterfactual, compareCheaperOption } from "@/lib/agent/counterfactual";
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

  // "طيب ارخص" (2026-08-10, D→E mission Part A/C — one of the founder's own named example
  // follow-ups). Checked ONLY after every number-bearing form above returns null: a sentence
  // naming a real amount always means that amount, never falls back to "cheaper".
  it("«طيب ارخص؟» and «أوفر» parse as kind:'cheapest', with no amount to guess", () => {
    expect(parseCounterfactualDelta("طيب ارخص؟")).toEqual({ kind: "cheapest" });
    expect(parseCounterfactualDelta("أبيه أوفر")).toEqual({ kind: "cheapest" });
    expect(parseCounterfactualDelta("cheaper please")).toEqual({ kind: "cheapest" });
  });
  it("a number-bearing sentence never falls back to 'cheapest', even if it also says أرخص", () => {
    expect(parseCounterfactualDelta("لو رفعت الميزانية إلى 4000 عشان ألقى شي أرخص من قبل")).toEqual({ kind: "absolute", value: 4000 });
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
  it("cheapest: never called in practice (mutation-turn.ts branches away first) — returns the budget unchanged for type-exhaustiveness", () => {
    expect(applyCounterfactualDelta(3000, { kind: "cheapest" })).toBe(3000);
  });
});

describe("compareCheaperOption — re-ranks the SAME already-fetched, already-eligible candidates by cost, never re-fetches or re-derives eligibility", () => {
  it("returns null when no candidate carries a cost at all — honest 'nothing to say'", () => {
    const current = resp({ smart_pick: null, recommendations: [] });
    expect(compareCheaperOption(current)).toBeNull();
  });

  it("says the current pick is already the cheapest when no candidate beats it", () => {
    const smart = pick({ canonical_id: "c1", unit_price: 2000, total_cost_estimate: 2500 });
    const current = resp({ smart_pick: smart, recommendations: [smart, pick({ canonical_id: "c2", unit_price: 2800, total_cost_estimate: 3200 })] });
    const cmp = compareCheaperOption(current)!;
    expect(cmp.kind).toBe("cheapest");
    expect(cmp.changed).toBe(false);
    expect(cmp.explanation_ar).toMatch(/الأرخص/);
  });

  it("finds a genuinely cheaper eligible option and reports the price delta", () => {
    const smart = pick({ canonical_id: "c1", unit_price: 2500, total_cost_estimate: 2900, reasons_ar: ["سعة أكبر", "إنفرتر"] });
    const cheaper = pick({ canonical_id: "c2", unit_price: 1900, total_cost_estimate: 2100, reasons_ar: ["سعر موثوق"] });
    const current = resp({ smart_pick: smart, recommendations: [smart, cheaper] });
    const cmp = compareCheaperOption(current)!;
    expect(cmp.changed).toBe(true);
    expect(cmp.price_delta).toBe(1900 - 2500);
    // "وش أتنازل عنه؟" — only reasons the ORIGINAL pick had that the cheaper one lacks,
    // filtered to the same qualifying vocabulary compareCounterfactual's worth_it uses.
    expect(cmp.giveUp_reasons_ar).toEqual(["سعة أكبر"]);
  });

  it("gives an honest 'not enough evidence' signal (empty array, not a guess) when the engine's own reasons name no specific difference", () => {
    const smart = pick({ canonical_id: "c1", unit_price: 2500, total_cost_estimate: 2900, reasons_ar: ["سعر موثوق"] });
    const cheaper = pick({ canonical_id: "c2", unit_price: 1900, total_cost_estimate: 2100, reasons_ar: [] });
    const current = resp({ smart_pick: smart, recommendations: [smart, cheaper] });
    const cmp = compareCheaperOption(current)!;
    expect(cmp.changed).toBe(true);
    expect(cmp.giveUp_reasons_ar).toEqual([]);
  });

  it("works even with no smart pick at all — compares against the cheapest of the plain recommendations", () => {
    const cheaper = pick({ canonical_id: "c2", unit_price: 1500, total_cost_estimate: 1700, is_smart_pick: false });
    const other = pick({ canonical_id: "c3", unit_price: 3000, total_cost_estimate: 3400, is_smart_pick: false });
    const current = resp({ smart_pick: null, recommendations: [other, cheaper] });
    const cmp = compareCheaperOption(current)!;
    expect(cmp.changed).toBe(true);
    expect(cmp.after.unit_price).toBe(1500);
  });
});

describe("compareCounterfactual — built ONLY from two real decision-engine answers", () => {
  // MEASURED (2026-08-09, D→E mission Section 11 laptop journey — isolated, reproducible via
  // captured request/response bodies, not the cross-fork tab contamination first suspected): a
  // real gaming-laptop query at a real budget returned 4 real recommendations with NONE flagged
  // `is_smart_pick` — an engine-confidence gap, not a parser bug. The OLD behavior (return null)
  // made every counterfactual turn on that query a silent no-op: `mutation-turn.ts` reads null
  // as "no_context" and leaves the screen exactly as it was, which reads as "nothing happened"
  // rather than the honest disclosure Section 0 requires. It must never fabricate a pick, but it
  // must also never go silent — it now returns the same "no confident single pick yet"
  // disclosure the plain results view already gives via «خيارات أخرى مناسبة».
  it("never returns null when neither side has a smart pick — surfaces an honest disclosure instead of going silent", () => {
    const cmp = compareCounterfactual(resp(), resp(), 4500)!;
    expect(cmp).not.toBeNull();
    expect(cmp.changed).toBe(false);
    expect(cmp.worth_it).toBeNull();
    expect(cmp.before.title_ar).toBeNull();
    expect(cmp.after.title_ar).toBeNull();
    expect(cmp.explanation_ar).toMatch(/لا نملك ترشيحًا واثقًا/);
    expect(cmp.explanation_en).toMatch(/don't have a single confident pick/);
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
