// src/lib/campaigns/link.ts
// Builds the FINAL, already-tagged merchant URL for a campaign at IMPRESSION time
// (final closure round §3 — click architecture "B": the browser navigates to the
// merchant directly, there is no /go/campaign/[id] redirect hop). Reuses
// buildOfferExitLink()/getProvider() from src/lib/providers unchanged — the exact
// same tag logic already live for Amazon/Noon's organic exits.
//
// AMAZON SUB-TAG AUDIT (final closure round §2): `ctx.clickId` is NEVER passed here,
// for either merchant, so `ascsubtag` (Amazon) / the subId param (Noon's `utm_content`)
// is never set — network.build() only writes it `if (subId && ...)`, and subId is
// null whenever ctx.clickId is undefined (see src/lib/providers/networks/amazon.ts and
// param.ts). Attribution is CAMPAIGN-LEVEL only, via `campaign.tracking_id`.
//
// `tracking_id` OVERRIDE IS AMAZON-ONLY: Amazon's network reads `config.trackingId`
// directly (a real, single-string "Tracking ID" concept — ADR-212). Noon has no
// equivalent per-campaign concept in the current account: its attribution is a FIXED
// program-level UTM parameter set (`utm_source=C1000264L`/…, ADR-224) read via
// `config.params`, not `trackingId`, so overriding `trackingId` for Noon would silently
// do nothing to the actual link. Rather than special-case a param-array rewrite for a
// capability the account doesn't have, V1 leaves Noon's link exactly as the organic
// exit already builds it — a founder-set `tracking_id` on a Noon campaign row is
// simply not read here (documented in the admin UI).
//
// AUDIT FINDING (final closure round §2, discovered writing this file's tests):
// src/lib/catalog/normalizeStoreUrl.ts — called by buildOfferExitLink() BEFORE it ever
// reaches amazonNetwork.build() — has a legacy branch that matches ANY amazon.sa host
// (`host.includes("amazon.sa")`, unconditional — not gated on the storeName argument)
// and hardcodes `tag=tawveeri0f-21` onto the URL itself. amazon.ts's own tag logic
// then sees the param already present (`if (!out.searchParams.has("tag"))`) and never
// overwrites it — so passing a provider config with a different `trackingId` silently
// has NO EFFECT on the resulting URL for any Amazon destination. This is dormant today
// only because the legacy hardcoded value happens to equal the registry's current
// default tag; a future tag rotation in registry.ts without updating this duplicate
// would silently desync the two. NOT fixed here (organic-exit code is out of this
// mission's bound) — flagged for the founder. Worked around below with an explicit
// post-build override of the `tag` query param, applied AFTER buildOfferExitLink runs,
// rather than relying on config.trackingId ever reaching the URL.
import { buildOfferExitLink, getProvider } from '@/lib/providers';
import type { AffiliateConfig, RetailerProvider } from '@/lib/providers';
import { isNonProductionExitUrl } from '@/lib/retailers/exit-url';
import type { AffiliateCampaign } from './types';

export interface CampaignMerchantLink {
  url: string;
  program: string;
  tag: string | null;
}

/**
 * Resolve the final merchant URL for a campaign. Never throws; returns null if the
 * destination cannot be safely resolved (caller must then hide the campaign rather
 * than render a broken/unsafe link).
 */
export function buildCampaignMerchantUrl(campaign: Pick<AffiliateCampaign, 'merchant' | 'destination_url' | 'tracking_id'>): CampaignMerchantLink | null {
  const provider = getProvider(campaign.merchant);
  if (!provider) return null;

  let affiliateConfig: AffiliateConfig | null = provider.affiliate;
  if (affiliateConfig && campaign.tracking_id && campaign.merchant === 'amazon') {
    affiliateConfig = { ...affiliateConfig, trackingId: campaign.tracking_id };
  }
  // supportsSubId is documentation-level here (network.build() only reacts to a
  // present ctx.clickId, which this call never supplies) — set false anyway so the
  // config itself states the policy, not just the call site.
  if (affiliateConfig) affiliateConfig = { ...affiliateConfig, supportsSubId: false };

  const syntheticProvider: RetailerProvider = { ...provider, affiliate: affiliateConfig };
  // storeName MUST be the numeric store id (String(provider.storeId)), never the
  // merchant slug — src/lib/catalog/normalizeStoreUrl.ts has a legacy branch that
  // pattern-matches storeName === "amazon" and hardcodes tag=tawveeri0f-21 itself,
  // BEFORE buildOfferExitLink ever dispatches to the provider's own network builder.
  // Passing "amazon" here silently clobbered every campaign-level Tracking ID
  // override (amazon.ts's `if (!out.searchParams.has("tag"))` guard then leaves the
  // legacy value in place) — caught by tests/campaigns/link.test.ts. The real /go
  // route (src/app/go/[offerId]/route.ts) already passes the numeric store id for
  // exactly this reason; this is the same convention, not a new one.
  //
  // Deliberately NO clickId in ctx — see file header.
  const link = buildOfferExitLink(syntheticProvider, campaign.destination_url, provider.storeId, { source: 'campaign' });

  if (!/^https?:\/\//i.test(link.url) || isNonProductionExitUrl(link.url)) return null;

  // Post-build override (see AUDIT FINDING above): normalizeStoreUrl's legacy Amazon
  // branch stamps the shared default tag onto the URL unconditionally, before the
  // provider config above ever gets a say — so a campaign-level tracking_id must be
  // applied here, on the ALREADY-BUILT url, to actually take effect.
  let finalUrl = link.url;
  let finalTag = link.tag ?? null;
  if (campaign.merchant === 'amazon' && campaign.tracking_id) {
    try {
      const u = new URL(finalUrl);
      u.searchParams.set('tag', campaign.tracking_id);
      finalUrl = u.toString();
      finalTag = campaign.tracking_id;
    } catch { /* unparseable — keep the provider-built url as-is */ }
  }

  return { url: finalUrl, program: link.program, tag: finalTag };
}
