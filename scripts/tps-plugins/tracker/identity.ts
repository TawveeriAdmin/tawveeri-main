// scripts/tps-plugins/tracker/identity.ts — brand | family | variant.
// A tracker with no recognizable family is too weak to assert an identity —
// unknown beats incorrect.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(brand: string | null, p: Record<string, unknown>): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? p.brand : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand not canonicalizable" };
  const family = p.family as string | null;
  if (!family) return { key: null, status: "invalid", reason: "family missing" };
  const variant = (p.variant as string) || "Standard";
  return { key: `${cb}|${family}|${variant}`, status: "valid", reason: "brand+family+variant" };
}
