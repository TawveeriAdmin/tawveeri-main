/**
 * SUGGESTED CONTEXTUAL FOLLOW-UPS (D→E mission, Section 9 — 2026-08-09). Every suggestion's
 * `prefill_ar` text must classify and execute correctly through the SAME pipeline
 * `mutation-turn.test.ts`/`multi-turn-missions.test.ts` already prove works — pinned here by
 * cross-checking against `classifyDecisionIntent` directly, so this file can never drift
 * into suggesting an action the pipeline does not actually honor.
 */
import { buildFollowUpSuggestions } from "@/lib/agent/follow-up-suggestions";
import { classifyDecisionIntent } from "@/lib/agent/decision-intent";
import { createDecisionState, applyParsedTask } from "@/lib/agent/decision-state";

describe("buildFollowUpSuggestions", () => {
  it("suggests raising the budget only when a budget is stated", () => {
    const withBudget = applyParsedTask(createDecisionState(), { category: "air_conditioner", budget_total: 4000 }, "NEEDS_DISCOVERY");
    expect(buildFollowUpSuggestions(withBudget).some((s) => s.key === "raise_budget")).toBe(true);

    const withoutBudget = applyParsedTask(createDecisionState(), { category: "air_conditioner" }, "NEEDS_DISCOVERY");
    expect(buildFollowUpSuggestions(withoutBudget).some((s) => s.key === "raise_budget")).toBe(false);
  });

  it("the raise_budget suggestion states the correct NEW total (not a delta)", () => {
    const state = applyParsedTask(createDecisionState(), { category: "mobile", budget_total: 3000 }, "NEEDS_DISCOVERY");
    const s = buildFollowUpSuggestions(state).find((x) => x.key === "raise_budget")!;
    expect(s.prefill_ar).toContain("3500"); // 3000 + 500 bump
  });

  it("always includes why/where", () => {
    const state = createDecisionState();
    const keys = buildFollowUpSuggestions(state).map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["why", "where"]));
  });

  it("EVERY suggestion's prefill text classifies as the intent it promises (never a dead-end tap)", () => {
    const state = applyParsedTask(createDecisionState(), { category: "mobile", budget_total: 3000 }, "NEEDS_DISCOVERY");
    const suggestions = buildFollowUpSuggestions(state);
    const expected: Record<string, string> = {
      raise_budget: "COUNTERFACTUAL",
      cheaper: "COUNTERFACTUAL",
      why: "FOLLOW_UP_REASONING",
      where: "MERCHANT_SELECTION",
    };
    for (const s of suggestions) {
      const intent = classifyDecisionIntent(s.prefill_ar, { hasActiveDecisionState: true }).intent;
      expect(intent).toBe(expected[s.key]);
    }
  });
});
