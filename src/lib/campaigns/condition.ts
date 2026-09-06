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
  return resolveCondition({ title }).condition;
}

// ── Evidence-hierarchy contract (Merchant Condition Evidence Recovery, 2026-09-06) ─────
//
// Audited all 8 currently-relevant providers (Amazon, Noon, Jarir, Extra, Almanea,
// Samsung KSA, Shaker, SWSG/others) for a source of condition evidence beyond title text,
// without building any new scraper:
//
// - Jarir: EXPLICIT_TEXT_CONDITION, already handled — 62 real listings found using the
//   SAME vocabulary this module already detects ("Renewed Grade A/B ..."), confirming
//   classifyCondition() is already merchant-agnostic and needs no Jarir-specific code.
// - Extra, Almanea, Shaker, LuLu, SharafDG, Samsung KSA: NO_RELIABLE_CONDITION_EVIDENCE —
//   a live count found ZERO condition-disclosing titles for any of them today. Already
//   correctly UNKNOWN by the same generic rule; nothing to recover.
// - Noon: a real STRUCTURED field exists (schema.org `offers.itemCondition` in the
//   product page's own JSON-LD, already fetched by the existing scraper for price/name —
//   see noon-scraper.ts's parseProductJsonLd(), which does not currently read this field)
//   — but two independent live checks (2026-09-06) of confirmed-RENEWED titles both
//   returned `itemCondition: "https://schema.org/NewCondition"`, i.e. the field is WRONG /
//   defaulted, not a reliable per-offer fact. Classified PARTIAL_EVIDENCE: real evidence
//   exists in principle, proven UNRELIABLE in practice for the specific claim "NEW" —
//   never wired as a source of NEW. (A non-NEW structured claim, e.g. explicitly
//   RefurbishedCondition/UsedCondition, was not observed in this sample and is treated
//   more cautiously below — see STRUCTURED_FIELD's asymmetric trust rule.)
// - Amazon: STRUCTURED_CONDITION exists and IS reliable — the product page renders a
//   `#conditionGuideFeature_feature_div` element ("الحالة / مُجدّد - ممتاز" = "Condition:
//   Renewed - Excellent") for Amazon Renewed listings, confirmed live and consistent
//   across both a listing's English and Arabic page variants. NOT wired: for every real
//   case checked, Tawveeri's already-stored `products.name_en` already discloses the same
//   condition via title text, making the additional extraction redundant for currently
//   observed data, and reading it would require modifying the live, unattended production
//   Amazon scraper (Puppeteer product-page fetch) — a real production-reliability risk not
//   justified by a redundant benefit. Documented as a viable FUTURE improvement if a case
//   is ever found where Tawveeri's stored English title lacks the marker but the
//   structured element would have caught it.
// - No merchant/source contract found anywhere in this codebase or its docs guaranteeing
//   "every offer through this path is new" — SOURCE_CONTRACT_BACKED_NEW has zero current
//   instances; the contract below supports it for a future source that does make this
//   guarantee, verified independently before being trusted.
//
// CONCLUSION: no code-safe, reliable evidence beyond title text is available TODAY for any
// of the 8 audited merchants. The contract below is real, tested, and ready to accept
// structured/source-contract evidence the moment a reliable one is integrated — it is not
// exercised with real non-title evidence in production today, and this is disclosed
// honestly rather than wired against unproven signals (Noon's disproven NewCondition
// above being the concrete cautionary example of exactly that mistake).

export type ConditionEvidenceSource = 'EXPLICIT_TITLE' | 'STRUCTURED_FIELD' | 'SOURCE_CONTRACT' | 'NONE';
export type ConditionEvidenceStrength = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface ConditionEvidence {
  title: string | null | undefined;
  /** A merchant-supplied structured condition value (e.g. schema.org itemCondition). A
   *  non-NEW value (renewed/refurbished/used) is trusted even unverified, per the
   *  asymmetric-incentive rule below — only a 'new' value additionally requires
   *  `structuredSourceVerifiedForNew`. */
  structuredCondition?: 'new' | 'renewed' | 'refurbished' | 'used' | null;
  /** Set true ONLY after independently verifying, for THIS SPECIFIC source, that its
   *  structured field reliably reports NEW and is not a lazy default. Deliberately
   *  DEFENSIVE, deviating from a literal reading of the founder's own hypothetical
   *  example ("structured condition = new → NEW") because this module found a REAL
   *  counter-example: two independent live checks of Noon's own `offers.itemCondition`
   *  (schema.org JSON-LD, 2026-09-06) both returned "NewCondition" for titles that
   *  EXPLICITLY say "Renewed" — proving that specific structured field is an unreliable
   *  default, not a trustworthy per-offer fact. No source has been verified reliable for
   *  a NEW claim as of this writing; this flag exists so a FUTURE source can be, without
   *  ever silently trusting an unverified one. */
  structuredSourceVerifiedForNew?: boolean;
  /** True only when the caller has independently verified that EVERY offer reaching this
   *  specific ingestion path is contractually guaranteed new by the source/program —
   *  never a general "this merchant mostly sells new items" assumption (mission's own
   *  explicit distinction). No current source qualifies; this exists for a future one
   *  that is verified to. */
  sourceContractGuaranteesNew?: boolean;
}

