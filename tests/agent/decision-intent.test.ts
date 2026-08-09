/**
 * THE FULL DECISION INTENT TAXONOMY (Unified Intelligence mission, Section 5 — 2026-08-09).
 *
 * `classifyDecisionIntent` wraps `routeQuery` (untouched, still tested independently by
 * `route-query.test.ts`) with the mission's 12-way taxonomy. These tests pin the ORDER rule
 * documented in the file itself, and the honest scoping decision that IMPOSSIBLE_REQUEST is
 * never reachable from text alone (see `refineIntentFromOutcome`'s own tests below).
 */
import { classifyDecisionIntent, refineIntentFromOutcome } from "@/lib/agent/decision-intent";

describe("classifyDecisionIntent — the 12-way taxonomy", () => {
  it("EXTERNAL_PRODUCT_REFERENCE: a pasted URL wins over everything else", () => {
    const r = classifyDecisionIntent("قارن هذا https://example.com/product/123 بأفضل سعر");
    expect(r.intent).toBe("EXTERNAL_PRODUCT_REFERENCE");
  });

  it("COUNTERFACTUAL: «لو زدت الميزانية وش يتغير؟»", () => {
    const r = classifyDecisionIntent("لو زدت الميزانية وش يتغير؟");
    expect(r.intent).toBe("COUNTERFACTUAL");
  });

  it("CONSTRAINT_CHANGE requires active state — without it, falls through", () => {
    const withState = classifyDecisionIntent("خليها ميزانية اعلى", { hasActiveDecisionState: true });
    expect(withState.intent).toBe("CONSTRAINT_CHANGE");
    const withoutState = classifyDecisionIntent("خليها ميزانية اعلى", { hasActiveDecisionState: false });
    expect(withoutState.intent).not.toBe("CONSTRAINT_CHANGE");
  });

  it("FOLLOW_UP_REASONING requires active state — «طيب ليش هذا أفضل؟»", () => {
    const r = classifyDecisionIntent("طيب ليش هذا أفضل؟", { hasActiveDecisionState: true });
    expect(r.intent).toBe("FOLLOW_UP_REASONING");
    const noState = classifyDecisionIntent("طيب ليش هذا أفضل؟", { hasActiveDecisionState: false });
    expect(noState.intent).not.toBe("FOLLOW_UP_REASONING");
  });

  it("DEAL_EVALUATION: «هل هذا العرض يستاهل؟»", () => {
    const r = classifyDecisionIntent("هل هذا العرض يستاهل؟");
    expect(r.intent).toBe("DEAL_EVALUATION");
  });

  it("SAME_PRODUCT_VERIFICATION: «هل هذا نفس الموديل؟»", () => {
    const r = classifyDecisionIntent("هل هذا نفس الموديل؟");
    expect(r.intent).toBe("SAME_PRODUCT_VERIFICATION");
  });

  it("MERCHANT_SELECTION: «وين أشتريه؟» — the North Star's own example", () => {
    const r = classifyDecisionIntent("وين اشتريه؟");
    expect(r.intent).toBe("MERCHANT_SELECTION");
  });

  it("PRODUCT_COMPARISON delegates entirely to routeQuery's comparison detection", () => {
    const r = classifyDecisionIntent("S25 ولا iPhone 17؟");
    expect(r.intent).toBe("PRODUCT_COMPARISON");
    expect(r.route.mode).toBe("comparison");
  });

  it("EXACT_PRODUCT: a named model routes to retrieval with the model reason", () => {
    const r = classifyDecisionIntent("iPhone 15 برو");
    expect(r.intent).toBe("EXACT_PRODUCT");
    expect(r.route.mode).toBe("retrieval");
  });

  it("NEEDS_DISCOVERY: a described need with signals routes to advisory", () => {
    const r = classifyDecisionIntent("مكيف لغرفة 30 متر هادئ تحت 4000");
    expect(r.intent).toBe("NEEDS_DISCOVERY");
    expect(r.route.mode).toBe("advisory");
  });

  it("CATEGORY_BROWSE: a bare category with no need signal", () => {
    const r = classifyDecisionIntent("لابتوب");
    expect(r.intent).toBe("CATEGORY_BROWSE");
  });

  it("CATEGORY_BROWSE: empty query is the safe default, never an error", () => {
    expect(classifyDecisionIntent("").intent).toBe("CATEGORY_BROWSE");
  });

  it("every result carries the underlying routeQuery classification, never discarded", () => {
    const r = classifyDecisionIntent("مكيف لغرفة 30 متر");
    expect(r.route).toBeDefined();
    expect(r.route.mode).toBe("advisory");
  });
});

describe("refineIntentFromOutcome — IMPOSSIBLE_REQUEST is earned from evidence, never guessed from text", () => {
  it("upgrades NEEDS_DISCOVERY to IMPOSSIBLE_REQUEST only when the engine found candidates but none fit the budget", () => {
    const prior = classifyDecisionIntent("مكيف لغرفة 30 متر تحت 100 ريال");
    const refined = refineIntentFromOutcome(prior, {
      supported: true, count: 5, anyWithinBudget: false, hadBudgetConstraint: true,
    });
    expect(refined.intent).toBe("IMPOSSIBLE_REQUEST");
  });

  it("does NOT upgrade when the budget IS satisfied", () => {
    const prior = classifyDecisionIntent("مكيف لغرفة 30 متر تحت 4000");
    const refined = refineIntentFromOutcome(prior, {
      supported: true, count: 5, anyWithinBudget: true, hadBudgetConstraint: true,
    });
    expect(refined.intent).toBe("NEEDS_DISCOVERY");
  });

  it("does NOT upgrade when there was no budget constraint at all", () => {
    const prior = classifyDecisionIntent("مكيف لغرفة 30 متر هادئ");
    const refined = refineIntentFromOutcome(prior, {
      supported: true, count: 5, anyWithinBudget: null, hadBudgetConstraint: false,
    });
    expect(refined.intent).toBe("NEEDS_DISCOVERY");
  });

  it("does NOT upgrade when the engine found nothing at all for the category (a different, honest empty state)", () => {
    const prior = classifyDecisionIntent("مكيف لغرفة 30 متر تحت 100 ريال");
    const refined = refineIntentFromOutcome(prior, {
      supported: true, count: 0, anyWithinBudget: null, hadBudgetConstraint: true,
    });
    expect(refined.intent).toBe("NEEDS_DISCOVERY");
  });

  it("leaves non-discovery intents untouched", () => {
    const prior = classifyDecisionIntent("S25 ولا iPhone 17؟");
    const refined = refineIntentFromOutcome(prior, {
      supported: true, count: 0, anyWithinBudget: false, hadBudgetConstraint: true,
    });
    expect(refined.intent).toBe("PRODUCT_COMPARISON");
  });
});
