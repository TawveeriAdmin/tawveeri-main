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

  // ADR-350 (2026-09-13): Samsung's own gaming-monitor line names ("Odyssey Neo G9",
  // "Odyssey OLED G6/G9") carry no "monitor"/"screen" word at all — just the model line +
  // hz/inch. The old fallback gated this hz/inch/gaming check behind requiring the Arabic
  // word "شاشة" first, which could never fire for Samsung KSA's English-locale (sa_en)
  // scrape — proven live: its name_ar field is a verbatim duplicate of name_en, no Arabic
  // characters at all. This is a same-language-symmetry fix (English gets the same
  // evidentiary bar Arabic already had), not a new, looser one.
  it.each([
    ["57\" Odyssey Neo G9 G95NC Inch 240hz Curved Dual Uhd (LS57CG952NMXUE)"],
    ["27\" Odyssey OLED G6 G61SD QHD Inch 240hz (LS27DG612SMXUE)"],
  ])("detects English-only gaming monitor with no 'monitor' word: %s", (en) => {
    expect(detect(en, en)).toBe(true); // name_ar === name_en, as Samsung KSA's sa_en scrape actually stores it
  });

  // ADR-350: confirmed Samsung KSA source-side title typo (model LS22A336NHMXUE) — the
  // ONLY occurrence of this spelling platform-wide.
  it("detects Samsung's own 'Monintor' title typo", () => {
    expect(detect("", "22\" FHD Flat Monintor with Wide Viewing Angle S33a Inch (LS22A336NHMXUE)")).toBe(true);
  });

  it.each([
    ["Samsung 55 Inch QLED 4K Smart TV 2024"],
    ["LG OLED evo 65 Inch 4K Smart TV"],
    ["Dell XPS 15 Laptop Intel Core i7 16GB 512GB 15.6 inch"],
    ["Samsung Galaxy Tab S9 11 inch Tablet"],
    ["Monitor Arm Desk Mount for 27 inch screen"],
  ])("rejects non-monitor: %s", (en) => { expect(detect("", en)).toBe(false); });

  // Proven live (2026-09-13, Phase 1 execution): a TV+monitor merchandising bundle
  // ("83-inch OLED S85H 4K, 32-inch Smart Monitor M8-M80F Bundle F-FA01COMBO61") contains
  // "monitor", a real inch figure and an hz/panel cue — MONITOR_SIGNALS alone would have
  // claimed it as a single monitor identity. Same doctrine as the TV/vacuum bundle rejects.
  it.each([
    ["83-inch OLED S85H 4K, 32-inch Smart Monitor M8-M80F Bundle F-FA01COMBO61"],
    ["TV + Monitor Combo Bundle 32 inch 144Hz"],
    ["حزمة شاشة قيمنج 27 بوصة 165 هرتز"],
  ])("rejects a bundle/combo page: %s", (en) => { expect(detect("", en)).toBe(false); });
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

  // Proven live-production defect (2026-09-13): Samsung's own spec table writes
  // big resolution numbers with a thousands comma ("3,840 x 2,160"). Upstream
  // Arabic normalization folds that comma to a space ("3 840 x 2 160"), which
  // the resolution regex never matched — the monitor silently fell through to
  // NO_RES and merged onto an unrelated FHD monitor's identity, a real
  // cross-product collapse, not a duplicate. All three real-world spellings
  // below must resolve identically.
  it("resolution is comma/space/× tolerant (comma-resolution protection)", () => {
    expect(p("Samsung Smart Monitor M8 32 inch Resolution 3,840 x 2,160 60Hz VA").resolution).toBe("4k");
    expect(p("Samsung Smart Monitor M8 32 inch Resolution 3840 x 2160 60Hz VA").resolution).toBe("4k");
    expect(p("Samsung Smart Monitor M8 32 inch Resolution 3840×2160 60Hz VA").resolution).toBe("4k");
  });

  it("a comma-formatted 4K monitor no longer collapses onto an unrelated FHD monitor's identity", () => {
    const uhd = build("", "Samsung Smart Monitor M8 32 inch Resolution 3,840 x 2,160 60Hz VA", "samsung");
    const fhd = build("", "Samsung Smart Monitor M5 32 inch Resolution 1,920 x 1,080 60Hz VA", "samsung");
    expect(uhd.key).not.toBeNull();
    expect(fhd.key).not.toBeNull();
    expect(uhd.key).not.toBe(fhd.key);
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

// Official Gateway Closure mission (2026-09-13): a SECOND, distinct Samsung KSA source-side
// title typo (samsung.com/sa_en, model LS24H850QFNXZA: "24\" WQHD Business Montior with
// bezeless design..."), verified as the sole platform-wide occurrence before adding — the
// same evidence standard as "monintor" (ADR-350).
describe("detector — a second Samsung KSA source typo ('Montior') is still recognized", () => {
  it("detects the row despite the 'Montior' misspelling", () => {
    expect(detect("", "24\" WQHD Business Montior with bezeless design Inch (LS24H850QFNXZA)")).toBe(true);
  });
});

// PROVEN LIVE (2026-09-13, Official Gateway Closure mission): Samsung's own "Smart
// Monitor M7/M8" line advertises "Smart TV Apps" as a built-in FEATURE — the bare
// "smart tv" substring inside WRONG_DEVICE wrongly rejected these real monitors.
describe("detector — 'TV Apps' is a Smart Monitor feature, not a television", () => {
  it("still detects a Smart Monitor that advertises 'Smart TV Apps'", () => {
    expect(detect("", "43\" Smart Monitor With Smart TV Apps and UHD M7 Inch (LS43AM700UMXUE)")).toBe(true);
  });
  it("detects a Smart Monitor even when 'Tv Apps' isn't adjacent to 'Smart' (real Samsung title, LS43DM703UMXUE)", () => {
    expect(detect("", "43\" Smart Monitor M7 M70D UHD White Inch Tv Apps (LS43DM703UMXUE)")).toBe(true);
  });
  it("still rejects a genuine Smart TV (no regression)", () => {
    expect(detect("", "Samsung 55 inch Crystal UHD 4K Smart TV")).toBe(false);
  });
  it("a projector referencing 'Android TV Apps' still stays a projector (no regression)", () => {
    expect(detect("", "4K Ultra HD Daylight Projector Smart LED Home Theater Projector HDR WiFi6 Bluetooth NFC Android TV Apps HDMI for Video Gaming")).toBe(false);
  });
});
