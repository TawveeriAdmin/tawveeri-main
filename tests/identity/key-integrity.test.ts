// tests/identity/key-integrity.test.ts
// Guards the ADR-058 key-integrity invariant. Every fixture below is a REAL
// value observed in production on 2026-07-23 — this suite is the regression
// gate that keeps store-internal identifiers out of identity/continuity keys.
import {
  isStoreInternalIdentifier,
  hasModelNumberShape,
  extractManufacturerModel,
} from "@/lib/identity/store-identifiers";

describe("store-internal identifier rejection", () => {
  it.each([
    ["B0F62T4GWJ", "Amazon ASIN"],
    ["B0CVMTTDMM", "Amazon ASIN"],
    ["N70382194V", "Noon product code — the defect that poisoned 163 identities"],
    ["N53421344A", "Noon product code"],
    ["Z8371A5052A760FF62718Z", "Noon long-form code"],
    ["670741", "Jarir numeric SKU"],
    ["170100502020014", "Almanea 15-digit internal SKU"],
  ])("rejects %s (%s)", (value) => {
    expect(isStoreInternalIdentifier(value)).toBe(true);
  });

  it.each([
    ["SM-S938BZKIMEA", "Samsung MPN (Almanea)"],
    ["QA75QN70FAUXSA", "Samsung TV MPN (Extra)"],
    ["MDHH4AB/A", "Apple part number (Almanea)"],
    ["MG1G4AH/A", "Apple part number (SWSG)"],
    ["83K100EPAD", "Lenovo MPN"],
    ["27GS60QC", "LG monitor MPN"],
    ["KSGA18NE1", "Super General AC MPN"],
    ["BRV-TB-T3PRO-CYN", "Brave tablet MPN"],
  ])("accepts %s (%s)", (value) => {
    expect(isStoreInternalIdentifier(value)).toBe(false);
    expect(hasModelNumberShape(value)).toBe(true);
  });
});

describe("model-number shape validation", () => {
  it.each([
    ["Galaxy A07", "marketing name with whitespace (Jarir)"],
    ["Motorola edge 70", "marketing name (Jarir)"],
    ["4G SIM Smart Watch", "title fragment (Noon)"],
    ["50 Inch Full HD", "title fragment (Noon)"],
    ["TV-Backlight(55 inch)-NETFLIX", "junk with parens (Extra)"],
    ["ايفون 17، 256 جيجا، أسود - MG674AH/A", "full Arabic title (SWSG)"],
  ])("rejects %s — %s", (value) => {
    expect(hasModelNumberShape(value)).toBe(false);
  });

  it.each([
    ["128GB", "capacity is not an identity (Amazon supplied this as a tablet model)"],
    ["512GB", "capacity"],
    ["65H", "size fragment"],
    ["24000", "bare number"],
  ])("rejects spec-only value %s — %s", (value) => {
    expect(hasModelNumberShape(value)).toBe(false);
  });

  // ADR-060 hazards, each caught in a production dry-run before any write.
  it.each([
    ["HDR10", "a video format bridged a mini-LED TV to a QLED TV"],
    ["HDR10+", "format token"],
    ["DOLBYVISION", "format token"],
    ["QLED", "panel technology, shared by thousands of products"],
    ["WIFI6", "connectivity standard"],
  ])("rejects technology/standard token %s — %s", (value) => {
    expect(hasModelNumberShape(value)).toBe(false);
  });

  it.each([
    ["QA65Q", "truncated Samsung code — bridged Q6/Q7/Q8/QN70 into one product"],
    ["116UX", "5-char code"],
    ["QA75Q", "truncated"],
  ])("rejects model shorter than the 6-char identity floor: %s — %s", (value) => {
    expect(hasModelNumberShape(value)).toBe(false);
  });

  it("keeps the full-length siblings that the truncation was fusing", () => {
    for (const m of ["QA65Q6FAAU", "QA65Q8FAAUXSA", "QA75QN70FAUXZN"]) {
      expect(hasModelNumberShape(m)).toBe(true);
    }
  });
});

describe("extractManufacturerModel — sku is never trusted", () => {
  it("refuses Noon's sku, the exact defect that made Noon unable to corroborate", () => {
    // Real Noon payload shape: model is a title fragment, sku is Noon's code.
    expect(
      extractManufacturerModel({ model: "50 Inch Full HD", sku: "N70199643V" })
    ).toBeNull();
  });

  it("refuses an Amazon ASIN even though it is structurally model-shaped", () => {
    expect(extractManufacturerModel({ sku: "B0F62T4GWJ" })).toBeNull();
  });

  it("accepts Almanea's genuine MPN from the model field", () => {
    expect(
      extractManufacturerModel({ model: "SM-S938BZKIMEA", sku: "170100502020014" })
    ).toBe("SM-S938BZKIMEA");
  });

  it("accepts Extra's modelNumber field", () => {
    expect(extractManufacturerModel({ modelNumber: "QA75QN70FAUXSA" })).toBe("QA75QN70FAUXSA");
  });

  it("prefers an explicit mpn over a generic model field", () => {
    expect(extractManufacturerModel({ mpn: "27GS60QC", model: "LG UltraGear" })).toBe("27GS60QC");
  });

  it("returns null rather than guessing when nothing qualifies", () => {
    expect(extractManufacturerModel({ model: "Galaxy A07", sku: "670741" })).toBeNull();
  });

  it("uppercases for stable comparison", () => {
    expect(extractManufacturerModel({ model: "qa65qn70fauxsa" })).toBe("QA65QN70FAUXSA");
  });
});
