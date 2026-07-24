// scripts/tps-plugins/printer/identity.ts
// Printer Identity Contract v1 — precision over recall.
//
//   KEY : brand | line + model_number   (e.g. hp|laserjet 1602w, canon|pixma g3410)
//
// The model number is the printer's stable cross-store identity. Function
// (single/MFP), connectivity and colour are commercial — a row without a
// recognised line+model is `invalid` (a bare "HP printer" is not an identity).
// The line token lives in the key (not the canonical model_number column), so it
// never touches the (brand, model_number) unique index. Unknown beats incorrect.
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

  return { key: `${cb}|${model}`, status: "valid", reason: "brand + line + model" };
}
