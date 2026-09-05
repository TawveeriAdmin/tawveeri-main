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
import { resolveAmazonDestination, EXACT_IDENTITY_CONFIDENCE_THRESHOLD, type LiveCategoryDestination } from './destination-resolver';
import { getAmazonExactProductEvidence, getNoonExactProductEvidence } from './amazon-evidence';
import { logTiebreakEvent } from './commercial-tiebreak';

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

/** Amazon Decision Layer V2.1 §3/§6 — real signals the caller can supply about the
 *  shopping context, used ONLY to inform resolveAmazonDestination()'s amazon-merchant
 *  routing. Never trusted blindly: `productId` is re-verified against product_stores
 *  server-side (amazon-evidence.ts) before it can ever produce an exact_product link. */
export interface RoutingEvidence {
  /** Tawveeri's own internal product row id for the top/most relevant search result —
   *  never a client-asserted URL or confidence score. */
  productId?: string | null;
  /** The shopper's raw query — sanitized before ever reaching an Amazon URL
   *  (destination-resolver.ts's sanitizeModelSearchTerm). */
  queryText?: string | null;
}

/** Fire-and-forget write to campaign_exposures (Revenue Proof dashboard, Phase 2B) —
 *  SERVER-side decision-grade evidence that an eligible campaign was resolved/served
 *  for an eligible context. Never awaited by the caller, never throws into it. */
