// scripts/tps-plugins/ac/identity.ts
// نقل حرفي 100% من buildACKey() في write-product-observations.ts
// technology_inferred يُستقبَل عبر normalizeMeta (وفق عقد CategoryPlugin)

import type { IdentityResult } from "../../tps-core/types";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  normalizeMeta?: Record<string, unknown>
): IdentityResult {
  const technology_inferred = Boolean(normalizeMeta?.technology_inferred);

  if (!p.ac_type) return { key: null, status: "invalid", reason: "ac_type unknown" };

  const nulls = ["capacity_btu","technology","cooling_mode"].filter(f => p[f] === null || p[f] === undefined);
  if (!brand) nulls.unshift("brand");
  if (nulls.length > 0) return { key: null, status: "invalid", reason: `null in critical: ${nulls.join(", ")}` };

  if (technology_inferred)
    return { key: `${brand}|${p.ac_type}|NO_SERIES|${p.capacity_btu}|${p.technology}|${p.cooling_mode}`,
             status: "low_confidence_candidate", reason: "technology inferred from compressor_type" };

  if (!p.series_or_platform)
    return { key: `${brand}|${p.ac_type}|NO_SERIES|${p.capacity_btu}|${p.technology}|${p.cooling_mode}`,
             status: "low_confidence_candidate", reason: "series_or_platform missing" };

  return { key: `${brand}|${p.ac_type}|${p.series_or_platform}|${p.capacity_btu}|${p.technology}|${p.cooling_mode}`,
           status: "valid" };
}