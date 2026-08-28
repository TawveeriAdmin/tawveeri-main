// tests/intelligence/evidence-engine.test.ts — Trust & Evidence Engine (ADR-087).
import { assessTrust, observedAgoLabel, PICK_FRESHNESS_MAX_HOURS, isFreshObservation } from "../../src/lib/intelligence/evidence-engine";

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

  it("ADR-163 (Decision Card v1 ruling): identity evidence is worded, never a raw percentage", () => {
    // MEASURED (2026-08-22): this factor used to emit `دقة الهوية 75%` / `identity confidence
    // 75%` verbatim — a bare confidence number leaking into the customer-visible EvidencePanel
    // facts group through a channel ADR-163's original fix (the top-level score) never covered.
    for (const idc of [10, 40, 60, 90]) {
      const t = assessTrust({ store_count: 2, identity_confidence: idc });
      const identity = t.factors.find((f) => f.key === "identity")!;
      expect(identity.evidence_ar).not.toMatch(/\d/);
      expect(identity.evidence_en).not.toMatch(/\d/);
    }
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

describe("observedAgoLabel — one rendering of observation age (ADR-193)", () => {
  it("hours below 48h, days at 48h and above (day form is in the approved corpus)", () => {
    expect(observedAgoLabel(0.4, "ar")).toBe("آخر رصد قبل أقل من ساعة");
    expect(observedAgoLabel(3, "ar")).toBe("آخر رصد قبل 3 ساعة");
    expect(observedAgoLabel(47, "en")).toBe("Last observed 47h ago");
    // The founder-reported «آخر رصد قبل 99 ساعة» now reads in days.
    expect(observedAgoLabel(99, "ar")).toBe("آخر رصد قبل 4 يومًا");
    expect(observedAgoLabel(264, "ar")).toBe("آخر رصد قبل 11 يومًا");
    expect(observedAgoLabel(264, "en")).toBe("Last observed 11 days ago");
  });

  it("the freshness factor's evidence line uses the shared label", () => {
    const t = assessTrust({ store_count: 2, identity_confidence: 90, data_age_hours: 99 });
    const fresh = t.factors.find((f) => f.key === "freshness")!;
    expect(fresh.evidence_ar).toBe(observedAgoLabel(99, "ar"));
    expect(fresh.evidence_en).toBe(observedAgoLabel(99, "en"));
  });

  it("the pick-label gate is the freshness floor band, owned here", () => {
    expect(PICK_FRESHNESS_MAX_HOURS).toBe(168);
  });
});

describe("isFreshObservation — the single 'cheapest' claim eligibility test (quality program P0, §11/§12)", () => {
  const ago = (h: number, from: number) => new Date(from - h * 3_600_000).toISOString();

  it("is fresh strictly within the floor, and exactly AT the floor (inclusive boundary)", () => {
    const now = Date.parse("2026-08-27T00:00:00.000Z");
    expect(isFreshObservation(ago(1, now), now)).toBe(true);
    expect(isFreshObservation(ago(PICK_FRESHNESS_MAX_HOURS, now), now)).toBe(true);
  });

  it("is stale one second past the floor", () => {
    const now = Date.parse("2026-08-27T00:00:00.000Z");
    const justOver = new Date(now - PICK_FRESHNESS_MAX_HOURS * 3_600_000 - 1000).toISOString();
    expect(isFreshObservation(justOver, now)).toBe(false);
  });

  it("treats missing, empty, or unparseable timestamps as stale — unknown never wins 'cheapest'", () => {
    const now = Date.parse("2026-08-27T00:00:00.000Z");
    expect(isFreshObservation(null, now)).toBe(false);
    expect(isFreshObservation(undefined, now)).toBe(false);
    expect(isFreshObservation("", now)).toBe(false);
    expect(isFreshObservation("not-a-date", now)).toBe(false);
  });

  it("defaults to the real clock when no `now` is injected", () => {
    expect(isFreshObservation(new Date().toISOString())).toBe(true);
    expect(isFreshObservation(new Date(Date.now() - 9999 * 3_600_000).toISOString())).toBe(false);
  });
});
