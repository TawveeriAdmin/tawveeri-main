// src/lib/analytics/referral-link.ts
// Referral-loop follow-up (2026-08-25, docs/CATEGORY-PAGES-PLAN.md §8 "GEO + Referral
// Follow-ups"). NO new table, NO new column, NO new event type — the referral "code" is a
// short, derived slice of an identifier that already exists (Home Mission's share token;
// the Decision Card sharer's own anonymous session_id), never a value generated or stored
// anywhere new. Reuses the SAME utm_source/utm_medium/utm_content query params
// `campaign.ts`'s `initCampaignFromUrl()` already captures for every other campaign — a
// referral link needs zero new capture code, zero new wiring on the landing page, because
// `CampaignCapture` is already mounted globally (root layout) and already threads
// `meta.utm_content` into every subsequent `track()` call and the `/go` route's
// `outbound_clicks` stamp (ADR-244). Attribution is a `GROUP BY utm_content` over data this
// pipeline is already collecting — nothing else to build.

export type ReferralMedium = 'home_mission_share' | 'decision_card_share';

/**
 * Short, public-facing referral code — 8 lowercase alphanumeric characters, derived (never
 * stored) from an identifier that already exists. Deterministic: the same source always
 * produces the same code, so re-sharing the same plan or the same browser session always
 * carries the same code (useful for the sharer's own re-shares to attribute consistently).
 * Dashes/other separators stripped first so a UUID's first hyphen-delimited segment isn't
 * accidentally shortened by punctuation eating into the 8-character budget.
 */
export function deriveReferralCode(source: string): string {
  return source.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
}

/**
 * Appends `utm_source=referral&utm_medium=<medium>&utm_content=<code>` to a share URL —
 * the exact 3 fields `initCampaignFromUrl()` already reads, `utm_campaign` deliberately
 * left unset (nothing meaningful to put there for a peer-to-peer share). Works whether
 * `url` already carries a query string or not, and whether it's a relative path or an
 * absolute URL — same `?`-vs-`&` decision `withCategoryAttribution` (category-link.ts)
 * already makes for the same reason.
 */
export function appendReferralParams(url: string, medium: ReferralMedium, code: string): string {
  const params = new URLSearchParams({ utm_source: 'referral', utm_medium: medium, utm_content: code });
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${params.toString()}`;
}
