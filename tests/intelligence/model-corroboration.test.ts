/**
 * Model-Number Corroboration — precision rules (Constitution: precision over recall).
 * A cross-store model match asserts product identity, so these gates must never
 * admit a false merge: weak model strings, brand collisions, or variant mixes.
 */
import { normalizeModel, qualifyModelGroup, type ModelObs } from "../../src/lib/intelligence/model-corroboration";

describe("normalizeModel — only accept real manufacturer codes", () => {
  it("accepts alphanumeric manufacturer codes", () => {
    expect(normalizeModel("MYWJ3AH/A")).toBe("MYWJ3AHA");
    expect(normalizeModel("27GR83Q-B")).toBe("27GR83QB");
    expect(normalizeModel("SM-S938B/ZKI")).toBe("SMS938BZKI");
  });
  it("rejects weak/ambiguous strings (short, no letter+digit mix, generic)", () => {
    expect(normalizeModel("ABC")).toBeNull();          // too short
    expect(normalizeModel("BLACK")).toBeNull();        // letters only
    expect(normalizeModel("123456")).toBeNull();       // digits only
    expect(normalizeModel("GENERIC")).toBeNull();      // generic token
    expect(normalizeModel(null)).toBeNull();
    expect(normalizeModel("")).toBeNull();
  });
});

describe("qualifyModelGroup — cross-store corroboration gates", () => {
  const o = (store: number, brand: string, price: number | null): ModelObs => ({ store, brand, price });
  it("qualifies a genuine ≥2-store, single-brand match", () => {
    const r = qualifyModelGroup([o(4, "apple", 5699), o(5, "apple", 5699)]);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.brand).toBe("apple"); expect(r.stores.sort()).toEqual([4, 5]); }
  });
  it("rejects a single-store model (no corroboration)", () => {
    expect(qualifyModelGroup([o(4, "apple", 5699), o(4, "apple", 5699)])).toEqual({ ok: false, reason: "too_few_stores" });
  });
  it("rejects a brand collision (same model string, two brands)", () => {
    expect(qualifyModelGroup([o(4, "apple", 100), o(5, "samsung", 100)])).toEqual({ ok: false, reason: "brand_ambiguous" });
  });
  it("rejects when no known brand anchors the identity", () => {
    expect(qualifyModelGroup([o(4, "unknown", 100), o(5, "other", 100)])).toEqual({ ok: false, reason: "brand_ambiguous" });
  });
  it("rejects an implausible price spread (likely mixed variants/errors)", () => {
    expect(qualifyModelGroup([o(4, "hp", 500), o(5, "hp", 3000)])).toEqual({ ok: false, reason: "price_spread" });
  });
  it("tolerates unknown-brand observations when exactly one known brand agrees", () => {
    const r = qualifyModelGroup([o(4, "lg", 900), o(5, "unknown", 950)]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.brand).toBe("lg");
  });
});
