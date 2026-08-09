/**
 * THE SHOPPING DECISION STATE (Unified Intelligence mission, Section 6 — 2026-08-09).
 *
 * Pins the two properties Section 6 requires: the state ACCUMULATES additively across turns
 * (a later turn naming only a budget must not erase an earlier turn's room size), and nothing
 * here fabricates a candidate, a shortlist entry, or a budget verdict that the caller did not
 * actually supply. No jsdom (testEnvironment: 'node', matching journey-context.test.ts) —
 * sessionStorage is stubbed minimally.
 */
import {
  createDecisionState, applyParsedTask, applyDecisionResult, removeConstraint,
  saveDecisionState, readDecisionState, clearDecisionState,
  markSelectedProduct, decisionStateToAdvisorBody,
} from "@/lib/agent/decision-state";
import type { AdvisorParsed } from "@/lib/agent/advisor-api";

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

describe("createDecisionState", () => {
  it("starts empty, inspectable, with a stable journey_id", () => {
    const s = createDecisionState();
    expect(s.journey_id).toMatch(/^j_/);
    expect(s.category).toBeNull();
    expect(s.hard_constraints).toEqual({});
    expect(s.conversation_turn).toBe(0);
  });

  it("two states get different journey_ids", () => {
    const a = createDecisionState();
    const b = createDecisionState();
    expect(a.journey_id).not.toBe(b.journey_id);
  });
});

describe("applyParsedTask — additive across turns, never re-interpreted from scratch", () => {
  it("folds category, hard constraints, and soft preferences from a parsed task", () => {
    const s0 = createDecisionState();
    const task: AdvisorParsed = { category: "air_conditioner", room_size_m2: 30, budget_total: 4000, priorities: ["quiet"] };
    const s1 = applyParsedTask(s0, task, "NEEDS_DISCOVERY");
    expect(s1.category).toBe("air_conditioner");
    expect(s1.hard_constraints.room_size_m2).toBe(30);
    expect(s1.hard_constraints.budget_total).toBe(4000);
    expect(s1.soft_preferences).toEqual(["quiet"]);
    expect(s1.intent).toBe("NEEDS_DISCOVERY");
    expect(s1.conversation_turn).toBe(1);
  });

  it("a later turn naming ONLY a budget does not erase an earlier turn's room size (the hard requirement)", () => {
    const s0 = createDecisionState();
    const s1 = applyParsedTask(s0, { category: "air_conditioner", room_size_m2: 30 }, "NEEDS_DISCOVERY");
    const s2 = applyParsedTask(s1, { budget_total: 3500 }, "CONSTRAINT_CHANGE");
    expect(s2.hard_constraints.room_size_m2).toBe(30); // still there
    expect(s2.hard_constraints.budget_total).toBe(3500); // newly added
    expect(s2.category).toBe("air_conditioner"); // still there (task2 had no category)
    expect(s2.conversation_turn).toBe(2);
  });

  // MEASURED (2026-08-09, Section 43 multi-turn missions): parseShoppingTask returns
  // `category: ""` (an empty STRING, never null) when nothing was classified. A follow-up
  // turn's parsed task therefore carries `category: ""`, not `category: undefined` — `??`
  // alone does not fall back on an empty string, so a naive `task.category ?? state.category`
  // would silently WIPE an already-established category on every category-less follow-up.
  it("a category-less follow-up turn (task.category === '', the parser's real shape) never wipes the established category", () => {
    const s0 = createDecisionState();
    const s1 = applyParsedTask(s0, { category: "laptop", budget_total: 5000 }, "NEEDS_DISCOVERY");
    const s2 = applyParsedTask(s1, { category: "", budget_total: 5000 } as never, "FOLLOW_UP_REASONING");
    expect(s2.category).toBe("laptop");
  });

  it("a later turn's budget OVERWRITES an earlier turn's budget for the same field", () => {
    const s0 = createDecisionState();
    const s1 = applyParsedTask(s0, { category: "laptop", budget_total: 5000 }, "NEEDS_DISCOVERY");
    const s2 = applyParsedTask(s1, { budget_total: 3000 }, "CONSTRAINT_CHANGE");
    expect(s2.hard_constraints.budget_total).toBe(3000);
  });

  it("soft preferences accumulate without duplicates", () => {
    const s0 = createDecisionState();
    const s1 = applyParsedTask(s0, { category: "laptop", priorities: ["gaming"] }, "NEEDS_DISCOVERY");
    const s2 = applyParsedTask(s1, { priorities: ["gaming", "portability"] }, "NEEDS_DISCOVERY");
    expect(s2.soft_preferences.sort()).toEqual(["gaming", "portability"]);
  });
});

