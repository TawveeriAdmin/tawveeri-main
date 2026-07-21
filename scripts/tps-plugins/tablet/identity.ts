// scripts/tps-plugins/tablet/identity.ts
// Tablet Identity Contract v1 — precision over recall.
//
//   PRIMARY  : brand | MODEL:<manufacturer_model_number>
//   FALLBACK : brand | line(+variant) | gen | storage | connectivity | size
//
// The line token carries the VARIANT (Plus/FE/Ultra/Pro/Air/Mini) and series
// number, so Galaxy Tab A11 ≠ A11 Plus and iPad Air ≠ iPad Pro never merge.
// Connectivity is an identity axis (Wi-Fi-only ≠ cellular/5G/4G — different SKUs
// and prices). Storage is always in the key (128GB ≠ 256GB). `gen`/chip splits
// Apple siblings (iPad Air M2 ≠ M4). Colour, bundle (case/pen/keyboard),
// warranty, region and year are commercial — normalized_payload only. `valid`
// (corroboration-eligible) requires brand+line+storage+connectivity; missing
// connectivity or storage → low_confidence_candidate (the matcher does not
// corroborate those). Unknown beats incorrect.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  normalizeMeta?: Record<string, unknown>
): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? String(p.brand) : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand missing" };

  const model = normalizeMeta?.model_number ? String(normalizeMeta.model_number) : null;
  if (model) return { key: `${cb}|MODEL:${model}`, status: "valid", reason: "primary: model_number" };

  const line = p.line as string | null;
  const storage = p.storage as number | null;
  const connectivity = p.connectivity as string | null;
  const gen = p.gen as string | null;
  const size = p.screen_size as number | null;
  // Line + storage are the non-negotiable tablet discriminators.
  if (!line) return { key: null, status: "invalid", reason: "line missing" };
  if (storage == null) return { key: null, status: "invalid", reason: "storage missing" };

  const key = `${cb}|${line}|${gen ?? "NO_GEN"}|${storage}|${connectivity ?? "NO_CONN"}|${size != null ? size : "NO_SIZE"}`;
  // Full (corroboration-eligible) requires connectivity present (Wi-Fi/cellular
  // distinction is price-relevant). Missing → low_confidence, not corroborated.
  const full = !!connectivity;
  return { key, status: full ? "valid" : "low_confidence_candidate", reason: full ? "fallback: line+storage+conn" : "fallback: connectivity missing" };
}
