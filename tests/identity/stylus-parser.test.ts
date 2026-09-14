// tests/identity/stylus-parser.test.ts
// 2026-09-14, Samsung KSA official-gateway high-value-standalone-accessory closure. New
// category: standalone styluses (Samsung S Pen today; generic across brands, not a
// Samsung-only carve-out — same precedent as ring/tracker, ADR-351).
//
// This category exists because ~20 real, live, HTTP-200 Samsung KSA S Pen PDPs (real
// manufacturer part numbers GH96-xxxxx / EJ-PSxxx, real ~219-259 SAR prices) had no path
// to become a Tawveeri product: mobile's own detector correctly refuses to claim them as a
// phone (S_PEN_MENTION && !HAS_STORAGE_TIER_HINT), and no other category existed to claim
// them as what they actually are — a real, independently-purchasable accessory product.
import { detect } from "../../scripts/tps-plugins/mobile/detector";
import { detect as stylusDetect } from "../../scripts/tps-plugins/stylus/detector";
import { normalize } from "../../scripts/tps-plugins/stylus/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/stylus/identity";

const build = (ar: string, en: string, brand: string | null) => {
  const n = normalize(ar, en, brand);
  return { ...buildIdentityKey(brand, n.payload), p: n.payload as Record<string, unknown> };
};

describe("detector — real Samsung KSA S Pen titles are recognized as a stylus", () => {
  it.each([
    "Galaxy S26 Ultra S Pen Black (EJ-PS948BBEGWW)",
    "S Pen for Galaxy S23 Ultra Phantom Black (GH96-15658A)",
    "S Pen for Galaxy S24 Ultra Gray (GH96-16577A)",
    "S Pen for Galaxy S25 Ultra Gold (GH96-18791A)",
    "S Pen for Galaxy S26 Ultra Black (GH96-20906A)",
    "S Pen for Galaxy Tab S11 and S11 Ultra (GH96-20268A)",
  ])("detects: %s", (en) => {
    expect(stylusDetect("", en)).toBe(true);
  });

  it("rejects a low-value replacement part (tips/nibs/case), per the explicit narrow scope", () => {
    expect(stylusDetect("", "S Pen Tips Replacement Pack for Galaxy S23 Ultra")).toBe(false);
    expect(stylusDetect("", "Case for S Pen Galaxy S24 Ultra")).toBe(false);
  });

  it("does not claim a real phone that merely bundles an S Pen (has a storage tier)", () => {
    expect(stylusDetect("", "Galaxy S24 Ultra 256GB, S Pen Included")).toBe(false);
  });
});

// THE REQUIRED IDENTITY-SAFETY REGRESSION — the exact previously-proven failure cases.
// An S-Pen accessory must NEVER resolve to the phone it is compatible with.
describe("identity safety — a stylus can never resolve to its compatible phone's identity", () => {
  it.each([
    ["S Pen for Galaxy S23 Ultra Phantom Black (GH96-15658A)", "S23"],
    ["S Pen for Galaxy S24 Ultra Gray (GH96-16577A)", "S24"],
    ["S Pen for Galaxy S25 Ultra Gold (GH96-18791A)", "S25"],
    ["Galaxy S26 Ultra S Pen Black (EJ-PS948BBEGWW)", "S26"],
  ])("%s never produces a mobile-shaped key, and mobile itself still refuses it", (en) => {
    // 1. mobile's own detector still correctly refuses this title (the pre-existing guard).
    expect(detect("", en)).toBe(false);
    // 2. stylus's own key is a genuinely different shape from any mobile identity key —
    //    it can never be mistaken for, or collide with, "samsung|Galaxy S|S2x|Ultra|...".
    const r = build("", en, "Samsung");
    expect(r.key).not.toBeNull();
    expect(r.key).toMatch(/^samsung\|stylus\|/);
    expect(r.key).not.toMatch(/^samsung\|Galaxy S\|/);
  });

  it("Galaxy S23/S24/S25/S26 Ultra styluses resolve to four DISTINCT identities, not one merged phone-line identity", () => {
    const s23 = build("", "S Pen for Galaxy S23 Ultra Phantom Black (GH96-15658A)", "Samsung");
    const s24 = build("", "S Pen for Galaxy S24 Ultra Gray (GH96-16577A)", "Samsung");
    const s25 = build("", "S Pen for Galaxy S25 Ultra Gold (GH96-18791A)", "Samsung");
    const s26 = build("", "Galaxy S26 Ultra S Pen Black (EJ-PS948BBEGWW)", "Samsung");
    const keys = [s23.key, s24.key, s25.key, s26.key];
    expect(new Set(keys).size).toBe(4);
  });
});

describe("identity — colour is a commercial variant, not identity (verified: same product, same price)", () => {
  it("real Samsung KSA evidence: every colour of the S23 Ultra S Pen prices identically (219 SAR) — colour excluded", () => {
    const beige = build("", "S Pen for Galaxy S23 Ultra Beige (GH96-15658B)", "Samsung");
    const green = build("", "S Pen for Galaxy S23 Ultra Green (GH96-15658C)", "Samsung");
    const black = build("", "S Pen for Galaxy S23 Ultra Phantom Black (GH96-15658A)", "Samsung");
    expect(beige.key).toBe(green.key);
    expect(beige.key).toBe(black.key);
  });
});

describe("identity — the tablet S Pen resolves to the Tab S family, not the Galaxy S phone family", () => {
  it("S Pen for Galaxy Tab S11 and S11 Ultra", () => {
    const r = build("", "S Pen for Galaxy Tab S11 and S11 Ultra (GH96-20268A)", "Samsung");
    expect(r.status).toBe("valid");
    expect(r.key).toContain("Galaxy Tab S");
    expect(r.key).not.toContain("|Galaxy S|");
  });
});

describe("precision — a stylus with no readable compatible device is not asserted", () => {
  it("rejects when compatible family/generation cannot be read", () => {
    const r = build("", "S Pen Stylus Universal Replacement", "Samsung");
    expect(r.status).toBe("invalid");
  });
});
