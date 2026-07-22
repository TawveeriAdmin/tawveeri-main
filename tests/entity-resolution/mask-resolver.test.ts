/**
 * Entity-Resolution primitives — leakage protection + multi-signal precision.
 * The masker must remove exact identifiers while keeping the human product
 * description; the resolver must reject adversarially-similar hard negatives.
 */
import { maskIdentifiers } from "../../src/lib/entity-resolution/mask";
import { pairScore, specNumbers, verifySameProduct, designationSet } from "../../src/lib/entity-resolution/resolver";

describe("maskIdentifiers — strip identifiers, keep description (anti-leakage)", () => {
  it("removes model codes / SKUs / GTINs", () => {
    expect(maskIdentifiers("Samsung Galaxy S25 Ultra 256GB SM-S938BZKIMEA 5G")).not.toMatch(/S938BZKIMEA/);
    expect(maskIdentifiers("Apple iPhone 16 Pro Max MYWJ3AHA 512GB")).not.toMatch(/MYWJ3AHA/);
    expect(maskIdentifiers("Noon Galaxy A16 N70126887V")).not.toMatch(/N70126887V/);
    expect(maskIdentifiers("Barcode 6291234567890 TV")).not.toMatch(/6291234567890/);
  });
  it("KEEPS the natural description (brand, family, specs)", () => {
    const m = maskIdentifiers("Samsung Galaxy S25 Ultra 256GB SM-S938BZKIMEA 5G");
    expect(m).toMatch(/samsung|Samsung/i); expect(m).toMatch(/Galaxy/); expect(m).toMatch(/S25/);
    expect(m).toMatch(/Ultra/); expect(m).toMatch(/256GB/); expect(m).toMatch(/5G/);
  });
  it("keeps spec-with-unit tokens even when alphanumeric (10100mAh)", () => {
    expect(maskIdentifiers("Tablet 10100mAh 128GB")).toMatch(/10100mAh/);
  });
});

describe("specNumbers", () => {
  it("extracts storage/size discriminators", () => {
    expect(specNumbers("iPhone 16 Pro Max 256GB").has(256)).toBe(true);
    expect(specNumbers("TV 55 inch 4K").has(55)).toBe(true);
  });
});

describe("pairScore — multi-signal precision (masked titles)", () => {
  const r = (title: string, brand = "apple") => ({ title, brand });
  it("scores a genuine same-product pair (divergent titles) high", () => {
    const s = pairScore(r("Apple iPhone 16 Pro Max 256GB Desert Titanium 5G"), r("iPhone 16 Pro Max, 5G, 6.9 inch, 256 GB, Titanium"));
    expect(s).toBeGreaterThan(0.4);
  });
  it("REJECTS an adversarial hard negative: same model, different storage (256 vs 512)", () => {
    const same = pairScore(r("Apple iPhone 16 Pro Max 256GB Titanium"), r("Apple iPhone 16 Pro Max 256GB Titanium"));
    const diff = pairScore(r("Apple iPhone 16 Pro Max 256GB Titanium"), r("Apple iPhone 16 Pro Max 512GB Titanium"));
    expect(diff).toBeLessThan(same * 0.6); // spec conflict heavily penalized
  });
  it("returns 0 for different known brands", () => {
    expect(pairScore({ title: "55 inch 4K QLED TV", brand: "samsung" }, { title: "55 inch 4K QLED TV", brand: "lg" })).toBe(0);
  });
});

describe("verifySameProduct — the deterministic precision gate (candidates → resolution)", () => {
  const r = (title: string, brand = "samsung") => ({ title, brand });
  it("ACCEPTS a genuine same-product pair across languages (cross-lingual)", () => {
    expect(verifySameProduct(r("Samsung Galaxy A56 5G 128GB"), r("سامسونج جالاكسي A56 5G، 128 جيجا"))).toBe(true);
  });
  it("REJECTS a family/generation hard negative embeddings can't separate", () => {
    expect(designationSet("Galaxy A56").has("a56")).toBe(true);
    expect(verifySameProduct(r("Samsung Galaxy A56 5G"), r("Samsung Galaxy A25 5G"))).toBe(false); // A56 ≠ A25
    expect(verifySameProduct(r("Apple Watch Series 10 46mm", "apple"), r("Apple Watch Series 11 46mm", "apple"))).toBe(false); // gen 10 ≠ 11
    expect(verifySameProduct(r("Huawei Watch GT5 41mm", "huawei"), r("Huawei Watch GT6 41mm", "huawei"))).toBe(false); // GT5 ≠ GT6
  });
  it("REJECTS storage and variant hard negatives", () => {
    expect(verifySameProduct(r("iPhone 16 Pro Max 256GB", "apple"), r("iPhone 16 Pro Max 512GB", "apple"))).toBe(false); // 256 ≠ 512
    expect(verifySameProduct(r("iPhone 16 Pro Max 256GB", "apple"), r("iPhone 16 Pro 256GB", "apple"))).toBe(false);     // Pro Max ≠ Pro
  });
});
