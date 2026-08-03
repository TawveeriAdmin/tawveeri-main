// tests/catalog/arabic-naming.test.ts
// ADR-185 — the Arabic display name is a MEASURED customer surface, not a nicety.
// Baseline on production: 30% of the result names an Arabic shopper reads carried no
// Arabic character at all (0% for an English shopper), and 100% of that shortfall inside
// the registered plugins came from mobile-v1 and smartwatch-v1.
//
// Three classes of assertion here:
//   1. every composed Arabic name actually contains Arabic;
//   2. nothing is fabricated — an unknown brand stays Latin, sentinels never render;
//   3. the TV brand map that MOVED into this module is byte-identical, so merging the
//      two Arabic vocabularies changed no existing TV name.
import {
  BRAND_AR, arabicBrand, latinBrand, stripBrandPrefix, joinSeries,
  mobileNames, smartwatchNames, hasArabic, variantSuffix,
} from "../../scripts/tps-core/arabic-naming";
import { buildNames as tvNames } from "../../scripts/tps-matcher/tv-matcher-v1-dry";

// Verbatim copy of the map that lived in tv-matcher-v1-dry.ts before ADR-185.
const TV_BRAND_AR_BEFORE: Record<string, string> = {
  samsung: "سامسونج", lg: "إل جي", sony: "سوني", tcl: "تي سي إل", hisense: "هايسنس",
  toshiba: "توشيبا", nikai: "نيكاي", panasonic: "باناسونيك", philips: "فيليبس",
  dansat: "دان سات", skyworth: "سكاي ورث", haier: "هاير", vision: "فيجن",
};

describe("ADR-185 — merging the brand maps changed no TV name", () => {
  it("keeps every pre-existing TV brand transliteration byte-identical", () => {
    for (const [k, v] of Object.entries(TV_BRAND_AR_BEFORE)) expect(BRAND_AR[k]).toBe(v);
  });

  it("still renders the TV names the matcher rendered before", () => {
    expect(tvNames("samsung|65|4k|neo_qled|120").nameAr).toContain("تلفزيون سامسونج");
    expect(tvNames("lg|55|4k|oled|NO_HZ").nameAr).toContain("تلفزيون إل جي");
  });
});

describe("brand and family de-duplication (visible in BOTH locales before the fix)", () => {
  it("strips a family that merely repeats the brand", () => {
    expect(stripBrandPrefix("tecno", "Tecno Spark")).toBe("Spark");
    expect(stripBrandPrefix("huawei", "Huawei Watch GT")).toBe("Watch GT");
    expect(stripBrandPrefix("honor", "Honor")).toBe("");
    expect(stripBrandPrefix("samsung", "Galaxy A")).toBe("Galaxy A"); // no repetition — untouched
  });

  it("does not strip on a partial (non-token) prefix", () => {
    expect(stripBrandPrefix("son", "Sonos Arc")).toBe("Sonos Arc");
  });

  it("merges a repeated series letter back into the model name", () => {
    expect(joinSeries("Galaxy A", "A07")).toBe("Galaxy A07");
    expect(joinSeries("Galaxy S", "S11")).toBe("Galaxy S11");
    expect(joinSeries("Galaxy Z", "Z Fold 7")).toBe("Galaxy Z Fold 7");
    expect(joinSeries("Honor X", "5")).toBe("Honor X 5"); // no repetition — left alone
    expect(joinSeries("iPhone", "16")).toBe("iPhone 16");
  });

  it("does not repeat a generation that already ends the family", () => {
    // samsung|Galaxy Watch Ultra|Ultra|Ultra|47|cellular rendered "Galaxy Watch Ultra Ultra".
    expect(joinSeries("Galaxy Watch Ultra", "Ultra")).toBe("Galaxy Watch Ultra");
    expect(smartwatchNames("samsung|Galaxy Watch Ultra|Ultra|Ultra|47|cellular").nameEn)
      .toBe("Samsung Galaxy Watch Ultra 47mm Cellular");
  });

  it("does not repeat a variant already carried by the generation", () => {
    // samsung|Galaxy Z|Z Flip 7|Flip|512 rendered "Galaxy Z Flip 7 Flip 512GB".
    expect(variantSuffix("Galaxy Z Flip 7", "Flip")).toBe("");
    expect(variantSuffix("iPhone 16", "Pro Max")).toBe(" Pro Max");
    expect(variantSuffix("iPhone 16", "Standard")).toBe("");
    expect(mobileNames("samsung|Galaxy Z|Z Flip 7|Flip|512").nameEn).toBe("Samsung Galaxy Z Flip 7 512GB");
  });

  it("produces no doubled brand in either locale", () => {
    expect(mobileNames("tecno|Tecno Spark|12|Standard|128").nameEn).toBe("Tecno Spark 12 128GB");
    expect(mobileNames("tecno|Tecno Spark|12|Standard|128").nameAr).toBe("جوال تكنو Spark 12 128 جيجابايت");
    expect(smartwatchNames("huawei|Huawei Watch GT|3|Pro|46|gps").nameEn).toBe("Huawei Watch GT 3 Pro 46mm");
  });
});

