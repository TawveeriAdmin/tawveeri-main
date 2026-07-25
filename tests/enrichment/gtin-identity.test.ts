// tests/enrichment/gtin-identity.test.ts
import { groupByGtin, gtinComparisons } from "@/lib/enrichment/gtin-identity";

const EAN13 = "4006381333931"; // valid
const UPCA = "036000291452";   // valid UPC-A
const UPCA_AS_EAN13 = "0036000291452"; // same trade item, EAN-13 form

describe("groupByGtin", () => {
  it("marks a GTIN sold by ≥2 distinct stores as a comparison", () => {
    const groups = groupByGtin([
      { store_id: 1, gtin: EAN13, price: 100 },
      { store_id: 2, gtin: EAN13, price: 95 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].stores.sort()).toEqual([1, 2]);
    expect(groups[0].isComparison).toBe(true);
    expect(groups[0].observations).toHaveLength(2);
  });

  it("does NOT count one store repeating a GTIN as a comparison", () => {
    const groups = groupByGtin([
      { store_id: 5, gtin: EAN13 },
      { store_id: 5, gtin: EAN13 },
    ]);
    expect(groups[0].stores).toEqual([5]);
    expect(groups[0].isComparison).toBe(false);
  });

  it("collapses UPC-A and its EAN-13 leading-zero form into one comparison", () => {
    const groups = groupByGtin([
      { store_id: 1, gtin: UPCA },
      { store_id: 2, gtin: UPCA_AS_EAN13 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].isComparison).toBe(true);
    expect(groups[0].gtinKey).toBe("00036000291452");
  });

  it("drops observations without a checksum-valid GTIN (never guesses)", () => {
    const groups = groupByGtin([
      { store_id: 1, gtin: "SSBX525-B5" },
      { store_id: 2, gtin: null },
      { store_id: 3, gtin: "123" },
    ]);
    expect(groups).toHaveLength(0);
  });

  it("ignores null store_ids when counting distinct stores", () => {
    const groups = groupByGtin([
      { store_id: null, gtin: EAN13 },
      { store_id: 2, gtin: EAN13 },
    ]);
    expect(groups[0].stores).toEqual([2]);
    expect(groups[0].isComparison).toBe(false);
  });

  it("sorts deepest comparisons first", () => {
    const groups = groupByGtin([
      { store_id: 1, gtin: EAN13 },
      { store_id: 2, gtin: EAN13 },
      { store_id: 3, gtin: EAN13 },
      { store_id: 9, gtin: UPCA },
      { store_id: 9, gtin: UPCA },
    ]);
    expect(groups[0].stores).toHaveLength(3); // the 3-store group leads
    expect(groups[0].gtinKey).toBe("04006381333931");
  });
});

describe("gtinComparisons", () => {
  it("returns only the ≥2-store groups", () => {
    const cmp = gtinComparisons([
      { store_id: 1, gtin: EAN13 },
      { store_id: 2, gtin: EAN13 },
      { store_id: 7, gtin: UPCA }, // single store → excluded
    ]);
    expect(cmp).toHaveLength(1);
    expect(cmp[0].gtinKey).toBe("04006381333931");
  });
});
