/**
 * Merchant Trust Intelligence — deterministic, precision-first, NON-ACCUSATORY.
 * Founder evidence standard: "we did not observe the advertised reference price" is
 * NOT a claim of fabrication. Must distinguish insufficient_data / no_advertised_discounts
 * / unobserved_reference / verified drops, and expose sample size + window + confidence.
 */
import { computeStoreTrust, rankStoresByTrust, type StoreTrustInput } from "../../src/lib/intelligence/merchant-trust";

const inp = (over: Partial<StoreTrustInput>): StoreTrustInput => ({
  store_id: 4, store_name: "extra", facts_analyzed: 500, discount_inflated: 0, discount_verified: 0,
  cheapest_count: 0, corroborated_appearances: 0, distinct_products: 0, observation_window_days: 41, ...over,
});

describe("computeStoreTrust — non-accusatory, evidence-exposed", () => {
  it("systematic-unobserved-reference: NOT called fabricated; exposes sample + window + confidence", () => {
    const t = computeStoreTrust(inp({ discount_inflated: 4426, discount_verified: 21, cheapest_count: 82, corroborated_appearances: 137, distinct_products: 900 }));
    expect(t.discount_behavior).toBe("unobserved_reference");
    expect(t.unobserved_reference_pct).toBe(100);   // 4426/4447 → 99.5% → 100
    expect(t.evidence.sample_size).toBe(4447);
    expect(t.evidence.observation_window_days).toBe(41);
    expect(t.evidence.confidence).toBe("high");
    expect(t.headline.en).toMatch(/did not observe the advertised "was" price/);
    expect(t.headline.en).not.toMatch(/fabricat|fake|fraud/i);   // never accusatory
    expect(t.headline.en).toMatch(/compare the actual price/);
  });
  it("no-claims store: labelled honestly, with the sample it's based on", () => {
    const t = computeStoreTrust(inp({ store_name: "almanea", facts_analyzed: 392, cheapest_count: 6, corroborated_appearances: 69 }));
    expect(t.discount_behavior).toBe("no_advertised_discounts");
    expect(t.unobserved_reference_pct).toBeNull();
    expect(t.headline.en).toMatch(/no "was\/now" discount claims across 392 listings/);
  });
  it("NOT-analyzed store is insufficient_data (never mislabelled)", () => {
    const t = computeStoreTrust(inp({ store_name: "samsung", facts_analyzed: 0 }));
    expect(t.discount_behavior).toBe("insufficient_data");
    expect(t.evidence.confidence).toBe("low");
    expect(t.headline.en).toMatch(/haven't analyzed/);
  });
  it("small sample ⇒ low/medium confidence (never overstate)", () => {
    expect(computeStoreTrust(inp({ discount_inflated: 3, discount_verified: 7 })).evidence.confidence).toBe("low");     // sample 10
    expect(computeStoreTrust(inp({ discount_inflated: 20, discount_verified: 10 })).evidence.confidence).toBe("medium"); // sample 30
  });
});

describe("rankStoresByTrust — real value first, then fewer unobserved references (ranking-blind)", () => {
  it("ranks a cheaper store above a pricier one", () => {
    const a = computeStoreTrust(inp({ store_name: "a", cheapest_count: 63, corroborated_appearances: 100 }));
    const b = computeStoreTrust(inp({ store_name: "b", cheapest_count: 9, corroborated_appearances: 100 }));
    expect(rankStoresByTrust([b, a])[0].store_name).toBe("a");
  });
});
