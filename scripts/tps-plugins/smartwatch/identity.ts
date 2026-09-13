// scripts/tps-plugins/smartwatch/identity.ts
// Smartwatch Identity Contract v1 (ADR-066):
//   brand | family | generation | variant | size_mm | connectivity
//
// Case size and connectivity are IDENTITY, not commercial: a 42mm GPS and a 49mm
// Cellular of the same series are different products at materially different
// prices, and merging them would misprice the comparison. Colour and strap
// material are Commercial Variants and never appear here (Constitution Art. III).
//
// A watch without a readable family AND generation is too weak to assert an
// identity and is rejected rather than guessed — unknown beats incorrect.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  _meta?: Record<string, unknown>
): IdentityResult {
  // Prefer the brand the parser resolved (it may have been inferred from the
  // title when the store published "Unknown"); fall back to the raw value.
  const cb = (typeof p.brand === "string" && p.brand) ? p.brand : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand not canonicalizable" };

  const family = p.family as string | null;
  const generation = p.generation as string | null;
  if (!family) return { key: null, status: "invalid", reason: "family missing" };
  if (!generation) return { key: null, status: "invalid", reason: "generation missing" };

  const variant = (p.variant as string) || "Standard";
  const size = p.size_mm != null ? String(p.size_mm) : "NO_SIZE";
  const conn = (p.connectivity as string) || "gps";
  const key = `${cb}|${family}|${generation}|${variant}|${size}|${conn}`;

  // ADR-350 (2026-09-13): band-type families (Galaxy Fit, Huawei Band, Honor Band, Huawei
  // Watch Fit, ...) are sold in ONE physical size — unlike round-watch families (Galaxy
  // Watch, Galaxy Watch Ultra, Huawei Watch GT, Honor Watch, ...) where a 40mm and a 44mm
  // of the same generation are genuinely different SKUs at different prices. For those,
  // a missing size really is missing price-discriminating information and must stay
  // low-confidence. For a band-type family, "no size" isn't missing evidence — there is no
  // size axis to miss, the same way mobile's NO_STORAGE sentinel is a legitimate, confident
  // identity for a phone that genuinely has no storage variants. Proven case: Samsung's own
  // "Galaxy Fit3 Gray/Pink Gold/Silver, Bluetooth v5.3" titles never carry a case-size
  // spec at all — treating that as low-confidence would leave every Galaxy Fit3 unable to
  // ever corroborate into a canonical. Generic — applies to any brand's Fit/Band family, not
  // a Samsung-only carve-out.
  const isBandTypeFamily = /\bfit\b|\bband\b/i.test(family);
  const sizeIsFullyResolved = p.size_mm != null || isBandTypeFamily;

  // Case size is the main price discriminator for round watches; without it (and without
  // being a band-type family) the identity is weaker and must not silently claim full confidence.
  return {
    key,
    status: sizeIsFullyResolved ? "valid" : "low_confidence_candidate",
    reason: sizeIsFullyResolved
      ? (p.size_mm != null ? "full: family+gen+size+connectivity" : "band-type family — no size axis, NO_SIZE is a confident identity")
      : "size missing",
  };
}
