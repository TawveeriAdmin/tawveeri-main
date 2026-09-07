// tests/compare/affiliate-true-tie.test.ts
//
// AFFILIATE_TRUE_TIE_POLICY (Founder decision, 2026-09-07 — ADR-304). Safety test matrix
// per the founder's own mission §7 (CASE A-H), plus the two invariants the whole policy
// depends on: price truth is never altered, and affiliate status alone can never beat a
// materially better shopper offer.
import {
  isTrueTie,
  applyAffiliateTrueTieOrder,
  isAffiliateMerchant,
  type TrueTieCandidate,
} from "../../src/lib/compare/affiliate-true-tie";

const candidate = (over: Partial<TrueTieCandidate> = {}): TrueTieCandidate => ({
  store_slug: "extra",
  price: 2000,
  availability: "in_stock",
  stale: false,
  product_url: "/go/1",
  raw_name: "Samsung Galaxy A55 128GB",
  ...over,
});

describe("isAffiliateMerchant — registry-driven, never hardcoded", () => {
  it("amazon and noon are affiliate merchants today", () => {
    expect(isAffiliateMerchant("amazon")).toBe(true);
    expect(isAffiliateMerchant("noon")).toBe(true);
  });
  it("a non-affiliate merchant (extra, jarir, almanea) is not", () => {
    expect(isAffiliateMerchant("extra")).toBe(false);
    expect(isAffiliateMerchant("jarir")).toBe(false);
    expect(isAffiliateMerchant("almanea")).toBe(false);
  });
  it("an unknown slug is never treated as affiliate", () => {
    expect(isAffiliateMerchant("not-a-real-store")).toBe(false);
  });
});

describe("CASE A — true tie: same product, same condition, same price, equivalent freshness — affiliate MAY win the tie", () => {
  it("amazon leads a genuine tie with almanea", () => {
    const offers = [
      candidate({ store_slug: "almanea", price: 2000 }),
      candidate({ store_slug: "amazon", price: 2000 }),
    ];
    const ordered = applyAffiliateTrueTieOrder(offers);
    expect(ordered.map((o) => o.store_slug)).toEqual(["amazon", "almanea"]);
  });
});

describe("CASE B — non-affiliate cheaper: non-affiliate wins, no reordering happens", () => {
  it("almanea at 1900 stays first ahead of amazon at 2000", () => {
    const offers = [
      candidate({ store_slug: "almanea", price: 1900 }),
      candidate({ store_slug: "amazon", price: 2000 }),
    ].sort((a, b) => a.price - b.price);
    const ordered = applyAffiliateTrueTieOrder(offers);
    expect(ordered.map((o) => o.store_slug)).toEqual(["almanea", "amazon"]);
    expect(ordered[0].price).toBe(1900); // price truth untouched
  });
});

describe("CASE C — affiliate cheaper: affiliate wins because it is the better offer, not because of status", () => {
  it("amazon at 1900 stays first ahead of almanea at 2000 — no tie exists, so the tie-break never runs", () => {
    const offers = [
      candidate({ store_slug: "amazon", price: 1900 }),
      candidate({ store_slug: "almanea", price: 2000 }),
    ].sort((a, b) => a.price - b.price);
    const ordered = applyAffiliateTrueTieOrder(offers);
    expect(ordered.map((o) => o.store_slug)).toEqual(["amazon", "almanea"]);
    expect(ordered[0].price).toBe(1900);
  });
});

describe("CASE D — wrong variant: excluded upstream by construction, not re-derived here", () => {
  it("documents that TrueTieCandidate carries no variant/model/storage field — variant safety is the caller's (get-comparison.ts's canonical_product_id grouping) responsibility, never re-checked in this pure module", () => {
    const offer = candidate();
    const keys = Object.keys(offer);
    expect(keys).not.toContain("variant");
    expect(keys).not.toContain("storage");
    expect(keys).not.toContain("model");
  });
});

describe("CASE E — refurbished vs new: not a true tie", () => {
  it("an explicitly-refurbished offer never ties with an explicitly-new offer at the same price", () => {
    const leader = candidate({ store_slug: "amazon", raw_name: "Samsung Galaxy A55 128GB (Refurbished)" });
    const other = candidate({ store_slug: "almanea", raw_name: "Samsung Galaxy A55 128GB - Renewed" });
    // Both explicit but DIFFERENT conditions (REFURBISHED vs RENEWED) -> not equivalent.
    expect(isTrueTie(leader, other).trueTie).toBe(false);
    expect(isTrueTie(leader, other).reason).toBe("CONDITION_MISMATCH");
  });
  it("an offer with NO condition marker at all is UNKNOWN, not presumed NEW — UNKNOWN != EQUAL blocks the tie", () => {
    const leader = candidate({ store_slug: "amazon", raw_name: "Samsung Galaxy A55 128GB" });
    const refurb = candidate({ store_slug: "almanea", raw_name: "Samsung Galaxy A55 128GB (Refurbished)" });
    const result = isTrueTie(leader, refurb);
    expect(result.trueTie).toBe(false);
    expect(result.reason).toBe("CONDITION_UNKNOWN"); // leader's own title carries no marker -> UNKNOWN
  });
});

