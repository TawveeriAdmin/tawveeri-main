// src/lib/analytics/events.ts
// THE event contract — single source of truth for every usage-event type
// (ADR-244, Gate A). The client emitter (track.ts) and the ingestion API
// (/api/events) both derive from this list, so an event type can no longer be
// fired on the client and silently dropped by the server allowlist — the exact
// defect found 2026-08-13: `advisor_clarified`, `advisor_share` and
// `advisor_constraint_removed` were emitted for months and never written,
// because the API kept its own hand-maintained copy of the list.
// tests/analytics/event-contract.test.ts scans the codebase's track() call
// sites against this list and fails on drift in either direction.

export const USAGE_EVENT_TYPES = [
  "landing_view",                        // Landing engagement: which entry arm was shown
  "advisor_query", "advisor_result",     // advisor surface: Search / Results
  "advisor_clarified",                   // shopper answered the ONE clarification question (asked-vs-answered)
  "advisor_share",                       // Decision Receipt shared/copied (growth-loop signal)
  "advisor_constraint_removed",          // shopper removed a parsed constraint («فهمنا منك»)
  // Decision Card v1 (2026-08-22, §D) — trust-companion behavior signals on the advisor's
  // own crowned pick, distinct from the surface-wide events above/below:
  "recommendation_accept",               // shopper clicked the SMART PICK's own primary CTA
  "alternative_view",                    // "موثوقية المعلومات" expand opened AND an alternative rendered
  "evidence_expand",                     // "موثوقية المعلومات" expand opened (fires on the toggle, not on mount)
  "return_to_decision",                  // SmartPick re-mounted for a canonical_id already seen this journey
  "search", "results",                   // storefront surface: Search / Results
  "product_view",                        // Product View (both surfaces)
  "comparison_view",                     // Comparison seen (≥2 stores)
  "evidence_view",                       // Evidence / trust engaged
  "go_click",                            // Outbound Click (measured exit intent, client-side)
  // Category-facet-pages mission (2026-08-25) — /categories/[slug] (ADR-226) and its facet
  // tier had ZERO measurement of any kind: no page-view event, and a click on a category
  // page's product card lands on /compare/[key], where the merchant-exit link was (and for
  // non-category traffic still is) a plain <a> with no track() call at all — so even a
  // category-originated exit click could never be attributed anywhere. These two close that:
  "category_page_view",                  // A /categories/[slug] or /categories/[slug]/[facet]
                                          // page rendered. meta.facet set only on the facet tier.
  "category_go_click",                   // Merchant-exit click on /compare/[key], attributed
                                          // back to the category/facet page that linked here
                                          // (via ?src=category on the compare-page URL) — see
                                          // category-exit-link.tsx. `category` = TPS category
                                          // key, meta.facet = facet slug when applicable.
  "home_mission",                        // «جهّز بيتك بذكاء» pilot funnel — step in meta.step
                                         // (started | plan | partial | refined | rejected | clarified)
  "home_share",                          // shared-plan lifecycle (ADR-257) — meta.step:
                                         // created | opened | feedback (owner + recipient surfaces)
  // Zero-state "closest options" fallback (ADR-271) actually rendering candidates — distinct
  // from `no_answer`, which fires for ANY zero-result cause and doesn't say whether the
  // fallback found something to show. meta.count = candidates shown.
  "closest_options_view",
  "no_answer", "error",                  // off-funnel signals
  // Affiliate Campaign Revenue Layer V1 (Phase 1E) — TELEMETRY ONLY, matching the
  // go_click/outbound_clicks split: campaign_clicks (server-written by
  // /go/campaign/[id]) is the AUTHORITATIVE click ledger; these two client events are
  // funnel signal, deduped the same way every other track() call is (track.ts). An
  // impression/click is NEVER treated as a lead/order — Section 1E's own rule.
  "campaign_impression",                 // an eligible campaign card rendered. meta.placement,
                                          // meta.merchant, meta.campaign_id
  "campaign_click",                      // its CTA was clicked (client-side signal only;
                                          // campaign_clicks is authoritative for the actual exit)
] as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

export const USAGE_EVENT_SET: ReadonlySet<string> = new Set(USAGE_EVENT_TYPES);
