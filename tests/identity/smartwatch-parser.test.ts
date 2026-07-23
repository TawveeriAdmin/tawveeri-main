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
