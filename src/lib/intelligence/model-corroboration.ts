// src/lib/intelligence/model-corroboration.ts
// ─────────────────────────────────────────────────────────────────────────────
// MODEL-NUMBER CORROBORATION — pure, deterministic precision core.
// Stores publish a manufacturer model number. When the SAME normalized model
// appears in ≥2 DISTINCT stores it is definitively the same product — a stronger
// AND higher-recall identity signal than title heuristics (it catches matches
// whose titles diverge). This module holds the precision rules ONLY (no I/O), so
// they are unit-tested and reproducible. Constitution: precision over recall.
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC = new Set(["GENERIC", "STANDARD", "DEFAULT", "ASSORTED", "MULTICOLOR", "VARIOUS", "NONE", "NA"]);

/** Normalize a raw model string to a comparable manufacturer code, or null if it
 *  is too weak to be a reliable identity (short / no letter+digit mix / generic). */
export function normalizeModel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (m.length < 6 || m.length > 40) return null;
  if (!/[A-Z]/.test(m) || !/[0-9]/.test(m)) return null; // real codes mix letters + digits
  if (GENERIC.has(m)) return null;
  return m;
}

export interface ModelObs { store: number; brand: string; price: number | null }
export type ModelReject = "too_few_stores" | "brand_ambiguous" | "price_spread";
export interface ModelQualdirect { ok: true; brand: string; stores: number[]; observations: number }
export interface ModelRejectRes { ok: false; reason: ModelReject }
export type ModelQualification = ModelQualdirect | ModelRejectRes;

const MAX_PRICE_SPREAD = 3; // > this ⇒ likely mixed variants/errors

/**
 * Decide whether a group of observations that share a normalized model number is a
 * valid cross-store corroboration. Precision-first:
 *  • ≥2 distinct stores (cross-store agreement is self-validating — internal SKUs
 *    do not match across independent retailers),
 *  • EXACTLY ONE known brand (0 ⇒ no brand to anchor identity; ≥2 ⇒ model collision),
 *  • price spread ≤ 3× (a huge spread signals mixed variants/data errors).
 */
export function qualifyModelGroup(obs: ModelObs[]): ModelQualification {
  const stores = [...new Set(obs.map((o) => o.store))];
  if (stores.length < 2) return { ok: false, reason: "too_few_stores" };
  const knownBrands = [...new Set(obs.map((o) => o.brand).filter((b) => b && b !== "unknown" && b !== "other"))];
  if (knownBrands.length !== 1) return { ok: false, reason: "brand_ambiguous" };
  const prices = obs.map((o) => o.price).filter((x): x is number => x != null && x > 0);
  if (prices.length >= 2 && Math.max(...prices) > Math.min(...prices) * MAX_PRICE_SPREAD) return { ok: false, reason: "price_spread" };
  return { ok: true, brand: knownBrands[0], stores, observations: obs.length };
}
