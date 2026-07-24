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

describe("ADR-079 — technology is optional (NO_TECH), so budget/window ACs identify", () => {
  const buildB = (en: string, brand: string) => {
    const n = acN("", en, brand);
    return { ...acPlugin.buildIdentityKey(brand, n.payload, { model_number: n.model_number }), p: n.payload as Record<string, unknown> };
  };
  it("a Gree split AC with no inverter/standard word is identified as NO_TECH", () => {
    const r = buildB("Gree Split AC 18500 BTU Cool Only WiFi", "Gree");
    expect(r.p.technology).toBeNull();
    expect(r.key).toBe("gree|split|NO_SERIES|18500|NO_TECH|cool_only");
    expect(r.status).toBe("low_confidence_candidate");
  });
  it("two stores' same budget AC corroborate on the NO_TECH key", () => {
    const a = buildB("Midea Mission Extreme Split AC 18800 BTU Cool Only WiFi", "Midea");
    const b = buildB("Midea Split AC 18800 Cool Only White", "Midea");
    expect(a.key).toBe(b.key);
    expect(a.key).toContain("|NO_TECH|");
  });
  it("a stated-inverter AC keeps tech=Inverter and never merges with NO_TECH", () => {
    const inv = buildB("Samsung Split AC Inverter 17000 BTU Cool Only", "Samsung");
    expect(inv.key).toContain("|Inverter|");
    expect(inv.key).not.toContain("|NO_TECH|");
  });
  it("still invalid without capacity or cooling_mode (those stay required)", () => {
    expect(acPlugin.buildIdentityKey("Gree", acN("", "Gree Split AC WiFi White", "Gree").payload, {}).status).toBe("invalid");
  });
});
