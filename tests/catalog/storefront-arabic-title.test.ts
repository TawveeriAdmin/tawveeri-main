// tests/catalog/storefront-arabic-title.test.ts
// ADR-185 — the storefront composer must never trade a fact for a language.
//
// The composer this replaced read capacity from `specifications` only. `capacity_btu` is null
// for EVERY English-named air conditioner in the storefront layer while 166 of them state the
// BTU in the title, so it would have renamed 187 rows and dropped the number an AC shopper
// decides on from all of them.
import { parseCapacity, parseCooling, statesCapacity } from "../../scripts/tps-core/arabic-naming";
import { composeStorefrontArabic, applianceBrandAr, parseAcType } from "../../scripts/tps-core/storefront-arabic-title";

describe("capacity is read from the merchant's own title", () => {
  it("reads BTU in every shape a merchant writes it", () => {
    expect(parseCapacity("Haier Nano Cool Split AC, 22,200 BTU, Heat & Cool").btu).toBe(22200);
    expect(parseCapacity("Window AC 17800 BTU Hot Cold").btu).toBe(17800);
    expect(parseCapacity("Samsung Split AC 18 000 BTU Rotary").btu).toBe(18000);
  });

  it("reads litres, kilos and cubic feet", () => {
    expect(parseCapacity("LG single door refrigerator 380L inverter").liters).toBe(380);
    expect(parseCapacity("11 kg Washer, Front Load, White").kg).toBe(11);
    expect(parseCapacity("Samsung Refrigerator 14.2 Cu ft").cuft).toBe(14.2);
  });

  it("rejects numbers that are not capacities", () => {
    expect(parseCapacity("Split AC 2 BTU").btu).toBeUndefined();      // below the floor
    expect(parseCapacity("Cable 500 L").liters).toBe(500);            // in range, still a litre claim
    expect(parseCapacity("Monitor 27 inch 240Hz").btu).toBeUndefined();
  });

  it("reads cooling mode however it is spelled", () => {
    expect(parseCooling("Split AC 18000 BTU Hot and Cool")).toBe("hot_cold");
    expect(parseCooling("Window AC 17800 BTU Hot Cold Rotary Compressor")).toBe("hot_cold");
    expect(parseCooling("Split AC, Heat & Cool, Wi-Fi")).toBe("hot_cold");
    expect(parseCooling("Split AC 12000 BTU Cool Only")).toBe("cool_only");
    expect(parseCooling("Split AC 18400 BTU Cold Only")).toBe("cool_only");
    expect(parseCooling("Split AC 18000 BTU Wifi White")).toBeNull(); // never assumed
  });
});

describe("a rename may not lose a fact the merchant stated", () => {
  it("REFUSES when the title states a capacity that cannot be carried", () => {
    // 60,001 BTU is outside the plausible band, so nothing is read — and nothing is written.
    const r = composeStorefrontArabic({
      category: "air_conditioner",
      nameEn: "Mystery Split AC 99,000 BTU",
      brand: "gree",
      specifications: { ac_type: "split" },
    });
    expect(r.title).toBeNull();
    expect(r.refusedBecause).toBe("capacity_would_be_lost");
  });

  it("carries the capacity the old composer dropped", () => {
    const r = composeStorefrontArabic({
      category: "air_conditioner",
      nameEn: "Haier Nano Cool Split AC, 22,200 BTU, Heat & Cool, Wi-Fi",
      brand: "haier",
      specifications: { ac_type: "split" },   // capacity_btu absent, as it is on every such row
    });
    expect(r.title).toBe("مكيف سبليت هاير 22200 وحدة حار/بارد واي فاي");
  });

  it("refuses a category it cannot identify rather than guessing one", () => {
    const r = composeStorefrontArabic({ category: "appliance", nameEn: "Some Gadget X1", brand: "acme", specifications: {} });
    expect(r.title).toBeNull();
    expect(r.refusedBecause).toBe("no_category");
  });
});

describe("nothing is doubled and nothing is invented", () => {
  it("keeps an already-Arabic brand instead of appending the Latin one", () => {
    // The storefront `brand` column already holds Arabic for many rows; the old composer did not
    // notice and produced «مكيف سبليت كرافت CRAFFT».
    expect(applianceBrandAr("ميديا")).toBe("ميديا");
    const r = composeStorefrontArabic({
      category: "air_conditioner",
      nameEn: "CRAFFT, Split AC, 18,000 BTU, Hot and Cool",
      brand: "كرافت",
      specifications: { ac_type: "split" },
    });
    expect(r.title).toBe("مكيف سبليت كرافت 18000 وحدة حار/بارد");
  });

  it("treats a placeholder brand as no brand", () => {
    expect(applianceBrandAr("Unknown")).toBeNull();
    expect(applianceBrandAr("n/a")).toBeNull();
    expect(applianceBrandAr("")).toBeNull();
  });

  it("keeps an uncurated brand as written rather than transliterating it by guess", () => {
    expect(applianceBrandAr("HAAM")).toBe("HAAM");
  });

  it("prefers the longest matching brand key so 'super general' is not read as 'general'", () => {
    expect(applianceBrandAr("Super General")).toBe("سوبر جنرال");
    expect(applianceBrandAr("General")).toBe("جنرال");
  });

  it("reads the AC form factor from the title when specs omit it", () => {
    expect(parseAcType("Window AC 17800 BTU Hot Cold")).toBe("window");
    expect(parseAcType("Gree Portable AC Cooling 16000 BTU")).toBe("portable");
    expect(parseAcType("Some AC 12000 BTU")).toBeNull();
    expect(composeStorefrontArabic({
      category: "air_conditioner", nameEn: "Window AC 17800 BTU Hot Cold Rotary Compressor",
      brand: "zamil", specifications: {},
    }).title).toBe("مكيف شباك الزامل 17800 وحدة حار/بارد");
  });

  it("every composed title is in Arabic", () => {
    const r = composeStorefrontArabic({
      category: "refrigerator", nameEn: "LG single door refrigerator 380L inverter",
      brand: "lg", specifications: {},
    });
    expect(r.title).toMatch(/[؀-ۿ]/);
    expect(r.title).toBe("ثلاجة إل جي 380 لتر إنفرتر");
  });
});