function logExposure(
  c: AffiliateCampaign,
  placement: CampaignPlacement,
  category: string | null,
  ctx: ExposureContext,
  destinationMode: EligibleCampaign['destinationMode'],
  reasonCode: string,
) {
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
        destination_mode: destinationMode,
        reason_code: reasonCode,
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
 *
 * `evidence` (V2.1) is where resolveAmazonDestination() actually gets wired into the
 * live serving path — ONLY for merchant === 'amazon'. Noon keeps the unchanged V1
 * category-only link build (buildCampaignMerchantUrl on the raw campaign row); Amazon's
 * final URL/mode is decided by resolveAmazonDestination() using evidence re-verified
 * server-side (amazon-evidence.ts), never a client-asserted destination.
 */
export async function getEligibleCampaigns(
  placement: Exclude<CampaignPlacement, 'both'>,
  category: string | null,
  ctx: ExposureContext = {},
  evidence: RoutingEvidence = {},
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
    // Commercial tie-break logging (2026-09-05): when BOTH an Amazon and a Noon exact_product
    // decision land in the SAME call (same request, same evidence.productId, so the same
    // canonical product by construction), that is exactly the "shopper-equivalent offer on two
    // merchants" situation the founder's commercial tie-break policy governs. Captured here so
    // it can be logged once, after the loop, WITHOUT changing which cards render — both cards
    // still render exactly as their own branch decides (Constitution Art. VII: this layer may
    // measure a commercial signal, it may never let that signal decide what's shown to whom).
    let amazonExactDecision: { priceSar: number | null; offerFreshnessHours: number | null; inStock: boolean } | null = null;
    let noonExactDecision: { priceSar: number | null; offerFreshnessHours: number | null; inStock: boolean } | null = null;

    for (const c of eligible) {
      // Small-appliance claim-guard (multi-category expansion, Sept 2026): affiliate_campaigns
      // has no column yet for "fresh, confirmed Amazon offer evidence" — until one exists,
      // every campaign is checked as if none exists (the safe default), so a card can never
      // present "best price"/"cheapest"/"verified price" it cannot back. A campaign whose
      // copy fails this is dropped, never rendered non-compliant — same fail-closed pattern
      // as the unresolvable-destination check below.
      const claimCheck = checkClaimGuard([c.title_ar, c.title_en, c.cta_ar, c.cta_en], false);
      if (!claimCheck.compliant) {
        console.error('campaign dropped: claim guard violation', c.id, claimCheck.violations);
        continue;
      }

      if (c.merchant === 'amazon' && category) {
        const liveMap: ReadonlyMap<string, LiveCategoryDestination> = new Map([
          [category, { destinationUrl: c.destination_url, trackingId: c.tracking_id }],
        ]);
        const amazonEvidence = await getAmazonExactProductEvidence(evidence.productId ?? null);
        // Practical confidence proxy (founder's "do not demand impossible perfection"):
        // ≥2 distinct approved stores is the SAME "corroborate before asserting identity"
        // bar CLAUDE.md already applies everywhere else in this codebase — a single-store
        // match hasn't been cross-verified by Tawveeri's own pipeline the way a ≥2-store
        // match has, so it stays below EXACT_IDENTITY_CONFIDENCE_THRESHOLD.
        const canonicalIdentityConfidence = amazonEvidence.distinctStoreCount >= 2
          ? EXACT_IDENTITY_CONFIDENCE_THRESHOLD + 0.1
          : amazonEvidence.distinctStoreCount === 1 ? 0.5 : null;
        // Out-of-stock is treated as "no exact offer to send a shopper to" — falls
        // through to model_search/category rather than an exact link to a dead listing.
        const exactAmazonProductUrl = amazonEvidence.inStock ? amazonEvidence.amazonProductUrl : null;

        const decision = resolveAmazonDestination({
          category,
          queryText: evidence.queryText ?? null,
          canonicalProductId: evidence.productId ?? null,
          canonicalIdentityConfidence,
          exactAmazonProductUrl,
          offerFreshnessHours: amazonEvidence.offerFreshnessHours,
          // Upstream (Tawveeri's own search/corroboration pipeline) already excludes
          // accessory queries from canonical matching and never merges different
          // storage/model/condition into one identity — see search/route.ts's own
          // "Accessory queries get no TPS canonical" contract. A productId reaching
          // here is therefore already identity-safe on those dimensions; re-deriving
          // that check here would duplicate a decision this codebase's own rules say
          // to trust once made (CLAUDE.md: "Deterministic engines decide... never
          // re-derive them").
          accessoryLeakageRisk: false,
          conditionMismatch: false,
          storageOrModelMismatch: false,
          openQualityIncident: false,
          liveCategoryCampaigns: liveMap,
        });

        if (decision.mode === 'unavailable' || !decision.destination) continue; // structurally shouldn't happen (category is always the map's only key) — fail closed anyway
        const link = buildCampaignMerchantUrl({ merchant: 'amazon', destination_url: decision.destination, tracking_id: decision.trackingId });
        if (!link) continue;

        if (decision.mode === 'exact_product') {
          amazonExactDecision = { priceSar: amazonEvidence.priceSar, offerFreshnessHours: amazonEvidence.offerFreshnessHours, inStock: amazonEvidence.inStock };
        }
        logExposure(c, placement, category, ctx, decision.mode, decision.reasonCode);
        withLinks.push({
          ...c,
          merchantUrl: link.url,
          clickToken: issueClickToken(c.id),
          destinationMode: decision.mode,
          canonicalProductId: decision.canonicalProductId,
          reasonCode: decision.reasonCode,
        });
        continue;
      }

      // Noon Wave 1 (2026-09-05) — the SAME resolver/gates as Amazon's, reused unchanged
      // (resolveAmazonDestination() has no Amazon-specific logic, only Amazon-specific
      // naming — see destination-resolver.ts's header). Gated behind its OWN independent
      // flag (NOON_EXACT_PRODUCT_ENABLED, default off) so Noon can launch in the same
      // category-only V1 shape Amazon itself launched in (ADR-284) before opting into
      // this richer routing later — same rollout precedent, same rollback lever, never
      // forced to move in lockstep with Amazon's.
      if (c.merchant === 'noon' && category && process.env.NOON_EXACT_PRODUCT_ENABLED === '1') {
        const liveMap: ReadonlyMap<string, LiveCategoryDestination> = new Map([
          [category, { destinationUrl: c.destination_url, trackingId: c.tracking_id }],
        ]);
        const noonEvidence = await getNoonExactProductEvidence(evidence.productId ?? null);
        const canonicalIdentityConfidence = noonEvidence.distinctStoreCount >= 2
          ? EXACT_IDENTITY_CONFIDENCE_THRESHOLD + 0.1
          : noonEvidence.distinctStoreCount === 1 ? 0.5 : null;
        const exactNoonProductUrl = noonEvidence.inStock ? noonEvidence.productUrl : null;

        const decision = resolveAmazonDestination({
          category,
          queryText: evidence.queryText ?? null,
          canonicalProductId: evidence.productId ?? null,
          canonicalIdentityConfidence,
          exactAmazonProductUrl: exactNoonProductUrl,
          offerFreshnessHours: noonEvidence.offerFreshnessHours,
          accessoryLeakageRisk: false,
          conditionMismatch: false,
          storageOrModelMismatch: false,
          openQualityIncident: false,
          liveCategoryCampaigns: liveMap,
        });

        if (decision.mode === 'unavailable' || !decision.destination) continue;
        const link = buildCampaignMerchantUrl({ merchant: 'noon', destination_url: decision.destination, tracking_id: decision.trackingId });
        if (!link) continue;

        if (decision.mode === 'exact_product') {
          noonExactDecision = { priceSar: noonEvidence.priceSar, offerFreshnessHours: noonEvidence.offerFreshnessHours, inStock: noonEvidence.inStock };
        }
        logExposure(c, placement, category, ctx, decision.mode, decision.reasonCode);
        withLinks.push({
          ...c,
          merchantUrl: link.url,
          clickToken: issueClickToken(c.id),
          destinationMode: decision.mode,
          canonicalProductId: decision.canonicalProductId,
          reasonCode: decision.reasonCode,
        });
        continue;
      }

      // Non-amazon (Noon, without the exact-product flag) or no category context —
      // unchanged V1 behavior.
      const link = buildCampaignMerchantUrl(c);
      if (!link) continue; // unresolvable destination — drop rather than render broken
      logExposure(c, placement, category, ctx, 'category', c.merchant === 'amazon' ? 'no_category_context' : 'non_amazon_merchant');
      withLinks.push({
        ...c,
        merchantUrl: link.url,
        clickToken: issueClickToken(c.id),
        destinationMode: 'category',
        canonicalProductId: null,
        reasonCode: c.merchant === 'amazon' ? 'no_category_context' : 'non_amazon_merchant',
      });
    }

    if (amazonExactDecision && noonExactDecision && evidence.productId && category) {
      logTiebreakEvent({
        canonicalProductId: evidence.productId,
        category,
        sessionId: ctx.sessionId ?? null,
        isTest: !!ctx.isTest,
        amazon: amazonExactDecision,
        noon: noonExactDecision,
      });
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
