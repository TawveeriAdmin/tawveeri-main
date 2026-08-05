# Data Quality Contract — Founder Commerce Command Center

_Governs how the command center handles missing, delayed, or ambiguous data. Companion: [METRIC_DEFINITIONS.md](METRIC_DEFINITIONS.md), [ANALYTICS_ATTRIBUTION_AUDIT.md](ANALYTICS_ATTRIBUTION_AUDIT.md)._

## Rule 1 — Missing data is never zero

If a metric's source table has no rows for a period, or an upstream feed (affiliate report) hasn't been imported yet, the UI renders **"—"** with the confidence state and reason (e.g. `UNAVAILABLE — no affiliate report imported yet`), never `0`. A `0` must mean "counted and genuinely zero," not "couldn't measure."

## Rule 2 — TEST traffic is always separated, never blended

Every headline number is REAL-only (`is_test=false`). TEST volume (our own QA/`?test=1`/bot traffic) is shown as a secondary line, not summed in. Current split (2026-08-05 baseline): REAL sessions=36 vs TEST sessions=166 — TEST outnumbers REAL by ~4.6×, so blending would misstate the business by roughly that factor.

## Rule 3 — "Visitor" language is not used until it's true

There is no durable anonymous identity (no long-lived first-party ID beyond a session). The command center says **"sessions,"** not **"visitors"** or **"people,"** everywhere. This is a wording constraint on every card, not just documentation.

## Rule 4 — Attribution joins are labeled at the precision they actually have

- **UPDATED (ADR-214):** campaign→outbound attribution is now computed — a `go_click` event's captured UTM is joined to the matching `outbound_clicks` row by `(canonical_product_id, is_test, nearest clicked_at within 10s)`. This is a **session-level, ESTIMATED** join, never presented as a guaranteed exact per-click match, and never a person-level claim. Production-verified with a controlled TEST journey 2026-08-05 (ADR-214).
- `outbound_clicks.session_id` still exists as a column and is still unpopulated (ADR-207, unchanged) — the ADR-214 join deliberately does not need it. Do not query `session_id` on `outbound_clicks` as if it were live.
- A `go_click` with no captured UTM resolves to `utmSource: null` (**UNKNOWN** in the UI) — never `"direct"`, never folded into zero.

## Rule 5 — Affiliate match confidence is tiered and shown, not collapsed

Per `AFFILIATE_RECONCILIATION_CONTRACT.md`: every imported conversion row is classified **EXACT / PROBABLE / AGGREGATE_ONLY / UNMATCHED**. Only EXACT matches feed a per-product/per-campaign attribution claim. PROBABLE is shown labeled as probable. AGGREGATE_ONLY and UNMATCHED amounts are shown as their own line item ("₹X unmatched — cannot attribute to a specific click"), never silently folded into a retailer's confirmed total.

## Rule 6 — Freshness is on every card

Every headline card and table shows **last updated** (query time) and, where relevant, the **source's own freshness** (e.g. "Amazon report as of report period end + N days reporting delay"). A stale affiliate report is never presented next to same-day traffic numbers without a visible delay flag.

## Rule 7 — Small samples say so

Below existing thresholds already established in `tps:usage` (min 100 sessions, min 30 exits, min 50 sessions per A/B arm), the dashboard shows the raw counts plus an explicit "insufficient sample" label instead of a misleadingly precise percentage. Today's real sample (36 sessions) is below the sessions threshold — the dashboard must say so, matching the existing `tps:usage` verdict ("EARLY SIGNAL — gathering"), not invent false confidence.

## Rule 8 — Internal/founder traffic

Classification today is binary (`is_test` true/false) via the `?test=1` cookie and a bot-UA regex — there is no separate "founder/Cowork" tier distinct from TEST. If founder browsing without `?test=1` pollutes REAL counts, that's a known residual risk, not silently fixed by guessing at IP/device heuristics (would risk false-excluding real customers). Flagged here as a limitation; not solved without a deliberate, reversible identification signal (e.g. an internal-only cookie set at a known admin login), which is a follow-up decision, not assumed in this unit.

**Partial mitigation (ADR-214):** `topSessionSearchShare` surfaces what fraction of REAL search actions came from the single most active session, shown as a data-quality banner above 30%. This does not exclude or reclassify anything — it discloses concentration so the founder can judge, since we don't have evidence to distinguish "one heavy genuine user" from "unflagged internal browsing." Production example at ship time: one session was ~50% of REAL search volume over 30 days.

## Rule 9 — Historical comparability

Since `usage_events`/`outbound_clicks` schema has been stable since migration 22, period-over-period comparisons are valid back to that migration's rollout date. No claim is made about traffic before instrumentation existed.

## Rule 10 — RLS and exposure

`usage_events` and `outbound_clicks` have RLS enabled with **no policies** for `anon`/`authenticated` — only the service-role key (server-only, `src/lib/database` `createServerClient`) can read them. The command center queries them server-side only; no client-side Supabase call ever touches these tables directly. Same rule applies to any new `affiliate_reports`/`affiliate_conversions` tables.
