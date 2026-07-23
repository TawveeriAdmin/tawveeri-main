// tests/catalog/projection-derive.test.ts
// ADR-067 gate for the set-based projection builder. `deriveProjection` is the
// pure core of the rewrite: given a canonical plus its latest price per store,
// it must produce byte-identical output to the v2 row-at-a-time implementation.
// Verified against production: 1,815 rows, every price field identical.
import { deriveProjection } from "../../scripts/build-tps-projection";

type Args = Parameters<typeof deriveProjection>[0];
const row = (over: Partial<Args> = {}): Args => ({
  canonical_id: "11111111-1111-4111-8111-111111111111",
  tps_identity_key: "apple|iPhone|17|Pro|256",
  name_ar: "آبل آيفون 17 برو 256 جيجابايت",
  name_en: "Apple iPhone 17 Pro 256GB",
  brand: "apple",
  category: "mobile",
  identity_confidence: 90,
  attributes: null,
  stores: null,
  prices: null,
  ...over,
});

describe("price aggregation", () => {
  it("takes lowest/highest/cheapest from the latest price per store", () => {
    const p = deriveProjection(row({ stores: ["اكسترا", "جرير", "أمازون"], prices: ["4199.00", "4599.00", "3999.00"] }));
    expect(p.lowest_price).toBe(3999);
    expect(p.highest_price).toBe(4599);
    expect(p.cheapest_store).toBe("أمازون");
    expect(p.store_count).toBe(3);
    expect(p.has_comparison).toBe(true);
  });

  it("computes saving and spread exactly as v2 (2-dp rounding)", () => {
    const p = deriveProjection(row({ stores: ["a", "b"], prices: ["1000.00", "1333.00"] }));
    expect(p.saving).toBe(333);
    expect(p.price_spread_pct).toBe(33.3);
  });

  it("reports no saving and a zero spread for a single store (v2 semantics)", () => {
    // v2 emitted saving=null (nothing is higher) but spread=0 (low === high, and
    // the guard only requires lowest > 0). Preserved deliberately: changing it
    // would alter every single-store row for no correctness gain.
    const p = deriveProjection(row({ stores: ["a"], prices: ["1000.00"] }));
    expect(p.saving).toBeNull();
    expect(p.price_spread_pct).toBe(0);
    expect(p.has_comparison).toBe(false);
  });

  it("emits null spread only when there is no price at all", () => {
    const p = deriveProjection(row({ stores: null, prices: null }));
    expect(p.price_spread_pct).toBeNull();
    expect(p.saving).toBeNull();
  });

  it("is not a comparison with a single store — the core honesty rule", () => {
    expect(deriveProjection(row({ stores: ["جرير"], prices: ["500"] })).has_comparison).toBe(false);
    expect(deriveProjection(row({ stores: ["جرير", "اكسترا"], prices: ["500", "600"] })).has_comparison).toBe(true);
  });

  it("discards non-positive and unparseable prices rather than trusting them", () => {
    const p = deriveProjection(row({ stores: ["a", "b", "c"], prices: ["0", "-5", "700"] }));
    expect(p.store_count).toBe(1);
    expect(p.lowest_price).toBe(700);
    expect(p.has_comparison).toBe(false);
  });
});

describe("determinism — a projection that cannot be reproduced cannot be verified", () => {
  it("breaks exact price ties by store name, not by input order", () => {
    // 12 of 1,815 production rows are exact ties; v2 let the database decide.
    const a = deriveProjection(row({ stores: ["المنيع", "اكسترا"], prices: ["6199.00", "6199.00"] }));
    const b = deriveProjection(row({ stores: ["اكسترا", "المنيع"], prices: ["6199.00", "6199.00"] }));
    expect(a.cheapest_store).toBe(b.cheapest_store);
    expect(a.text_for_search).toBe(b.text_for_search);
  });

  it("produces identical output when called twice on the same evidence", () => {
    const r = row({ stores: ["a", "b"], prices: ["10", "20"] });
    expect(deriveProjection(r)).toEqual(deriveProjection(r));
  });
});

