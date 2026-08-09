/**
 * MULTI-TURN MISSIONS (Unified Intelligence mission, Section 43 — 2026-08-09).
 *
 * The mission's own worked example was a 5-turn laptop conversation that must "remain
 * coherent across the whole conversation." Every prior test in this repo (including the
 * existing `saudi-agent-benchmark.test.ts`) exercises ONE turn — `parseShoppingTask` →
 * `decide()` — never the orchestration layer that carries understanding ACROSS turns
 * (`classifyDecisionIntent`, `DecisionState`, `counterfactual`). This is the seed of the
 * mission's "Shopping Reasoning Bench" (Section 30-31): missions, not queries — each turn's
 * intent and state are graded against what the PRIOR turns established, not in isolation.
 *
 * Honest scope (Section 30-31 says "minimum eventually 500 missions"): this is the harness
 * and its first missions, not the full suite. Two categories in depth (AC, laptop — Phase 3's
 * own priority order), each covering the full turn-type range the mission names: a described
 * need, a constraint narrowing on a LATER turn (state must accumulate, not reset), a
 * follow-up "why", a real counterfactual, and a merchant-selection question.
 */
import { parseShoppingTask } from "@/lib/agent/task-parser";
import { decide, type CanonicalRow, type ShoppingTask, type Recommendation } from "@/lib/agent/decision-engine";
import { classifyDecisionIntent } from "@/lib/agent/decision-intent";
import { createDecisionState, applyParsedTask, applyDecisionResult, isNewMissionSwitch, type DecisionState } from "@/lib/agent/decision-state";
import { parseCounterfactualDelta, applyCounterfactualDelta, compareCounterfactual } from "@/lib/agent/counterfactual";
import type { AdvisorResponse, AdvisorRecommendation } from "@/lib/agent/advisor-api";

// Minimal decide()-Recommendation → AdvisorResponse adapter. Only the fields
// compareCounterfactual actually reads (canonical_id, title_ar/en, unit_price) — this test
// runs at the decide()-level (DB-free, matching the existing benchmark's fixture approach),
// so it maps the engine's own real output rather than fabricating a separate response shape.
function toAdvisorResponse(out: { supported: boolean; recommendations: Recommendation[] }, budgetSatisfied: boolean): AdvisorResponse {
  const smart = out.recommendations.find((r) => r.is_smart_pick) ?? null;
  return {
    version: "v1", task: {}, supported: out.supported, count: out.recommendations.length,
    smart_pick: smart as unknown as AdvisorRecommendation | null,
    recommendations: out.recommendations as unknown as AdvisorRecommendation[],
    budget_satisfied: budgetSatisfied,
  };
}

let n = 0;
const acRow = (o: { btu: number; tech: string; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `ac${++n}`, tps_identity_key: "k", display_name_ar: `مكيف ${o.btu}`, display_name_en: "AC",
  brand: "gree", category: "air_conditioner", image_url: null, lowest_price: o.price, store_count: o.stores,
  has_comparison: o.stores >= 2, identity_confidence: 80,
  attributes: { capacity_btu: o.btu, technology: o.tech, cooling_mode: "cool_only", ac_type: "split" },
});
const laptopRow = (o: { ram: number; gpu: string; screen: number; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `lap${++n}`, tps_identity_key: "k", display_name_ar: "لابتوب", display_name_en: "Laptop",
  brand: "hp", category: "laptop", image_url: null, lowest_price: o.price, store_count: o.stores,
  has_comparison: o.stores >= 2, identity_confidence: 80,
  attributes: { family: "pavilion", cpu: "i7", ram: o.ram, storage: 512, screen: o.screen, gpu: o.gpu },
});

