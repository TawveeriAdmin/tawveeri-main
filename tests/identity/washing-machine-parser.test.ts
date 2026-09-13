// tests/identity/washing-machine-parser.test.ts
// ADR-350 (2026-09-13, Samsung KSA official-catalog closure mission): standalone dryers
// and washer/dryer combos share the washing_machine plugin's identity model (key already
// anticipated a 4th "dryer(combo|washer)" segment) but the detector/parser never handled
// a title that says "dryer" without ever saying "washer" at all — proven on Samsung's own
// "Bespoke AI Dryer with Hybrid Heat Pump...17kg" and "16kg Inverter Heatpump Dryer".
// Multi-merchant evidence before building this: standalone dryers are carried by Amazon,
// Noon, Extra, Almanea, Shaker and Sharaf DG too — this is a real comparison category, not
// a Samsung-only completeness exercise.
import { detect } from "../../scripts/tps-plugins/washing_machine/detector";
import { normalize } from "../../scripts/tps-plugins/washing_machine/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/washing_machine/identity";

const build = (ar: string, en: string, brand: string | null) => {
  const n = normalize(ar, en, brand);
  return { ...buildIdentityKey(brand, n.payload), p: n.payload as Record<string, unknown> };
};

describe("detector — standalone dryers (no 'washer' word at all)", () => {
  it.each([
    ["Bespoke AI™ Dryer with Hybridheatpump Auto Open Door AI Dry 17kg Beige Yl (DV17B9750CE/YL)"],
    ["16kg Inverter Heatpump Dryer Black Color AI Control WIFI Hygiene Care Yl (DV16T8740BV/YL)"],
    ["Bespoke AI Laundry Dryer with Hybrid Heat Pump Home 17kg Gray (DV90F17CDSYL)"],
  ])("detects: %s", (en) => { expect(detect("", en)).toBe(true); });

  it("still rejects a hair dryer", () => {
    expect(detect("", "Philips Hair Dryer 2200W, Black")).toBe(false);
  });

  it("still rejects a bare mention of 'dryer' with no capacity/laundry cue", () => {
    expect(detect("", "Universal Dryer Stand Accessory")).toBe(false);
  });

  it("still detects a real washer with no dryer mentioned at all", () => {
    expect(detect("", "21kg Washer Black Color AI Control WIFI DD Motor Front Load")).toBe(true);
  });

  it("still detects an existing washer-with-dryer combo phrasing", () => {
    expect(detect("", "18kg Washer with 11kg dryer Inox Color AI Control")).toBe(true);
  });
});

describe("identity — standalone dryer gets its own type, never confused with washer/combo (ADR-350)", () => {
  it("a standalone dryer is valid, keyed as 'dryer_only'/'standalone_dryer'", () => {
    const r = build("", "Bespoke AI Dryer with Hybrid Heat Pump Home 17kg Gray (DV90F17CDSYL)", "Samsung");
    expect(r.status).toBe("valid");
    expect(r.key).toBe("samsung|dryer_only|17|standalone_dryer");
    expect(r.p.is_dryer_only).toBe(true);
  });

  it("a washer+dryer combo (mentions both) stays keyed as 'combo', distinct from a standalone dryer", () => {
    const r = build("", "18kg Washer with 11kg dryer Inox Color AI Control Front Load", "Samsung");
    expect(r.status).toBe("valid");
    expect(r.key).toContain("|combo");
    expect(r.key).not.toContain("standalone_dryer");
  });

  it("a plain washer with no dryer mention stays keyed as 'washer'", () => {
    const r = build("", "21kg Washer Black Color AI Control WIFI DD Motor Front Load", "Samsung");
    expect(r.status).toBe("valid");
    expect(r.key).toContain("|washer");
  });

  it("combo capacity notation with '+' (not just '/') is read correctly", () => {
    // Real Samsung title (WD80H25BHWYL). Note: this exact title states neither
    // front-load/top-load NOR "dryer" (only "Combo"), so it still correctly stays
    // type_missing/invalid under this fix's deliberately narrow scope — precision over
    // recall; a disclosed, remaining gap, not silently forced to a guessed type. This test
    // only pins down that the capacity itself parses correctly once type IS resolved.
    const n = normalize("", "Bespoke AI Laundry Combo All-in-One 25kg + 18kg Wd80h27 White (WD80H25BHWYL)", "Samsung");
    expect(n.payload.capacity_kg).toBe(25);
  });

  // MEASURED DEFECT, found live (2026-09-13, Official Gateway Closure mission): Samsung's
  // own title hyphenates "Front-load" — the old `\s*` separator never matched a hyphen, so
  // this real, fully-described combo stayed "type missing"/invalid.
  it("a hyphenated 'Front-load' still resolves washer_type (real Samsung title, WD25DB8995BZYL)", () => {
    const r = build("", "Bespoke AI Laundry Combo Front-load Washer & Dryer All-in-one combo 25kg +15kg Super Speed Gray (WD25DB8995BZYL)", "Samsung");
    expect(r.p.washer_type).toBe("front_load");
    expect(r.status).toBe("valid");
    expect(r.key).toContain("front_load");
  });
});
