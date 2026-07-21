// scripts/tps-plugins/laptop/validator.ts
// Confidence = completeness of the identity-critical laptop fields.
// A clean model number is the strongest single signal (+ boost). Ambiguity
// flags reduce confidence but never fabricate certainty.
import type { ConfidenceResult } from "../../tps-core/types";

export function scoreConfidence(
  brand: string | null,
  payload: Record<string, unknown>,
  model_number: string | null,
  flags: string[]
): ConfidenceResult {
  const missing: string[] = [];
  if (!brand && !payload.brand) missing.push("brand");
  if (!payload.cpu) missing.push("cpu");
  if (!payload.ram) missing.push("ram");
  if (!payload.storage) missing.push("storage");
  if (!payload.screen) missing.push("screen");
  if (!payload.family) missing.push("family");

  const total = 6;
  let conf = Math.round(((total - missing.length) / total) * 100);
  if (model_number) conf = Math.min(100, conf + 10);
  if (flags.length) conf = Math.max(0, conf - Math.min(10, flags.length * 3));

  return { confidence: conf, missing_critical: missing, needs_llm: missing.length > 2 || conf < 70 };
}
