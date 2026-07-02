// scripts/tps-plugins/ac/validator.ts
// نقل حرفي من جزء AC في scoreConf() الأصلي

import type { ConfidenceResult } from "../../tps-core/types";

export function scoreConfidence(
  brand: string | null,
  payload: Record<string, unknown>,
  model_number: string | null,
  flags: string[]
): ConfidenceResult {
  const missing: string[] = [];
  if (!brand) missing.push("brand");
  if (!payload.capacity_btu) missing.push("capacity_btu");
  if (!payload.technology) missing.push("technology");
  if (!payload.cooling_mode) missing.push("cooling_mode");
  if (!payload.ac_type) missing.push("ac_type");

  const total = 5;
  let conf = Math.round(((total - missing.length) / total) * 100);
  if (model_number) conf = Math.min(100, conf + 5);
  if (flags.length) conf = Math.max(0, conf - 5);

  return { confidence: conf, missing_critical: missing, needs_llm: missing.length > 0 || conf < 85 };
}