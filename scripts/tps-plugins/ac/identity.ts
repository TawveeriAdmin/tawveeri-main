// scripts/tps-plugins/ac/identity.ts
// نقل حرفي 100% من buildACKey() في write-product-observations.ts
// technology_inferred يُستقبَل عبر normalizeMeta (وفق عقد CategoryPlugin)

import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  normalizeMeta?: Record<string, unknown>
): IdentityResult {
  const technology_inferred = Boolean(normalizeMeta?.technology_inferred);

  if (!p.ac_type) return { key: null, status: "invalid", reason: "ac_type unknown" };

  // ADR-079: `technology` (inverter/standard) is NO LONGER required. Budget/window
  // ACs (midea, gree, hisense, haier, TCL) routinely omit it — 120 comparison-
  // possible listings failed on this ALONE. It becomes an optional discriminator
  // (NO_TECH), exactly like `series`: a listing that DOES state "inverter" keeps
  // tech=Inverter and never merges with a NO_TECH one, so precision holds while
  // recall is recovered. Churn-safe: tech-stated ACs keep their exact key.
  const nulls = ["capacity_btu","cooling_mode"].filter(f => p[f] === null || p[f] === undefined);
  if (!brand) nulls.unshift("brand");
  if (nulls.length > 0) return { key: null, status: "invalid", reason: `null in critical: ${nulls.join(", ")}` };

  // Canonicalize brand (Arabic↔English of the same brand → one canonical form)
  // so cross-store corroboration works. Shared, evidence-backed only (brand-map).
  const cb = canonicalizeBrand(brand);
  const series = p.series_or_platform ? String(p.series_or_platform) : "NO_SERIES";
  const tech = p.technology ? String(p.technology) : "NO_TECH";
  const key = `${cb}|${p.ac_type}|${series}|${p.capacity_btu}|${tech}|${p.cooling_mode}`;

  // Full confidence requires the discriminating attributes to be actually STATED —
  // a real series AND a real (non-inferred) technology. Otherwise it is a
  // low_confidence catalogue candidate that still corroborates (requireValidTier
  // is false for AC), but is flagged for the merge-quality audit.
  const full = !!p.series_or_platform && !!p.technology && !technology_inferred;
  const reason = full ? "brand+type+series+btu+tech+mode"
    : !p.technology ? "technology not stated (NO_TECH)"
    : technology_inferred ? "technology inferred from compressor_type"
    : "series_or_platform missing";
  return { key, status: full ? "valid" : "low_confidence_candidate", reason };
}