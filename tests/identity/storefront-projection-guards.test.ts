// Regression coverage for the storefront identity projection's negative-evidence
// guards (ADR-242, rule_version convergence-v1).
//
// Every "→ veto" case below is a REAL pair the 2026-08-12 production shadow run
// surfaced: a storefront listing whose URL/ASIN matched a TPS-identified
// observation while the two sides describe DIFFERENT products. The guards are
// the only thing standing between listing-equality evidence and a false
// products.canonical_product_id claim, so each failure class is pinned here
// with the production strings that exposed it.
import {
  storageTokensGb,
  storageContradiction,
  identityParamSignature,
  identityParamsDisagree,
  suffixedNumeralContradiction,
  sharedWordNumeralContradiction,
  deviceClassContradiction,
  brandContradiction,
  accessoryTitleContradiction,
} from "../../scripts/tps-core/identity-projection-guards";
import { isAccessoryTitle, isAccessoryTitleHead } from "../../src/lib/scraping/utils/category-utils";

describe("R11 — storage-token contradiction", () => {
  it("extracts labeled GB/TB tokens, TB normalized to GB", () => {
    expect(storageTokensGb("Galaxy Z Fold8 Ultra, 1 TB, 16 GB RAM")).toEqual(new Set([1024, 16]));
    expect(storageTokensGb("iPhone 11 (64GB)")).toEqual(new Set([64]));
  });

  it("reads Arabic storage tokens and Arabic-Indic digits", () => {
    expect(storageTokensGb("آيفون 17 برو ماكس، سعة 1 تيرابايت")).toEqual(new Set([1024]));
    expect(storageTokensGb("سعة ٢٥٦ جيجا")).toEqual(new Set([256]));
  });

  it("a bare number is never a storage claim", () => {
    expect(storageTokensGb("Xiaomi 14 with 108MP camera").size).toBe(0);
  });

  it("vetoes the production Fold8 1TB-vs-512 pair", () => {
    expect(storageContradiction(
      "Samsung Galaxy Z Fold8 Ultra, 1 TB, 16 GB RAM, Violet Shadow",
      "Samsung Galaxy Z Fold 8 Ultra 512GB samsung|Galaxy Z|Z Fold 8|Ultra|512GB",
    )).toBe(true);
  });

  it("vetoes the refurbished 64GB iPhone 11 against the 128GB canonical", () => {
    expect(storageContradiction(
      "Apple (Refurbished) iPhone 11 (64GB) - White",
      "Apple iPhone 11 128GB",
    )).toBe(true);
  });

  it("never vetoes on absence of a claim (unknown beats incorrect, both ways)", () => {
    expect(storageContradiction("Apple iPhone 16 Plus", "Apple iPhone 16 Plus 256GB")).toBe(false);
    expect(storageContradiction(null, "256GB")).toBe(false);
  });

  it("a shared claim survives extra RAM tokens (8GB RAM + 256GB vs 256GB)", () => {
    expect(storageContradiction("POCO M8 Pro, 256 GB, 8 GB RAM", "Xiaomi POCO M8 Pro 256GB")).toBe(false);
  });
});

describe("R12 — identity-bearing query params must agree", () => {
  it("reads Jarir childSku signatures and ignores affiliate/tracking params", () => {
    expect(identityParamSignature("https://www.jarir.com/x.html?childSku=642285")).toBe("childsku=642285");
    expect(identityParamSignature("https://www.amazon.sa/dp/B0X?tag=tawveeri-21&ref=sr_1_2")).toBeNull();
  });

  it("disagrees when one side is a childSku variant page and the other is not", () => {
    expect(identityParamsDisagree(
      "https://www.jarir.com/sa-en/xiaomi-15t.html?childSku=666038",
      "https://www.jarir.com/sa-en/xiaomi-15t.html",
    )).toBe(true);
  });

  it("agrees when both sides carry the same variant", () => {
    expect(identityParamsDisagree(
      "https://www.jarir.com/x.html?childSku=1",
      "https://www.jarir.com/x.html?childSku=1&utm_source=y",
    )).toBe(false);
  });

  it("no params on either side is agreement", () => {
    expect(identityParamsDisagree("https://a/x", "https://a/x?utm=1")).toBe(false);
  });
});

describe("R13 — suffixed-numeral contradiction (14T ≠ 14)", () => {
  it("vetoes every production T/C/i-suffix trap", () => {
    expect(suffixedNumeralContradiction("Xiaomi 14T", "Xiaomi 14")).toBe(true);
    expect(suffixedNumeralContradiction("Xiaomi 15T Pro", "Xiaomi 15 Pro")).toBe(true);
    expect(suffixedNumeralContradiction("Xiaomi Redmi 13C, 256 GB", "Xiaomi Redmi 13 256GB")).toBe(true);
    expect(suffixedNumeralContradiction("Huawei nova 14i", "Huawei nova 14")).toBe(true);
  });

  it("unit tokens (5G, 4K, 60Hz, HDR10) never fire it", () => {
    expect(suffixedNumeralContradiction("Galaxy S25 Ultra 5G", "Samsung Galaxy S25 Ultra")).toBe(false);
    expect(suffixedNumeralContradiction("55 Inch 4K TV 60Hz HDR10", "55\" 4K UHD 60Hz Smart TV")).toBe(false);
  });

  it("an identical suffixed token on both sides is agreement", () => {
    expect(suffixedNumeralContradiction("iPhone 6s 32GB", "Apple iPhone 6s")).toBe(false);
  });

  it("digits embedded in model codes never tokenize (QN90D)", () => {
    expect(suffixedNumeralContradiction("Samsung QN90D 55-inch", "Samsung QN90D TV")).toBe(false);
  });
});

