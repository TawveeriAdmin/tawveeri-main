/**
 * THE SHARED MUTATION-TURN HANDLER (D→E mission, Section 5 — 2026-08-09). Pins the
 * synchronous gating logic (which intents own the plain catalog search vs which never touch
 * it, and every "nothing to act on" early return) WITHOUT mocking network calls — the
 * network-calling paths (COUNTERFACTUAL/CONSTRAINT_CHANGE/etc. actually re-asking the
 * engine) are covered by live production verification instead, matching this repo's existing
 * convention for `askAdvisor`-calling code (no fetch-mocking precedent exists here).
 *
 * No jsdom (testEnvironment: 'node') — sessionStorage is stubbed minimally, same discipline
 * as `decision-state.test.ts`/`journey-context.test.ts`.
 */
import { isMutationIntent, handleMutationTurn } from "@/lib/agent/mutation-turn";
import { createDecisionState, applyParsedTask, saveDecisionState } from "@/lib/agent/decision-state";
import type { AdvisorResponse } from "@/lib/agent/advisor-api";

function stubSessionStorage() {
  const store: Record<string, string> = {};
  (global as unknown as { window: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
  };
}

describe("isMutationIntent — which intents must NEVER reach the plain catalog search", () => {
  it("all seven continuation intents are mutation intents", () => {
    for (const i of ["COUNTERFACTUAL", "CONSTRAINT_CHANGE", "DEAL_EVALUATION", "SAME_PRODUCT_VERIFICATION", "MERCHANT_SELECTION", "FOLLOW_UP_REASONING", "EXTERNAL_PRODUCT_REFERENCE"] as const) {
      expect(isMutationIntent(i)).toBe(true);
    }
  });
  it("fresh-search-shaped intents are NOT mutation intents — they keep using plain retrieval", () => {
    for (const i of ["EXACT_PRODUCT", "CATEGORY_BROWSE", "NEEDS_DISCOVERY", "PRODUCT_COMPARISON", "IMPOSSIBLE_REQUEST"] as const) {
      expect(isMutationIntent(i)).toBe(false);
    }
  });
});

describe("handleMutationTurn — synchronous gating (no network call reached)", () => {
  beforeEach(() => stubSessionStorage());
  afterEach(() => { delete (global as unknown as { window?: unknown }).window; });

  it("FOLLOW_UP_REASONING with an answer on screen is a genuine no-op — never touches the catalog search", async () => {
    // FOLLOW_UP_REASONING only classifies with an ACTIVE DecisionState (same rule
    // decision-intent.ts pins) — a real "why" follow-up always comes after an established
    // mission, never as the very first turn.
    saveDecisionState(applyParsedTask(createDecisionState(), { category: "air_conditioner", budget_total: 4000 }, "NEEDS_DISCOVERY"));
    const fakeResult = { smart_pick: null, recommendations: [] } as unknown as AdvisorResponse;
    const { intent, outcome } = await handleMutationTurn("طيب ليش هذا أفضل؟", fakeResult);
    expect(intent.intent).toBe("FOLLOW_UP_REASONING");
    // `reason` added 2026-08-10 (follow-up-continuation mission) — tells the caller WHICH
    // existing content to scroll to/highlight, distinct from MERCHANT_SELECTION's "where".
    expect(outcome).toEqual({ kind: "noop", reason: "why" });
  });

  it("FOLLOW_UP_REASONING with NOTHING on screen falls through — nothing to preserve", async () => {
    const { outcome } = await handleMutationTurn("طيب ليش هذا أفضل؟", null);
    expect(outcome).toEqual({ kind: "not_a_mutation" });
  });

  it("EXTERNAL_PRODUCT_REFERENCE always returns the honest notice, never runs a search", async () => {
    const { intent, outcome } = await handleMutationTurn("https://example.com/product/123", null);
    expect(intent.intent).toBe("EXTERNAL_PRODUCT_REFERENCE");
    expect(outcome).toEqual({ kind: "external_reference_notice" });
  });

  it("a mutation-shaped query with NO prior DecisionState returns no_context — never guesses", async () => {
    const { intent, outcome } = await handleMutationTurn("وين أشتريه؟", null);
    expect(intent.intent).toBe("MERCHANT_SELECTION");
    expect(outcome).toEqual({ kind: "no_context" });
  });

  it("MERCHANT_SELECTION with an active state AND an answer already on screen is a noop — never a redundant re-fetch", async () => {
    // MEASURED (2026-08-10, follow-up-continuation mission): «وين أشتريه؟» parses to no new
    // fields at all, so the OLD path (generic merge-and-reask) fired a real network call that
    // returned the IDENTICAL recommendation — a "successful" mutation with zero visible change,
    // the same class of dead-feeling control this whole mission fixes for the other three chips.
    saveDecisionState(applyParsedTask(createDecisionState(), { category: "laptop", budget_total: 4000 }, "NEEDS_DISCOVERY"));
    const fakeResult = { smart_pick: { canonical_id: "x" }, recommendations: [] } as unknown as AdvisorResponse;
    const { intent, outcome } = await handleMutationTurn("وين أشتريه؟", fakeResult);
    expect(intent.intent).toBe("MERCHANT_SELECTION");
    expect(outcome).toEqual({ kind: "noop", reason: "where" });
  });

  it("COUNTERFACTUAL with no parseable delta returns no_context even with active state", async () => {
    const state = applyParsedTask(createDecisionState(), { category: "air_conditioner", budget_total: 4000 }, "NEEDS_DISCOVERY");
    saveDecisionState(state);
    const { outcome } = await handleMutationTurn("لو زدت الميزانية شوي", null);
    expect(outcome).toEqual({ kind: "no_context" });
  });

  it("COUNTERFACTUAL with active state but NO stated budget returns no_context — nothing to vary", async () => {
    const state = applyParsedTask(createDecisionState(), { category: "air_conditioner" }, "NEEDS_DISCOVERY");
    saveDecisionState(state);
    const { outcome } = await handleMutationTurn("لو زدت الميزانية 500", null);
    expect(outcome).toEqual({ kind: "no_context" });
  });

  it("a genuine category switch mid-refinement is not_a_mutation — the caller's normal search flow should handle it as a new mission", async () => {
    const state = applyParsedTask(createDecisionState(), { category: "mobile", budget_total: 3000 }, "NEEDS_DISCOVERY");
    saveDecisionState(state);
    // "خليها 4000" alone has no category — not a switch. A real category-naming sentence is.
    const { outcome } = await handleMutationTurn("خليها للمكيف بس بميزانية 4000", null);
    // "بميزانية 4000" + "مكيف" parses category=air_conditioner, differing from state's "mobile".
    expect(outcome).toEqual({ kind: "not_a_mutation" });
  });

  it("fresh-search-shaped intents (e.g. a bare category) are not_a_mutation regardless of active state", async () => {
    const state = applyParsedTask(createDecisionState(), { category: "mobile" }, "NEEDS_DISCOVERY");
    saveDecisionState(state);
    const { intent, outcome } = await handleMutationTurn("لابتوب", null);
    expect(intent.intent).toBe("CATEGORY_BROWSE");
    expect(outcome).toEqual({ kind: "not_a_mutation" });
  });
});
