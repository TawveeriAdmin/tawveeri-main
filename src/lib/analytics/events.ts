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
  "search", "results",                   // storefront surface: Search / Results
  "product_view",                        // Product View (both surfaces)
  "comparison_view",                     // Comparison seen (≥2 stores)
  "evidence_view",                       // Evidence / trust engaged
  "go_click",                            // Outbound Click (measured exit intent, client-side)
  "no_answer", "error",                  // off-funnel signals
] as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

export const USAGE_EVENT_SET: ReadonlySet<string> = new Set(USAGE_EVENT_TYPES);
