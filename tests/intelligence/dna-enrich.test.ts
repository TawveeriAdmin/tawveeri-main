/**
 * Product-DNA enrichment for model canonicals — deterministic, precision-first.
 * Specs must be extracted only when confidently present (never fabricated), and
 * storage must be the true storage figure, not RAM.
 */
import { extractMobileStorage, extractMobileVariant, enrichMobileDna } from "../../src/lib/intelligence/dna-enrich";

describe("extractMobileStorage — storage, not RAM", () => {
  it("picks storage over RAM when both appear", () => {
    expect(extractMobileStorage("سامسونج جالاكسي ايه 36، 256 جيجا، 8 جيجا رام")).toBe(256);
    expect(extractMobileStorage("iPhone 16 Pro Max 512GB 8GB")).toBe(512);
  });
  it("handles TB and Arabic units", () => {
    expect(extractMobileStorage("iPhone 17 Pro Max 1 TB")).toBe(1024);
    expect(extractMobileStorage("جوال 128 جيجابايت")).toBe(128);
  });
  it("returns null when no recognized storage is present", () => {
    expect(extractMobileStorage("Apple iPhone Air Sky Blue")).toBeNull();
    expect(extractMobileStorage("random 999 gb")).toBeNull(); // 999 not a storage tier
  });
});

describe("extractMobileVariant", () => {
  it("detects tiers, including Arabic", () => {
    expect(extractMobileVariant("iPhone 16 Pro Max 256GB")).toBe("Pro Max");
    expect(extractMobileVariant("Galaxy S25 Ultra")).toBe("Ultra");
    expect(extractMobileVariant("iPhone 16 Plus")).toBe("Plus");
    expect(extractMobileVariant("Galaxy S24 FE")).toBe("FE");
    expect(extractMobileVariant("Apple iPhone Air")).toBe("Air");
  });
  it("defaults to Standard (an honest default, not a guess)", () => {
    expect(extractMobileVariant("Samsung Galaxy A36 256GB")).toBe("Standard");
  });
});

describe("enrichMobileDna — only confident fields", () => {
  it("emits storage + variant when present", () => {
    expect(enrichMobileDna("", "iPhone Air 512GB Sky Blue")).toEqual({ storage: 512, variant: "Air" });
  });
  it("omits storage when absent (honest), still gives a variant default", () => {
    expect(enrichMobileDna("", "Apple iPhone Air Sky Blue")).toEqual({ variant: "Air" });
  });
});
