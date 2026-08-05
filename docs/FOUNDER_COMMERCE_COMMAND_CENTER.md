# Founder Commerce Command Center — Architecture

_Decision record: [ADR-213](DECISIONS.md). Metric definitions: [METRIC_DEFINITIONS.md](METRIC_DEFINITIONS.md). Data-quality rules: [DATA_QUALITY_CONTRACT.md](DATA_QUALITY_CONTRACT.md). Affiliate design: [AFFILIATE_RECONCILIATION_CONTRACT.md](AFFILIATE_RECONCILIATION_CONTRACT.md)._

## Decision: reuse, don't rebuild

The existing stack already has everything needed: `usage_events` + `outbound_clicks` (append-only, RLS-locked), the Provider/`/go` exit framework, and — critically — `scripts/tps-analysis/usage-report.ts` already computes the exact funnel/KPI logic the founder asked for. It just isn't a live UI. The build is:

1. **Lift, don't re-derive**, the funnel/KPI SQL into `src/lib/admin/command-center-queries.ts`, add period filtering (today/yesterday/7d/30d/custom — the CLI version is all-time only).
2. **New admin route** `/admin/command-center` — server component, same auth gate as every other admin page (`requireAdmin()` in the shared admin layout), same visual system as `/admin/dashboard`.
3. **New schema, additive only**: `affiliate_reports` + `affiliate_conversions` (migration 30) for the reconciliation layer. Nothing existing is altered.
4. **No new infrastructure.** No new service, no cron, no queue. Queries run on page load against the existing Postgres via the existing service-role client, same pattern as `getDashboardKPIs()`.

## Tools evaluated, decision, and why (Section 3 research)

| Tool/category | Decision changed? | Why not |
|---|---|---|
| PostHog / Mixpanel / Amplitude | **NO** | Would become a second, competing source of truth for the exact events `usage_events` already captures append-only; recurring cost; data leaves Supabase (residency/PDPL question) for zero net new capability at current traffic (36 real sessions/day-ish). ADR-120 already made and validated this call — reaffirmed, not re-litigated. |
| Metabase / Looker / Power BI | **NO** | Solves "query my Postgres and chart it" — which a ~150-line Next.js page already does, with founder-specific KPI logic (launch gate, A/B arm, unmet-demand) these tools don't know natively. Extra service to host/secure/maintain for less-tailored output. |
| GA4 | **NO** | Session/attribution model doesn't match this app's identity-light, RLS-governed model; would need its own consent/privacy review; duplicates `usage_events`. |
| Amazon Associates official reporting (CSV export) | **YES — build the import path** | This is the actual commercial source of truth Amazon reports don't have a public API for small publishers; CSV is the only permitted route without a business-development relationship. Confirmed via Amazon Associates help docs: reports are CSV/XML-exportable from Associates Central; no documented self-serve API for this account tier. |
| Stripe-style dashboard, affiliate SaaS platforms (e.g. commission trackers) | **NO** | Paid, and the only two states this business currently monetizes through (Amazon confirmed, Noon config-only per ADR-181) don't justify a subscription; the reconciliation logic needed (tiered match confidence against `outbound_clicks.sub_id`) is bespoke either way — a generic tool wouldn't understand our click ID. |
| LLM-generated "Founder Brief" | **DEFERRED, not rejected** | At 36 real sessions, a narrative daily summary would mostly restate noise as insight. Section 10 of the mandate itself says not to build forecasting before data supports it — same logic applies to narrative anomaly explanation. The deterministic launch-readiness gate (already in `tps:usage`, now live in the dashboard) **is** the "what needs attention" signal for now. Revisit once REAL sessions clear the existing 100/30 thresholds with some consistency. |

**Total new recurring cost: $0.** Everything runs on already-provisioned Supabase/Railway capacity.

## What's live after this unit

- `/admin/command-center` — headline cards (sessions, funnel steps, outbound, launch-gate verdict), time-period filter, by-surface breakdown, top/unmet demand, REAL/TEST split always visible.
- `affiliate_reports` / `affiliate_conversions` schema + CSV import UI at `/admin/affiliate` (Amazon Reports tab) — column-mapping importer (see reconciliation contract for why it's mapping-based, not a hardcoded Amazon column list), idempotent via file checksum. **Cannot be exercised end-to-end without a real exported report** — see reconciliation contract's stop boundary.

## What's explicitly deferred (and why that's the right call, not a shortfall)

- Forecasting — data volume doesn't support it yet (mandate's own rule).
- AI founder brief / natural-language querying — same reasoning; the metric dictionary + dashboard has to be trustworthy and used first.
- Alerting delivery (Slack/email/push) — no delivery channel was authorized in this unit; the data-quality signals (Rule 2/6/8 in the contract) are computed and shown as in-dashboard banners, not pushed anywhere, until the founder picks a channel.
- Noon reporting — ADR-181 confirmed Noon's real tracking params but there's no confirmed live Noon Associates-equivalent report access; not built on an assumption.
