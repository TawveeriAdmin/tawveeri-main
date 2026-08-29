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

---

## Radar 2.0 Phase 2 — Shadow Discovery: checkpoint state (2026-08-29)

**Read this section first if you are a fresh Claude Code session resuming this work
with no conversation history.** It is a state checkpoint, not a directive — normal
`CLAUDE.md` precedence still applies. Everything above this line is Phase 1's
original runbook, unchanged.

**Phase 1 (four-axis taxonomy, funnel observability, decoupled Opportunity Score,
privacy-safe fingerprinting)** — DONE, deployed, founder-verified in production
(manual dismiss-click + read-only checks all passed). No changes since.

**Phase 2 Checkpoints 1–4 (Shadow isolation foundation, review queue, replay
function, control-parity baseline)** — DONE, deployed. Shadow writes only to
`demand_radar_shadow_funnel_events` / `demand_radar_shadow_outcomes` /
`demand_radar_shadow_review_queue` — physically separate tables, own
`demand_radar_state` rows (`x-shadow-control-parity`, `x-shadow-recommendation-v1`),
proven via static reference tests + live cross-table + drop-and-diff tests. Radar 1's
own tables/state/logic have never been written to by any Shadow code.

**Checkpoint 5 (widened experiment: `PRODUCT_RECOMMENDATION × {mobile, laptop,
air_conditioner}`, X Developer Console prerequisite founder-waived)** — RUN once,
22 candidates, all founder-reviewed via the admin Shadow Review UI. Results:
FAP 59.1% (13/22 valuable), Shadow-only precision 55.0% (11/20 net-new), Missed
Opportunity Recovery Rate 84.6% (11/13 valuable were Shadow-only), mobile precision
36.4% (4/11), laptop precision 80.0% (8/10), duplicate rate 18.2% (4/22 — one
merchant-ad template reposted 4×, 2 copies inconsistently labeled `valuable` by the
founder vs. 2 labeled `not_a_lead`). **Founder decision: MODIFY — do not promote,
do not proceed to Checkpoint 6.**

**Checkpoint 5.1 (precision-fix pass)** — IMPLEMENTED, TESTED, DEPLOYED. Adds, as
new Shadow-local files only (zero Radar 1 / retrieval / category / query changes):
- `src/lib/growth/demand-radar/shadow/shadow-exclusion.ts` — 6 active deterministic
  exclusion overrides (merchant-ad comparison bait ≥2-of-5 signals, owned-device,
  decision-already-made, migration/support co-occurrence, news/narrative anecdote,
  carrier/SIM-not-device), each traced to a real Checkpoint 5 false positive.
- `src/lib/growth/demand-radar/shadow/shadow-dedup.ts` — within-run near-duplicate
  suppression (normalize URL/hashtag/mention/emoji away, reuse the existing
  privacy-safe HMAC fingerprint mechanism on the normalized text). Cross-run
  near-dup detection is NOT built (would need a persisted content-fingerprint
  column; no migration authorized).
- **`isContextPoorReply` is implemented but deliberately DISABLED from the active
  override chain** — not called from `applyShadowExclusionOverrides()`. The one
  real founder-rejected ambiguous case in the sample
  (`"@SaudiAndroid طيب وش افضل جالكسي من ناحيه الاستخدام والسعر"`) turned out to be
  an implicit-antecedent problem (needs the parent tweet to know which Galaxy
  models are being compared), not a short-reply-length problem, and a
  structurally identical implicit-antecedent case was labeled `valuable` by the
  founder — no non-speculative textual rule separates them. Explicitly deferred
  to a future, not-yet-approved **Context Resolver** checkpoint.
- Regression-tested against all 22 real founder-reviewed Checkpoint 5 texts (not
  synthetic data) — this caught and fixed a real bug during testing: `"شاري"`
  (owned-device form) is a substring of `"المشاريع"` ("projects"), false-firing
  on both AutoCAD-laptop `valuable` posts; fixed via whole-token matching.
- Commit: `7b167a1dc1267747a365408043e25be8f78d9b23` (pushed to `origin/main`).
- Railway deployment: `f0e10c98-2f49-47a2-b52a-f04640a311b5` (service
  `tawveeri-main`, production). Clean boot verified (no crash, no new errors —
  one pre-existing unrelated warning: `scraping_schedules` migration-16 drift).
  `GET /api/health` → 200.
