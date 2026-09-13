// tests/identity/smartwatch-parser.test.ts
// ADR-066/068 gate. Every fixture is a real Saudi listing observed in production.
// The plugin earned registration on COMPARISON VALUE (91.9% identified where a
// comparison is possible, vs mobile's 80.1%), not on the blended headline.
import { detect } from "../../scripts/tps-plugins/smartwatch/detector";
import { normalize } from "../../scripts/tps-plugins/smartwatch/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/smartwatch/identity";

const idOf = (ar: string, en: string, brand: string | null) => {
  const n = normalize(ar, en, brand, {});
  return { ...buildIdentityKey(brand, n.payload, {}), p: n.payload };
};

describe("detector — the two measured precision leaks stay closed", () => {
  it.each([
    ["TP-Link RE505X (AX1500) Range Extender, Dual Band (2.4 GHz/5 GHz)", "a bare 'band' signal matched every router"],
    ["Brovi H165-383 5G CPE Router, Dual-Band (2.4GHz/5GHz Wi-Fi)", "router"],
    ["TP-Link Omada WiFi 7 Wireless Access Point | BE5000 Dual Band", "access point"],
  ])("rejects networking gear: %s (%s)", (title) => {
    expect(detect("", title)).toBe(false);
  });

  it.each([
    ["باور بانك أورايمو 27 ألف مللي أمبير/ساعة 22.5 واط OPB-7270Q أسود", "'ساعة' is inside 'مللي أمبير/ساعة' (mAh)"],
    ["قوي , بطارية متنقلة كيجو بسعة 20,000 مللي أمبير في الساعة,أسود", "portable battery"],
  ])("rejects power banks: %s (%s)", (title) => {
    expect(detect(title, "")).toBe(false);
  });

  it.each([
    ["حزام ساعة ابل الرياضي، أسود", "strap contains the full product name"],
    ["واقي شاشة لساعة سامسونج جالاكسي", "screen protector"],
  ])("rejects watch accessories: %s (%s)", (title) => {
    expect(detect(title, "")).toBe(false);
  });

  it("still detects real watches in both languages", () => {
    expect(detect("هواوي ساعة فيت 3، 45 مم، أخضر", "")).toBe(true);
    expect(detect("", "Apple Watch Series 11 46mm GPS")).toBe(true);
    expect(detect("شاومي، ساعة ذكية باند 9، أزرق", "")).toBe(true);
  });
});

describe("identity contract — size and connectivity are identity, not commercial", () => {
  it("separates case sizes of the same series (different SKUs, different prices)", () => {
    const a = idOf("", "Apple Watch Series 11 42mm GPS", "Apple");
    const b = idOf("", "Apple Watch Series 11 46mm GPS", "Apple");
    expect(a.key).not.toBe(b.key);
    expect(a.p.size_mm).toBe(42);
    expect(b.p.size_mm).toBe(46);
  });

  it("separates cellular from GPS-only", () => {
    const gps = idOf("ابل، ساعة سيريس 11، 46 ملم، جي بي اس", "", "ابل");
    const cell = idOf("ابل، ساعة سيريس 11، 46 ملم، خاصية الاتصال", "", "ابل");
    expect(gps.p.connectivity).toBe("gps");
    expect(cell.p.connectivity).toBe("cellular");
    expect(gps.key).not.toBe(cell.key);
  });

  it("treats colour and strap as commercial — same product, one identity", () => {
    const black = idOf("هواوي ساعة فيت 3، 45 مم، أسود", "", "هواوي");
    const green = idOf("هواوي ساعة فيت 3، 45 مم، أخضر", "", "هواوي");
    expect(black.key).toBe(green.key);
  });

  it("rejects a case size that is not a real watch size", () => {
    // 1.43 بوصة is a SCREEN size in inches, not a 43mm case.
    expect(idOf("ساعة ذكية اوكي الترا 2، 1.43 بوصة، رمادي", "", "أوكي").p.size_mm).toBeNull();
  });

  it("marks a missing case size as low confidence rather than claiming certainty", () => {
    const r = idOf("", "Huawei Watch GT 5", "Huawei");
    expect(r.status).toBe("low_confidence_candidate");
  });
});