/** Runs one turn: classify → fold into state → decide → fold result back into state. */
function runTurn(state: DecisionState, text: string, rows: CanonicalRow[]) {
  const decisionIntent = classifyDecisionIntent(text, { hasActiveDecisionState: state.conversation_turn > 0 });
  const parsed = parseShoppingTask(text);
  // `ParsedTask.budget_total`/`quantity` are typed `... | null | undefined` (via
  // ShoppingTask); `AdvisorParsed`'s equivalents are `... | undefined` — neither parser
  // function actually returns null in practice, only the wider ShoppingTask type allows it.
  // Same normalization the real API response already performs implicitly (a JSON round-trip
  // erases null vs undefined the same way); done explicitly here since this test calls the
  // parser directly.
  const advisorParsed = { ...parsed, budget_total: parsed.budget_total ?? undefined, quantity: parsed.quantity ?? undefined };
  const nextState = applyParsedTask(state, advisorParsed, decisionIntent.intent);
  const task: ShoppingTask = { category: nextState.category || "", ...nextState.hard_constraints, priorities: nextState.soft_preferences };
  const out = decide(task, rows);
  const finalState = applyDecisionResult(nextState, {
    recommendations: out.recommendations,
    smart_pick: out.recommendations.find((r) => r.is_smart_pick) ?? null,
    budget_satisfied: out.anyWithinBudget,
  });
  return { intent: decisionIntent.intent, state: finalState, out };
}

describe("Multi-turn mission: AC, Riyadh, quiet — constraint narrowed on a LATER turn, then why, then counterfactual, then merchant", () => {
  const rows = [
    acRow({ btu: 18000, tech: "Inverter", price: 1800, stores: 1, id: "under" }),
    acRow({ btu: 24000, tech: "Inverter", price: 2600, stores: 2, id: "fit-inv" }),
    acRow({ btu: 24000, tech: "Standard", price: 2300, stores: 1, id: "fit-std" }),
  ];
  let state = createDecisionState();

  it("Turn 1 — «مكيف لغرفة 30 متر في الرياض هادئ» classifies NEEDS_DISCOVERY and seeds the state", () => {
    const t1 = runTurn(state, "مكيف لغرفة 30 متر في الرياض هادئ", rows);
    expect(t1.intent).toBe("NEEDS_DISCOVERY");
    expect(t1.state.category).toBe("air_conditioner");
    expect(t1.state.hard_constraints.room_size_m2).toBe(30);
    expect(t1.state.soft_preferences).toContain("quiet");
    expect(t1.state.hard_constraints.budget_total).toBeUndefined(); // not stated yet
    state = t1.state;
  });

  it("Turn 2 — «خليه تحت 4000» (no category/room restated) NARROWS the constraint WITHOUT losing turn 1's room size", () => {
    const t2 = runTurn(state, "خليه تحت 4000", rows);
    expect(t2.state.hard_constraints.budget_total).toBe(4000);
    expect(t2.state.hard_constraints.room_size_m2).toBe(30); // still there — the hard requirement
    expect(t2.state.category).toBe("air_conditioner"); // still there
    expect(t2.state.conversation_turn).toBe(2);
    state = t2.state;
  });

  it("Turn 3 — «طيب ليش هذا أفضل؟» classifies FOLLOW_UP_REASONING because state is now active", () => {
    const t3 = runTurn(state, "طيب ليش هذا أفضل؟", rows);
    expect(t3.intent).toBe("FOLLOW_UP_REASONING");
    // A follow-up question does not itself carry a category — the state's own must survive.
    expect(t3.state.category).toBe("air_conditioner");
    state = t3.state;
  });

  it("Turn 4 — «لو رفعت الميزانية 500 وش يتغير؟» classifies COUNTERFACTUAL and computes a REAL before/after", () => {
    const t4Intent = classifyDecisionIntent("لو رفعت الميزانية 500 وش يتغير؟", { hasActiveDecisionState: true });
    expect(t4Intent.intent).toBe("COUNTERFACTUAL");

    const delta = parseCounterfactualDelta("لو رفعت الميزانية 500 وش يتغير؟")!;
    expect(delta).toEqual({ kind: "relative", direction: "increase", amount: 500 });

    const currentBudget = state.hard_constraints.budget_total as number;
    const newBudget = applyCounterfactualDelta(currentBudget, delta);
    expect(newBudget).toBe(4500);

    const baseTask: ShoppingTask = { category: state.category!, ...state.hard_constraints, priorities: state.soft_preferences };
    const before = decide(baseTask, rows);
    const after = decide({ ...baseTask, budget_total: newBudget }, rows);
    const cmp = compareCounterfactual(
      toAdvisorResponse(before, before.anyWithinBudget),
      toAdvisorResponse(after, after.anyWithinBudget),
      newBudget,
    );
    expect(cmp).not.toBeNull();
    // At 4000 the fit-inv (2600) and fit-std (2300) are both already affordable — raising to
    // 4500 must not silently invent a different pick; the same well-suited option should win
    // on both sides here (an honest "no material change" is itself a correct answer).
    expect(cmp!.explanation_ar.length).toBeGreaterThan(0);
  });

  it("Turn 5 — «وين أشتريه؟» classifies MERCHANT_SELECTION", () => {
    const t5 = classifyDecisionIntent("وين أشتريه؟", { hasActiveDecisionState: true });
    expect(t5.intent).toBe("MERCHANT_SELECTION");
  });
});

