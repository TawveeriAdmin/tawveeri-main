/**
 * Knowledge-Graph relationship edges — deterministic, precision-first.
 * An edge asserts a product relationship, so it must require exact agreement on
 * every identity field except the one that defines the relationship.
 */
import { deriveProductEdges, genNumber, type EdgeCanonical } from "../../src/lib/intelligence/product-edges";

const c = (o: Partial<EdgeCanonical> & { id: string }): EdgeCanonical => ({
  brand: "apple", family: "iPhone", generation: "16", variant: "Pro Max", storage: 256, price: 5699, ...o,
});

describe("genNumber", () => {
  it("extracts a numeric generation", () => {
    expect(genNumber("16")).toBe(16);
    expect(genNumber("S26")).toBe(26);
    expect(genNumber(null)).toBeNull();
    expect(genNumber("Air")).toBeNull();
  });
});

describe("storage_variant edges", () => {
  it("links adjacent storages of the SAME model, with price delta", () => {
    const e = deriveProductEdges([c({ id: "a", storage: 256, price: 5699 }), c({ id: "b", storage: 512, price: 6499 })]);
    const sv = e.find((x) => x.type === "storage_variant");
    expect(sv).toBeDefined();
    expect(sv!.from_id).toBe("a"); expect(sv!.to_id).toBe("b");
    expect(sv!.price_delta).toBe(800);
    expect(sv!.detail).toBe("256GB → 512GB");
  });
  it("does NOT link different variants (Pro Max ≠ Pro)", () => {
    const e = deriveProductEdges([c({ id: "a", variant: "Pro Max", storage: 256 }), c({ id: "b", variant: "Pro", storage: 512 })]);
    expect(e.filter((x) => x.type === "storage_variant")).toHaveLength(0);
  });
});

describe("successor edges", () => {
  it("links consecutive generations of the SAME config (older → newer)", () => {
    const e = deriveProductEdges([c({ id: "g15", generation: "15", price: 5000 }), c({ id: "g16", generation: "16", price: 5699 })]);
    const s = e.find((x) => x.type === "successor");
    expect(s).toBeDefined();
    expect(s!.from_id).toBe("g15"); expect(s!.to_id).toBe("g16");
    expect(s!.price_delta).toBe(699);
  });
  it("does NOT link non-consecutive generations (15 → 17)", () => {
    const e = deriveProductEdges([c({ id: "g15", generation: "15" }), c({ id: "g17", generation: "17" })]);
    expect(e.filter((x) => x.type === "successor")).toHaveLength(0);
  });
  it("does NOT link across different storage (identity must match)", () => {
    const e = deriveProductEdges([c({ id: "g15", generation: "15", storage: 128 }), c({ id: "g16", generation: "16", storage: 256 })]);
    expect(e.filter((x) => x.type === "successor")).toHaveLength(0);
  });
});