describe("bilingual family/generation — each rule fixed a measured lost comparison", () => {
  it.each([
    ["هواوي، ساعة 5، 42 ملم، أبيض", "هواوي", "huawei|Huawei Watch|5|Standard|42|gps", "bare 'watch N' in Arabic"],
    ["ساعة سامسونج جالكسي 8 كلاسيك , 46 ملم", "سامسونج", "samsung|Galaxy Watch|8|Classic|46|gps", "line number follows Galaxy"],
    ["ساعة شاومي ريدمي ووتش 5 اكتيف، 1.83 بوصة", "شاومي", "xiaomi|Redmi Watch|5|Active|NO_SIZE|gps", "Redmi Watch line"],
    ["ساعة ذكية ميبرو سي 4، 2.01 بوصة", "ميبرو", "mibro|Mibro C|4|Standard|NO_SIZE|gps", "C4 transliterated as 'سي 4'"],
  ])("parses %s", (ar, brand, expected) => {
    expect(idOf(ar, "", brand).key).toBe(expected);
  });

  it("reads Samsung's Ultra line, which carries a YEAR not a generation", () => {
    const r = idOf("سامسونج جالاكسي ساعة الترا 2025، 47 مم، أبيض", "", "سامسونج");
    expect(r.key).toBe("samsung|Galaxy Watch Ultra|Ultra|Ultra|47|gps");
  });

  it("reads Garmin's Forerunner across its Arabic transliterations", () => {
    for (const ar of ["جارمين ساعة ذكية للجري 265 من فوررنر", "ساعة ذكية للجري فور رانر 265"]) {
      expect(idOf(ar, "", "GARMIN").key).toContain("Garmin Forerunner|265");
    }
  });

  it("infers the brand from the title when the store publishes 'Unknown'", () => {
    // Jarir and Amazon do this on wearables; the title is evidence too.
    const r = idOf("", "Honor Watch 5, GPS, Honor 45.6 mm", "Unknown");
    expect(r.status).not.toBe("invalid");
    expect(r.key).toContain("honor|");
  });
});

describe("precision — rejects rather than guesses", () => {
  it("rejects a watch whose title carries no model at all", () => {
    // Correctly unidentifiable: unknown beats incorrect.
    expect(idOf("هواوي ساعه ذكية ، بلوتوث، 1.64 بوصة، وردي", "", "هواوي").status).toBe("invalid");
  });

  it("rejects an uncanonicalizable brand instead of keying on noise", () => {
    expect(idOf("", "Bostbo Health and Fitness Tracker 1.38 inch", "Unknown").status).toBe("invalid");
  });

  it("keeps different brands apart even with the same model number", () => {
    expect(idOf("", "Honor Watch 5", "Honor").key).not.toBe(idOf("", "Huawei Watch 5", "Huawei").key);
  });
});

// ADR-350 (2026-09-13): band-type families (Galaxy Fit, Huawei Band, Honor Band, Huawei
// Watch Fit, ...) are sold in ONE physical size — unlike round-watch families (Galaxy Watch,
// Galaxy Watch Ultra, Huawei Watch GT, Honor Watch, ...) where a 40mm vs. 44mm of the same
// generation really is a different SKU at a different price. Proven case: Samsung's own
// "Galaxy Fit3 Gray/Pink Gold/Silver, Bluetooth v5.3" titles never carry a case-size spec at
// all — before this fix every Galaxy Fit3 observation stayed low_confidence_candidate forever
// and could never corroborate into a canonical, purely because it belongs to a family that
// structurally has no size axis (not because evidence was actually missing).
describe("identity — band-type families don't need a case size to be confident (ADR-350)", () => {
  it("Galaxy Fit3 with no case-size spec is VALID (NO_SIZE is a confident identity for a band)", () => {
    const r = idOf("", "Galaxy Fit3 Gray Bluetooth V5 3 (SM-R390NZAAMEA)", "Samsung");
    expect(r.status).toBe("valid");
    expect(r.key).toBe("samsung|Galaxy Fit|3|Standard|NO_SIZE|gps");
  });

  it("a round Galaxy Watch with no case-size spec STAYS low_confidence (size genuinely discriminates price there)", () => {
    const r = idOf("", "Samsung Galaxy Watch 6, Bluetooth", "Samsung");
    expect(r.status).toBe("low_confidence_candidate");
  });

  it("a Huawei Band with no case-size spec is also VALID (generic fix, not Samsung-only)", () => {
    const r = idOf("", "Huawei Band 9, Bluetooth, Black", "Huawei");
    expect(r.status).toBe("valid");
    expect(r.key).toContain("|NO_SIZE|");
  });
});

