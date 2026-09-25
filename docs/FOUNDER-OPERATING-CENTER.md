# Founder Operating & Decision Center — unified specification

**Status:** v1 shipped 2026-09-25 (ADR-383). Route: `/ar/admin/founder`. Supersedes the review-only
study in `docs/report/FOUNDER-DECISIONS-PROPOSAL-2026-09-25.md` as the implemented contract; the
study's metric semantics are preserved verbatim (`S01..S08`, `Q01..`, `D01..`).

## 1. Purpose

Open one Arabic surface and answer, without technical translation or manual cross-page sums:
*How much qualified audience did we observe? What does it want? Did we serve it correctly? Which
store did it exit to? What did the partner prove? What did we spend, earn and collect? Are we on
this month's goal? What is the next decision?*

## 2. Non-negotiables (carried from the study, the audit and the Constitution)

1. **Unknown beats incorrect.** A missing partner report is «غير معلوم», never 0. A failed query is
   «غير متاح», never 0. Every number carries its definition version, window, source and coverage.
2. **A browser id is not a person.** `tw_sid` is a persistent browser identifier. No IP-as-person,
   no fingerprinting, no login requirement for browsing, no "human=true" inferred from
   `is_test=false`.
3. **Proof stages stay separate.** recorded click (usage_events) ≠ matched `/go` row
   (`first_party_interactions ⋈ outbound_clicks`) ≠ merchant-reported arrival (not available) ≠
   partner order ≠ pending/confirmed/cancelled/paid commission.
4. **Numbers are computed by code, never by a model.** The AI layer only explains, hypothesises and
   proposes ONE experiment, over a fact pack it cannot alter; any number in model output that is
   not in the pack rejects the whole response and the deterministic summary stands.
5. **Founder money is not revenue.** Annual payments are shown as cash on the paid date AND as
   period cost pro-rated over the service period. This is a management ledger, not statutory books.
6. **Additive, reversible, audited.** Every ledger row is soft-deleted, versioned and mirrored into
   `founder_ledger_audit`; imports are checksum-deduplicated; goals keep an append-only revision log.
7. **Ranking and affiliate links are untouched.** The center reads; it never changes catalogue,
   ranking or exits.

## 3. Computation authority

| Layer | Where | Notes |
|---|---|---|
| Metric definitions | `src/lib/founder/registry.ts` (`DEFINITION_VERSION`) | id, unit, proves / not-proves, confidence |
| Journey/audience SQL | `scripts/database/58-founder-operating-center.sql` — `founder_window_metrics`, `founder_query_demand`, `founder_product_demand`, `founder_store_funnel`, `founder_store_go_clicks`, `founder_daily_series` | Verified equal to the frozen study window: 637 / 91 / 80 / 4 / 204 / 116 / 12; 7d 53 / 45 / 5 |
| Finance | `src/lib/founder/finance.ts` | cash vs accrual, FX only when documented, coverage state |
| Goals / scenarios | `src/lib/founder/goals.ts` | status = achieved / on_track / behind / not_judgeable |
| Snapshots | `founder_metric_snapshots` via `src/lib/founder/snapshots.ts` | daily 06:15 Riyadh, last 7 days recomputed for late events |
| Summaries | `src/lib/founder/summary.ts` | deterministic pack → optional AI explanation → validation |
| Independent check | `docs/evidence/founder-decisions-2026-09-25/metric-queries.sql` | same semantics, hand-written, run read-only |

## 4. Windows

Riyadh calendar (UTC+3, no DST), half-open `[start, end)`. Kinds: `day` (previous completed day),
`7d` / `30d` (rolling, partial), `month` (month-to-date, partial), `custom`. Comparisons are only
against the **equal-length immediately preceding window**; a partial window is labelled partial.

## 5. Surfaces (all under `/admin/founder`)

| Page | Answers | Primary sources |
|---|---|---|
| `/` نظرة القرار | month result, biggest gap, next decision, 8 cards, data quality | pack + finance + goals |
| `/audience` الزوار والعملاء | browsers, visits, new/returning, intent, channels, entry types, daily series, exclusions | `founder_window_metrics`, `founder_daily_series` |
| `/demand` المنتجات والاحتياجات | need → query → sessions/events/concentration/results/exit; product groups behind linked exits, model-mix check, freshness | `founder_query_demand`, `founder_product_demand`, catalog tables |
| `/referrals` المتاجر والإحالات | proof stages by store × channel × campaign; partner orders/commissions by state; coverage | `founder_store_funnel`, `founder_store_go_clicks`, affiliate tables, revenue ledger |
| `/expenses` المصروفات | add / edit / CSV import; totals since start, month, today, due, by category/tool/campaign, budgets | `founder_expenses`, `founder_budgets` |
| `/revenue` الإيرادات والعمولات | manual entries with evidence, partner imports (existing `/admin/affiliate`), states, coverage | `founder_revenue_entries`, `affiliate_*` |
| `/goals` الأهداف الشهرية | goals with baseline, target, progress, status, revision log; three scenarios or the inputs they need | `founder_goals`, `founder_settings.scenario_inputs` |
| `/summary` الملخص | previous-day summary, month report, generate on demand | `founder_summaries` |
| `/reports` التقارير | founder / store / investor exports (HTML print + JSON/CSV) with period, extraction time, sources, definition version, limits | all of the above |

## 6. Journey linking (opportunity 3)

`track()` mints a `query_id` on every `search`/`advisor_query`, keeps it in `sessionStorage`, and
attaches `meta.query_id` to later `results`, `no_answer`, `product_view`, `comparison_view`,
`alternative_view`, `go_click`, `category_go_click`, `evidence_view` events; `results` also carry
`meta.result_set_id`. `recordFirstPartyInteraction()` sends the same `query_id`, stored on
`first_party_interactions.query_id`. History is never backfilled; S02/S04/S06 keep the 30-minute
temporal association until a query_id-based definition version has an overlap baseline.

## 7. Automation

`tawveeri-worker` job `founder_daily` (hourly tick, self-gated) calls
`POST /api/cron/founder-daily` (Bearer `CRON_SECRET`): after `summary_hour_riyadh` (default 08:00)
it snapshots yesterday + rolling windows, recomputes the last 7 days, and writes the daily summary
once. On the first tick of a month it also writes the previous month's report. No external send.

## 8. What the founder must still provide

Partner exports (Amazon Associates, Noon) with period and state columns; historical expenses (CSV
or manual); founder funding amounts; scenario inputs (commission per linked exit, acquisition cost)
once partner data exists. Merchant-side arrival confirmation is not obtainable from `/go`.