describe("every composed Arabic name is actually Arabic", () => {
  const MOBILE_KEYS = [
    "apple|iPhone|16|Pro Max|256", "samsung|Galaxy A|A07|Standard|64",
    "xiaomi|Redmi Note|13|Standard|NO_STORAGE", "oppo|OPPO Reno|15|Pro|512",
    "honor|Honor X|5|Standard|64", "vivo|vivo Y|Y19|Standard|128",
  ];
  const WATCH_KEYS = [
    "apple|Apple Watch|10|Standard|42|cellular", "huawei|Huawei Watch Fit|4|Standard|43|gps",
    "samsung|Galaxy Watch|7|Standard|NO_SIZE|gps", "garmin|Garmin Forerunner|970|Standard|47|gps",
  ];

  it.each(MOBILE_KEYS)("mobile %s carries Arabic and no sentinel", (k) => {
    const n = mobileNames(k);
    expect(hasArabic(n.nameAr)).toBe(true);
    expect(n.nameAr).toContain("جوال");
    expect(n.nameAr).not.toMatch(/NO_STORAGE|Standard|undefined/);
    expect(n.nameEn).not.toMatch(/NO_STORAGE|Standard|undefined/);
  });

  it.each(WATCH_KEYS)("smartwatch %s carries Arabic and no sentinel", (k) => {
    const n = smartwatchNames(k);
    expect(hasArabic(n.nameAr)).toBe(true);
    expect(n.nameAr).toContain("ساعة ذكية");
    expect(n.nameAr).not.toMatch(/NO_SIZE|Standard|undefined/);
    expect(n.nameEn).not.toMatch(/NO_SIZE|Standard|undefined/);
  });

  it("renders case size and cellular in Arabic", () => {
    const n = smartwatchNames("apple|Apple Watch|10|Standard|42|cellular");
    expect(n.nameAr).toBe("ساعة ذكية آبل Watch 10 42 ملم خلوي");
    expect(n.nameEn).toBe("Apple Watch 10 42mm Cellular");
  });
});

describe("nothing is invented", () => {
  it("keeps an untransliterated brand in Latin rather than guessing", () => {
    expect(arabicBrand("kieslect")).toBe("kieslect");
    expect(mobileNames("kieslect|Kieslect|K11|Standard|NO_STORAGE").nameAr).toBe("جوال kieslect K11");
  });

  it("transliterates only brands we curated", () => {
    expect(arabicBrand("apple")).toBe("آبل");
    expect(arabicBrand("APPLE")).toBe("آبل");
    expect(latinBrand("apple")).toBe("Apple");
  });

  it("model lines and codes stay Latin — never transliterated", () => {
    expect(mobileNames("apple|iPhone|16|Pro Max|256").nameAr).toContain("iPhone 16 Pro Max");
  });
});
