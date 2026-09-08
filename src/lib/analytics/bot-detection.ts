// src/lib/analytics/bot-detection.ts
// ADR-282 (2026-09): extracted from src/app/go/[offerId]/route.ts's inline `isTest` check so
// the UA-matching rule is independently testable — the 2026-08-31 anomaly investigation
// (docs/report/AUGUST-2026-FOUNDER-REVIEW.md §12) found the route's list missed a bot UA
// ("...compatible; BuiltWith/1.4; ...") that WAS present in the affected redirects. Session
// identity on /go is cookie-only by design (a raw HTTP client replaying a harvested /go link
// never carries tw_sid), so UA matching is the only lever available for this traffic class.
//
// Deliberately a narrow, well-known-signature allowlist, not a broad heuristic: a false
// positive here only mis-labels a redirect as TEST (excluded from real-traffic counts) — it
// never blocks or alters the actual redirect, so real customers are never at risk from this
// list growing or from a UA it doesn't recognize.
const KNOWN_BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|headless|puppeteer|playwright|lighthouse|python-requests|python-urllib|scrapy|phantom|curl|wget|builtwith|ahrefs|semrush|mj12bot|dotbot|seokicks|uptime|pingdom|monitor|okhttp|go-http-client|libwww-perl|axios\/|node-fetch/i;

export function isKnownBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return KNOWN_BOT_UA_PATTERN.test(userAgent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Market Proof mission, 2026-09-08 — sessionless-redirect root-cause investigation.
//
// tps:sanity's "redirect/browse mismatch" check found `outbound_clicks` rows with realistic,
// current, non-spoofed-looking browser user agents (Chrome 142-150, Safari, Edge — none match
// KNOWN_BOT_UA_PATTERN above) that nonetheless carry NO session_id, spread broadly across ~700
// distinct products, on a bursty (not ambient) daily cadence with sharp peaks — a signature this
// investigation traced to `<a href="/go/<offerId>">` (ExitLink, exit-link.tsx / product-card.tsx
// / category-exit-link.tsx): a REAL, crawlable anchor kept in server-rendered HTML for
// accessibility/no-JS/middle-click support, whose onClick handler intercepts a real user's click
// (adding session + interaction provenance) but does nothing to stop a non-JS HTTP client from
// following the raw href directly — exactly the failure mode ADR-286's own comment on this route
// already predicted ("a crawler, curl, a scraper — no click, no JS, no session required").
// robots.txt already disallows `/go/`; this traffic is not honoring it.
//
// Session identity on /go has been cookie-only since session stamping went live in production —
// verified live: the EARLIEST outbound_clicks row anywhere carrying a non-null session_id is
// 2026-08-13T09:08:15Z. Every row before that instant legitimately has no session_id (the
// column simply didn't exist yet) and must never be judged by this rule. From that instant on,
// a null session_id on a non-is_test row is the same "raw HTTP client, not a real browser click"
// signal the route's own design already relies on (see the comment atop this file) — narrow,
// well-evidenced, and, like the UA list above, fails safe: a false positive here only removes a
// row from a REPORTING count, never blocks, alters, or deletes the underlying redirect or its
// raw stored row.
export const SESSION_TRACKING_LIVE_SINCE = new Date('2026-08-13T09:08:15Z');

export function isProbableAutomatedRedirect(row: { session_id?: string | null; clicked_at: string }): boolean {
  if (row.session_id) return false;
  return new Date(row.clicked_at) >= SESSION_TRACKING_LIVE_SINCE;
}
