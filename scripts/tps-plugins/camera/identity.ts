// scripts/tps-plugins/camera/identity.ts
// Camera Identity Contract v1 — precision over recall.
//   key : brand | model(line + variant) | config(kit focal | body)
// EOS R50 ≠ R50 V (variant in model); a body ≠ a lens kit ≠ a different kit
// (config). Colour/extra bundles are commercial. A row without a recognised
// model is invalid (skipped). Unknown beats incorrect.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  _meta?: Record<string, unknown>
): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? String(p.brand) : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand missing" };
  const model = p.model as string | null;
  if (!model) return { key: null, status: "invalid", reason: "model missing" };
  const config = (p.config as string) ?? "body";
  return { key: `${cb}|${model}|${config}`, status: "valid", reason: "brand + model + config" };
}
