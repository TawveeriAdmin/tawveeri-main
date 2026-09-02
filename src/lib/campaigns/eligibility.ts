// src/lib/campaigns/eligibility.ts
// Deterministic campaign eligibility + selection (Phase 1D). NO AI, NO ranking signal,
// NO revenue-awareness — exactly ACTIVE × ENABLED × CATEGORY MATCH × VALID WINDOW ×
// COMPLIANCE-SAFE MERCHANT, as a pure function of (campaigns, now, request context).
// Pure and side-effect-free so it is fully unit-testable without a database.
import type { AffiliateCampaign, CampaignPlacement, CampaignMerchant } from './types';
import { deriveCampaignStatus } from './types';
import { validateCampaignDestination } from './destination-validation';

export interface EligibilityContext {
  now: Date;
  placement: Exclude<CampaignPlacement, 'both'>;
  /** The shopper's current category context (post-search: resolved query category;
   *  homepage: null — homepage campaigns are not category-gated). */
  category?: string | null;
  /** Global kill switch (AFFILIATE_CAMPAIGNS_ENABLED). false ⇒ always returns []. */
  globalEnabled: boolean;
  /** Per-merchant runtime allowlist (AFFILIATE_CAMPAIGNS_MERCHANTS). A merchant not in
   *  this set never renders — e.g. drop 'noon' while a brand-naming clarification is
   *  pending, without touching Amazon or the rest of the engine. */
  allowedMerchants: ReadonlySet<CampaignMerchant>;
}

function placementMatches(campaignPlacement: CampaignPlacement, requested: string): boolean {
  return campaignPlacement === requested || campaignPlacement === 'both';
}

function categoryMatches(categories: string[], category: string | null | undefined): boolean {
  if (categories.length === 0) return true; // ungated campaign matches any context
  if (!category) return false; // gated campaign requires a known category
  return categories.includes(category);
}

/** True iff `c` may be shown at all, ignoring which OTHER campaigns are also eligible. */
export function isCampaignEligible(c: AffiliateCampaign, ctx: EligibilityContext): boolean {
  if (!ctx.globalEnabled) return false;
  if (!ctx.allowedMerchants.has(c.merchant)) return false;
  if (deriveCampaignStatus(c, ctx.now) !== 'live') return false;
  if (!placementMatches(c.placement, ctx.placement)) return false;
  if (!categoryMatches(c.categories, ctx.category)) return false;
  if (!validateCampaignDestination(c.merchant, c.destination_url).valid) return false;
  return true;
}

/**
 * Select at most ONE campaign per merchant from the eligible set (Phase 1C/1D: "one
 * Amazon campaign and/or one Noon campaign"). Deterministic tie-break within a
 * merchant — no randomness, no AI, no CTR/revenue weighting:
 *   1. a category-gated campaign (categories.length > 0) beats an ungated one — more
 *      specific evidence of relevance wins;
 *   2. earlier created_at wins — stable or first-created, never "whichever was clicked
 *      more."
 * Returns campaigns sorted amazon-then-noon for a stable render order.
 */
export function selectEligibleCampaigns(campaigns: AffiliateCampaign[], ctx: EligibilityContext): AffiliateCampaign[] {
  const eligible = campaigns.filter((c) => isCampaignEligible(c, ctx));
  const byMerchant = new Map<CampaignMerchant, AffiliateCampaign>();
  for (const c of eligible) {
    const current = byMerchant.get(c.merchant);
    if (!current) {
      byMerchant.set(c.merchant, c);
      continue;
    }
    const currentGated = current.categories.length > 0;
    const candidateGated = c.categories.length > 0;
    if (candidateGated && !currentGated) {
      byMerchant.set(c.merchant, c);
    } else if (candidateGated === currentGated && Date.parse(c.created_at) < Date.parse(current.created_at)) {
      byMerchant.set(c.merchant, c);
    }
  }
  const order: CampaignMerchant[] = ['amazon', 'noon'];
  return order.map((m) => byMerchant.get(m)).filter((c): c is AffiliateCampaign => !!c);
}

/** Parse AFFILIATE_CAMPAIGNS_MERCHANTS (comma list) into an allowlist. Defaults to both
 *  known merchants when unset — an explicit empty value ("") disables every merchant
 *  without touching the global kill switch. */
export function parseAllowedMerchants(envValue: string | undefined): ReadonlySet<CampaignMerchant> {
  if (envValue === undefined) return new Set<CampaignMerchant>(['amazon', 'noon']);
  const parts = envValue
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is CampaignMerchant => s === 'amazon' || s === 'noon');
  return new Set(parts);
}

/** The global kill switch (Phase 1A). Read at request time (server-only env var) so a
 *  Railway env-var flip takes effect on the next request without a code redeploy —
 *  same mechanism as AI_ASSISTANT_ENABLED (src/app/api/ai-assistant/route.ts). */
export function isCampaignsGloballyEnabled(): boolean {
  return process.env.AFFILIATE_CAMPAIGNS_ENABLED === '1';
}
