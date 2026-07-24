// scripts/tps-plugins/monitor/validator.ts
// Confidence = completeness of identity-critical monitor fields (brand, size,
// resolution, refresh). A manufacturer model number is the strongest single signal.
import type { ConfidenceResult } from "../../tps-core/types";

export function scoreConfidence(
  brand: string | null,
  payload: Record<string, unknown>,
  model_number: string | null,
  flags: string[]
): ConfidenceResult {
  const missing: string[] = [];
  if (!brand && !payload.brand) missing.push("brand");
  if (!payload.screen_size) missing.push("screen_size");
  if (!payload.resolution) missing.push("resolution");
  if (!payload.refresh_rate) missing.push("refresh_rate");

  const total = 4;
  let conf = Math.round(((total - missing.length) / total) * 100);
  if (model_number) conf = Math.min(100, conf + 10);
  if (flags.length) conf = Math.max(0, conf - Math.min(10, flags.length * 3));

  return { confidence: conf, missing_critical: missing, needs_llm: missing.length > 1 || conf < 70 };
}
