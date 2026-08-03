// tests/catalog/store-identity-guard.test.ts
// ADR-191 — a store name reaching the `brand` field becomes the first segment of
// `tps_identity_key`, fencing that merchant's listing off from every other retailer selling the
// identical product.
//
// THE DANGEROUS DIRECTION IS THE OTHER ONE. A guard that eats "Samsung" because a store is
// called "Samsung KSA", or "Sony" because a store is called "Sony World", would destroy identity
// across the catalogue. Most of these tests defend real brands.
import { isStoreIdentity, brandOrNull } from "../../scripts/tps-core/store-identity-guard";

describe("real brands always survive", () => {
  const BRANDS = [
    "Samsung", "samsung", "SAMSUNG", "Sony", "sony", "LG", "Apple", "Huawei", "Xiaomi",
    "Haier", "Midea", "Gree", "Hisense", "TCL", "Toshiba", "Panasonic", "Philips", "Bosch",
    "سامسونج", "سوني", "إل جي", "آبل", "هواوي", "شاومي", "هاير", "جري",
  ];
  it.each(BRANDS)("%s is not a store identity", (b) => {
    expect(isStoreIdentity(b)).toBe(false);
    expect(brandOrNull(b)).toBe(b);
  });

  it("keeps a brand that merely SHARES a word with a store name", () => {
    // The store is «سوني وورلد» / "Sony World". The brand "Sony" must survive it.
    expect(isStoreIdentity("Sony")).toBe(false);
    // The store is "Samsung KSA". The brand "Samsung" must survive it.
    expect(isStoreIdentity("Samsung")).toBe(false);
  });

  it("keeps an unrecognised value — unknown is far more likely to be a brand", () => {
    expect(isStoreIdentity("Anker")).toBe(false);
    expect(isStoreIdentity("Zorblex")).toBe(false);
    expect(brandOrNull("Anker")).toBe("Anker");
  });
});

describe("the measured offender is caught", () => {
  it("rejects the exact value found on production", () => {
    // 22 active canonicals were keyed `sony world - ksa|…` — Sony WH-1000XM6, WF-C510, INZONE.
    expect(isStoreIdentity("sony world - ksa")).toBe(true);
    expect(brandOrNull("sony world - ksa")).toBeNull();
  });

  it("rejects its spelling variants and its country suffix", () => {
    for (const v of ["Sony World", "sonyworld", "SONY WORLD KSA", "sony world – KSA", "سوني وورلد"]) {
      expect(isStoreIdentity(v)).toBe(true);
    }
  });

  it("rejects other retailers that could appear in a brand field", () => {
    for (const v of ["Jarir", "مكتبة جرير", "eXtra", "Noon", "نون", "Almanea", "LuLu Hypermarket"]) {
      expect(isStoreIdentity(v)).toBe(true);
      expect(brandOrNull(v)).toBeNull();
    }
  });
});

describe("degenerate input never becomes a claim", () => {
  it("treats empty and near-empty values as no brand", () => {
    expect(brandOrNull(null)).toBeNull();
    expect(brandOrNull(undefined)).toBeNull();
    expect(brandOrNull("")).toBeNull();
    expect(brandOrNull("   ")).toBeNull();
  });

  it("does not match on a fragment too short to identify anything", () => {
    expect(isStoreIdentity("a")).toBe(false);
    expect(isStoreIdentity("SA")).toBe(false);
  });
});
