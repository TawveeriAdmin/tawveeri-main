// scripts/tps-plugins/washing_machine/identity.ts — brand|type|kg|dryer.
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";
export function buildIdentityKey(brand: string | null, p: Record<string, unknown>): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? String(p.brand) : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand missing" };
  const type = p.washer_type as string | null, kg = p.capacity_kg as number | null;
  if (!type) return { key: null, status: "invalid", reason: "type missing" };
  if (kg == null) return { key: null, status: "invalid", reason: "capacity missing" };
  // ADR-350 (2026-09-13): a standalone dryer (no washer at all — type === "dryer_only") gets
  // its own 4th-segment value so it can never collide with, or be mistaken for, a real washer
  // ("washer") or a genuine washer+dryer combo unit ("combo") at the same brand/capacity.
  const dryer = type === "dryer_only" ? "standalone_dryer" : p.has_dryer ? "combo" : "washer";
  return { key: `${cb}|${type}|${kg}|${dryer}`, status: "valid", reason: "brand+type+kg+dryer" };
}
