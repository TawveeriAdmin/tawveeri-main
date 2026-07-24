// scripts/tps-plugins/monitor/identity.ts
// Monitor Identity Contract v1 — precision over recall.
//
//   KEY : brand | screen_size | resolution | refresh_rate | panel
//
// SPEC-ONLY, deliberately. A model-number PRIMARY tier (as TV uses) was dropped:
// (1) monitor model codes are store-inconsistent (Samsung "LS27DG502EMXUE" vs
// "27DG50"), so they rarely corroborate cross-store, whereas size+res+refresh
// reliably do; and (2) the general model-corroboration-v1 writer already owns the
// (brand, model_number) space for a handful of monitors — a plugin emitting the
// same brand|MODEL key collides on the unique index. Every registered plugin that
// coexists with that writer (mobile, smartwatch) is likewise spec-keyed. ADR-074.
//
// A monitor is defined to a buyer by size, resolution and refresh rate — the
// three specs every store states and that cross-store matches align on (a 27"
// QHD 165Hz is the same product whether Extra or Amazon lists it). Panel (IPS/VA/
// OLED) is a real axis but stores state it inconsistently, so it sharpens the key
// when present (NO_PANEL otherwise) rather than gating identity. Size is
// non-negotiable; without resolution AND refresh the identity is too weak to
// assert (a bare "brand 27-inch" over-merges) → low_confidence, not corroborated.
// Line/series, curved and colour are non-identity (normalized_payload only).
import type { IdentityResult } from "../../tps-core/types";
import { canonicalizeBrand } from "../../tps-core/brand-map";

export function buildIdentityKey(
  brand: string | null,
  p: Record<string, unknown>,
  normalizeMeta?: Record<string, unknown>
): IdentityResult {
  const cb = (typeof p.brand === "string" && p.brand) ? String(p.brand) : canonicalizeBrand(brand);
  if (!cb || cb === "unknown") return { key: null, status: "invalid", reason: "brand missing" };
  void normalizeMeta; // model number intentionally not part of the monitor key (see header)

  const size = p.screen_size as number | null;
  const res = p.resolution as string | null;
  const refresh = p.refresh_rate as number | null;
  const panel = p.panel as string | null;
  // Size is the non-negotiable monitor discriminator.
  if (size == null) return { key: null, status: "invalid", reason: "screen_size missing" };
  // Beyond size, need at least resolution or refresh — brand+size alone over-merges.
  if (!res && refresh == null) return { key: null, status: "invalid", reason: "no resolution and no refresh" };

  const key = `${cb}|${size}|${res ?? "NO_RES"}|${refresh != null ? refresh : "NO_HZ"}|${panel ?? "NO_PANEL"}`;
  // `valid` (corroboration-eligible) needs both resolution AND refresh; with only
  // one it can over-merge distinct SKUs → low_confidence (the matcher won't corroborate it).
  const full = !!res && refresh != null;
  return { key, status: full ? "valid" : "low_confidence_candidate", reason: full ? "fallback: size+res+hz(+panel)" : "fallback: resolution or refresh missing" };
}
