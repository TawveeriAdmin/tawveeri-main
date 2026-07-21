// scripts/tps-plugins/tablet/validator.ts
// Confidence = completeness of identity-critical tablet fields (brand, line,
// storage, connectivity, size). A manufacturer model number is the strongest
// signal. Ambiguity flags reduce confidence; never fabricate certainty.
import type { ConfidenceResult } from "../../tps-core/types";

export function scoreConfidence(
  brand: string | null,
  payload: Record<string, unknown>,
  model_number: string | null,
  flags: string[]
): ConfidenceResult {
  const missing: string[] = [];
  if (!brand && !payload.brand) missing.push("brand");
  if (!payload.line) missing.push("line");
  if (!payload.storage) missing.push("storage");
  if (!payload.connectivity) missing.push("connectivity");
  if (!payload.screen_size) missing.push("screen_size");

  const total = 5;
  let conf = Math.round(((total - missing.length) / total) * 100);
  if (model_number) conf = Math.min(100, conf + 10);
  if (flags.length) conf = Math.max(0, conf - Math.min(10, flags.length * 3));

  return { confidence: conf, missing_critical: missing, needs_llm: missing.length > 1 || conf < 70 };
}
