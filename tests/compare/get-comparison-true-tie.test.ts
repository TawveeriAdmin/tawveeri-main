// tests/compare/get-comparison-true-tie.test.ts
//
// AFFILIATE_TRUE_TIE_POLICY (ADR-304) at the getComparison() integration boundary:
// deriveComparisonSummary must report `cheapest_store` consistent with the SAME
// tie-break-aware order the compare page renders, and must never let it move price truth
// (lowest_price/highest_price/saving) — those are values, never affected by order.
import { deriveComparisonSummary, type CompareOffer } from "../../src/lib/compare/get-comparison";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const offer = (over: Partial<CompareOffer> = {}): CompareOffer => ({
  store_slug: "extra",
  store_name: "اكسترا",
  raw_name: "product",
  price: 100,
  availability: "in_stock",
  product_url: "/go/1",
  observed_at: hoursAgo(1),
  stale: false,
  confidence: 100,
  is_verified: true,
  campaign_eligibility: null,
  ...over,
});

describe("deriveComparisonSummary — AFFILIATE_TRUE_TIE_POLICY", () => {
  it("EXAMPLE_5_EQUAL_STORES: cheapest_store names the affiliate leader, price truth unchanged", () => {
    const offers = [
      offer({ store_slug: "almanea", store_name: "المنيع", price: 2000 }),
      offer({ store_slug: "amazon", store_name: "أمازون", price: 2000 }),
      offer({ store_slug: "jarir", store_name: "جرير", price: 2000 }),
      offer({ store_slug: "noon", store_name: "نون", price: 2000 }),
      offer({ store_slug: "extra", store_name: "اكسترا", price: 2000 }),
    ];
    const { summary } = deriveComparisonSummary(offers);
    expect(summary.cheapest_store).toBe("أمازون");
    expect(summary.lowest_price).toBe(2000);
    expect(summary.highest_price).toBe(2000);
    expect(summary.saving).toBeNull(); // no real saving exists among identical prices
    expect(summary.store_count).toBe(5); // nothing dropped
  });

  it("CHEAPER_NON_AFFILIATE: a materially cheaper non-affiliate offer still wins cheapest_store", () => {
    const offers = [
      offer({ store_slug: "almanea", store_name: "المنيع", price: 1900 }),
      offer({ store_slug: "amazon", store_name: "أمازون", price: 2000 }),
      offer({ store_slug: "noon", store_name: "نون", price: 2000 }),
    ];
    const { summary } = deriveComparisonSummary(offers);
    expect(summary.cheapest_store).toBe("المنيع");
    expect(summary.lowest_price).toBe(1900);
  });

  it("CONDITION_PROTECTION: a same-priced refurbished affiliate offer never wins cheapest_store over an unmarked (UNKNOWN-condition) offer — UNKNOWN != EQUAL blocks the tie, so plain price order (input order at equal price) stands", () => {
    const offers = [
      offer({ store_slug: "almanea", store_name: "المنيع", price: 2000, raw_name: "Product X" }),
      offer({ store_slug: "amazon", store_name: "أمازون", price: 2000, raw_name: "Product X (Refurbished)" }),
    ];
    const { summary } = deriveComparisonSummary(offers);
    // Not a proven true tie (condition UNKNOWN on one side) -> the leader stays whichever the
    // price-sort already put first (stable), never the affiliate offer promoted on top of it.
    expect(summary.cheapest_store).toBe("المنيع");
  });

  it("FRESHNESS_PROTECTION: a stale affiliate offer never wins cheapest_store over a fresh non-affiliate offer at the same price", () => {
    const offers = [
      offer({ store_slug: "almanea", store_name: "المنيع", price: 2000, stale: false }),
      offer({ store_slug: "amazon", store_name: "أمازون", price: 2000, stale: true }),
    ];
    const { summary } = deriveComparisonSummary(offers);
    expect(summary.cheapest_store).toBe("المنيع");
  });

  it("PRODUCT_TRUTH: reordering never changes store_count, lowest_price, or highest_price versus the pre-existing price-only derivation", () => {
    const offers = [
      offer({ store_slug: "jarir", store_name: "جرير", price: 1500 }),
      offer({ store_slug: "amazon", store_name: "أمازون", price: 1500 }),
      offer({ store_slug: "extra", store_name: "اكسترا", price: 1800 }),
    ];
    const { summary } = deriveComparisonSummary(offers);
    expect(summary.lowest_price).toBe(1500);
    expect(summary.highest_price).toBe(1800);
    expect(summary.saving).toBe(300);
    expect(summary.store_count).toBe(3);
  });
});
