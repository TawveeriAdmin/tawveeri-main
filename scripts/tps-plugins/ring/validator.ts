// scripts/tps-plugins/ring/validator.ts
// Confidence reflects how much of the identity contract was actually READ from
// the listing — never how much was guessed.
import type { ConfidenceResult } from "../../tps-core/types";

export function scoreConfidence(
  brand: string | null,
  p: Record<string, unknown>,
  _model: string | null,
  flags: string[]
): ConfidenceResult {
  let score = 60;
  if (brand) score += 15;
  if (p.family) score += 15;
  if (p.material && p.material !== "Standard") score += 10;
  score -= flags.length * 10;

  const missing_critical = flags.filter((f) => f === "family_missing");
  return {
    confidence: Math.max(30, Math.min(95, score)),
    missing_critical,
    needs_llm: false,
  };
}
