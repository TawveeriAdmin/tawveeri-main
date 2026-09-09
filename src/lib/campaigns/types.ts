// src/lib/campaigns/types.ts
// Affiliate Campaign Revenue Layer V1 — shared types. See scripts/database/44-affiliate-campaigns.sql.

export type CampaignMerchant = 'amazon' | 'noon';
// Merchant Affiliate Campaign Engine (Sept 2026 mission) — 'campaign_page' is the
// dedicated, evergreen per-merchant offers page (src/app/[locale]/(public)/offers/
// [merchant]/page.tsx). Deliberately its OWN value, not folded into 'both': a campaign
// must opt in explicitly, and 'both' keeps its original, unchanged meaning (homepage +
// post_search).
export type CampaignPlacement = 'homepage' | 'post_search' | 'both' | 'campaign_page';

export interface AffiliateCampaign {
  id: string;
  merchant: CampaignMerchant;
  title_ar: string;
  title_en: string;
  cta_ar: string;
  cta_en: string;
  destination_url: string;
  /** Campaign-level Amazon Tracking ID / Noon program-tag override. null = use the
   *  provider's shared default. Never a per-user/session identifier. */
  tracking_id: string | null;
  categories: string[];
  placement: CampaignPlacement;
  enabled: boolean;
  start_at: string;
  end_at: string;
  verified_at: string | null;
  source: string | null;
  disclosure_ar: string;
  disclosure_en: string;
  is_test: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Optional seasonal/event identity shared by multiple merchant rows (migration 57,
   *  e.g. "national_day_96"). null/undefined = an evergreen, event-less campaign.
   *  Optional (not required) so every existing campaign object literal — tests, admin
   *  forms, older rows read before this migration — keeps compiling and working
   *  unchanged; treat a missing value exactly like null. */
  event_slug?: string | null;
  /** Optional visual theme hook for the event — styling only, no business logic
   *  branches on this value. */
  event_theme?: string | null;
  /** The MERCHANT'S OWN quoted marketing claim (never Tawveeri's own wording) — see
   *  `claim_verified_at`'s own doc comment for the rule governing when this may render. */
  official_claim_ar?: string | null;
  official_claim_en?: string | null;
  /** Official-source provenance only (never a third-party coupon-aggregator site). */
  official_claim_source?: string | null;
  /** When a human last confirmed official_claim_ar/en against the live official source.
   *  null/undefined = no verified claim exists — a campaign_page render must show its
   *  generic evergreen framing, NEVER a claim banner, while this is unset (mission
   *  §20/§30). */
  claim_verified_at?: string | null;
}

export type CampaignStatus = 'scheduled' | 'live' | 'expired' | 'paused';

/** Derived status (never persisted) — scheduled/live/expired/paused from enabled + start/end. */
export function deriveCampaignStatus(c: Pick<AffiliateCampaign, 'enabled' | 'start_at' | 'end_at'>, now: Date): CampaignStatus {
  if (!c.enabled) return 'paused';
  const start = Date.parse(c.start_at);
  const end = Date.parse(c.end_at);
  const t = now.getTime();
  if (Number.isFinite(end) && t >= end) return 'expired';
  if (Number.isFinite(start) && t < start) return 'scheduled';
  return 'live';
}

/** Where an eligible campaign was surfaced — used by campaign_clicks + track() events. */
export type CampaignSurface = 'homepage' | 'post_search';

/**
 * What the client actually receives (final closure round §3 — click architecture "B").
 * `merchantUrl` is the FINAL, already-tagged, server-validated destination — the card's
 * href points straight at the merchant, no Tawveeri redirect hop. `clickToken` is a
 * short-lived, server-signed value (src/lib/campaigns/click-token.ts) the client must
 * echo back to POST /api/campaigns/click for the click to be recorded — it is NOT part
 * of the merchant URL and is never sent to Amazon/Noon.
 */
export interface EligibleCampaign extends AffiliateCampaign {
  merchantUrl: string;
  clickToken: string;
  /** Amazon Decision Layer V2.1 — which resolveAmazonDestination() mode produced
   *  merchantUrl. Always 'category' for a non-amazon merchant (Noon has no exact/model
   *  routing in V2.1) or when no evidence was supplied. */
  destinationMode: import('./destination-resolver').DestinationMode;
  canonicalProductId: string | null;
  /** Why this mode was chosen (or the prior mode was rejected) — see
   *  resolveAmazonDestination()'s reasonCode. Not persisted verbatim to the DB in V2.1
   *  beyond the reason_code column added for exactly this (migration 48). */
  reasonCode: string;
}
