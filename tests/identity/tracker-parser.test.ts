// tests/identity/tracker-parser.test.ts
// ADR-351 (2026-09-13, Samsung KSA official-catalog closure mission). New category:
// Bluetooth item-finders (Samsung SmartTag, Apple AirTag, Tile, Aukey Track Mate) —
// generic across brands. Multi-merchant evidence checked before building: Jarir,
// Noon and Almanea all carry real, priced tracker SKUs distinct from Samsung's own.
//
// Colour is kept in identity here (unlike ring's material) because production
// evidence showed a real, measured price difference between Samsung's own
// SmartTag2 Black (99 SAR) and White (300.3 SAR) listings — collapsing them would
// risk merging two SKUs that may be legitimately priced differently.
import { detect } from "../../scripts/tps-plugins/tracker/detector";
import { normalize } from "../../scripts/tps-plugins/tracker/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/tracker/identity";

const build = (ar: string, en: string, brand: string | null) => {
  const n = normalize(ar, en, brand);
  return { ...buildIdentityKey(brand, n.payload), p: n.payload as Record<string, unknown> };
};

describe("detector — real Bluetooth-tracker listings (production evidence)", () => {
  it.each([
    ["Samsung Galaxy SmartTag2 Multi-function Item Locator, Black"],
    ["Aukey Track Mate 1 Smart Bluetooth Tracker (1 PC)"],
    ["Apple AirTag 4 Pack"],
    ["Tile Mate (2022) 1-pack, Bluetooth Tracker"],
  ])("detects: %s", (en) => { expect(detect("", en)).toBe(true); });

  it.each([
    ["Samsung Galaxy Watch 6, Bluetooth", "a watch"],
    ["Galaxy Ring Titanium Black Size 12", "a ring"],
    ["Samsung earbuds with charging case", "unrelated audio"],
    ["Silicone case for AirTag", "an accessory FOR a tracker, not the tracker"],
  ])("rejects: %s (%s)", (title) => { expect(detect("", title)).toBe(false); });
});

describe("identity — brand | family | variant (colour kept, proven real price difference)", () => {
  it("SmartTag2 Black is a valid identity", () => {
    const r = build("", "Galaxy SmartTag2 Black Ei (EI-T5600BBEGWW)", "Samsung");
    expect(r.status).toBe("valid");
    expect(r.key).toBe("samsung|SmartTag2|Black");
  });

  it("SmartTag2 White stays a DISTINCT identity from Black (measured real price gap: 99 vs 300.3 SAR)", () => {
    const black = build("", "Galaxy SmartTag2 Black Ei (EI-T5600BBEGWW)", "Samsung");
    const white = build("", "Galaxy SmartTag2 White Ei (EI-T5600KWEGWW)", "Samsung");
    expect(black.key).not.toBe(white.key);
  });

  it("Aukey Track Mate keeps its pack-count as part of identity", () => {
    const r = build("", "Aukey Track Mate 1 Smart Bluetooth Tracker (1 PC)", "Aukey");
    expect(r.status).toBe("valid");
    expect(r.key).toContain("aukey|Track Mate");
  });

  it("rejects a tracker with no recognizable family", () => {
    const r = build("", "Generic Bluetooth Gadget", "Unknown");
    expect(r.status).toBe("invalid");
  });
});
