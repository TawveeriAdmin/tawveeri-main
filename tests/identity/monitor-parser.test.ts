// tests/identity/monitor-parser.test.ts
// ADR-074 registration gate for the NEW monitor plugin. Every title below is a
// real Saudi listing observed in production on 2026-07-24. Monitor was an
// unregistered category (507 listings, 271 comparison-possible, 0 identified);
// this suite is what lets it earn registration on measured identity quality.
import { detect } from "../../scripts/tps-plugins/monitor/detector";
import { normalize } from "../../scripts/tps-plugins/monitor/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/monitor/identity";

const build = (ar: string, en: string, brand: string | null, payload: Record<string, unknown> = {}) => {
  const n = normalize(ar, en, brand, payload);
  return { ...buildIdentityKey(brand, n.payload, { model_number: n.model_number }), p: n.payload as Record<string, unknown> };
};
const identified = (r: { status: string; key: string | null }) => r.status !== "invalid" && !!r.key;

describe("detector — monitors, not TVs / laptops / accessories", () => {
  it.each([
    ["Samsung Odyssey G5 G53F Flat Gaming Monitor 27 Inch QHD 200Hz IPS Black"],
    ["Dell P2725H 27 Inch Full HD Monitor, 100Hz, IPS"],
    ["شاشة ألعاب داهوا 27 بوصة FHD، لوحة IPS، 200Hz"],
  ])("detects monitor: %s", (en) => { expect(detect("", en)).toBe(true); });

  it.each([
    ["Samsung 55 Inch QLED 4K Smart TV 2024"],
    ["LG OLED evo 65 Inch 4K Smart TV"],
    ["Dell XPS 15 Laptop Intel Core i7 16GB 512GB 15.6 inch"],
    ["Samsung Galaxy Tab S9 11 inch Tablet"],
    ["Monitor Arm Desk Mount for 27 inch screen"],
  ])("rejects non-monitor: %s", (en) => { expect(detect("", en)).toBe(false); });
});

describe("identity — brand | size | resolution | refresh | panel", () => {
  it("Samsung Odyssey G5 (English, Extra)", () => {
    const r = build("", "Samsung Odyssey G5 G53F Flat Gaming Monitor 27 Inch QHD - 200Hz IPS Black", "Samsung");
    expect(r.key).toBe("samsung|27|qhd|200|ips");
    expect(r.status).toBe("valid");
    expect(r.p.line).toBe("odyssey g5");
  });
  it("LG UltraGear (Arabic, Almanea): size بوصة + refresh هرتز + Latin QHD", () => {
    const r = build("إل جي 32 بوصة UltraGear شاشة ألعاب منحنية 1000R، دقة QHD، 180 هرتز، أسود، 32GS60QC-B", "", "LG");
    expect(r.key).toBe("lg|32|qhd|180|NO_PANEL");
    expect(r.status).toBe("valid");
    expect(r.p.curved).toBe(true);
  });
  it("Dell P2725H (Amazon)", () => {
    expect(build("", "Dell P2725H 27 Inch Full HD (1920x1080) Monitor, 100Hz, IPS, 5ms, USB-C", "Dell").key).toBe("dell|27|fhd|100|ips");
  });
  it("Dahua gaming (Arabic)", () => {
    expect(build("شاشة ألعاب داهوا 27 بوصة FHD، لوحة IPS، ‏200Hz، ‏0.5ms", "", "Dahua").key).toBe("dahua|27|fhd|200|ips");
  });
  it("AOC 24.5\" written '24.5 بوصة'", () => {
    const r = build("اي او سي شاشة كمبيوتر للألعاب، مسطحة، 24.5 بوصة، دقة fhd، لوحة ips، أسود", "AOC 25B36X Gaming Flat Monitor", "AOC");
    expect(r.p.screen_size).toBe(24.5);
    expect(r.key).toBe("aoc|24.5|fhd|NO_HZ|ips");   // no refresh in title → low_confidence
    expect(r.status).toBe("low_confidence_candidate");
  });
});

describe("component extraction", () => {
  const p = (en: string) => build("", en, "test").p;
  it("ultrawide resolution (WFHD / UWQHD kept distinct from flat)", () => {
    expect(p("LG UltraWide 29 inch WFHD 2560x1080 100Hz IPS").resolution).toBe("wfhd");
    expect(p("Samsung Odyssey 34 inch UWQHD 3440x1440 165Hz").resolution).toBe("uwqhd");
  });
  it("panel OLED / VA", () => {
    expect(p("MSI 27 inch QHD 240Hz OLED Gaming Monitor").panel).toBe("oled");
    expect(p("Samsung Odyssey 32 inch 4K 165Hz VA Curved").panel).toBe("va");
  });
});

describe("precision — too-weak identities are not asserted", () => {
  it("brand + size only (no resolution, no refresh) is invalid", () => {
    expect(identified(build("", "Some Monitor 24 inch Black", "hp"))).toBe(false);
  });
  it("LG UltraGear with refresh but no stated resolution → low_confidence, not corroborated", () => {
    const r = build("", "LG UltraGear 27GS60QC 27\" Gaming Monitor, LED, 180 Hz, 1ms, Black", "LG");
    expect(r.status).toBe("low_confidence_candidate");
    expect(r.key).toBe("lg|27|NO_RES|180|NO_PANEL");
  });
});