describe("empty and partial evidence", () => {
  it("keeps the product with zero stores rather than dropping or faking it", () => {
    const p = deriveProjection(row({ stores: null, prices: null }));
    expect(p.store_count).toBe(0);
    expect(p.lowest_price).toBeNull();
    expect(p.cheapest_store).toBeNull();
    expect(p.has_comparison).toBe(false);
    expect(p.tps_identity_key).toBe("apple|iPhone|17|Pro|256"); // identity survives
  });

  it("survives an empty array and a stores/prices length mismatch", () => {
    expect(deriveProjection(row({ stores: [], prices: [] })).store_count).toBe(0);
    const p = deriveProjection(row({ stores: ["a", "b"], prices: ["100"] }));
    expect(p.store_count).toBe(1);
    expect(p.lowest_price).toBe(100);
  });

  it("never throws on missing names or attributes", () => {
    expect(() => deriveProjection(row({ name_ar: null, name_en: null, brand: null, category: null }))).not.toThrow();
  });
});

describe("identity and URL semantics are preserved exactly", () => {
  it("percent-encodes the identity key in compare_url (keys contain '|')", () => {
    const p = deriveProjection(row({ tps_identity_key: "apple|iPhone|17|Pro|256" }));
    expect(p.compare_url).toBe("/ar/compare/apple%7CiPhone%7C17%7CPro%7C256");
  });

  it("encodes Arabic keys without corrupting them", () => {
    const p = deriveProjection(row({ tps_identity_key: "سامسونج|جالاكسي" }));
    expect(p.compare_url).toBe(`/ar/compare/${encodeURIComponent("سامسونج|جالاكسي")}`);
  });

  it("carries canonical_id and identity_confidence through unchanged", () => {
    const p = deriveProjection(row({ identity_confidence: 73 }));
    expect(p.identity_confidence).toBe(73);
    expect(p.canonical_id).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("text_for_search composition (drives search retrieval)", () => {
  it("includes names, brand, category, cheapest store and the price in riyals", () => {
    const p = deriveProjection(row({ stores: ["جرير"], prices: ["4599"] }));
    for (const part of ["آبل آيفون 17", "Apple iPhone 17", "apple", "mobile", "جرير", "4599 ريال"]) {
      expect(p.text_for_search).toContain(part);
    }
  });

  it("appends category attributes in the v2 order", () => {
    const p = deriveProjection(row({
      category: "air_conditioner",
      attributes: { capacity_btu: 18000, technology: "inverter", cooling_mode: "hot_cold", ac_type: "split" },
    }));
    expect(p.text_for_search).toContain("18000 BTU");
    expect(p.text_for_search).toContain("inverter");
    expect(p.text_for_search).toContain("حار وبارد hot and cold");
    expect(p.text_for_search).toContain("split");
  });

  it("omits absent attributes instead of emitting empty tokens", () => {
    const p = deriveProjection(row({ attributes: { family: "iPhone", generation: "17" } }));
    expect(p.text_for_search).not.toContain("undefined");
    expect(p.text_for_search).not.toContain("null");
    expect(p.text_for_search).not.toMatch(/\s{2,}/);
  });
});

describe("high volume", () => {
  it("handles a many-store product without losing or duplicating a store", () => {
    const stores = Array.from({ length: 40 }, (_, i) => `store${String(i).padStart(2, "0")}`);
    const prices = stores.map((_, i) => String(1000 + i));
    const p = deriveProjection(row({ stores, prices }));
    expect(p.store_count).toBe(40);
    expect(p.lowest_price).toBe(1000);
    expect(p.highest_price).toBe(1039);
    expect(p.cheapest_store).toBe("store00");
  });

  it("derives 5,000 rows well under a second — the rewrite must not move the cost", () => {
    const t0 = Date.now();
    for (let i = 0; i < 5000; i++) {
      deriveProjection(row({ tps_identity_key: `k|${i}`, stores: ["a", "b"], prices: ["100", "200"] }));
    }
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
