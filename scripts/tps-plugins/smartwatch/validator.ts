// scripts/tps-plugins/smartwatch/validator.ts
// Confidence reflects how much of the identity contract was actually READ from
// the listing — never how much was guessed.
import type { ConfidenceResult } from "../../tps-core/types";

export function scoreConfidence(
  brand: string | null,
  p: Record<string, unknown>,
  _model: string | null,
  flags: string[]
): ConfidenceResult {
  let score = 55;
  if (brand) score += 10;
  if (p.family) score += 10;
  if (p.generation) score += 10;
  if (p.size_mm != null) score += 10;
  if (p.connectivity) score += 5;
  score -= flags.length * 5;

  const missing_critical = flags.filter((f) => f === "family_missing" || f === "generation_missing");
  return {
    confidence: Math.max(30, Math.min(95, score)),
    missing_critical,
    needs_llm: false,
  };
}
