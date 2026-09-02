// src/lib/campaigns/types.ts
// Affiliate Campaign Revenue Layer V1 — shared types. See scripts/database/44-affiliate-campaigns.sql.

export type CampaignMerchant = 'amazon' | 'noon';
export type CampaignPlacement = 'homepage' | 'post_search' | 'both';

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
}
