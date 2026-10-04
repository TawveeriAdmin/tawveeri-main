// tests/compare/identity-verifier-gate.test.ts — Phase 3B (2026-10-03).
// The compare page's identity gate (flag `TPS_IDENTITY_V2`, default OFF): key equality proposes
// the offer set, the verifier decides. A rejected offer (stated-attribute conflict) is dropped
// from the page; a review-tier offer stays as a reference row and never backs the cheapest claim;
// with the flag OFF nothing changes (rollback proof for the read path).
import {
  applyIdentityVerifierGate,
  deriveComparisonSummary,
  partitionOffersByEligibility,
  type CompareOffer,
} from "../../src/lib/compare/get-comparison";

const NOW = Date.parse("2026-10-03T06:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const offer = (over: Partial<CompareOffer> = {}): CompareOffer => ({
  store_slug: "extra",
  store_name: "إكسترا",
  raw_name: "Apple iPhone 14, 5G, 128GB, Blue",
  price: 2999,
  availability: "in_stock",
  product_url: "/go/x",
  observed_at: hoursAgo(1),
  stale: false,
  confidence: 100,
  is_verified: true,
  campaign_eligibility: null,
  ...over,
});

describe("applyIdentityVerifierGate", () => {
  it("drops a refurbished listing from a new-price comparison (P020 class) and keeps the rest", () => {
    const offers = [
      offer({ store_slug: "amazon", store_name: "أمازون", raw_name: "Apple (Refurbished) iPhone 14 5G 128GB Phone - Midnight", price: 1899 }),
      offer({ store_slug: "extra", price: 2999 }),
      offer({ store_slug: "almanea", store_name: "المنيع", raw_name: "ابل ايفون 14، 128 جيجا، 5 جي، ازرق", price: 2949 }),
    ];
    const gated = applyIdentityVerifierGate(offers, "mobile");
    expect(gated.map((o) => o.store_slug)).toEqual(["extra", "almanea"]);
    expect(gated.every((o) => o.identity_verdict === undefined)).toBe(true);
  });

  it("keeps a region-tagged listing as a REVIEW reference row that never backs the cheapest claim", () => {
    const offers = [
      offer({ store_slug: "noon", store_name: "نون", raw_name: "Apple iPhone 14 128GB Blue (International Version)", price: 2599 }),
      offer({ store_slug: "extra", price: 2999 }),
    ];
    const gated = applyIdentityVerifierGate(offers, "mobile");
    expect(gated).toHaveLength(2);
    const noon = gated.find((o) => o.store_slug === "noon")!;
    expect(noon.identity_verdict?.outcome).toBe("review");
    expect(noon.identity_verdict?.reasons[0]).toMatch(/region_tag_one_side/);
    const p = partitionOffersByEligibility(gated, NOW);
    expect(p.eligible.map((o) => o.store_slug)).toEqual(["extra"]);
    expect(p.older.map((o) => o.store_slug)).toEqual(["noon"]);
    expect(deriveComparisonSummary(gated, NOW).summary.cheapest_store).toBe("إكسترا");
    expect(deriveComparisonSummary(gated, NOW).summary.lowest_price).toBe(2999);
  });

  it("a two-sided conflict resolves against the page's own identity (anchor): the side that conflicts with the canonical name leaves", () => {
    const offers = [
      offer({ store_slug: "amazon", raw_name: "Samsung Galaxy A06 5G, Dual SIM, 4GB RAM, 128GB Storage, Black", price: 449 }),
      offer({ store_slug: "extra", raw_name: "Samsung Galaxy A06, 4G, 128GB, 4GB RAM, Black", price: 499 }),
    ];
    expect(applyIdentityVerifierGate(offers, "mobile", "Samsung Galaxy A06, 4G, 128GB, 4GB RAM").map((o) => o.store_slug)).toEqual(["extra"]);
    expect(applyIdentityVerifierGate(offers, "mobile", "Samsung Galaxy A06 5G 128GB").map((o) => o.store_slug)).toEqual(["amazon"]);
  });

  it("without an anchor a two-sided conflict keeps the larger consistent set — never an empty page, never both sides", () => {
    const offers = [
      offer({ store_slug: "amazon", raw_name: "Samsung Galaxy A06 5G, Dual SIM, 4GB RAM, 128GB Storage, Black", price: 449 }),
      offer({ store_slug: "extra", raw_name: "Samsung Galaxy A06, 4G, 128GB, 4GB RAM, Black", price: 499 }),
      offer({ store_slug: "almanea", raw_name: "سامسونج جالاكسي A06 LTE 4 جيجابايت 128 جيجابايت أسود", price: 479 }),
    ];
    expect(applyIdentityVerifierGate(offers, "mobile").map((o) => o.store_slug)).toEqual(["extra", "almanea"]);
  });

  it("a 1-vs-1 conflict nothing resolves leaves BOTH sides as reference rows — never a coin flip, never price-favoured", () => {
    const offers = [
      offer({ store_slug: "amazon", raw_name: "Samsung Galaxy A06 5G, Dual SIM, 4GB RAM, 128GB Storage, Black", price: 449 }),
      offer({ store_slug: "extra", raw_name: "Samsung Galaxy A06, 4G, 128GB, 4GB RAM, Black", price: 499 }),
    ];
    const gated = applyIdentityVerifierGate(offers, "mobile");
    expect(gated.map((o) => o.identity_verdict?.outcome)).toEqual(["review", "review"]);
    expect(gated[0].identity_verdict!.reasons.join(" ")).toMatch(/conflict_unresolved/);
    // reversing the input order or the prices changes nothing
    const swapped = applyIdentityVerifierGate([{ ...offers[1], price: 399 }, { ...offers[0], price: 999 }], "mobile");
    expect(swapped.every((o) => o.identity_verdict?.outcome === "review")).toBe(true);
    expect(deriveComparisonSummary(gated, NOW).summary.cheapest_store).toBeNull();
  });

  it("source-declared model codes (payload) decide where titles state none: eXtra's codeless title vs Almanea's declared code", () => {
    const offers = [
      offer({ store_slug: "extra", raw_name: "Samsung Front Load Washer 21KG Hygiene Steam WIFI 1100 rpm Black", price: 2999, source_model: "WF21T6500GV" }),
      offer({ store_slug: "almanea", raw_name: "غسالة سامسونج 21 ك فتحة امامية اسود WF21T6500GV", price: 3099, source_model: "WF21T6500GV" }),
    ];
    expect(applyIdentityVerifierGate(offers, "washing_machine").every((o) => o.identity_verdict === undefined)).toBe(true);
    const conflicting = [offers[0], { ...offers[1], source_model: "WF21T6500GV/YL", raw_name: "Samsung WF21T6500GV/YL Frontload Washer 21kg" }, offer({ store_slug: "noon", raw_name: "Samsung Washer 21kg WF24B9600KE", price: 2899, source_model: "WF24B9600KE" })];
    const gated = applyIdentityVerifierGate(conflicting, "washing_machine", null, "WF21T6500GV");
    expect(gated.map((o) => o.store_slug)).toEqual(["extra", "almanea"]);
  });

  it("a code on one side only marks the CODELESS side as the reference row (washer family key)", () => {
    const offers = [
      offer({ store_slug: "amazon", raw_name: "Bosch Washing Machine WGA144ZRSA, Series 4, Front Load 9 kg, 1400 RPM", price: 1899 }),
      offer({ store_slug: "extra", raw_name: "Bosch Series 4 Front Load Washing Machine 9 kg Grey", price: 1999 }),
    ];
    const gated = applyIdentityVerifierGate(offers, "washing_machine");
    expect(gated.find((o) => o.store_slug === "amazon")!.identity_verdict).toBeUndefined();
    expect(gated.find((o) => o.store_slug === "extra")!.identity_verdict?.outcome).toBe("review");
  });

  it("a colour-code suffix pair is symmetric: the side that is not an exact-code match with the anchor is the reference row; both are when the anchor cannot tell", () => {
    const offers = [
      offer({ store_slug: "amazon", raw_name: "Samsung 620 Liter Double Door Refrigerator | Model No RT62K7050SLB", price: 2899 }),
      offer({ store_slug: "almanea", raw_name: "ثلاجة سامسونج بابين، سعة 21.9 قدم مكعب، انفرتر، فضي - RT62K7050SLH", price: 2799 }),
    ];
    const anchored = applyIdentityVerifierGate(offers, "refrigerator", "Samsung Top Freezer Refrigerator 620 L Silver RT62K7050SLH");
    expect(anchored.find((o) => o.store_slug === "almanea")!.identity_verdict).toBeUndefined();
    expect(anchored.find((o) => o.store_slug === "amazon")!.identity_verdict?.outcome).toBe("review");
    const blind = applyIdentityVerifierGate(offers, "refrigerator");
    expect(blind.every((o) => o.identity_verdict?.outcome === "review")).toBe(true);
    expect(deriveComparisonSummary(blind, NOW).summary.cheapest_store).toBeNull();
  });

  it("a MODEL-keyed group shares its code: the key's code is structured evidence, so a title without the code is NOT a one-side review", () => {
    const offers = [
      offer({ store_slug: "amazon", raw_name: "Bosch Washing Machine WGA144ZRSA, Series 4, Front Load 9 kg, 1400 RPM", price: 1899 }),
      offer({ store_slug: "extra", raw_name: "Bosch Series 4 Front Load Washing Machine 9 kg Grey", price: 1999 }),
    ];
    const gated = applyIdentityVerifierGate(offers, "washing_machine", null, "WGA144ZRSA");
    expect(gated.every((o) => o.identity_verdict === undefined)).toBe(true);
    // …and a title whose own code CONFLICTS with the key's code still leaves.
    const wrong = [offers[0], offer({ store_slug: "noon", raw_name: "Bosch Series 4 Washing Machine 9 kg WGA254ZRSA", price: 1799 })];
    expect(applyIdentityVerifierGate(wrong, "washing_machine", null, "WGA144ZRSA").map((o) => o.store_slug)).toEqual(["amazon"]);
  });

  it("refurbished never prices the new item: 1 refurbished vs 1 new → the refurbished listing leaves; ALL refurbished → every listing is a reference row", () => {
    const mixed = [
      offer({ store_slug: "amazon", raw_name: "Apple (Refurbished) iPhone 11 (128GB) - White", price: 1040 }),
      offer({ store_slug: "extra", raw_name: "Apple iPhone 11 128GB Purple", price: 1068 }),
    ];
    expect(applyIdentityVerifierGate(mixed, "mobile").map((o) => o.store_slug)).toEqual(["extra"]);
    const allRefurb = [
      offer({ store_slug: "amazon", raw_name: "Apple (Refurbished) iPhone 11 (128GB) - White", price: 1040 }),
      offer({ store_slug: "noon", raw_name: "Apple iPhone 11 128GB Renewed", price: 990 }),
    ];
    const g = applyIdentityVerifierGate(allRefurb, "mobile");
    expect(g.map((o) => o.identity_verdict?.outcome)).toEqual(["review", "review"]);
    expect(g[0].identity_verdict!.reasons.join(" ")).toMatch(/condition_refurbished_only/);
    expect(deriveComparisonSummary(g, NOW).summary.cheapest_store).toBeNull();
  });

  it("a single offer is returned untouched", () => {
    const one = [offer()];
    expect(applyIdentityVerifierGate(one, "mobile")).toBe(one);
  });
});
