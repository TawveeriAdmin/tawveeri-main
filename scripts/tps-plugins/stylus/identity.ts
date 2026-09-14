// scripts/tps-plugins/stylus/identity.ts — brand | compatible_family | compatible_generation.
//
// SAFETY REQUIREMENT (2026-09-14, Samsung KSA official-gateway high-value-accessory
// closure): this key format can NEVER collide with a phone/tablet's own identity key
// (mobile's format is `brand|family|generation|variant|storage`; tablet's own format is
// distinct too) — the "stylus" category segment is baked into every key this plugin
// produces, and compatible_generation is explicitly the DEVICE the stylus works with, not
// a claim that this row IS that device. A stylus with no readable compatible family+
// generation is too weak to assert an identity — unknown beats incorrect.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(brand: string | null, p: Record<string, unknown>): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? p.brand : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand not canonicalizable" };
  const family = p.family as string | null;
  if (!family) return { key: null, status: "invalid", reason: "compatible family missing" };
  const generation = p.generation as string | null;
  if (!generation) return { key: null, status: "invalid", reason: "compatible generation missing" };
  return { key: `${cb}|stylus|${family}|${generation}`, status: "valid", reason: "brand+compatible_family+compatible_generation" };
}
