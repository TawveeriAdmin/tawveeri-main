// scripts/tps-plugins/refrigerator/identity.ts — brand|type|capacity|tech.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
export function buildIdentityKey(brand: string | null, p: Record<string, unknown>): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? String(p.brand) : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand missing" };
  const type = p.fridge_type as string | null, cap = p.capacity_liters as number | null;
  if (!type) return { key: null, status: "invalid", reason: "type missing" };
  if (cap == null) return { key: null, status: "invalid", reason: "capacity missing" };
  const tech = p.inverter ? "inverter" : "standard";
  return { key: `${cb}|${type}|${cap}|${tech}`, status: "valid", reason: "brand+type+capacity+tech" };
}
