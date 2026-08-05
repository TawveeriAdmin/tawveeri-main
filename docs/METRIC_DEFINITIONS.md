# Metric Definitions — Founder Commerce Command Center

_Single governed dictionary for every metric shown in `/admin/command-center`. If a metric isn't defined here, it doesn't ship. Sources: `usage_events`, `outbound_clicks` (production `vyceqrzttspyycdpojtn`). Companion: [DATA_QUALITY_CONTRACT.md](DATA_QUALITY_CONTRACT.md), [ANALYTICS_ATTRIBUTION_AUDIT.md](ANALYTICS_ATTRIBUTION_AUDIT.md)._

Every metric below is computed **REAL-only** (`is_test = false`) unless stated otherwise. TEST volume is always shown alongside, never blended in.

## Confidence states

| State | Meaning |
|---|---|
| CONFIRMED | Directly counted from an immutable, append-only event or click row. |
| ESTIMATED | Derived (rate, ratio) from CONFIRMED counts — precision depends on sample size. |
| DELAYED | Source data exists but the latest period hasn't landed yet (e.g. an affiliate report not yet imported). |
| INCOMPLETE | Partially available — some rows/periods missing by design or known gap (e.g. no session_id join). |
| UNAVAILABLE | Not measurable with current instrumentation. Never shown as zero — shown as "—" with the reason. |

## Traffic

| Metric | Definition | Source | Window/TZ | Confidence |
|---|---|---|---|---|
| **Sessions** | Distinct `session_id` values with ≥1 event, `is_test=false`. **Not** a person-count — session_id is a client-generated, session-scoped identifier; a returning person on a new browser session counts twice. | `count(distinct session_id) from usage_events where is_test=false` | Selected period, Asia/Riyadh | CONFIRMED |
| **"Real visitors"** | We deliberately do **not** publish this label. There is no cookie/identity layer that survives across sessions for anonymous users, so "unique person" cannot be asserted. Dashboards say **Sessions**, never "visitors," until a durable anonymous ID exists. | — | — | UNAVAILABLE (by design, not a bug) |
| **New vs. returning session** | A session's `session_id` is "returning" if the same id has events on ≥2 distinct calendar days (matches the retention definition already used in `tps:usage`). | `usage_events`, grouped by `session_id`, `count(distinct created_at::date)` | Selected period | ESTIMATED |
| **Source / campaign / content** | `usage_events.meta->>'utm_source'` etc., captured at landing per ADR-207. Only reliable up to the point of capture — see UTM-to-exit gap below. | `usage_events.meta` | Selected period | CONFIRMED (capture) / UNAVAILABLE (join to exit) |

## Product journey (funnel)

Six-step funnel, identical definition to `scripts/tps-analysis/usage-report.ts` (not re-derived):

| Step | `event_type` | Numerator | Denominator (conversion shown) |
|---|---|---|---|
| 1 Search | `search`, `advisor_query` | count | — |
| 2 Results (valid result returned) | `results`, `advisor_result` | count | Step 1 |
| 3 Product opened | `product_view` | count | Step 2 |
| 4 Comparison opened | `comparison_view` | count | Step 3 |
| 5 Evidence viewed | `evidence_view` | count | Step 4 |
| 6 Outbound (retailer exit) | `go_click` | count | Step 4 (Comparison→Exit CTR) |

Off-funnel: **Zero-result** = `event_type='no_answer'` (numerator: `no_answer`, denominator: Search). **Errors** = `event_type='error'`. **Reformulation** is not currently instrumented as a distinct event — UNAVAILABLE (would require correlating consecutive `search` events per session within a short window; not built, noted as a future lever if unmet-demand analysis needs it).

All conversions computed **event-level** (matches `tps:usage`) for the funnel table; a **session-level** view (what fraction of sessions that searched also exited) is shown separately, matching the existing A/B-arm methodology.

## Commerce (retailer exit + affiliate)

| Metric | Definition | Source | Confidence |
|---|---|---|---|
| **Retailer outbound clicks** | Rows in `outbound_clicks`, `is_test=false`, in period. | `outbound_clicks` | CONFIRMED |
| **Affiliate click (sub_id)** | Every outbound click already carries a generated `sub_id` — this is the join key for reconciliation, not a separate count. | `outbound_clicks.sub_id` | CONFIRMED |
| **Ordered / Shipped / Cancelled / Returned items** | From imported affiliate reports only (see `AFFILIATE_RECONCILIATION_CONTRACT.md`). | `affiliate_conversions` | UNAVAILABLE until first report import |
| **Pending / Confirmed / Paid commission** | Same — affiliate-network-reported states, never inferred. | `affiliate_conversions` | UNAVAILABLE until first report import |
| **Unmatched conversion amount** | Sum of imported conversion rows that could not be matched (EXACT/PROBABLE) to an `outbound_clicks` row. | `affiliate_conversions` | UNAVAILABLE until first report import |
| **Click→Order / Click→Shipped rate, Commission per 100 clicks** | Derived once conversions exist. Never computed against an unmatched or partial report. | Derived | UNAVAILABLE until first report import |

## Trust / data-quality

| Metric | Definition | Source |
|---|---|---|
| Quarantined price count | Existing price-truth gate (ADR-211) — surfaced by reference, not recomputed here. | `src/lib/intelligence` price-truth path |
| Tracking-stopped alert | No `usage_events` row in the last N hours (default 6h). | `usage_events` |
| go_click vs outbound_clicks divergence | `count(event_type='go_click')` in `usage_events` vs `count(*)` in `outbound_clicks` for the same window — these should track closely; a widening gap means one pipe is dropping events. | Both tables |
| Amazon tag present | `stores.affiliate_config` for the `amazon` store slug has a non-null tag matching the current rotation (`tawveeri0f-21` per ADR-212). | `stores.affiliate_config` |

## Explicitly out of scope for this dictionary (v1)

- **Social metrics (SAFJ/SDGS)** — not defined anywhere in the existing codebase/ADRs under those names; not fabricated here. If the founder has a definition, it gets added as a follow-up, not guessed.
- **Revenue in SAR** — `outbound_clicks` and `usage_events` carry no price at click time reliably enough to sum as "sales value" without the affiliate report; any SAR figure before reconciliation exists would be a guess. Not shown.
