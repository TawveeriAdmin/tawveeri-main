// tests/identity/ac-identity.test.ts
// ADR-077 regression gate. LG design lines are distinct products; without series
// extraction, Art Cool (premium) and Fresh DV (basic) merged at the same BTU
// (measured 1650 to 5280 SAR). A series-less AC key is low_confidence, so with
// requireValidTier it no longer corroborates.
import { acPlugin } from "../../scripts/tps-plugins/ac";
import { normalize as acN } from "../../scripts/tps-plugins/ac/parser";

const build = (en: string) => {
  const n = acN("", en, "LG");
  return { ...acPlugin.buildIdentityKey("LG", n.payload, { model_number: n.model_number }), p: n.payload as Record<string, unknown> };
};

describe("AC identity — LG design series distinguish products", () => {
  it("Art Cool is extracted as a series (valid, corroboration-eligible)", () => {
    const r = build("LG Split AC 18000 BTU Cool Only Art Cool Dual Inverter Compressor Black");
    expect(r.p.series_or_platform).toBe("ArtCool");
    expect(r.status).toBe("valid");
    expect(r.key).toContain("|ArtCool|");
  });
  it("Fresh DV is a distinct series from Art Cool (no more false merge)", () => {
    const r = build("LG Split AC 18000 BTU Cool Only Fresh DV Dual Inverter Compressor White");
    expect(r.p.series_or_platform).toBe("FreshDV");
    expect(r.key).toContain("|FreshDV|");
    expect(r.key).not.toContain("|ArtCool|");
  });
  it("a series-less LG AC is low_confidence (its design line was unread)", () => {
    const r = build("LG Split AC 18000 BTU Smart Dual Inverter Compressor Cool Only");
    expect(r.p.series_or_platform).toBeNull();
    expect(r.key).toContain("|NO_SERIES|");
    expect(r.status).toBe("low_confidence_candidate");
  });
  it("'Dual Inverter' alone is compressor tech, not a series", () => {
    expect(build("LG Split AC 18000 BTU Dual Inverter Cool Only").p.series_or_platform).toBeNull();
  });
});
