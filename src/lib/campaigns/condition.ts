// src/lib/campaigns/condition.ts — Amazon × Noon internal commerce, condition truth
// (founder mission, 2026-09-05/06, §1/§2/§3-closure-proof). "RENEWED IS NOT NEW."
//
// Reuses extractSpecsFromTitle() (src/lib/scraping/config/spec-configs.ts, ADR-287) for
// the RENEWED/USED signal — the one existing condition detector in this codebase, already
// live behind the Smart Pick disclosure. That shared function is NOT modified here (it
// backs ADR-287's own live disclosure; changing its output would risk that caller too) —
// REFURBISHED is distinguished as a narrower case of the SAME underlying evidence
// (extractSpecsFromTitle groups "refurbished" into its 'renewed' bucket by design), using
// the identical keyword, checked here rather than duplicating a second, independently-
// drifting detector.
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';

export type MerchantCondition = 'NEW' | 'RENEWED' | 'REFURBISHED' | 'USED' | 'UNKNOWN';

/**
 * Classifies an offer's condition from its own raw title. Pure, deterministic.
 *
 * TAXONOMY RECONCILIATION (closure-proof, 2026-09-06). The founder's mission required
 * at minimum NEW/RENEWED/REFURBISHED/USED/OPEN_BOX/UNKNOWN. Resolved per-value:
 *
 * - RENEWED, USED: (A) separately represented — extractSpecsFromTitle() already
 *   distinguishes them; reused unchanged.
 * - REFURBISHED: (A) separately represented, NEW as of this closure pass — a live count
 *   found 31 real production titles saying "refurbished" WITHOUT saying "renewed" (e.g.
 *   "Apple (Refurbished) iPhone 15 Pro Max...", "DELL 7060-MINI... (Refurbished)") —
 *   genuine, distinct evidence, not a hypothetical. Detected as its own value BEFORE
 *   falling through to extractSpecsFromTitle()'s combined 'renewed' bucket, using the
 *   IDENTICAL keyword (never a second, independently-drifting vocabulary).
 * - OPEN_BOX: (C) unsupported by current evidence — a live count found ZERO "open box" /
 *   "فتح الصندوق" titles anywhere in current Amazon+Noon production data. Not given a
 *   dedicated detector (inventing one for evidence that does not exist would itself be
 *   "manufacturing a distinction unsupported by source evidence"). PROVEN FAIL-SAFE
 *   instead: because of the UNKNOWN-default rule below, a hypothetical open-box listing
 *   with no marker this function recognizes falls through to UNKNOWN, never to NEW —
 *   it cannot be silently promoted to an equivalence claim. The day a real open-box
 *   title is observed, this is a one-line addition, not a redesign.
 * - UNKNOWN: reserved for (a) a genuinely missing/empty title, or (b) a title with NO
 *   recognized condition marker at all — see the safety proof below for why (b) is
 *   UNKNOWN and not NEW.
 *
 * SAFETY PROOF FOR "NO MARKER DETECTED" (closure-proof, 2026-09-06; supersedes this
 * function's OWN prior design note, which defaulted absence-of-marker to NEW and is
 * retracted here as not rigorously provable).
 *
 * Prior reasoning: 218 real cross-merchant renewed/refurbished/used titles were found,
 * 100% of which self-disclosed their condition in the title text, so "no marker" was
 * treated as evidence of NEW. That count is real and reproducible (this same closure
 * pass re-verified it: 177 "renewed" + 31 "refurbished"-only + 7 "used" in English, plus
 * 132 + 1 + 4 in Arabic, at Amazon+Noon combined) — but on reflection it proves only a
 * DATASET-BACKED HEURISTIC ("every renewed/used item WE HAVE OBSERVED so far discloses
 * it"), not a MERCHANT/SOURCE-CONTRACT GUARANTEE. Tawveeri's scraper captures only the
 * listing TITLE, not Amazon's or Noon's own STRUCTURED condition field (which their
 * marketplace policies may separately require sellers to set correctly) — so a seller
 * could set the structured field to non-new while leaving the scraped title silent,
 * and this function would have no way to see it. That failure mode cannot be proven
 * absent from a dataset observation alone, however consistent the dataset has been so
 * far — the absence of a counter-example today is not a guarantee against one tomorrow.
 *
 * Because this cannot be proven safe as a source-contract guarantee, per the mission's
 * own explicit instruction ("if not safely provable: use UNKNOWN for commercial
 * equivalence"), an UNDETECTED condition now classifies as UNKNOWN, not NEW. This is a
 * real behavior change from the prior pass: most listings (which do not explicitly say
 * "new" — extractSpecsFromTitle() deliberately never detects that word, "too many false
 * positives") will now read UNKNOWN rather than NEW, so most comparisons will resolve to
 * CONDITION_UNKNOWN (no commercial selection) rather than proceeding to a price
 * comparison. This is the deliberate, evidence-required cost of the safety proof above,
 * not an oversight — ordinary shopper listing/display is entirely unaffected (nothing
 * outside src/lib/campaigns/ imports this module), only the internal SHADOW/tie-break
 * decision is more conservative.
 */
export function classifyCondition(title: string | null | undefined): MerchantCondition {
  if (!title || !title.trim()) return 'UNKNOWN';
  if (/\brefurbished\b/i.test(title)) return 'REFURBISHED';
  const detected = extractSpecsFromTitle(title).condition;
  if (detected === 'renewed') return 'RENEWED';
  if (detected === 'used') return 'USED';
  return 'UNKNOWN';
}
