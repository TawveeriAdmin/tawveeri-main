// tests/compare/get-comparison-freshness.test.ts
// Quality program P0 (2026-08-27, §11/§12 of TAWVEERI_QUALITY_PROGRAM_STATE.md) — the
// stale-cheapest-store fix. `deriveComparisonSummary` is the compare page's pure
// summary derivation (extracted from getComparison for direct testability, same
// pattern as v1-search-helpers.ts's summarizeOffers).
import { deriveComparisonSummary, type CompareOffer } from "../../src/lib/compare/get-comparison";
import { PICK_FRESHNESS_MAX_HOURS } from "../../src/lib/intelligence/evidence-engine";

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

describe("deriveComparisonSummary — freshness gate", () => {
  it("excludes a stale historical cheapest, promoting a fresher and pricier offer", () => {
    const offers = [
      offer({ store_name: "اكسترا", price: 999, observed_at: hoursAgo(300) }), // stale, numerically cheapest
      offer({ store_name: "جرير", price: 1099, observed_at: hoursAgo(10) }),   // fresh
    ].sort((a, b) => a.price - b.price);
    const { summary, message } = deriveComparisonSummary(offers);
    expect(summary.cheapest_store).toBe("جرير");
    expect(summary.lowest_price).toBe(1099);
    expect(summary.store_count).toBe(2); // coverage untouched
    expect(message).toBeUndefined();
  });

  it("returns the honest no-current-comparison state when every offer is stale-only", () => {
    const offers = [
      offer({ store_name: "اكسترا", price: 999, observed_at: hoursAgo(300) }),
      offer({ store_name: "جرير", price: 1099, observed_at: hoursAgo(400) }),
    ];
    const { summary, message } = deriveComparisonSummary(offers);
    expect(summary.cheapest_store).toBeNull();
    expect(summary.lowest_price).toBeNull();
    expect(summary.highest_price).toBeNull();
    expect(summary.saving).toBeNull();
    expect(summary.cheapest_stale).toBe(false);
    expect(summary.store_count).toBe(2); // evidence preserved — nothing deleted or hidden
    expect(message).toMatch(/لا تتوفر مقارنة/);
  });

  it("picks the true minimum among multiple fresh offers", () => {
    const offers = [
      offer({ store_name: "a", price: 300, observed_at: hoursAgo(5) }),
      offer({ store_name: "b", price: 200, observed_at: hoursAgo(10) }),
      offer({ store_name: "c", price: 250, observed_at: hoursAgo(1) }),
    ];
    const { summary } = deriveComparisonSummary(offers);
    expect(summary.cheapest_store).toBe("b");
    expect(summary.lowest_price).toBe(200);
    expect(summary.highest_price).toBe(300);
  });

  it("boundary: just inside the floor is fresh; just outside is not", () => {
    // Offset by 30s from the exact floor (not 0) — this call chain (deriveComparisonSummary
    // -> isFreshObservation) doesn't take an injectable clock, so an EXACT boundary
    // timestamp is one `Date.now()` tick away from flaking on slow CI. The 30s margin
    // still proves the same boundary without being sensitive to execution latency.
    const insideFloor = offer({ store_name: "at-edge", price: 100, observed_at: hoursAgo(PICK_FRESHNESS_MAX_HOURS - 30 / 3600) });
    const outsideFloor = offer({ store_name: "over-edge", price: 90, observed_at: hoursAgo(PICK_FRESHNESS_MAX_HOURS + 30 / 3600) });
    const { summary } = deriveComparisonSummary([insideFloor, outsideFloor]);
    // The cheaper "over-edge" offer is excluded; the boundary offer, being inside the
    // threshold, is still eligible and wins by elimination.
    expect(summary.cheapest_store).toBe("at-edge");
    expect(summary.lowest_price).toBe(100);
  });

  it("a fresh single-store product still gets a real, honest price", () => {
    const { summary } = deriveComparisonSummary([offer({ price: 500, observed_at: hoursAgo(2) })]);
    expect(summary.cheapest_store).toBe("اكسترا");
    expect(summary.lowest_price).toBe(500);
    expect(summary.store_count).toBe(1);
  });

  it("a stale single-store product goes honest-zero, not honest-single", () => {
    const { summary, message } = deriveComparisonSummary([offer({ price: 500, observed_at: hoursAgo(300) })]);
    expect(summary.cheapest_store).toBeNull();
    expect(summary.lowest_price).toBeNull();
    expect(summary.store_count).toBe(1); // the offer is still known, just not claimable as current
    expect(message).toBeDefined();
  });

  it("an out-of-stock stale winner is excluded the same as any other stale offer", () => {
    const offers = [
      offer({ store_name: "اكسترا", price: 50, observed_at: hoursAgo(500), availability: "out_of_stock" }),
      offer({ store_name: "جرير", price: 80, observed_at: hoursAgo(4), availability: "in_stock" }),
    ];
    const { summary } = deriveComparisonSummary(offers);
    expect(summary.cheapest_store).toBe("جرير");
    expect(summary.lowest_price).toBe(80);
  });

  it("never mutates or drops the input offers array — price-history evidence stays intact upstream", () => {
    const offers = [
      offer({ store_name: "اكسترا", price: 999, observed_at: hoursAgo(300) }),
      offer({ store_name: "جرير", price: 1099, observed_at: hoursAgo(10) }),
    ];
    const before = offers.map((o) => ({ ...o }));
    deriveComparisonSummary(offers);
    expect(offers).toEqual(before);
  });

  it("no false coverage loss: store_count and offer list are identical whether stale or fresh", () => {
    const allFresh = [offer({ store_name: "a", observed_at: hoursAgo(1) }), offer({ store_name: "b", observed_at: hoursAgo(2) })];
    const allStale = [offer({ store_name: "a", observed_at: hoursAgo(500) }), offer({ store_name: "b", observed_at: hoursAgo(600) })];
    expect(deriveComparisonSummary(allFresh).summary.store_count).toBe(2);
    expect(deriveComparisonSummary(allStale).summary.store_count).toBe(2);
  });
});
