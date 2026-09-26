// tests/compare/partition-offers-by-eligibility.test.ts — ADR-386.
// The compare page renders `eligible` as the comparison set and `older` as last-observed
// reference prices, and publishes ONLY `eligible` in JSON-LD. The partition must apply the
// SAME rule deriveComparisonSummary uses for the lowest/highest claim, so structured data
// can never list a price below its own lowPrice (measured live 2026-09-26: lowPrice 3099
// beside a nested Offer at 2799).
import {
  deriveComparisonSummary,
  partitionOffersByEligibility,
  type CompareOffer,
} from "../../src/lib/compare/get-comparison";
import { PICK_FRESHNESS_MAX_HOURS } from "../../src/lib/intelligence/evidence-engine";

const NOW = Date.parse("2026-09-26T06:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const offer = (over: Partial<CompareOffer> = {}): CompareOffer => ({
  store_slug: "extra",
  store_name: "إكسترا",
  raw_name: "LG FreshDV 18000",
  price: 3099,
  availability: "in_stock",
  product_url: "/go/x",
  observed_at: hoursAgo(1),
  stale: false,
  confidence: 100,
  is_verified: true,
  campaign_eligibility: null,
  ...over,
});

describe("partitionOffersByEligibility — the FreshDV / ArtCool shapes", () => {
  it("FreshDV after the freshness fix: every re-observed store is eligible, lowest matches the list minimum", () => {
    const offers = [
      offer({ store_slug: "alnakheelk", store_name: "متجر النخيل", price: 2799, observed_at: hoursAgo(1) }),
      offer({ store_slug: "shaker", store_name: "شاكر", price: 2799.1, observed_at: hoursAgo(1) }),
      offer({ store_slug: "najm", store_name: "نجم الأجهزة", price: 2978.01, observed_at: hoursAgo(1) }),
      offer({ store_slug: "extra", store_name: "إكسترا", price: 3099, observed_at: hoursAgo(60) }),
      offer({ store_slug: "almanea", store_name: "المنيع", price: 3919, observed_at: hoursAgo(8) }),
    ];
    const { eligible, older } = partitionOffersByEligibility(offers, NOW);
    expect(eligible).toHaveLength(5);
    expect(older).toHaveLength(0);
    const { summary } = deriveComparisonSummary(offers);
    expect(Math.min(...eligible.map((o) => o.price))).toBe(summary.lowest_price);
  });

  it("ArtCool: a cheaper 12-day-old Amazon row and a 36-day-old Noon row are OLDER, never the hero and never in the eligible set", () => {
    const offers = [
      offer({ store_slug: "amazon", store_name: "أمازون", price: 2949, observed_at: hoursAgo(12 * 24), stale: true }),
      offer({ store_slug: "alnakheelk", store_name: "متجر النخيل", price: 3269, observed_at: hoursAgo(1) }),
      offer({ store_slug: "shaker", store_name: "شاكر", price: 3299.35, observed_at: hoursAgo(1) }),
      offer({ store_slug: "noon", store_name: "نون", price: 3369, observed_at: hoursAgo(36 * 24), stale: true }),
      offer({ store_slug: "extra", store_name: "إكسترا", price: 3669, observed_at: hoursAgo(60) }),
    ];
    const { eligible, older } = partitionOffersByEligibility(offers, NOW);
    expect(eligible.map((o) => o.store_slug)).toEqual(["alnakheelk", "shaker", "extra"]);
    expect(older.map((o) => o.store_slug)).toEqual(["amazon", "noon"]);
    // The JSON-LD invariant: no eligible price may undercut the summary's lowPrice.
    const lowest = Math.min(...eligible.map((o) => o.price));
    expect(eligible.every((o) => o.price >= lowest)).toBe(true);
    expect(older.some((o) => o.price < lowest)).toBe(true); // the 2949 row exists — but is disclosed as older, not current
  });

  it("uses the SAME boundary as the summary (PICK_FRESHNESS_MAX_HOURS) and treats out_of_stock as older", () => {
    const boundary = offer({ store_slug: "a", observed_at: hoursAgo(PICK_FRESHNESS_MAX_HOURS) });
    const justOver = offer({ store_slug: "b", observed_at: hoursAgo(PICK_FRESHNESS_MAX_HOURS + 1) });
    const oos = offer({ store_slug: "c", availability: "out_of_stock", observed_at: hoursAgo(1) });
    const { eligible, older } = partitionOffersByEligibility([boundary, justOver, oos], NOW);
    expect(eligible.map((o) => o.store_slug)).toEqual(["a"]);
    expect(older.map((o) => o.store_slug)).toEqual(["b", "c"]);
  });

  it("preserves input order inside each partition and never mutates the input", () => {
    const input = [
      offer({ store_slug: "x", price: 1, observed_at: hoursAgo(500) }),
      offer({ store_slug: "y", price: 2 }),
      offer({ store_slug: "z", price: 3, observed_at: hoursAgo(400) }),
    ];
    const snapshot = JSON.stringify(input);
    const { eligible, older } = partitionOffersByEligibility(input, NOW);
    expect(eligible.map((o) => o.store_slug)).toEqual(["y"]);
    expect(older.map((o) => o.store_slug)).toEqual(["x", "z"]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
