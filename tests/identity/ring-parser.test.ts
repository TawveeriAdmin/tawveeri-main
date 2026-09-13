// tests/identity/ring-parser.test.ts
// ADR-351 (2026-09-13, Samsung KSA official-catalog closure mission). New category:
// smart rings (Galaxy Ring, Oura, RingConn, Circular, Ultrahuman) — generic across
// brands, not a Samsung-only carve-out. Multi-merchant evidence checked before
// building: Galaxy Ring is listed on both samsung.com and Amazon SA.
//
// Deliberately registered despite most current evidence being UNPRICED: canonical
// creation has no price requirement anywhere in the pipeline (proven by reading
// corroboratePass — `canonicalRows.push` happens purely off identity + store count,
// price only gates the separate price_history/current_offers writes). A real,
// current product is worth representing (PRODUCT_SUPPORTED) even when no store
// currently publishes a price for it (that is a fact about the OFFER, not grounds
// to make the product itself invisible).
import { detect } from "../../scripts/tps-plugins/ring/detector";
import { normalize } from "../../scripts/tps-plugins/ring/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/ring/identity";

const build = (ar: string, en: string, brand: string | null) => {
  const n = normalize(ar, en, brand);
  return { ...buildIdentityKey(brand, n.payload), p: n.payload as Record<string, unknown> };
};

describe("detector — real smart-ring listings (production evidence)", () => {
  it.each([
    ["Galaxy Ring Titanium Black Size 12 (SM-Q502NZKAMEA)"],
    ["Galaxy Ring Titanium Gold Size 9 (SM-Q509NZDAMEA)"],
    ["Oura Ring Gen 4, Silver, Size 8"],
    ["RingConn Gen 3 Smart Ring, Titanium"],
  ])("detects: %s", (en) => { expect(detect("", en)).toBe(true); });

  it.each([
    ["RingConn Gen 3 Sizing Kit - Size First Before You Buy | Choose from 10 Sizes (6–15)", "a sizing kit is an accessory, not the ring"],
    ["Tasbih Smart Ring,Smart tasbih ring,Muslim Prayer,Counter,Prayer timing reminder,OLED display", "an Islamic prayer-counter ring, not a fitness ring, despite saying 'smart ring'"],
    ["Samsung Galaxy Watch 6, Bluetooth", "a watch, not a ring"],
    ["Samsung earbuds with charging case", "unrelated audio accessory"],
  ])("rejects: %s (%s)", (title) => { expect(detect("", title)).toBe(false); });

  it("a genuinely unbranded but real health-tracking smart ring still detects (brand resolution is a separate, later gate)", () => {
    expect(detect("", "Smart Ring Fitness Tracker Health Heart Rate, Oximetry, Sleep, Exercise Calories Monitoring")).toBe(true);
  });
});

describe("identity — brand | family | material (size deliberately excluded)", () => {
  it("Galaxy Ring Titanium Black is a valid identity", () => {
    const r = build("", "Galaxy Ring Titanium Black Size 12 (SM-Q502NZKAMEA)", "Samsung");
    expect(r.status).toBe("valid");
    expect(r.key).toBe("samsung|Galaxy Ring|Titanium Black");
  });

  it("different SIZES of the same material collapse to ONE identity (size is a purchase option, not a different product)", () => {
    const size12 = build("", "Galaxy Ring Titanium Black Size 12 (SM-Q502NZKAMEA)", "Samsung");
    const size7 = build("", "Galaxy Ring Titanium Black Size 7 (SM-Q507NZKAMEA)", "Samsung");
    expect(size12.key).toBe(size7.key);
  });

  it("different MATERIALS/finishes stay distinct identities (a real GS1-style variant boundary)", () => {
    const black = build("", "Galaxy Ring Titanium Black Size 12 (SM-Q502NZKAMEA)", "Samsung");
    const gold = build("", "Galaxy Ring Titanium Gold Size 12 (SM-Q502NZDAMEA)", "Samsung");
    expect(black.key).not.toBe(gold.key);
  });

  it("rejects a ring with no recognizable brand or family", () => {
    const r = build("", "Smart Ring Fitness Tracker Health Heart Rate, Oximetry, Sleep", "Unknown");
    expect(r.status).toBe("invalid");
  });
});
