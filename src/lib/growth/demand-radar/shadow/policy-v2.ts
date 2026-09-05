// Radar 2.0 — Policy V2 (integrated review, 2026-08-30; PROMOTED 2026-08-31).
// A pure, deterministic re-scoring function, backtested against every real
// founder-labeled candidate this session has retained evidence for
// (tests/growth/policy-v2-backtest.test.ts).
//
// PROMOTION NOTE (2026-08-31, founder-authorized end-to-end redesign): the
// scoring/exclusion primitives this file originally defined locally
// (isGiveawayReplyContext, isHyperbolicWishNoDecision, the decision-evidence
// point formula) are now the SHARED, canonical implementation in
// ../decision-evidence-score.ts, used for real by rank.ts (Radar 1). This
// file is kept — Shadow's own tier vocabulary ('high'|'medium'|'low') and
// backtest tooling still use it unchanged — but it now DELEGATES to the
// promoted module rather than owning a second copy of the same logic.
//
// WHY THIS EXISTS (evidence, not assumption — see the HIGH-threshold audit):
// Radar 1's real rejected set is dominated by bare declarative wish-language
// ("أبي جوال") that the current formula scores identically to genuine
// decision-stage language ("محتار بين آيباد ولابتوب للجامعة وش تنصحوني؟").
// A direct replay of the current formula against all 23 real founder
// verdicts showed the one real accept scores LOWER than 19 of the 22
// rejects. Policy V2 does not change that threshold — it changes what
// EARNS points in the first place, so that if a future, properly-gated
// experiment ever tests a numeric bar, it is testing a formula that
// actually separates decision-stage buyers from casual wishes.
//
// ISOLATION: imports only pure, side-effect-free helpers (no createServerClient import anywhere
// in this file, still true). The scoring/exclusion primitives now live in
// ../decision-evidence-score.ts (see the PROMOTION NOTE above) — this file no longer duplicates
// them, it composes them into Shadow's own tier vocabulary.
//
// BACKTEST TRUTH (ADR-274 — read this before citing any number from this file): the comparison
// detector originally used a JS `\b` word-boundary, which never matches beside Arabic script —
// silently dead since this file was written. Fixed via the shared decision-evidence.ts module's
// containsWholeWord(). The corrected Radar 1 backtest is 2/23 surfaced (1 valuable, 1 false
// positive) = 50% precision / 100% recall — NOT the 100%/100% first reported before the fix.
// Shadow's 25-item pool is unaffected (86.7%/86.7%). ADR-274 is the authoritative record.
// Post-promotion (ADR-280), rank.ts's own combined backtest (hard gates + this scoring, n=59
// real labeled texts across both pools + a fresh batch) is the current, superseding number for
// what Radar 1 itself does in production: 77.8% precision / 82.4% recall, down from 51 to 18
// surfaced. This file's OWN 4/2 thresholds are unchanged and remain Shadow's own measurement.

import type { Classification } from '../types';
import { scoreDecisionEvidence, isGiveawayReplyContext, isHyperbolicWishNoDecision } from '../decision-evidence-score';

// Re-exported for existing callers/tests — the implementations now live in the promoted,
// neutral ../decision-evidence-score.ts module (see the header note above).
export { isGiveawayReplyContext, isHyperbolicWishNoDecision };

export type PolicyV2Tier = 'high' | 'medium' | 'low' | 'excluded';

export interface PolicyV2Result {
  tier: PolicyV2Tier;
  decisionEvidenceScore: number;
  reasons: string[];
  excluded: boolean;
  exclusionDetail: string | null;
}

/**
 * Shadow's own tier vocabulary over the promoted scoring primitive — kept for Shadow's continued
 * backtest/experiment use (tests/growth/policy-v2-backtest.test.ts). Radar 1's real tier decision
 * lives in rank.ts now and uses its OWN threshold (score>=3, not >=4) calibrated specifically for
 * "email-worthy" — see rank.ts's own header note for why the two thresholds differ.
 */
export function scorePolicyV2(text: string, cls: Classification): PolicyV2Result {
  const r = scoreDecisionEvidence(text, cls);
  if (r.excluded) return { tier: 'excluded', decisionEvidenceScore: 0, reasons: r.reasons, excluded: true, exclusionDetail: r.exclusionDetail };
  // 'low' covers both "one weak signal" and "zero signals, not hard-excluded" — deliberately
  // never reuses the 'excluded' label, which is reserved for an actual detector firing.
  const tier: PolicyV2Tier = r.score >= 4 ? 'high' : r.score >= 2 ? 'medium' : 'low';
  return { tier, decisionEvidenceScore: r.score, reasons: r.reasons, excluded: false, exclusionDetail: null };
}