describe("applyDecisionResult — folds only what the engine actually returned", () => {
  it("populates candidate set, shortlist, and price context from a real result", () => {
    const s0 = applyParsedTask(createDecisionState(), { category: "laptop", budget_total: 3000 }, "NEEDS_DISCOVERY");
    const s1 = applyDecisionResult(s0, {
      recommendations: [{ canonical_id: "a" }, { canonical_id: "b" }],
      smart_pick: { canonical_id: "a" },
      budget_satisfied: true,
    });
    expect(s1.current_candidate_set).toEqual(["a", "b"]);
    expect(s1.current_shortlist).toEqual(["a", "b"]);
    expect(s1.selected_product).toBe("a");
    expect(s1.price_context).toEqual({ budget_total: 3000, anyWithinBudget: true });
    expect(s1.evidence_snapshot_at).not.toBeNull();
  });

  it("an empty result clears the candidate set rather than fabricating one", () => {
    const s0 = createDecisionState();
    const s1 = applyDecisionResult(s0, { recommendations: [] });
    expect(s1.current_candidate_set).toEqual([]);
    expect(s1.selected_product).toBeNull();
  });
});

describe("removeConstraint — the Constraint Ledger's write path (Section 7)", () => {
  it("drops a hard constraint by field name", () => {
    const s0 = applyParsedTask(createDecisionState(), { category: "air_conditioner", room_size_m2: 30, budget_total: 4000 }, "NEEDS_DISCOVERY");
    const s1 = removeConstraint(s0, "budget_total");
    expect(s1.hard_constraints.budget_total).toBeUndefined();
    expect(s1.hard_constraints.room_size_m2).toBe(30); // untouched
  });

  it("drops a soft preference by field name", () => {
    const s0 = applyParsedTask(createDecisionState(), { category: "laptop", priorities: ["gaming", "portability"] }, "NEEDS_DISCOVERY");
    const s1 = removeConstraint(s0, "gaming");
    expect(s1.soft_preferences).toEqual(["portability"]);
  });

  it("bumps conversation_turn — removal is a real turn, not a silent mutation", () => {
    const s0 = createDecisionState();
    const s1 = removeConstraint(s0, "budget_total");
    expect(s1.conversation_turn).toBe(1);
  });
});

describe("markSelectedProduct — the compare page's write path (Section 44 closure)", () => {
  it("sets selected_product", () => {
    const s0 = createDecisionState();
    const s1 = markSelectedProduct(s0, "canon-123");
    expect(s1.selected_product).toBe("canon-123");
  });
  it("overwrites a prior selection — whichever happened most recently is the current focus", () => {
    const s0 = markSelectedProduct(createDecisionState(), "canon-old");
    const s1 = markSelectedProduct(s0, "canon-new");
    expect(s1.selected_product).toBe("canon-new");
  });
});

describe("decisionStateToAdvisorBody — the ONE shared request-body builder (Section 44 closure)", () => {
  it("returns null when there is no category to reason about — never fabricates a question", () => {
    expect(decisionStateToAdvisorBody(createDecisionState())).toBeNull();
  });
  it("builds a body from the state's category and hard constraints", () => {
    const s = applyParsedTask(createDecisionState(), { category: "air_conditioner", room_size_m2: 30, budget_total: 4000, city: "Riyadh", priorities: ["quiet"] }, "NEEDS_DISCOVERY");
    expect(decisionStateToAdvisorBody(s)).toEqual({
      category: "air_conditioner", room_size_m2: 30, budget_total: 4000, city: "Riyadh", priorities: ["quiet"],
    });
  });
  it("categoryOverride wins over the state's own category — e.g. asking about a DIFFERENT product's category than the last search", () => {
    const s = applyParsedTask(createDecisionState(), { category: "laptop", budget_total: 3000 }, "NEEDS_DISCOVERY");
    const body = decisionStateToAdvisorBody(s, "air_conditioner");
    expect(body?.category).toBe("air_conditioner");
  });
  it("omits fields the state does not have — never invents a budget/room-size/city", () => {
    const s = applyParsedTask(createDecisionState(), { category: "laptop" }, "NEEDS_DISCOVERY");
    const body = decisionStateToAdvisorBody(s)!;
    expect(body).not.toHaveProperty("budget_total");
    expect(body).not.toHaveProperty("room_size_m2");
    expect(body).not.toHaveProperty("city");
    expect(body).not.toHaveProperty("priorities");
  });
});

describe("storage — same-tab, best-effort, time-bounded (mirrors journey-context.ts)", () => {
  beforeEach(() => stubSessionStorage());
  afterEach(() => { delete (global as unknown as { window?: unknown }).window; });

  it("round-trips a saved state", () => {
    const s = applyParsedTask(createDecisionState(), { category: "laptop", budget_total: 3000 }, "NEEDS_DISCOVERY");
    saveDecisionState(s);
    expect(readDecisionState()).toEqual(s);
  });

  it("does not throw when sessionStorage is unavailable", () => {
    delete (global as unknown as { window?: unknown }).window;
    expect(() => saveDecisionState(createDecisionState())).not.toThrow();
    expect(readDecisionState()).toBeNull();
  });

  it("a stale (>45min) saved state is not carried forward", () => {
    const stale = { ...createDecisionState(), updated_at: new Date(Date.now() - 46 * 60_000).toISOString() };
    (window as unknown as { sessionStorage: Storage }).sessionStorage.setItem("tawveeri:decision_state", JSON.stringify(stale));
    expect(readDecisionState()).toBeNull();
  });

  it("clearDecisionState removes the saved state", () => {
    saveDecisionState(createDecisionState());
    clearDecisionState();
    expect(readDecisionState()).toBeNull();
  });
});
