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

  it("never leaks any of the identity sentinels", () => {
    const { nameAr, nameEn } = buildNames("gree|split|NO_SERIES|24000|NO_TECH|hot_cold");
    for (const s of ["NO_TECH", "NO_SERIES", "NA"]) {
      expect(nameAr).not.toContain(s);
      expect(nameEn).not.toContain(s);
    }
  });
});
