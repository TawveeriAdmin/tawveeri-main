// scripts/tps-plugins/tv/identity.ts
// TV Identity Contract v1 — precision over recall.
//
//   PRIMARY  : brand | MODEL:<manufacturer_model_number>
//   FALLBACK : brand | screen_size | resolution | panel | refresh_rate
//
// Audit evidence: brand|size|res|panel ALONE over-merges multi-model brands
// (Hisense Q61Q@60Hz vs Q71Q@144Hz; Skyworth Q6500/Q6800/Q7700; LG QNED70 vs
// evo) — different models, different prices. Refresh rate is the discriminator
// that BOTH Jarir and Extra expose (unlike the series code, which only Jarir
// carries), and true cross-store matches align on it (Hisense 65 QLED 144Hz:
// Jarir 2449 ↔ Extra 2499; Skyworth 65 QLED 144Hz: 2199 ↔ 2199). So refresh
// rate is an IDENTITY axis here, not commercial. Panel is a real axis
// (OLED ≠ QLED ≠ Neo QLED ≠ LED). Series code, colour and year remain
// non-identity (stores inconsistent) — normalized_payload only. `refresh_rate`
// is required for the `valid` (corroboration-eligible) tier; missing refresh or
// panel yields a low_confidence_candidate (NO_HZ / NO_PANEL) that the matcher
// does not corroborate. Precision over recall; unknown beats incorrect.
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

  const size = p.screen_size as number | null;
  const res = p.resolution as string | null;
  const panel = p.panel as string | null;
  const refresh = p.refresh_rate as number | null;
  // Size is the non-negotiable TV discriminator; without it there is no identity.
  if (size == null) return { key: null, status: "invalid", reason: "screen_size missing" };
  // Need at least resolution or panel to distinguish beyond size.
  if (!res && !panel) return { key: null, status: "invalid", reason: "no resolution and no panel" };

  const key = `${cb}|${size}|${res ?? "NO_RES"}|${panel ?? "NO_PANEL"}|${refresh != null ? refresh : "NO_HZ"}`;
  // `valid` (corroboration-eligible) requires the full discriminating set incl.
  // refresh; without refresh or panel the identity can over-merge → low_confidence.
  const full = !!res && !!panel && refresh != null;
  return { key, status: full ? "valid" : "low_confidence_candidate", reason: full ? "fallback: size+res+panel+hz" : "fallback: refresh or panel missing" };
}
