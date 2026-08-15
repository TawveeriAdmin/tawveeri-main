# Demand Radar — Runbook (ADR-247)

**What it is:** one loop — discover public Saudi purchase questions (Source One: X),
classify intent/category, gate on real Tawveeri answerability, rank explainably,
draft a help-first Saudi reply, surface in `/ar/admin/growth` («مرصد الطلب»),
email the founder on HIGH. **Human-in-the-loop: nothing ever auto-publishes.**

## Activation (the ONE founder action)
1. Sign in at **console.x.com** with the @Tawveeri X account → accept the Developer
   Agreement → create Project + App → copy the **App-Only Bearer Token**.
2. Load a small prepaid credit balance (pay-per-use: $0.005/post read; expected
   **$25–75/month** at our polling volume; set a hard spending limit in the console).
3. On Railway, set `X_RADAR_BEARER_TOKEN=<token>` and redeploy.
   Polling starts automatically (every `DEMAND_RADAR_INTERVAL_MIN` minutes, default 10).

## Env vars
| Var | Meaning |
|---|---|
| `X_RADAR_BEARER_TOKEN` | X app-only token. Absent = radar OFF (explicit `unconfigured` state, never a silent zero). |
| `DEMAND_RADAR_INTERVAL_MIN` | Poll interval, default 10, min 5. |
| `DISABLE_DEMAND_RADAR=1` | Kill switch. |
| `DEMAND_RADAR_CLASSIFY_MODEL` / `DEMAND_RADAR_DRAFT_MODEL` | Optional model overrides (default haiku-4.5 / sonnet-5, using the already-provisioned `ANTHROPIC_API_KEY`). |
| `FOUNDER_DAILY_REPORT_EMAIL` + `SENDGRID_API_KEY` | HIGH alert delivery (existing infra). |

## Operations
- **Manual tick:** `POST /api/cron/demand-radar` with `Authorization: Bearer $CRON_SECRET`.
  Body `{"source":"mock"}` runs the deterministic TEST batch (always `is_test=true`).
- **State:** `demand_radar_state` row per source shows last poll time/status/candidates.
  `source_unavailable`/`unconfigured` are explicit — the UI never renders them as "0 opportunities".
- **Queue:** `demand_opportunities`. Statuses: new → ready_for_review → (approved |
  changes_requested | dismissed | replied_manually); unreviewed rows expire at 48h.
- **Alert cooldown:** max 3 HIGH emails per rolling 4h (per REAL/TEST class).
- **Tracking:** each opportunity gets `tawveeri.com/r/<short>` → 302 to `/ar` with
  `utm_source=x&utm_medium=social_reply&utm_campaign=demand_radar&utm_content=dr-<short>`;
  the existing ADR-244 capture stamps the session and the exit ledger. TEST rows
  redirect with `test=1` so verification traffic stays isolated.
- **Attribution discipline (§28):** a session is CONFIRMED only when it lands via the
  `/r/` link (utm stamped). Similar searches without the link are at most
  CORRELATED_POSSIBLE — never claimed as radar results.

## Quality gates
- `tests/growth/demand-radar.test.ts` — 19 deterministic tests (prefilters, rank
  gates, claim safety, injection containment, dedup).
- `npx tsx scripts/growth/demand-radar-eval.ts` — 28-case category-balanced eval
  against the REAL classifier. Ship bar: **0 tier-ceiling violations** (verified
  2026-08-15: 0 violations, 75% category accuracy, 50% intended-tier recall —
  precision over recall by design).

## Cost control
9 balanced queries × 25 results max × 144 polls/day, `since_id` cursor + X's 24h
read-dedup → only NEW posts bill. Watch console.x.com spend; hard-limit recommended.

## Source Two condition (§33)
Only after X proves in production: real candidates arriving, HIGH precision holding
(founder dismissal rate low), some manual replies made, and ≥1 CONFIRMED visit via
`/r/`. Then evaluate **YouTube** (free quota; comments near-real-time via video
watchlist; verified 2026-08-15) — TikTok remains legitimately unavailable
(Research API is academic/EU-only; commercial listening not offered).