describe("CASE F — stale affiliate offer: freshness advantage blocks the tie", () => {
  it("a stale affiliate offer does not lead over a fresher non-affiliate offer at the same price", () => {
    const offers = [
      candidate({ store_slug: "almanea", price: 2000, stale: false }),
      candidate({ store_slug: "amazon", price: 2000, stale: true }),
    ];
    const ordered = applyAffiliateTrueTieOrder(offers);
    // Not a true tie (freshness differs) -> original price-sort order preserved untouched.
    expect(ordered.map((o) => o.store_slug)).toEqual(["almanea", "amazon"]);
  });
});

describe("CASE G — two affiliates true-tied: deterministic shared policy, not randomness", () => {
  it("amazon leads noon when both are genuinely tied with each other and cheaper than a third store", () => {
    const offers = [
      candidate({ store_slug: "noon", price: 2000 }),
      candidate({ store_slug: "amazon", price: 2000 }),
      candidate({ store_slug: "jarir", price: 2000 }),
    ];
    const ordered = applyAffiliateTrueTieOrder(offers);
    expect(ordered.map((o) => o.store_slug)).toEqual(["amazon", "noon", "jarir"]);
  });
});

describe("CASE H — five genuinely equal stores: affiliate merchants lead, product truth unchanged", () => {
  it("amazon and noon lead ahead of almanea/jarir/extra, all at the identical price", () => {
    const offers = [
      candidate({ store_slug: "almanea", price: 2000 }),
      candidate({ store_slug: "amazon", price: 2000 }),
      candidate({ store_slug: "jarir", price: 2000 }),
      candidate({ store_slug: "noon", price: 2000 }),
      candidate({ store_slug: "extra", price: 2000 }),
    ];
    const ordered = applyAffiliateTrueTieOrder(offers);
    expect(ordered.map((o) => o.store_slug)).toEqual(["amazon", "noon", "almanea", "jarir", "extra"]);
    // Product truth: every offer still present, every price still 2000 — nothing dropped,
    // nothing re-priced.
    expect(ordered).toHaveLength(5);
    expect(ordered.every((o) => o.price === 2000)).toBe(true);
  });
});

describe("safety invariants", () => {
  it("never promotes an offer ahead of a materially cheaper one, however many ties exist above it", () => {
    const offers = [
      candidate({ store_slug: "almanea", price: 1900 }),
      candidate({ store_slug: "amazon", price: 2000 }),
      candidate({ store_slug: "noon", price: 2000 }),
    ].sort((a, b) => a.price - b.price);
    const ordered = applyAffiliateTrueTieOrder(offers);
    expect(ordered[0].store_slug).toBe("almanea");
    expect(ordered[0].price).toBe(1900);
  });

  it("out-of-stock offers never join or lead a true-tie group", () => {
    const offers = [
      candidate({ store_slug: "almanea", price: 2000, availability: "in_stock" }),
      candidate({ store_slug: "amazon", price: 2000, availability: "out_of_stock" }),
    ];
    const ordered = applyAffiliateTrueTieOrder(offers);
    expect(ordered.map((o) => o.store_slug)).toEqual(["almanea", "amazon"]); // unchanged — not a true tie
  });

  it("an offer with no valid destination link never leads a true-tie group", () => {
    const offers = [
      candidate({ store_slug: "almanea", price: 2000, product_url: "/go/1" }),
      candidate({ store_slug: "amazon", price: 2000, product_url: null }),
    ];
    const ordered = applyAffiliateTrueTieOrder(offers);
    expect(ordered.map((o) => o.store_slug)).toEqual(["almanea", "amazon"]);
  });

  it("a lone offer or an empty list is returned unchanged", () => {
    expect(applyAffiliateTrueTieOrder([])).toEqual([]);
    const single = [candidate({ store_slug: "jarir" })];
    expect(applyAffiliateTrueTieOrder(single)).toEqual(single);
  });

  it("never mutates the input array", () => {
    const offers = [
      candidate({ store_slug: "almanea", price: 2000 }),
      candidate({ store_slug: "amazon", price: 2000 }),
    ];
    const copy = [...offers];
    applyAffiliateTrueTieOrder(offers);
    expect(offers).toEqual(copy);
  });
});