// PROVEN LIVE (2026-09-13, Official Gateway Closure mission): two real Samsung KSA
// "Galaxy Watch Ultra2" PDPs (Silver LTE SM-L715FZSAKSA, Gray LTE SM-L715FZKAKSA) —
// titles never state a case size, staying low_confidence_candidate forever, even
// though Samsung's own declared spec table states "Body Dimension (HxWxD, mm):
// 47.4 x 47.1 x 10.7" on both. This is genuinely different from the ADR-350 band-type
// case (no size axis at all): Watch Ultra DOES have a real, stated, evidence-backed
// case size — it's just not printed in the title, so it belongs in the spec table
// fallback, not the family-wide NO_SIZE exception.
describe("identity — case size read from the declared spec table when absent from the title", () => {
  const specPayload = { specifications: { raw: { "Body Dimension (HxWxD, mm)": "47.4 x 47.1 x 10.7" } } };
  it("Galaxy Watch Ultra2 with no title case-size resolves size_mm=47 from the spec table", () => {
    const n = normalize("", "Galaxy Watch Ultra2 Titanium Silver Lte (SM-L715FZSAKSA)", "Samsung", specPayload);
    expect(n.payload.size_mm).toBe(47);
    const r = buildIdentityKey("Samsung", n.payload, {});
    expect(r.status).toBe("valid");
    expect(r.key).toBe("samsung|Galaxy Watch Ultra|Ultra2|Standard|47|cellular");
  });
  it("a title-stated case size still wins over the spec table (title is checked first)", () => {
    const n = normalize("", "Samsung Galaxy Watch 6 44mm", "Samsung", specPayload);
    expect(n.payload.size_mm).toBe(44);
  });
  it("an absent/malformed Body Dimension field does not fabricate a size", () => {
    const n = normalize("", "Galaxy Watch Ultra2 Titanium Silver Lte (SM-L715FZSAKSA)", "Samsung", { specifications: { raw: { "Body Dimension (HxWxD, mm)": "n/a" } } });
    expect(n.payload.size_mm).toBeNull();
  });
});

// MEASURED DEFECT (2026-09-13, Samsung KSA official-gateway residual closure mission):
// "Galaxy Watch Ultra2" (Samsung's own real successor line, model prefix SM-L715F — proven
// distinct from the original Ultra's SM-L705F by first-party model code, not title
// similarity) was silently merging onto generation="Ultra" because the old named pattern had
// no right boundary and matched "ultra2" as a prefix of "ultra". That made a real second
// generation invisible and blocked it from ever canonicalizing (a genuine missing product
// disguised as an identity collision).
describe("identity — Galaxy Watch Ultra2 is its own generation, not a collision with the original Ultra", () => {
  it("'Ultra2' resolves as its own generation, distinct from 'Ultra'", () => {
    const n = normalize("", "Galaxy Watch Ultra2 Titanium Silver Lte (SM-L715FZSAKSA)", "Samsung");
    expect(n.payload.generation).toBe("Ultra2");
  });
  it("the original Watch Ultra ('Ultra', model SM-L705F) is unaffected — still resolves 'Ultra'", () => {
    const n = normalize("", "Galaxy Watch Ultra (LTE 47mm) Titanium White (SM-L705FZWAKSA)", "Samsung");
    expect(n.payload.generation).toBe("Ultra");
  });
  it("Ultra and Ultra2 produce genuinely different identity keys (no false merge, no collision)", () => {
    const n1 = normalize("", "Galaxy Watch Ultra 47mm (Middle East Version) Smartwatch, LTE", "Samsung");
    const n2 = normalize("", "Galaxy Watch Ultra2 Titanium Silver Lte (SM-L715FZSAKSA)", "Samsung", { specifications: { raw: { "Body Dimension (HxWxD, mm)": "47.4 x 47.1 x 10.7" } } });
    const k1 = buildIdentityKey("Samsung", n1.payload, {});
    const k2 = buildIdentityKey("Samsung", n2.payload, {});
    expect(k1.key).not.toBe(k2.key);
    expect(k2.key).toContain("Ultra2");
  });
});
