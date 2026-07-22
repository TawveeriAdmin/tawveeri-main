/**
 * Merchant Trust Intelligence — deterministic, precision-first, non-accusatory.
 * Must distinguish "no advertised discounts" from "honest discounts", never fabricate,
 * and produce a nuanced headline (discount theatre ≠ real price value).
 */
import { computeStoreTrust, rankStoresByTrust, type StoreTrustInput } from "../../src/lib/intelligence/merchant-trust";

const inp = (over: Partial<StoreTrustInput>): StoreTrustInput => ({
  store_id: 4, store_name: "extra", facts_analyzed: 500, discount_inflated: 0, discount_verified: 0,
  cheapest_count: 0, corroborated_appearances: 0, distinct_products: 0, ...over,
});

describe("computeStoreTrust", () => {
  it("aggressive-but-cheap: separates discount theatre from real value", () => {
    const t = computeStoreTrust(inp({ discount_inflated: 4426, discount_verified: 21, cheapest_count: 82, corroborated_appearances: 137, distinct_products: 900 }));
    expect(t.discount_behavior).toBe("aggressive_claims");
    expect(t.discount_inflation_pct).toBe(100);     // 4426/4447 = 99.5% → 100
    expect(t.price_competitiveness_pct).toBe(60);   // 82/137
    expect(t.headline.en).toMatch(/trust the price, not the discount/);
  });
  it("no-claims store is labelled honestly (NOT called 'honest')", () => {
    const t = computeStoreTrust(inp({ store_id: 5, store_name: "almanea", discount_inflated: 0, discount_verified: 0, cheapest_count: 6, corroborated_appearances: 69, distinct_products: 400 }));
    expect(t.discount_behavior).toBe("no_advertised_discounts");
    expect(t.discount_inflation_pct).toBeNull();     // no claims to evaluate
    expect(t.price_competitiveness_pct).toBe(9);
    expect(t.headline.en).toMatch(/no "was\/now" discounts/);
  });
  it("some-claims store reports its inflation rate plainly", () => {
    const t = computeStoreTrust(inp({ discount_inflated: 3, discount_verified: 7, cheapest_count: 20, corroborated_appearances: 40 }));
    expect(t.discount_behavior).toBe("some_claims");
    expect(t.discount_inflation_pct).toBe(30);
  });
  it("null competitiveness when there are no corroborated appearances (honest)", () => {
    expect(computeStoreTrust(inp({ discount_inflated: 60 })).price_competitiveness_pct).toBeNull();
  });
  it("NOT-analyzed store is 'insufficient_data', never mislabelled 'no discounts'", () => {
    const t = computeStoreTrust(inp({ store_name: "jarir", facts_analyzed: 0, cheapest_count: 40, corroborated_appearances: 100 }));
    expect(t.discount_behavior).toBe("insufficient_data");
    expect(t.headline.en).toMatch(/haven't analyzed/);
  });
});

describe("rankStoresByTrust — real value first, then honesty (ranking-blind)", () => {
  it("ranks a cheaper-but-honest store above a pricier one", () => {
    const a = computeStoreTrust(inp({ store_name: "a", cheapest_count: 63, corroborated_appearances: 100 }));
    const b = computeStoreTrust(inp({ store_name: "b", cheapest_count: 9, corroborated_appearances: 100 }));
    expect(rankStoresByTrust([b, a])[0].store_name).toBe("a");
  });
});