- Full test status: **147/147 suites, 2445/2445 tests passing**; `tsc --noEmit`
  and `eslint` clean on every changed/new file.
- **First post-deployment temporal-validation run: 0 candidates.** Triggered
  ~1.5 hours after Checkpoint 5's last poll (`since_id` cursor barely advanced
  the window) — all 3 category fetches returned HTTP 200 with zero new posts.
  This is a valid result (no X errors, no rate/billing issue) but **non-informative
  for precision evaluation** — too small an observation window, not a failure.
  Radar 1 zero-drift confirmed by exact read-only before/after diff: `x` source's
  `demand_radar_state` cursor/`last_poll_at` unchanged; `demand_radar_funnel_events`
  53→53, `demand_radar_outcomes` 16→16, `demand_opportunities` 14→14 — only the
  `x-shadow-recommendation-v1` row's `last_poll_at` advanced.

**No Checkpoint 6 authorization exists.** Do not widen retrieval, add a category,
or add a query family without a fresh, explicit founder go-ahead.

### Locked next action (founder-approved 2026-08-29 — do not alter without new approval)

**On or after 2026-08-30 ~13:07 AST**, manually trigger exactly ONE new temporal-
validation run: `POST /api/cron/demand-radar-shadow-recommendation` (Bearer
`CRON_SECRET`, body `{"isTest": false}`) — the exact current, unchanged
`PRODUCT_RECOMMENDATION × {mobile, laptop, air_conditioner}` queries, the exact
current Checkpoint 5.1 exclusion rules and near-duplicate logic, the exact current
Shadow isolation boundaries. No query widening, no category expansion, no Radar 1
changes, no Shadow emails, no Checkpoint 6. The prior session-only scheduled cron
job for this was cancelled — this must be triggered manually.

**Locked evaluation rules (do not alter after seeing results):**
- Retrieval health: any non-zero count is acceptable evidence; zero again is not
  failure, just an still-sparse observation window.
- Shadow-only precision target ≥70% (≥80% = strong result; <60% = MODIFY again).
- The precision improvement must NOT come from suppressing genuine recovered
  purchase-intent patterns — specifically: university/major-specific laptop
  recommendations, CS/design/engineering use cases, iPad-vs-laptop/MacBook
  decisions, genuine «وش أفضل / إيش أفضل / وش تنصحوني / محتار بين» questions. If
  these disappear, that is a regression even if precision goes up.
- Report, specifically, whether Checkpoint 5.1 reduced: merchant/ad comparison
  bait, owned-device/post-purchase support, already-ordered decisions,
  migration/support questions, news/generic conversation, carrier/SIM ambiguity,
  near-duplicate promotional posts.
- Sample-size floor unchanged: do NOT promote from one small temporal run —
  promotion evidence floor is ≥30 founder-reviewed candidates AND ≥1 week of
  observation, whichever is later. Until then, all results are preliminary.
- Do NOT compute FAP / Shadow-only precision / Recovery Rate for the new sample
  until founder review of those specific new candidates is complete.
- The original 22-candidate Checkpoint 5 sample and any new temporal-validation
  sample remain analytically separate — never merged.
- Promotion requires, at the evidence floor: Shadow-only precision ≥70%, no
  material regression in legitimate recovered intent, Missed Opportunity Recovery
  materially positive, false-positive patterns controlled (not just hidden by
  lower volume), acceptable X cost/rate behavior. Otherwise: MODIFY if recovery
  remains valuable but precision is below target; KILL only if widened retrieval
  repeatedly fails to recover meaningful incremental value.

**After the next run, report exactly:** (1) total fetched (2) exclusion overrides
by reason (3) near-duplicate suppressions (4) remaining founder-review candidates
(5) Radar 1 overlap vs Shadow-only (6) category breakdown (7) legitimate-intent
regression evidence (8) zero Radar 1 drift confirmation (9) X errors/rate/billing
status. Then stop for founder review — do not proceed to Checkpoint 6, do not
widen another family.
