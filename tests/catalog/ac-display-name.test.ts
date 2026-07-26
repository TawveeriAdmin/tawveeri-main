// tests/catalog/ac-display-name.test.ts
import { buildNames } from "@/../scripts/tps-matcher/ac-matcher-v1-dry";

describe("AC buildNames — sentinel stripping (ADR-109)", () => {
  it("omits the NO_TECH sentinel from the customer-facing name", () => {
    const { nameAr, nameEn } = buildNames("lg|split|NO_SERIES|30000|NO_TECH|cool_only");
    expect(nameAr).not.toContain("NO_TECH");
    expect(nameEn).not.toContain("NO_TECH");
    expect(nameAr).toBe("مكيف سبليت إل جي، 30000 وحدة، بارد فقط");
    expect(nameEn).toBe("Lg Split AC 30000 BTU cool only");
  });

  it("preserves a known technology + series", () => {
    const { nameAr, nameEn } = buildNames("lg|split|Titan|18000|Inverter|hot_cold");
    expect(nameAr).toContain("انفرتر");
    expect(nameAr).toContain("Titan");
    expect(nameEn).toContain("Inverter");
  });

  it("localizes every ac_type to Arabic (not just split)", () => {
    expect(buildNames("tcl|portable|NO_SERIES|9000|NO_TECH|cool_only").nameAr).toContain("متنقل");
    expect(buildNames("haam|window|NO_SERIES|20800|NO_TECH|hot_cold").nameAr).toContain("شباك");
    expect(buildNames("gree|cabinet|NO_SERIES|46800|Inverter|cool_only").nameAr).toContain("دولابي");
    expect(buildNames("gree|cassette|NO_SERIES|36000|Inverter|hot_cold").nameAr).toContain("كاسيت");
  });

  it("omits a literal 'unknown' brand rather than printing it", () => {
    const { nameAr, nameEn } = buildNames("unknown|split|NO_SERIES|28600|Standard|cool_only");
    expect(nameAr).not.toContain("unknown");
    expect(nameEn).not.toContain("unknown");
    expect(nameAr).toBe("مكيف سبليت، 28600 وحدة، عادي، بارد فقط");
  });

  it("never leaks any of the identity sentinels", () => {
    const { nameAr, nameEn } = buildNames("gree|split|NO_SERIES|24000|NO_TECH|hot_cold");
    for (const s of ["NO_TECH", "NO_SERIES", "NA"]) {
      expect(nameAr).not.toContain(s);
      expect(nameEn).not.toContain(s);
    }
  });
});