describe("R15 — shared-word numeral contradiction (nova 14 ≠ nova 13)", () => {
  it("vetoes the production bare-generation traps", () => {
    expect(sharedWordNumeralContradiction("Huawei nova 14", "Huawei nova 13")).toBe(true);
    expect(sharedWordNumeralContradiction("Xiaomi Redmi Note 15 Pro+ 5G", "Xiaomi Redmi Note 14 Pro Plus")).toBe(true);
    expect(sharedWordNumeralContradiction("Haier 55\" Smart TV, 4K QLED, 60 Hz, H6F", "Haier 65\" 4K QLED 60Hz TV Haier 65")).toBe(true);
  });

  it("agreement on the shared word's number is never a veto", () => {
    expect(sharedWordNumeralContradiction("Apple iPhone 17 Pro Max, 256 GB", "Apple iPhone 17 Pro Max 256GB")).toBe(false);
    expect(sharedWordNumeralContradiction("Galaxy Watch 8 Classic 46mm", "Samsung Galaxy Watch 8 Classic")).toBe(false);
  });

  it("unit-suffixed numerals make no generation claim (Classic 46mm)", () => {
    expect(sharedWordNumeralContradiction("Watch Classic 46mm", "Watch Classic 42mm Watch Classic")).toBe(false);
  });

  it("a word absent from the other side claims nothing", () => {
    expect(sharedWordNumeralContradiction("ThinkPad E14 Gen4 i5-1235U", "Lenovo thinkpad Laptop")).toBe(false);
  });
});

describe("R14 — device-class contradiction", () => {
  it("an air fryer never links to a mobile canonical (production Xiaomi case)", () => {
    // classifyFromTitle("Xiaomi 6 5l Smart Air Fryer 1800w Black") → kitchen
    expect(deviceClassContradiction("kitchen", "mobile")).toBe(true);
  });

  it("two agreeing device claims pass; differing ones veto", () => {
    expect(deviceClassContradiction("smartphone", "mobile")).toBe(false);
    expect(deviceClassContradiction("tablet", "printer")).toBe(true);
    expect(deviceClassContradiction("tv", "washing_machine")).toBe(true);
  });

  it("uninformative classes never veto", () => {
    expect(deviceClassContradiction(null, "mobile")).toBe(false);
    expect(deviceClassContradiction("gaming", "tv")).toBe(false);
    expect(deviceClassContradiction("smartphone", "accessories")).toBe(false);
  });
});

describe("R17 — accessory-title contradiction (head-anchored)", () => {
  it("vetoes the production AirPods-case trap («كفر ايربودز برو» → apple|airpods pro 2)", () => {
    const title = "بايكرون,  كفرايربودز برو الجيل الثاني  , أسود";
    // the Arabic accessory word كفر is in the platform's own indicator list,
    // fused to the product word — an accessory listing names itself in the head
    expect(isAccessoryTitleHead(title)).toBe(true);
    expect(accessoryTitleContradiction(isAccessoryTitleHead(title), "audio")).toBe(true);
  });

  it("a genuine device title never trips it", () => {
    expect(isAccessoryTitleHead("Samsung Galaxy Buds 4, TWS, Black")).toBe(false);
    expect(accessoryTitleContradiction(false, "audio")).toBe(false);
  });

  it("Latin indicators respect word boundaries — 'Floor Standing AC' is not a stand (measured false veto)", () => {
    expect(isAccessoryTitleHead("Hisense Floor Standing AC, DC inverter, 48,000 BTU")).toBe(false);
    expect(isAccessoryTitleHead("Universal TV stand for 55-inch screens")).toBe(true);
  });

  it("main products that merely MENTION an accessory never trip it (56/2,102 measured false-flag class)", () => {
    expect(isAccessoryTitleHead("New Apple Watch Ultra (GPS + Cellular, 49mm) - Titanium Case with Black Band")).toBe(false);
    expect(isAccessoryTitleHead("Honor Pad X7 Tablet - Wi-Fi with Case Cover 2025, 8.7\", 128 GB")).toBe(false);
    expect(isAccessoryTitleHead("Q27G3Z Gaming Monitor 27-inch 2K QHD, height-adjustable stand included")).toBe(false);
    // the unbounded scanner still sees them — it is the guard that must not
    expect(isAccessoryTitle("Honor Pad X7 Tablet - Wi-Fi with Case Cover 2025")).toBe(true);
  });

  it("an accessory linking an accessories-category canonical is fine", () => {
    expect(accessoryTitleContradiction(true, "accessories")).toBe(false);
    expect(accessoryTitleContradiction(true, null)).toBe(false);
  });
});

describe("R16 — brand contradiction (both-known gate)", () => {
  it("two known, different brands veto", () => {
    expect(brandContradiction("Samsung", "apple")).toBe(true);
  });

  it("alias spellings of the same brand never veto", () => {
    expect(brandContradiction("إل جي", "LG")).toBe(false);
  });

  it("an unmapped spelling claims nothing (measured: 110 same-brand pairs would otherwise be vetoed)", () => {
    expect(brandContradiction("Ariston", "أريستون")).toBe(false);
    expect(brandContradiction(null, "apple")).toBe(false);
    expect(brandContradiction("Unknown", "apple")).toBe(false);
  });
});
