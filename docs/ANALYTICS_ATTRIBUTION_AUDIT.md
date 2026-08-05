# Analytics & Attribution Audit

_Audit date: 2026-08-05. Read-only, repo + production (`vyceqrzttspyycdpojtn`) evidence only. Companion to [ADR-213](DECISIONS.md), [METRIC_DEFINITIONS.md](METRIC_DEFINITIONS.md), [DATA_QUALITY_CONTRACT.md](DATA_QUALITY_CONTRACT.md)._

## What already exists (do not rebuild)

| Capability | Where | Status |
|---|---|---|
| Event capture (`usage_events`) | `scripts/database/22-usage-events.sql`, client tracker `src/lib/analytics/track.ts` | Live. `event_type, session_id, is_test, category, query_text, canonical_id, store, source, meta jsonb, created_at`. RLS on, **no policies** — service-role only, not anon/authenticated-readable. |
| Exit capture (`outbound_clicks`) | `src/app/go/[offerId]/route.ts:83-98` | Live. Records `offer_id, canonical_product_id, store_name, destination_url, affiliate_program, affiliate_tag, sub_id, source, is_test, referrer` on every `/go` redirect. Per-click `sub_id` already generated (ADR-085) for future conversion matching — nothing consumes it yet. |
| UTM capture | `src/lib/analytics/campaign.ts` (ADR-207) | Live. Captured into `sessionStorage`, merged into `usage_events.meta` at event time. **Not** joined into `outbound_clicks` — deliberate (ADR-207), see gap below. |
| Full customer funnel + KPI gate | `scripts/tps-analysis/usage-report.ts` (`npm run tps:usage`) | Live, CLI + `docs/BETA-FUNNEL.md` artifact only — **no live UI**. Computes Search→Results→Product View→Comparison→Evidence→Outbound, REAL/TEST split, per-surface (web/agent), A/B arm comparison, top/unmet demand, launch-readiness gate. This is the correct source of SQL truth for the funnel — ADR-213 lifts it into a live dashboard rather than re-deriving. |
| Test/bot exclusion | `is_test` column both tables, `?test=1` cookie, bot UA regex | Live and reliable — reusable as-is. |
| Amazon affiliate tag config | `stores.affiliate_config`, edited at `/admin/affiliate`, consumed by `src/lib/providers/link.ts` | Live. Current tag `tawveeri0f-21` (ADR-212). `ascsubtag=<sub_id>` wired. |
| Provider/exit framework | `src/lib/providers/` (`buildOfferExitLink`) | Live, single exit path (ADR-085/089). |

## What does not exist (greenfield)

1. **No affiliate report ingestion of any kind** — no CSV importer, no report table, no commission-state tracking. `outbound_clicks.sub_id` is the only hook available to match against.
2. **No metric-dictionary or data-quality-contract docs** — none of `ANALYTICS_ATTRIBUTION_AUDIT.md` (this file), `METRIC_DEFINITIONS.md`, `DATA_QUALITY_CONTRACT.md`, `FOUNDER_COMMERCE_COMMAND_CENTER.md`, `AFFILIATE_RECONCILIATION_CONTRACT.md` existed before this unit.
3. **No live founder-facing dashboard** — `/admin/analytics` exists but queries `users`/`stores`/`transactions` (a different, older concept), not `usage_events`/`outbound_clicks`. The beta funnel logic in `usage-report.ts` was never surfaced in the admin UI.
4. **No anomaly/alert layer, no forecasting, no AI founder brief.**

## Known attribution gaps (carried into the data-quality contract, not silently fixed)

- **UTM does not survive to `outbound_clicks`.** ADR-207 explicitly chose not to wire `outbound_clicks.session_id` for this join, reasoning it wasn't needed yet and avoided widening what a click event correlates to. This audit does **not** overturn that decision — it's noted as a live limitation. Campaign→exit attribution is currently only inferable via session_id + timestamp correlation in `usage_events` (`go_click` event), which already carries `meta` (including `variant`) — sufficient for the funnel, not for a hard per-click UTM join in `outbound_clicks`.
- **No persistent visitor identity.** `session_id` is a session-scoped identifier (client-generated, likely per browser session), not a durable person-level ID. "Real visitors" and "unique people" are not the same claim — see `METRIC_DEFINITIONS.md` for the honest wording.
- **Production event volume is TEST-dominated.** Live pull today: REAL sessions=36, REAL search=489, REAL outbound=49 vs TEST sessions=166, TEST search=2,557. Any dashboard must default to REAL-only and label the TEST volume, or it materially overstates traffic.
- **`answer_rate` is currently failing its own launch gate** (44.4% vs an 80% threshold) — a real, currently-open product-quality signal, not a tracking defect. Out of scope for this unit (no reopening of closed incidents), but the command center must surface it, not hide it.

## Existing docs already covering adjacent ground (not duplicated by this unit)

- `docs/AFFILIATE-ENROLLMENT.md`, `docs/AFFILIATE-FRAMEWORK.md` — merchant onboarding/config, not reconciliation.
- `docs/BETA-FUNNEL.md` — the durable re-generatable snapshot from `tps:usage`; the live dashboard reads the same tables, doesn't replace this artifact.
