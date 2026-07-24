// tests/identity/printer-parser.test.ts
// ADR-075 registration gate for the NEW printer plugin. Every title is a real
// Saudi listing observed in production on 2026-07-24. Printer was unregistered
// (86 listings, 29 comparison-possible, 0 identified); this suite lets it earn
// registration on measured identity quality.
import { detect } from "../../scripts/tps-plugins/printer/detector";
import { normalize } from "../../scripts/tps-plugins/printer/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/printer/identity";

const build = (ar: string, en: string, brand: string | null) => {
  const n = normalize(ar, en, brand, {});
  return { ...buildIdentityKey(brand, n.payload, {}), p: n.payload as Record<string, unknown> };
};
const identified = (r: { status: string; key: string | null }) => r.status !== "invalid" && !!r.key;

describe("detector — printers, not consumables/accessories", () => {
  it.each([
    ["", "HP LaserJet Tank MFP 1602w Multi-function Printer, Wi-Fi, Laser Printing"],
    ["طابعة كانون بيكسما G3410 تانك واي فاي، طباعة، نسخ، مسح ضوئي", ""],
  ])("detects printer: %s %s", (ar, en) => { expect(detect(ar, en)).toBe(true); });

  it.each([
    ["", "HP 305 Original Ink Cartridge, Black"],
    ["", "Hama USB 2.0 to Printer (Female) Standard Cable, 1.50 m, Black"],
    ["", "Canon PG-745 Black Toner Cartridge"],
    ["حبر طابعة اتش بي 682 أسود", ""],
  ])("rejects accessory/consumable: %s %s", (ar, en) => { expect(detect(ar, en)).toBe(false); });
});

describe("identity — brand | line + model number", () => {
  it("HP LaserJet Tank MFP 1602w (English)", () => {
    expect(build("", "HP LaserJet Tank MFP 1602w Multi-function Printer, Wi-Fi, Laser Printing", "HP").key).toBe("hp|laserjet 1602w");
  });
  it("HP DeskJet 2320 (Arabic, brand أتش بي)", () => {
    expect(build("طابعة اتش بي ديسك جيت 2320 متعددة الوظائف، طباعة، مسح ضوئي، نسخ، أبيض - 7WN42B", "", "HP").key).toBe("hp|deskjet 2320");
  });
  it("HP LaserJet MFP M141W (Arabic line ليزرجت, Latin model)", () => {
    expect(build("طابعة اتش بي ليزرجت MFP M141W متعددة الوظائف، طباعة، نسخ، مسح ضوئي، واى فاى، أبيض", "", "HP").key).toBe("hp|laserjet m141w");
  });
  it("Canon PIXMA G3410 (Arabic بيكسما)", () => {
    expect(build("طابعة كانون بيكسما G3410 تانك واي فاي، طباعة، نسخ، مسح ضوئي", "", "Canon").key).toBe("canon|pixma g3410");
  });
  it("Canon PIXMA TS5340A", () => {
    expect(build("طابعة كانون بيكسما TS5340A واي فاي، طباعة، نسخ، مسح ضوئي", "", "Canon").key).toBe("canon|pixma ts5340a");
  });
  it("Canon SELPHY CP1500 — brand inferred from the line when store says 'Unknown'", () => {
    expect(build("", "Canon SELPHY CP1500 Dye Sublimation Printing Photo Printer, Wi-Fi/USB, Black", "Unknown").key).toBe("canon|selphy cp1500");
  });
  it("HP Ink Advantage maps to the DeskJet line (a store may drop 'DeskJet')", () => {
    expect(build("", "HP Ink Advantage 2978 All-in-One Multi-function Printer, Wi-Fi", "HP").key).toBe("hp|deskjet 2978");
    expect(build("", "HP DeskJet Ink Advantage 2778 Wireless Printer", "HP").key).toBe("hp|deskjet 2778");
  });
  it("brand inferred from a bare line word (no brand, no 'Canon')", () => {
    // "PIXMA" alone implies Canon.
    expect(build("", "PIXMA G2411 Wireless All-in-One Printer", null).key).toBe("canon|pixma g2411");
  });
});

describe("precision — too-weak identities are not asserted", () => {
  it("a bare 'HP printer' with no line/model is invalid", () => {
    expect(identified(build("", "HP Printer, Wi-Fi, Black", "HP"))).toBe(false);
  });
});
