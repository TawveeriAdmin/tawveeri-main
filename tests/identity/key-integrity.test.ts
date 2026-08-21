// tests/identity/key-integrity.test.ts
// Guards the ADR-058 key-integrity invariant. Every fixture below is a REAL
// value observed in production on 2026-07-23 — this suite is the regression
// gate that keeps store-internal identifiers out of identity/continuity keys.
import {
  isStoreInternalIdentifier,
  hasModelNumberShape,
  extractManufacturerModel,
  extractManufacturerModelFromName,
  extractSizePrefixedModel,
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

/**
 * Spec compounds and slash-joined pairs (2026-08-02). Both were measured passing the
 * density rule on real TV titles and becoming identities.
 */
describe("tokens that are not a single model number", () => {
  it("rejects a refresh-rate compound welded into a token", () => {
    expect(extractManufacturerModelFromName("Dansat 65 Inch QLED 65LCS120HZ")).toBeNull();
    expect(extractManufacturerModelFromName("Hisense HSR120HZ Smart TV")).toBeNull();
    expect(extractManufacturerModel({ model: "DTD55QLED120HZ" })).toBeNull();
  });
  it("rejects two models joined by a slash", () => {
    expect(extractManufacturerModel({ model: "98Q6C/98C6K" })).toBeNull();
    expect(extractManufacturerModel({ model: "EVOQ75QLC/EVOQ75S4QLC2" })).toBeNull();
    expect(extractManufacturerModel({ model: "DDR5/512GB" })).toBeNull();
  });
  it("leaves Apple's genuine one-character slash form alone", () => {
    expect(extractManufacturerModel({ model: "MDHH4AB/A" })).toBe("MDHH4AB/A");
  });
});

/**
 * P4 (2026-08-21) — DUAL_MODEL_SLASH only rejects a slash pair when BOTH sides are
 * >=3 chars, so a RAM/Storage spec with a short bare-number side escaped it and was
 * live as a `MODEL:` identity (e.g. `asus|MODEL:DDR5/512GB`'s sibling defects). Every
 * value below is a real shape measured in production.
 */
describe("RAM/Storage slash specs and multi-slash phrases are not models (P4)", () => {
  it.each([
    ["16/256GB", "bare 2-digit RAM / capacity-with-unit"],
    ["8/512GB", "bare 1-digit RAM / capacity-with-unit"],
    ["4/64GB", "bare 1-digit RAM / capacity-with-unit"],
    ["256GB/16", "order-agnostic: capacity-with-unit / bare RAM"],
    ["512GB/8", "order-agnostic"],
  ])("rejects RAM/Storage slash pair %s — %s", (value) => {
    expect(extractManufacturerModel({ model: value })).toBeNull();
  });

  it.each([
    ["GEN/10-CORE/16GB", "multi-slash spec string"],
    ["DDR5/16GB/512GB", "multi-slash spec string"],
  ])("rejects multi-slash phrase %s — %s", (value) => {
    expect(extractManufacturerModel({ model: value })).toBeNull();
  });

  it("still rejects the already-guarded DDR5/DDR4 lead-slash forms (no regression)", () => {
    expect(extractManufacturerModel({ model: "DDR5/512GB" })).toBeNull();
    expect(extractManufacturerModel({ model: "DDR4/512GB" })).toBeNull();
  });

  it("does not regress a genuine single-slash MPN", () => {
    expect(extractManufacturerModel({ model: "MDHH4AB/A" })).toBe("MDHH4AB/A");
    expect(extractManufacturerModel({ model: "MG1G4AH/A" })).toBe("MG1G4AH/A");
  });

  it("does not regress real slash-free laptop/TV/AC MPNs", () => {
    for (const m of ["X1504VA-BQ575W", "SM-S938BZKIMEA", "QA75QN70FAUXSA", "83K100EPAD", "27GS60QC", "KSGA18NE1", "BRV-TB-T3PRO-CYN"]) {
      expect(extractManufacturerModel({ model: m })).toBe(m);
    }
  });
});

/**
 * P4 (2026-08-21) — a CPU's own part number must never stand in for the DEVICE's
 * model number. Measured live: a ZBook Fury 17 G7 listing named "Intel Xeon
 * W-10885M Processor" in its title, and the name-rescue path (which scans every
 * token in a title when the payload has no model) picked "W-10885M" as if it
 * were the laptop's own MPN.
 */
describe("Xeon CPU part number is never mistaken for the device's own model (P4)", () => {
  it("rejects a bare Xeon W-series token from the name-rescue path", () => {
    expect(
      extractManufacturerModelFromName("ZBook Fury 17 G7 Laptop With 17.3 Inch Full HD (19201x1080) IPS Display,Intel Xeon W-10885M Processor/32GB RAM DDR4/512GB SSD/Windows 10 Pro English/Arabic Grey")
    ).not.toBe("W-10885M");
  });
});

/**
 * ADR-177 — short models are admitted by naming CONVENTION, never by lowering the
 * global minimum. Every string here is production data from the prefix audit.
 */
describe("size-prefixed short models (ADR-177)", () => {
  const tcl = "TCL 85 Inch QLED Smart TV Google TV - 85P8L";
  it("accepts a complete size-prefixed code that the listing states verbatim", () => {
    expect(extractSizePrefixedModel({ model: "85P8L" }, tcl, 85)).toBe("85P8L");
    expect(extractSizePrefixedModel({ model: "65C8K" }, "TCL 65-inch QD Mini LED Google TV, 65C8K", 65)).toBe("65C8K");
  });
  it("rejects a truncation of a longer model in the same listing", () => {
    const amazon = "Samsung 65 Inch Crystal UHD TV, U8000F, 4K, UA65U8000FUXZN";
    expect(extractSizePrefixedModel({ model: "UA65U" }, amazon, 65)).toBeNull();
  });
  it("rejects a code whose size disagrees with the listing", () => {
    expect(extractSizePrefixedModel({ model: "85P8L" }, tcl, 75)).toBeNull();
  });
  it("rejects when the next word marks a variant (55C6K PRO is not 55C6K)", () => {
    expect(extractSizePrefixedModel({ model: "55C6K" }, "TCL 55 Inch 55C6K PRO Mini LED", 55)).toBeNull();
  });
  it("rejects a letter-leading Samsung fragment — the shape it was built to exclude", () => {
    expect(extractSizePrefixedModel({ model: "QA75Q" }, "Samsung 75 Inch QLED QA75Q", 75)).toBeNull();
    expect(extractSizePrefixedModel({ model: "UA80" }, "Samsung 80 Inch UA80", 80)).toBeNull();
  });
  it("never fires without a screen size to corroborate against", () => {
    expect(extractSizePrefixedModel({ model: "85P8L" }, tcl, null)).toBeNull();
  });
  it("leaves the global minimum untouched for the ordinary path", () => {
    expect(extractManufacturerModel({ model: "85P8L" })).toBeNull();
  });
});

/** LuLu welds `SMART-` onto a real MPN; three other stores publish it bare. */
describe("marketing prefixes", () => {
  it("strips a closed-list marketing prefix so the same TV meets itself", () => {
    expect(extractManufacturerModel({ model: "SMART-UA65U8000HUXSA" })).toBe("UA65U8000HUXSA");
    expect(extractManufacturerModelFromName("Samsung 65 Inch Smart TV SMART-UA65U8000HUXSA")).toBe("UA65U8000HUXSA");
  });
  it("never truncates a genuine MPN whose leading segment is part of the identity", () => {
    expect(extractManufacturerModel({ model: "BRV-TB-T3PRO-CYN" })).toBe("BRV-TB-T3PRO-CYN");
    expect(extractManufacturerModel({ model: "SM-S938BZKIMEA" })).toBe("SM-S938BZKIMEA");
  });
  it("leaves the prefix alone when the remainder is not a model on its own", () => {
    expect(extractManufacturerModel({ model: "SMART-TV4K" })).toBe("SMART-TV4K");
  });
});
