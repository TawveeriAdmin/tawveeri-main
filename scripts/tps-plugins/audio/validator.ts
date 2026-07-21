// scripts/tps-plugins/audio/validator.ts
// Confidence = completeness of identity-critical audio fields (brand, model, type).
import type { ConfidenceResult } from "../../tps-core/types";

export function scoreConfidence(
  brand: string | null,
  payload: Record<string, unknown>,
  _model_number: string | null,
  flags: string[]
): ConfidenceResult {
  const missing: string[] = [];
  if (!brand && !payload.brand) missing.push("brand");
  if (!payload.model) missing.push("model");
  if (!payload.type) missing.push("type");

  const total = 3;
  let conf = Math.round(((total - missing.length) / total) * 100);
  if (flags.length) conf = Math.max(0, conf - Math.min(10, flags.length * 4));

  return { confidence: conf, missing_critical: missing, needs_llm: missing.length > 0 || conf < 70 };
}
