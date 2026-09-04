// X → Tawveeri attribution contract (2026-09-04)
// Builds stable UTM URLs for Tawveeri-owned X surfaces. Capture already lives in
// src/lib/analytics/campaign.ts (sessionStorage + tw_campaign cookie) and is stamped
// onto outbound_clicks by /go/[offerId] (ADR-244). Do NOT invent a second capture path.
//
// Trust-first rule: most Intent Desk proactive replies SHOULD stay linkless.
// Linkless journeys are usually unmeasurable on-site — unknown beats fake attribution.

export const X_UTM_SOURCE = 'x' as const;
export const X_UTM_MEDIUM = 'organic_social' as const;

/** Campaigns for Tawveeri-owned X links. Keep snake_case and human-readable. */
export type XCampaign =
  | 'profile'
  | 'profile_pin_v2'
  | 'organic_post'
  | 'intent_desk'
  | 'intent_desk_reactive'
  | 'home_mission'
  | 'content_bank'
  | 'how_it_works'
  | 'proof_method';

export type XAttributionInput = {
  campaign: XCampaign | string;
  /** Stable public content id used as utm_content (e.g. pin_need_budget_v2, reply_2026-09-04_ac). */
  contentId: string;
  /** Optional intent family: COMPARISON | HOME_MISSION | BUDGET | … */
  term?: string;
  /** Path under the locale, e.g. '' | '/home-mission' | '/how-it-works' */
  path?: string;
  locale?: 'ar' | 'en';
  baseUrl?: string;
};

export function buildXAttributionUrl(input: XAttributionInput): string {
  const base = (input.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com').replace(/\/$/, '');
  const locale = input.locale === 'en' ? 'en' : 'ar';
  const path = (input.path || '').replace(/\/+$/, '');
  const cleanPath = path && !path.startsWith('/') ? `/${path}` : path;
  const u = new URL(`${base}/${locale}${cleanPath}`);
  u.searchParams.set('utm_source', X_UTM_SOURCE);
  u.searchParams.set('utm_medium', X_UTM_MEDIUM);
  u.searchParams.set('utm_campaign', String(input.campaign).slice(0, 64));
  u.searchParams.set('utm_content', String(input.contentId).slice(0, 64));
  if (input.term) u.searchParams.set('utm_term', String(input.term).slice(0, 64));
  return u.toString();
}

/** True when a captured campaign is attributable to organic X. */
export function isXOrganicCampaign(c?: { utm_source?: string; utm_medium?: string } | null): boolean {
  if (!c?.utm_source) return false;
  return c.utm_source === X_UTM_SOURCE && (c.utm_medium === X_UTM_MEDIUM || c.utm_medium === 'social_reply');
}
