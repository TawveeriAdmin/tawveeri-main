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
