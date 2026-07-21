// scripts/tps-plugins/audio/identity.ts
// Audio Identity Contract v1 — precision over recall.
//
//   key : brand | model(line + generation)
//
// The model token INCLUDES the generation (AirPods Pro 2, JBL Flip 7,
// WH-1000XM5), so successive generations never merge — the core precision risk
// for audio. Type is carried as an attribute (a specific model implies its
// type). Colour, bundle, warranty and region are commercial — normalized_payload
// only. A row without a recognised model is `invalid` (skipped): a bare brand is
// not an identity. Unknown beats incorrect.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  _normalizeMeta?: Record<string, unknown>
): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? String(p.brand) : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand missing" };

  const model = p.model as string | null;
  if (!model) return { key: null, status: "invalid", reason: "model missing (bare brand is not identity)" };

  return { key: `${cb}|${model}`, status: "valid", reason: "brand + model(+gen)" };
}
