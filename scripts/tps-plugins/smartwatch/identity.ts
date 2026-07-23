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
  const cb = canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand not canonicalizable" };

  const family = p.family as string | null;
  const generation = p.generation as string | null;
  if (!family) return { key: null, status: "invalid", reason: "family missing" };
  if (!generation) return { key: null, status: "invalid", reason: "generation missing" };

  const variant = (p.variant as string) || "Standard";
  const size = p.size_mm != null ? String(p.size_mm) : "NO_SIZE";
  const conn = (p.connectivity as string) || "gps";
  const key = `${cb}|${family}|${generation}|${variant}|${size}|${conn}`;

  // Case size is the main price discriminator; without it the identity is weaker
  // and must not silently claim full confidence.
  return {
    key,
    status: p.size_mm != null ? "valid" : "low_confidence_candidate",
    reason: p.size_mm != null ? "full: family+gen+size+connectivity" : "size missing",
  };
}
