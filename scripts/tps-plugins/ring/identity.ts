// scripts/tps-plugins/ring/identity.ts — brand | family | material.
// Family + material together are enough to compare "the same ring" across
// merchants without price-fabrication risk: unlike case size on a round watch,
// no ring vendor prices differently by finger size, so size correctly stays
// out of identity (see parser.ts). A ring with no family at all is too weak to
// assert an identity — unknown beats incorrect.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(brand: string | null, p: Record<string, unknown>): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? p.brand : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand not canonicalizable" };
  const family = p.family as string | null;
  if (!family) return { key: null, status: "invalid", reason: "family missing" };
  const material = (p.material as string) || "Standard";
  return { key: `${cb}|${family}|${material}`, status: "valid", reason: "brand+family+material" };
}
