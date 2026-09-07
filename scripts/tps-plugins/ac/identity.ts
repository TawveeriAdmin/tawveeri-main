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
  //
  // ADR-306 (2026-09-07, Amazon AC normalization-drop mission): `cooling_mode` gets
  // the IDENTICAL treatment, for the identical reason, MEASURED the same way — a
  // live sample of 7 real current Amazon AC titles found 5 with no cooling-mode word
  // the parser recognizes at all (many sellers state brand/type/BTU only, e.g. "Gree
  // GWH18AGDXF... 18000 BTU, 1.5 Ton Split Air Conditioner, White" — no cooling-mode
  // word anywhere), which made `cooling_mode` a hard-blocking null for genuine,
  // otherwise-fully-identified listings — the exact failure class ADR-079 already
  // fixed for `technology`, left unfixed here. A listing that DOES state its cooling
  // mode keeps that exact value in the key and never merges with a NO_MODE one, so
  // precision holds (a cool-only unit can never corroborate with a hot/cold one)
  // while recall is recovered.
  const nulls = ["capacity_btu"].filter(f => p[f] === null || p[f] === undefined);
  if (!brand) nulls.unshift("brand");
  if (nulls.length > 0) return { key: null, status: "invalid", reason: `null in critical: ${nulls.join(", ")}` };

  // Canonicalize brand (Arabic↔English of the same brand → one canonical form)
  // so cross-store corroboration works. Shared, evidence-backed only (brand-map).
  const cb = canonicalizeBrand(brand);
  const series = p.series_or_platform ? String(p.series_or_platform) : "NO_SERIES";
  const tech = p.technology ? String(p.technology) : "NO_TECH";
  const mode = p.cooling_mode ? String(p.cooling_mode) : "NO_MODE";
  const key = `${cb}|${p.ac_type}|${series}|${p.capacity_btu}|${tech}|${mode}`;

  // Full confidence requires the discriminating attributes to be actually STATED —
  // a real series, a real (non-inferred) technology, AND a real cooling mode.
  // Otherwise it is a low_confidence catalogue candidate that still corroborates
  // (requireValidTier is false for AC), but is flagged for the merge-quality audit.
  const full = !!p.series_or_platform && !!p.technology && !technology_inferred && !!p.cooling_mode;
  const reason = full ? "brand+type+series+btu+tech+mode"
    : !p.cooling_mode ? "cooling_mode not stated (NO_MODE)"
    : !p.technology ? "technology not stated (NO_TECH)"
    : technology_inferred ? "technology inferred from compressor_type"
    : "series_or_platform missing";
  return { key, status: full ? "valid" : "low_confidence_candidate", reason };
}