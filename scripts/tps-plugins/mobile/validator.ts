// scripts/tps-plugins/mobile/validator.ts
// نقل حرفي من جزء mobile في scoreConf() الأصلي

import type { ConfidenceResult } from "../../tps-core/types";

export function scoreConfidence(
  brand: string | null,
  payload: Record<string, unknown>,
  model_number: string | null,
  flags: string[]
): ConfidenceResult {
  const missing: string[] = [];
  if (!brand) missing.push("brand");
  if (!payload.family) missing.push("family");
  if (!payload.generation) missing.push("generation");
  if (!payload.variant) missing.push("variant");
  if (!payload.storage_gb) missing.push("storage_gb");

  const total = 5;
  let conf = Math.round(((total - missing.length) / total) * 100);
  if (model_number) conf = Math.min(100, conf + 5);
  if (flags.length) conf = Math.max(0, conf - 5);

  // ADR-081: a model identified WITHOUT storage (NO_STORAGE canonical) is a
  // deliberately weaker assertion — storage is a price-determining commercial
  // variant, so two bare listings could be different configs. Cap the confidence
  // low so the reduced value propagates to the projection and every customer
  // surface (compare / decide / search), and the Decision Engine can flag it.
  if (!payload.storage_gb && payload.family && payload.generation) conf = Math.min(conf, 60);

  return { confidence: conf, missing_critical: missing, needs_llm: missing.length > 0 || conf < 85 };
}