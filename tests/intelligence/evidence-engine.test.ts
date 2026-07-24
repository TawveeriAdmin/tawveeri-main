// tests/intelligence/evidence-engine.test.ts — Trust & Evidence Engine (ADR-087).
import { assessTrust } from "../../src/lib/intelligence/evidence-engine";

describe("assessTrust — evidence-grounded, deterministic, honest", () => {
  it("high trust: multi-store, precise identity, confident price history", () => {
    const t = assessTrust({ store_count: 4, identity_confidence: 95, has_comparison: true, price_spread_pct: 8, price_confident: true, price_distinct_days: 12, data_age_hours: 3 });
    expect(t.tier).toBe("high");
    expect(t.score).toBeGreaterThanOrEqual(80);
    expect(t.caveats_en.length).toBe(0);
    // score equals the sum of factor contributions (transparent, no hidden terms)
    expect(t.score).toBe(t.factors.reduce((a, f) => a + f.contribution, 0));
  });

  it("single-store is honestly LOW trust for price, with a caveat (precision over recall)", () => {
    const t = assessTrust({ store_count: 1, identity_confidence: 95, has_comparison: false });
    expect(t.tier).toBe("low");
    expect(t.caveats_en.some((c) => /single store/i.test(c))).toBe(true);
    const corro = t.factors.find((f) => f.key === "corroboration")!;
    expect(corro.status).toBe("weak");
    expect(corro.evidence_en).toMatch(/single store/i);
  });

  it("an unspecified price-determining spec caps identity trust + surfaces a caveat", () => {
    const full = assessTrust({ store_count: 2, identity_confidence: 90 });
    const partial = assessTrust({ store_count: 2, identity_confidence: 90, specs_incomplete: true });
    expect(partial.score).toBeLessThan(full.score);
    expect(partial.caveats_en.some((c) => /price-determining spec/i.test(c))).toBe(true);
  });

  it("missing evidence NEVER inflates trust — unknown factors are conservative", () => {
    const t = assessTrust({ store_count: 2, identity_confidence: 80 }); // no price/freshness evidence
    const priceF = t.factors.find((f) => f.key === "price_history")!;
    const freshF = t.factors.find((f) => f.key === "freshness")!;
    expect(priceF.status).toBe("unknown");
    expect(freshF.status).toBe("unknown");
    expect(priceF.value).toBeLessThanOrEqual(0.5);
    // a fully-unknown-price product cannot reach 'high' on identity+corroboration alone at 2 stores
    expect(t.score).toBeLessThan(72);
  });

  it("building-history price yields a preliminary-price caveat", () => {
    const t = assessTrust({ store_count: 3, identity_confidence: 90, price_confident: false, price_distinct_days: 1 });
    expect(t.caveats_en.some((c) => /still building/i.test(c))).toBe(true);
  });

  it("a large cross-store price spread lowers consistency + warns of possible mismatch", () => {
    const tight = assessTrust({ store_count: 2, identity_confidence: 90, has_comparison: true, price_spread_pct: 10 });
    const wide = assessTrust({ store_count: 2, identity_confidence: 90, has_comparison: true, price_spread_pct: 220 });
    expect(wide.score).toBeLessThan(tight.score);
    expect(wide.caveats_en.some((c) => /listings may differ/i.test(c))).toBe(true);
  });

  it("a dishonest claimed discount is penalized + surfaced; no-claim is neutral", () => {
    const honest = assessTrust({ store_count: 3, identity_confidence: 90, discount_claimed: true, discount_honest: true });
    const dishonest = assessTrust({ store_count: 3, identity_confidence: 90, discount_claimed: true, discount_honest: false });
    const noClaim = assessTrust({ store_count: 3, identity_confidence: 90 });
    expect(dishonest.score).toBeLessThan(honest.score);
    expect(honest.score).toBe(noClaim.score); // honest discount == no penalty
    expect(dishonest.caveats_en.some((c) => /not supported by price history/i.test(c))).toBe(true);
  });

  it("is deterministic (same input → same output)", () => {
    const inp = { store_count: 3, identity_confidence: 88, has_comparison: true, price_confident: true, price_distinct_days: 9 };
    expect(assessTrust(inp)).toEqual(assessTrust(inp));
  });
});
