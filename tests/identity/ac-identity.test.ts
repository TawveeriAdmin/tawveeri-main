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
  it("still invalid without capacity_btu (that alone stays required)", () => {
    expect(acPlugin.buildIdentityKey("Gree", acN("", "Gree Split AC WiFi White", "Gree").payload, {}).status).toBe("invalid");
  });
});

describe("ADR-306 (2026-09-07) — cooling_mode is optional (NO_MODE), so undisclosed-mode ACs identify", () => {
  const buildB = (en: string, brand: string) => {
    const n = acN("", en, brand);
    return { ...acPlugin.buildIdentityKey(brand, n.payload, { model_number: n.model_number }), p: n.payload as Record<string, unknown> };
  };
  // MEASURED (Amazon AC normalization-drop mission): a live sample of 7 real current
  // Amazon AC titles found 5 with no cooling-mode word the parser recognized at all —
  // including this exact title, the genuine storefront row that motivated this fix —
  // making `cooling_mode` a hard-blocking null for an otherwise fully-identified
  // listing, the identical failure class ADR-079 already fixed for `technology`.
  it("a Gree split AC with no cooling-mode word is identified as NO_MODE, not invalid", () => {
    const r = buildB("GWH18AGDXF-D3NTA1G-I 18000 BTU, 1.5 Ton Split Air Conditioner, White", "Gree");
    expect(r.p.cooling_mode).toBeNull();
    expect(r.key).toBe("gree|split|NO_SERIES|18000|NO_TECH|NO_MODE");
    expect(r.status).toBe("low_confidence_candidate");
  });
  it("two stores' same mode-undisclosed AC corroborate on the NO_MODE key", () => {
    const a = buildB("Super General 1.5 Ton 18000 BTU Window Air Conditioner", "Super General");
    const b = buildB("Super General 18000 BTU Window AC White", "Super General");
    expect(a.key).toBe(b.key);
    expect(a.key).toContain("|NO_MODE");
  });
  it("a stated cool-only AC keeps mode=cool_only and never merges with NO_MODE", () => {
    const stated = buildB("Aston Split AC, 18000BTU, 1.5Ton, Cold Only", "Aston");
    expect(stated.key).toContain("|cool_only");
    expect(stated.key).not.toContain("|NO_MODE");
  });
  it("capacity_btu remains a hard requirement — still invalid without it, even with mode stated", () => {
    const r = buildB("Gree Split AC Cool Only WiFi White", "Gree");
    expect(r.status).toBe("invalid");
  });
  it("real production title: bare 'Hot&Cold' (no spaces) is parsed as hot_cold, not NO_MODE", () => {
    const r = buildB("Star vision 16000 BTU Hot&Cold Portable Air Conditioner, Auto Fan, Self Diagnostic", "Star vision");
    expect(r.p.cooling_mode).toBe("hot_cold");
    expect(r.key).toContain("|hot_cold");
  });

  // MEASURED DEFECT, found while backfilling the recovered rows above: a model number
  // ending in a bare digit immediately before the real BTU number ("TCL CW-TW18HW1 24000
  // BTU...") let the old BTU regex's `[\d\s,]*` class cross the space and swallow the
  // model's trailing "1" into the capacity, producing capacity_btu=124000 — an impossible
  // residential capacity that would have reached a customer-facing canonical the moment
  // this NO_MODE fix stopped blocking the row entirely. Fixed in parser.ts (word-boundary
  // anchor + comma-only, no bare-space, digit grouping).
  it("a model number ending in a bare digit does not bleed into the real BTU value", () => {
    const r = buildB("TCL CW-TW18HW1 24000 BTU Heat and Cool Window Air Conditioner, 2 Ton Capacity, White", "TCL");
    expect(r.p.capacity_btu).toBe(24000);
    expect(r.key).toContain("|24000|");
  });
  it("comma-grouped BTU values still parse correctly (no regression)", () => {
    expect(buildB("YORK Taurus Inverter Window Air Conditioner 19,448 BTU Max (~1.6 Ton) Cooling and Heating", "YORK").p.capacity_btu).toBe(19448);
    expect(buildB("YORK ICEBERG High Wall Split Inverter 39,238 BTU Max (~3.27 Ton) Cool and Heat Air Conditioner", "YORK").p.capacity_btu).toBe(39238);
  });
});
