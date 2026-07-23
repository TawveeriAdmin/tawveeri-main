// tests/identity/key-integrity.test.ts
// Guards the ADR-058 key-integrity invariant. Every fixture below is a REAL
// value observed in production on 2026-07-23 — this suite is the regression
// gate that keeps store-internal identifiers out of identity/continuity keys.
import {
  isStoreInternalIdentifier,
  hasModelNumberShape,
  extractManufacturerModel,
} from "@/lib/identity/store-identifiers";
import { canonicalListingUrl, stableListingKey } from "@/lib/identity/listing-key";

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

describe("listing continuity keys", () => {
  // The exact URL family that gave Amazon avg_days = 1.00 and zero price history.
  const amazonScrapeA =
    "https://www.amazon.sa/-/en/Super-General-Conditioner-KSGA18NE1/dp/B0CVMTTDMM/ref=sr_1_1?dib=eyJ2IjoiMSJ9.AAA&dib_tag=se&keywords=%D9%85%D9%83%D9%8A%D9%81&qid=1784765305&sr=8-1";
  const amazonScrapeB =
    "https://www.amazon.sa/-/en/Super-General-Conditioner-KSGA18NE1/dp/B0CVMTTDMM/ref=sr_1_4?dib=eyJ2IjoiMSJ9.ZZZ&dib_tag=se&keywords=%D9%85%D9%83%D9%8A%D9%81&qid=1784999999&sr=8-4";

  it("gives the same Amazon listing one key across scrapes (the defect fix)", () => {
    const a = stableListingKey(2, amazonScrapeA, "amazon");
    const b = stableListingKey(2, amazonScrapeB, "amazon");
    expect(a).toBe(b);
    expect(a).toBe("2::amazon:B0CVMTTDMM");
  });

  it("still separates genuinely different Amazon products", () => {
    const other =
      "https://www.amazon.sa/-/en/Oscar-Conditioner-OWC18KC/dp/B0H5D5CYBF/ref=sr_1_2?qid=1784765305";
    expect(stableListingKey(2, other, "amazon")).not.toBe(stableListingKey(2, amazonScrapeA, "amazon"));
  });

  it("strips volatile query params and ref path segments", () => {
    expect(canonicalListingUrl("https://Example.com/p/x/ref=sr_1_1?qid=1&utm_source=g&color=red"))
      .toBe("https://example.com/p/x?color=red");
  });

  it("preserves parameters that identify the product itself", () => {
    expect(canonicalListingUrl("https://store.sa/p?sku=ABC&variant=256gb"))
      .toContain("variant=256gb");
  });

  it("NEVER strips Jarir's childSku — it selects a variant, not a campaign", () => {
    // Regression guard: treating childSku as tracking merged 89 Jarir listings
    // in a dry run, blending the prices of different SKUs on one parent page.
    const a = "https://www.jarir.com/sa-en/apple-ipad-a16-tablet-pc-jpm1424.html?childSku=654165";
    const b = "https://www.jarir.com/sa-en/apple-ipad-a16-tablet-pc-jpm1424.html?childSku=999999";
    expect(canonicalListingUrl(a)).toContain("childSku=654165");
    expect(stableListingKey(1, a, "jarir")).not.toBe(stableListingKey(1, b, "jarir"));
  });

  it("treats trailing-slash and param-order variants as one listing", () => {
    expect(canonicalListingUrl("https://s.sa/p/x/?b=2&a=1"))
      .toBe(canonicalListingUrl("https://s.sa/p/x?a=1&b=2"));
  });

  it("falls back to the canonical URL for stores without an id extractor", () => {
    expect(stableListingKey(4, "https://extra.com/p/item-1?utm_source=x", "extra"))
      .toBe("4::https://extra.com/p/item-1");
  });

  it("returns null instead of inventing a key when there is no URL", () => {
    expect(stableListingKey(2, null, "amazon")).toBeNull();
    expect(stableListingKey(2, "   ", "amazon")).toBeNull();
  });

  it("never throws on a malformed URL", () => {
    expect(() => canonicalListingUrl("not a url")).not.toThrow();
    expect(canonicalListingUrl("not a url")).toBe("not a url");
  });
});
