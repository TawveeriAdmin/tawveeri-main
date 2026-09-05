// src/lib/campaigns/traffic-eligibility.ts
// Merchant-specific traffic eligibility contract (founder mission §4, 2026-09-05).
//
// SCOPE: affiliate MONETIZATION eligibility is a separate concept from shopper MERCHANT
// AVAILABILITY (mission's own distinction). This module classifies which acquisition
// channel a click/exposure came from and whether that channel is safe to count as
// affiliate-eligible traffic FOR A GIVEN MERCHANT — it never disables, hides, or reorders
// any organic product/store/comparison. It is consulted only by the campaign layer's own
// measurement functions (revenue-proof-queries.ts), never by search/ranking/decision-engine.
//
// Built as the smallest safe contract the mission asked for: a pure classifier + a pure
// per-merchant eligibility table, not a live-editable database-backed policy — no paid
// traffic exists in production today (no paid media is authorized), so a config table
// nobody can populate yet would be premature (CLAUDE.md: "don't design for hypothetical
// future requirements"). If a real per-merchant policy change is ever needed without a
// redeploy, promoting this table to a DB-backed one is a natural, scoped follow-up.
import type { CampaignMerchant } from './types';

export type TrafficSourceClass =
  | 'organic_direct'      // no campaign params at all — the default, safe majority case
  | 'seo'                 // NOTE: indistinguishable from organic_direct at the utm-cookie
                           // level today (search-engine referral carries no utm params) —
                           // classified as organic_direct until referrer-based detection
                           // exists; listed here only so the mission's own taxonomy names
                           // it explicitly rather than silently folding it in unlabeled.
  | 'x_organic'
  | 'tiktok_organic'
  | 'email'
  | 'referral'
  | 'google_paid_search'
  | 'other_paid_social'
  | 'internal_test'
  | 'unknown';            // utm params present but not classifiable into any of the above

const PAID_UTM_MEDIA = new Set(['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'ads']);

export interface AcquisitionCampaign {
  utm_source?: string;
  utm_medium?: string;
}

/**
 * Classify the acquisition channel from the SAME tw_campaign cookie shape already read
 * elsewhere in this layer (readAttribution() in src/app/go/[offerId]/route.ts,
 * isPaidOriginAcquisition() in revenue-proof-queries.ts). `null`/no utm_source at all is
 * the default organic_direct case — the vast majority of today's real traffic — NOT the
 * "unknown" the mission warns must never be treated as eligible; "unknown" here is
 * reserved for utm params that exist but don't match any recognized channel.
 */
export function classifyTrafficSource(
  campaign: AcquisitionCampaign | null | undefined,
  isTest: boolean,
): TrafficSourceClass {
  if (isTest) return 'internal_test';
  if (!campaign || !campaign.utm_source) return 'organic_direct';

  const source = campaign.utm_source.toLowerCase();
  const medium = (campaign.utm_medium ?? '').toLowerCase();
  const isPaidMedium = PAID_UTM_MEDIA.has(medium);

  if (isPaidMedium) {
    return source.includes('google') ? 'google_paid_search' : 'other_paid_social';
  }
  if (source === 'x' || source === 'twitter') return 'x_organic';
  if (source === 'tiktok') return 'tiktok_organic';
  if (medium === 'email') return 'email';
  if (medium === 'referral') return 'referral';
  return 'unknown';
}

export type TrafficEligibilityState = 'eligible' | 'ineligible' | 'unknown';

export interface TrafficEligibilityResult {
  sourceClass: TrafficSourceClass;
  eligibility: TrafficEligibilityState;
  reasonCode: string;
}

/** Channels safe to count as affiliate-eligible for EVERY merchant today — plain organic
 *  acquisition, no paid-traffic or unverified-provenance question attached. */
const ALWAYS_ELIGIBLE: ReadonlySet<TrafficSourceClass> = new Set([
  'organic_direct', 'seo', 'x_organic', 'tiktok_organic', 'email', 'referral',
]);

/**
 * Per-merchant policy (mission §4). Amazon's paid-search policy is already documented
 * elsewhere in this codebase as POLICY-AMBIGUOUS (revenue-proof-queries.ts's own
 * isPaidOriginAcquisition comment, Amazon Decision Layer V2 §1D) — excluded rather than
 * risk violating an ambiguous rule. Noon's own paid-traffic policy is UNVERIFIED (no
 * confirmed primary-source review completed for this account) — same conservative
 * default applies until it is. Both merchants exclude paid channels identically today;
 * this is a per-merchant TABLE, not a shared constant, specifically so a future
 * confirmed policy difference (e.g. one network permitting paid search) is a one-line
 * change here, never a re-architecture.
 */
export function isTrafficEligibleForMerchant(merchant: CampaignMerchant, sourceClass: TrafficSourceClass): TrafficEligibilityResult {
  if (sourceClass === 'internal_test') {
    return { sourceClass, eligibility: 'ineligible', reasonCode: 'INTERNAL_TEST' };
  }
  if (sourceClass === 'google_paid_search' || sourceClass === 'other_paid_social') {
    return {
      sourceClass,
      eligibility: 'ineligible',
      reasonCode: merchant === 'amazon' ? 'PAID_TRAFFIC_POLICY_AMBIGUOUS' : 'PAID_TRAFFIC_POLICY_UNVERIFIED',
    };
  }
  if (sourceClass === 'unknown') {
    // Mission §4: "Do NOT treat UNKNOWN as eligible." A recognized utm pair that matches
    // no known channel is genuinely ambiguous provenance, not organic-by-default.
    return { sourceClass, eligibility: 'unknown', reasonCode: 'UNVERIFIED_SOURCE' };
  }
  if (ALWAYS_ELIGIBLE.has(sourceClass)) {
    return { sourceClass, eligibility: 'eligible', reasonCode: 'ORGANIC_TRAFFIC' };
  }
  // Exhaustive by construction — TypeScript keeps this reachable only if a new
  // TrafficSourceClass is added without updating this table.
  return { sourceClass, eligibility: 'unknown', reasonCode: 'UNVERIFIED_SOURCE' };
}