export interface ConditionResolution {
  condition: MerchantCondition;
  evidenceSource: ConditionEvidenceSource;
  evidenceStrength: ConditionEvidenceStrength;
}

/**
 * Evidence-hierarchy resolver. Precedence (highest first), each checked only if the
 * previous yields nothing:
 *   1. EXPLICIT TITLE TEXT (renewed/refurbished/used) — HIGH strength. A seller
 *      disclosing a WORSE-than-new condition in the title has no incentive to fabricate
 *      it, and it is the only signal proven consistent across every source audited.
 *   2. STRUCTURED FIELD claiming a NON-NEW condition — MEDIUM strength. Asymmetric trust:
 *      a structured claim of RENEWED/REFURBISHED/USED is accepted (a source has no
 *      incentive to wrongly claim worse-than-actual condition), but a structured claim of
 *      NEW is NEVER accepted here (proven unreliable/defaulted for the one real source
 *      checked, Noon) — callers must not pass `structuredCondition: 'new'` expecting it to
 *      promote to NEW; it is intentionally ignored below.
 *   3. VERIFIED SOURCE CONTRACT guaranteeing NEW — MEDIUM strength, NEW only. Requires the
 *      caller to have already independently verified this guarantee; never inferred from
 *      "this merchant mostly sells new products" (mission's own explicit distinction).
 *   4. No evidence at all — UNKNOWN, NONE/NONE. Never guessed.
 */
export function resolveCondition(evidence: ConditionEvidence): ConditionResolution {
  const { title, structuredCondition, structuredSourceVerifiedForNew, sourceContractGuaranteesNew } = evidence;

  if (title && title.trim()) {
    if (/\brefurbished\b/i.test(title)) return { condition: 'REFURBISHED', evidenceSource: 'EXPLICIT_TITLE', evidenceStrength: 'HIGH' };
    const detected = extractSpecsFromTitle(title).condition;
    if (detected === 'renewed') return { condition: 'RENEWED', evidenceSource: 'EXPLICIT_TITLE', evidenceStrength: 'HIGH' };
    if (detected === 'used') return { condition: 'USED', evidenceSource: 'EXPLICIT_TITLE', evidenceStrength: 'HIGH' };
  }

  if (structuredCondition === 'renewed') return { condition: 'RENEWED', evidenceSource: 'STRUCTURED_FIELD', evidenceStrength: 'MEDIUM' };
  if (structuredCondition === 'refurbished') return { condition: 'REFURBISHED', evidenceSource: 'STRUCTURED_FIELD', evidenceStrength: 'MEDIUM' };
  if (structuredCondition === 'used') return { condition: 'USED', evidenceSource: 'STRUCTURED_FIELD', evidenceStrength: 'MEDIUM' };
  // A bare structuredCondition === 'new' is NOT trusted — only if the caller has proven
  // THIS source reliable for a NEW claim specifically (see the field's own doc comment;
  // Noon's real itemCondition field is the proven counter-example of an unverified one).
  if (structuredCondition === 'new' && structuredSourceVerifiedForNew === true) {
    return { condition: 'NEW', evidenceSource: 'STRUCTURED_FIELD', evidenceStrength: 'MEDIUM' };
  }

  if (sourceContractGuaranteesNew === true) return { condition: 'NEW', evidenceSource: 'SOURCE_CONTRACT', evidenceStrength: 'MEDIUM' };

  return { condition: 'UNKNOWN', evidenceSource: 'NONE', evidenceStrength: 'NONE' };
}
