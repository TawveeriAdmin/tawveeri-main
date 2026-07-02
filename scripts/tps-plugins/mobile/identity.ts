// scripts/tps-plugins/mobile/identity.ts
// نقل حرفي 100% من buildMobileKey() في write-product-observations.ts

import type { IdentityResult } from "../../tps-core/types";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  _normalizeMeta?: Record<string, unknown>
): IdentityResult {
  const nulls = ["brand","family","generation","variant","storage_gb"]
    .filter(f => (f === "brand" ? brand : p[f]) === null || (f === "brand" ? brand : p[f]) === undefined);

  if (nulls.length > 0) return { key: null, status: "invalid", reason: `null in critical: ${nulls.join(", ")}` };

  return { key: `${brand}|${p.family}|${p.generation}|${p.variant}|${p.storage_gb}`, status: "valid" };
}