// scripts/tps-plugins/camera/validator.ts
import type { ConfidenceResult } from "../../tps-core/types";
export function scoreConfidence(brand: string | null, payload: Record<string, unknown>, _m: string | null, flags: string[]): ConfidenceResult {
  const missing: string[] = [];
  if (!brand && !payload.brand) missing.push("brand");
  if (!payload.model) missing.push("model");
  const total = 2;
  let conf = Math.round(((total - missing.length) / total) * 100);
  if (flags.length) conf = Math.max(0, conf - 5);
  return { confidence: conf, missing_critical: missing, needs_llm: missing.length > 0 };
}
