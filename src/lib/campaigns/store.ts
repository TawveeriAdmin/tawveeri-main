// src/lib/campaigns/store.ts
// Server-only data access for affiliate_campaigns (service-role client — the table
// grants no anon/authenticated access, matching src/lib/intelligence/home-verified-deals.ts's
// precedent for a server-only-readable table). Never imported from a client component.
import { createServerClient } from '@/lib/database';
import type { AffiliateCampaign, CampaignPlacement, EligibleCampaign } from './types';
import { isCampaignsGloballyEnabled, parseAllowedMerchants, selectEligibleCampaigns } from './eligibility';
import { buildCampaignMerchantUrl } from './link';
import { issueClickToken } from './click-token';
import { checkClaimGuard } from './claim-guard';

// affiliate_campaigns/campaign_clicks are new tables (scripts/database/44-affiliate-campaigns.sql)
// not yet present in the generated Database type (src/lib/database/types.ts). Same escape hatch
// already used for another new table with the identical problem (growth_content —
// src/app/api/admin/growth/content/route.ts) rather than hand-editing generated codegen output.
export function untypedClient() {
  return createServerClient() as unknown as { from: (table: string) => any };
}

/** All campaigns whose placement could ever include `placement`, enabled or not —
 *  callers apply eligibility themselves. Used by both the public selector below and
 *  the admin list (which needs paused/expired/scheduled rows too). */
export async function listCampaignsForPlacement(placement: CampaignPlacement): Promise<AffiliateCampaign[]> {
  const supabase = untypedClient();
  const { data, error } = await supabase
    .from('affiliate_campaigns')
    .select('*')
    .in('placement', placement === 'homepage' ? ['homepage', 'both'] : ['post_search', 'both']);
  if (error || !data) return [];
  return data as AffiliateCampaign[];
}

export interface ExposureContext {
  sessionId?: string | null;
  isTest?: boolean;
}

/** Fire-and-forget write to campaign_exposures (Revenue Proof dashboard, Phase 2B) —
 *  SERVER-side decision-grade evidence that an eligible campaign was resolved/served
 *  for an eligible context. Never awaited by the caller, never throws into it. */
function logExposure(c: AffiliateCampaign, placement: CampaignPlacement, category: string | null, ctx: ExposureContext) {
  try {
    const supabase = untypedClient();
    supabase
      .from('campaign_exposures')
      .insert({
        campaign_id: c.id,
        merchant: c.merchant,
        placement,
        category,
        session_id: ctx.sessionId ?? null,
        is_test: c.is_test || !!ctx.isTest,
        // Amazon Decision Layer V2 §6 — getEligibleCampaigns() only ever resolves the
        // CATEGORY mode today (resolveAmazonDestination()'s other modes are built but
        // not wired here yet), so this is a stated fact, not a guess.
        destination_mode: 'category',
      })
      .then(({ error }: { error: unknown }) => { if (error) console.error('campaign_exposures insert failed:', error); });
  } catch { /* measurement must never break the page */ }
}

/**
 * The one function the homepage and post-search surfaces call. Applies the global
 * kill switch, the per-merchant runtime allowlist, and deterministic eligibility —
 * then resolves each survivor's FINAL merchant URL and a click token (final closure
 * round §3: this is IMPRESSION-TIME URL building — the card's href points straight
 * at the merchant, no /go/campaign redirect). A campaign whose URL cannot be safely
 * resolved is dropped, never rendered broken. Never throws, never fabricates.
 *
 * `ctx` is optional purely so existing call sites keep compiling without it; pass a
 * real session id / is_test flag when the caller has one (see src/app/[locale]/page.tsx
 * and src/app/api/campaigns/eligible/route.ts) so campaign_exposures carries it.
 */
export async function getEligibleCampaigns(
  placement: Exclude<CampaignPlacement, 'both'>,
  category: string | null,
  ctx: ExposureContext = {},
): Promise<EligibleCampaign[]> {
  if (!isCampaignsGloballyEnabled()) return [];
  const allowedMerchants = parseAllowedMerchants(process.env.AFFILIATE_CAMPAIGNS_MERCHANTS);
  if (allowedMerchants.size === 0) return [];
  try {
    const campaigns = await listCampaignsForPlacement(placement);
    const eligible = selectEligibleCampaigns(campaigns, {
      now: new Date(),
      placement,
      category,
      globalEnabled: true,
      allowedMerchants,
    });
    const withLinks: EligibleCampaign[] = [];
    for (const c of eligible) {
      const link = buildCampaignMerchantUrl(c);
      if (!link) continue; // unresolvable destination — drop rather than render broken
      // Small-appliance claim-guard (multi-category expansion, Sept 2026): affiliate_campaigns
      // has no column yet for "fresh, confirmed Amazon offer evidence" — until one exists,
      // every campaign is checked as if none exists (the safe default), so a card can never
      // present "best price"/"cheapest"/"verified price" it cannot back. A campaign whose
      // copy fails this is dropped, never rendered non-compliant — same fail-closed pattern
      // as the unresolvable-destination check just above.
      const claimCheck = checkClaimGuard([c.title_ar, c.title_en, c.cta_ar, c.cta_en], false);
      if (!claimCheck.compliant) {
        console.error('campaign dropped: claim guard violation', c.id, claimCheck.violations);
        continue;
      }
      logExposure(c, placement, category, ctx);
      withLinks.push({ ...c, merchantUrl: link.url, clickToken: issueClickToken(c.id) });
    }
    return withLinks;
  } catch {
    return []; // a lookup failure hides the commercial layer, never breaks the page
  }
}

export async function getCampaignById(id: string): Promise<AffiliateCampaign | null> {
  const supabase = untypedClient();
  const { data, error } = await supabase.from('affiliate_campaigns').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as AffiliateCampaign;
}
