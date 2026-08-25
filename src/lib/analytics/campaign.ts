// src/lib/analytics/campaign.ts
// ─────────────────────────────────────────────────────────────────────────────
// Social attribution capture — closes the one confirmed gap in docs/SOCIAL-READINESS.md
// gate 7: nothing populated utm_source/utm_medium/utm_campaign/utm_content anywhere, so a
// social click could never be traced through search -> product -> comparison -> outbound.
//
// UTM contract (docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §23):
//   utm_source=x|tiktok|instagram|snapchat|youtube · utm_medium=organic_social|paid_social|social_reply
//   utm_campaign=controlled_demand_validation_<wave> · utm_content=<content_id>
//
// utm_source=referral (2026-08-25, docs/CATEGORY-PAGES-PLAN.md §8 "GEO + Referral
// Follow-ups") — the SAME capture path, extended to peer-to-peer shares rather than
// external social platforms: utm_medium=home_mission_share|decision_card_share,
// utm_content=<8-char code> (src/lib/analytics/referral-link.ts). utm_campaign unset —
// nothing meaningful to put there for a peer share. No new field, no new capture logic.
//
// Scope is per browser-tab SESSION (sessionStorage), not per-visitor-forever like the
// entry-variant assignment — a new social click in the same tab is a new attributed
// landing and should overwrite, but attribution must not leak across an unrelated later
// session.
//
// CORRECTION (2026-08-25): the line that stood here — "Never touches the /go route or
// outbound_clicks" — was stale the moment ADR-244 landed. `initCampaignFromUrl()` below
// mirrors the SAME campaign into a session cookie specifically so `/go/[offerId]/route.ts`
// can read it and stamp `outbound_clicks` server-side (confirmed live in that file — it
// reads `req.cookies.get("tw_campaign")`) — the two comments in this file already
// contradicted each other; this one was wrong, not that one.
const KEY = "tw_campaign";

export type Campaign = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
};

/** Capture utm_* from the current URL into sessionStorage (call once on mount, alongside
 *  initTestModeFromUrl()). Overwrites only when utm_source is present in THIS URL — a
 *  plain internal navigation never clears an already-captured campaign mid-session.
 *
 *  ADR-244: also mirrored into a SESSION cookie (no max-age — dies with the browser
 *  session, same lifetime semantics as the sessionStorage copy) so the `/go` exit
 *  route can stamp the campaign onto `outbound_clicks` server-side. That closes the
 *  split-brain this file's older comment described: the ledger that records the real
 *  exits could never see which content produced them. */
export function initCampaignFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams(window.location.search);
    const source = p.get("utm_source");
    if (!source) return;
    const c: Campaign = {
      utm_source: source.slice(0, 32),
      utm_medium: p.get("utm_medium")?.slice(0, 32) || undefined,
      utm_campaign: p.get("utm_campaign")?.slice(0, 64) || undefined,
      utm_content: p.get("utm_content")?.slice(0, 64) || undefined,
    };
    sessionStorage.setItem(KEY, JSON.stringify(c));
    try { document.cookie = `tw_campaign=${encodeURIComponent(JSON.stringify(c))}; path=/; samesite=lax`; } catch { /* noop */ }
  } catch { /* best-effort */ }
}

/** Read the session's captured campaign, if any. */
export function getCampaign(): Campaign | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Campaign) : undefined;
  } catch { return undefined; }
}