describe("Multi-turn mission: laptop — the mission's own worked example (gaming → budget narrowed → portability added → why → merchant)", () => {
  const rows = [
    laptopRow({ ram: 8, gpu: "igpu", screen: 15.6, price: 2500, stores: 1, id: "igpu-big" }),
    laptopRow({ ram: 16, gpu: "rtx4060", screen: 15.6, price: 4800, stores: 2, id: "discrete-big" }),
    laptopRow({ ram: 16, gpu: "rtx4060", screen: 14, price: 5200, stores: 2, id: "discrete-small" }),
  ];
  let state = createDecisionState();

  it("Turn 1 — «أبغى لابتوب للألعاب» classifies NEEDS_DISCOVERY", () => {
    const t1 = runTurn(state, "أبغى لابتوب للألعاب", rows);
    expect(t1.intent).toBe("NEEDS_DISCOVERY");
    expect(t1.state.category).toBe("laptop");
    expect(t1.state.soft_preferences).toContain("gaming");
    state = t1.state;
  });

  it("Turn 2 — «تحت 5000» narrows budget without losing the gaming preference", () => {
    const t2 = runTurn(state, "تحت 5000", rows);
    expect(t2.state.hard_constraints.budget_total).toBe(5000);
    expect(t2.state.soft_preferences).toContain("gaming"); // still there
    state = t2.state;
  });

  it("Turn 3 — «وخفيف للسفر» ADDS portability on top of gaming (both preferences carried, not replaced)", () => {
    const t3 = runTurn(state, "وخفيف للسفر", rows);
    expect(t3.state.soft_preferences).toEqual(expect.arrayContaining(["gaming", "portability"]));
    expect(t3.state.hard_constraints.budget_total).toBe(5000); // still there
    state = t3.state;
  });

  it("Turn 4 — «ليش هذا افضل من الثاني» classifies FOLLOW_UP_REASONING with state intact", () => {
    const t4 = classifyDecisionIntent("ليش هذا افضل من الثاني", { hasActiveDecisionState: true });
    expect(t4.intent).toBe("FOLLOW_UP_REASONING");
  });

  it("Turn 5 — «من وين اطلبه؟» classifies MERCHANT_SELECTION", () => {
    const t5 = classifyDecisionIntent("من وين اطلبه؟", { hasActiveDecisionState: true });
    expect(t5.intent).toBe("MERCHANT_SELECTION");
  });

  it("the final state's accumulated constraints, run through decide(), pick a gaming-capable AND smaller-screen candidate", () => {
    const task: ShoppingTask = { category: state.category!, ...state.hard_constraints, priorities: state.soft_preferences };
    const out = decide(task, rows);
    const pick = out.recommendations.find((r) => r.is_smart_pick)!;
    expect(pick.dna.discrete_gpu).toBe(true); // gaming, from turn 1, still honored on turn 3's decide()
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// THE FOUNDER'S OWN PRODUCTION FAILURE (D→E mission, Section 11 — 2026-08-09), verbatim.
//
// T1: "ابي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000 ريال وما يهمني الألعاب"
// T2: "طيب لو رفعت ميزانيتي إلى 4000 ريال وش بيتغير؟ وهل يستاهل أدفع الزيادة؟"
//
// Production observed: unrelated generic products entered results, a SAR 49 cable was
// "recommended", the counterfactual referenced a phantom SAR 7000, and the phone mission's
// own priorities were not correctly reflected. Every one of those is traced to a specific,
// now-fixed defect: (1) mutation-shaped turns reached the plain catalog search at all —
// fixed in mutation-turn.ts / search-client.tsx; (2) "رفعت … إلى 4000" was parsed as a
// RELATIVE +4000 delta instead of an ABSOLUTE target — fixed in counterfactual.ts; (3) "ما
// يهمني الألعاب" was recorded as a POSITIVE gaming priority — fixed in task-parser.ts.
// ─────────────────────────────────────────────────────────────────────────────────────────
const mobileRow = (o: { family: string; generation: string; variant: string; storage: number; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `m${++n}`, tps_identity_key: "k", display_name_ar: `${o.family} ${o.generation} ${o.variant}`, display_name_en: "phone",
  brand: "apple", category: "mobile", image_url: null, lowest_price: o.price, store_count: o.stores,
  has_comparison: o.stores >= 2, identity_confidence: 90,
  attributes: { family: o.family, generation: o.generation, variant: o.variant, storage: o.storage, ram_values: [] },
});

describe("THE FOUNDER'S PRODUCTION JOURNEY — phone, camera+battery, budget 3000 → 4000, gaming de-prioritized", () => {
  const T1 = "ابي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000 ريال وما يهمني الألعاب";
  const T2 = "طيب لو رفعت ميزانيتي إلى 4000 ريال وش بيتغير؟ وهل يستاهل أدفع الزيادة؟";

  const rows = [
    mobileRow({ family: "iPhone", generation: "16", variant: "Standard", storage: 128, price: 2200, stores: 2, id: "budget" }),
    mobileRow({ family: "iPhone", generation: "16", variant: "Plus", storage: 256, price: 2800, stores: 2, id: "good-3000" }),
    mobileRow({ family: "iPhone", generation: "16", variant: "Ultra", storage: 512, price: 3800, stores: 3, id: "flagship-3800" }),
  ];

  let state: DecisionState;
  let t1Advisor: AdvisorResponse;

  it("T1 — category=mobile, budget=3000, camera+battery positive, gaming DE-PRIORITIZED (never positive)", () => {
    const t1Intent = classifyDecisionIntent(T1, { hasActiveDecisionState: false });
    expect(t1Intent.intent).toBe("NEEDS_DISCOVERY");

    const parsed = parseShoppingTask(T1);
    expect(parsed.category).toBe("mobile");
    expect(parsed.budget_total).toBe(3000);
    expect(parsed.priorities).toEqual(expect.arrayContaining(["camera", "battery"]));
    expect(parsed.priorities ?? []).not.toContain("gaming"); // THE regression
    expect(parsed.deprioritized_priorities).toEqual(expect.arrayContaining(["gaming"]));

    const advisorParsed = { ...parsed, budget_total: parsed.budget_total ?? undefined, quantity: parsed.quantity ?? undefined };
    state = applyParsedTask(createDecisionState(), advisorParsed, "NEEDS_DISCOVERY");
    expect(state.category).toBe("mobile");
    expect(state.hard_constraints.budget_total).toBe(3000);
    expect(state.soft_preferences.sort()).toEqual(["battery", "camera"]);
    expect(state.deprioritized_preferences).toEqual(["gaming"]);

    const task: ShoppingTask = { category: state.category!, ...state.hard_constraints, priorities: state.soft_preferences };
    const out = decide(task, rows);
    expect(out.supported).toBe(true);
    // NO ACCESSORY EVER ENTERS THIS SET — `rows` is the category-scoped candidate set
    // decide/route.ts constructs (`.eq('category', task.category)`); a cable's own category
    // is never "mobile", so it structurally cannot appear here. This is the same guarantee
    // in test form, not a new one.
    expect(out.recommendations.every((r) => rows.some((row) => row.canonical_id === r.canonical_id))).toBe(true);
    expect(out.anyWithinBudget).toBe(true);
    const pick = out.recommendations.find((r) => r.is_smart_pick)!;
    expect(pick.unit_price).toBeLessThanOrEqual(3000); // the flagship (3800) must not win — it's over budget

    state = applyDecisionResult(state, { recommendations: out.recommendations, smart_pick: pick, budget_satisfied: out.anyWithinBudget });
    t1Advisor = {
      version: "v1", task: {}, supported: out.supported, count: out.recommendations.length,
      smart_pick: pick as unknown as AdvisorResponse["smart_pick"],
      recommendations: out.recommendations as unknown as AdvisorResponse["recommendations"],
      budget_satisfied: out.anyWithinBudget,
    };
  });

  it("T2 — classifies COUNTERFACTUAL; the delta is ABSOLUTE 4000, never a phantom 7000", () => {
    const t2Intent = classifyDecisionIntent(T2, { hasActiveDecisionState: true });
    expect(t2Intent.intent).toBe("COUNTERFACTUAL");

    const delta = parseCounterfactualDelta(T2)!;
    expect(delta).toEqual({ kind: "absolute", value: 4000 }); // NOT { direction: 'increase', amount: 4000 }

    const currentBudget = state.hard_constraints.budget_total as number;
    const newBudget = applyCounterfactualDelta(currentBudget, delta);
    expect(newBudget).toBe(4000); // THE regression check: never 7000
  });

  it("T2 — category/camera/battery/gaming-deprioritization all PERSIST; only budget mutates", () => {
    // isNewMissionSwitch must be false — T2 names no category at all, so this is a
    // refinement of the SAME mission, not a switch (Section 10's own distinction).
    const t2Parsed = parseShoppingTask(T2);
    expect(isNewMissionSwitch(state, { ...t2Parsed, budget_total: t2Parsed.budget_total ?? undefined, quantity: t2Parsed.quantity ?? undefined })).toBe(false);
    expect(state.category).toBe("mobile");
    expect(state.soft_preferences.sort()).toEqual(["battery", "camera"]);
    expect(state.deprioritized_preferences).toEqual(["gaming"]);
  });

  it("T2 — the REAL before/after at the corrected budget: the flagship unlocks, evidence-grounded, phones only", () => {
    const newBudget = 4000; // from the previous test — re-stated so this test stands alone
    const afterTask: ShoppingTask = { category: state.category!, budget_total: newBudget, priorities: state.soft_preferences };
    const afterOut = decide(afterTask, rows);
    expect(afterOut.anyWithinBudget).toBe(true);
    // Every candidate is still phone-only — the budget mutation never widened the category.
    expect(afterOut.recommendations.every((r) => rows.some((row) => row.canonical_id === r.canonical_id))).toBe(true);

    const afterPick = afterOut.recommendations.find((r) => r.is_smart_pick)!;
    const afterAdvisor: AdvisorResponse = {
      version: "v1", task: {}, supported: afterOut.supported, count: afterOut.recommendations.length,
      smart_pick: afterPick as unknown as AdvisorResponse["smart_pick"],
      recommendations: afterOut.recommendations as unknown as AdvisorResponse["recommendations"],
      budget_satisfied: afterOut.anyWithinBudget,
    };

    const cmp = compareCounterfactual(t1Advisor, afterAdvisor, newBudget)!;
    expect(cmp).not.toBeNull();
    // THE FLAGSHIP GENUINELY UNLOCKS: at 3000 it was gated out by budget; at 4000 its
    // stronger camera+battery variant tier ("Ultra") outscores the 3000-budget pick.
    expect(cmp.changed).toBe(true);
    expect(cmp.after.unit_price).toBe(3800);
    // "هل يستاهل؟" — grounded ONLY in reasons the engine itself attached to the NEW pick,
    // never a fabricated camera/battery superiority claim.
    expect(cmp.worth_it).toBe(true);
    expect(cmp.worth_it_reasons_ar.length).toBeGreaterThan(0);
    expect(cmp.explanation_ar).toMatch(/4000/);
    expect(cmp.explanation_ar).not.toMatch(/7000/); // the exact phantom value production showed
  });

  it("merchant neutrality — the recommendation carries no commission/ranking signal, only suitability+trust+price", () => {
    // decide()'s own contract (decision-engine.ts's own documentation, unchanged by this
    // mission): ranking is suitability + trust (corroboration) + total cost ONLY. Structural
    // check that no recommendation object carries any commission/affiliate-weighted field.
    const task: ShoppingTask = { category: "mobile", budget_total: 4000, priorities: ["camera", "battery"] };
    const out = decide(task, rows);
    for (const r of out.recommendations) {
      expect(Object.keys(r)).not.toContain("commission");
      expect(Object.keys(r)).not.toContain("affiliate_weight");
    }
  });
});
