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

## Scoring (live, ADR-280 → ADR-289, 2026-09-05)
`rankOpportunity()` scores tier via `scoreDecisionEvidence()`
(`decision-evidence-score.ts`) — recommendation request, explicit comparison,
budget stated, use-case stated, named competing products, urgency, replacement,
and availability-question language, NOT a bare want-verb. Backtested on 59 real
founder-labeled texts: 77.8% precision / 82.4% recall / 18 surfaced (was 27.5%
precision / 51 surfaced under the old points formula, same recall). Hard gates
(intent none, KSA not-relevant, unanswerable, unsupported category, stale/self
post, accessory question) are unchanged. Retrieval (`CATEGORY_LEXICONS`, 10
direct-want queries) is UNCHANGED and deliberately NOT widened to
recommendation-phrase language — that widening already exists, isolated, as
Shadow's `PRODUCT_RECOMMENDATION_QUERIES` experiment (see Checkpoint 5.1 below);
duplicating it into Radar 1's own live ticker would pay X twice for the same
posts before that experiment's own evidence floor is reached. See ADR-289 for
the full reconciliation record.

## Quality gates
- `tests/growth/demand-radar.test.ts` — deterministic tests (prefilters, rank
  gates, claim safety, injection containment, dedup, retrieval-scope guards).
- `tests/growth/rank-redesign-backtest.test.ts` — the real 59-item backtest
  above (live DB read; run explicitly, excluded from the fast gate).
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

**Temporal-validation run (2026-08-30, ~13:07 AST gate)** — RUN once, exact
unchanged `PRODUCT_RECOMMENDATION × {mobile, laptop, air_conditioner}` queries.
4 candidates fetched (mobile 2, laptop 1, air_conditioner 1); 1 near-duplicate
suppressed (mobile — a second near-identical copy of the same merchant-ad
template polled in the same window); 1 exclusion override applied (`ad_seller`,
on a **fresh, different repost** of the same TCL/Samsung ad template Checkpoint
5.1 was built against — confirms the detector generalizes, not just memorizes);
3 candidates left for founder review (mobile/ad_seller, laptop, air_conditioner).
Radar 1 zero-drift re-confirmed by exact before/after diff. Review-UI isolation
was empirically clean this run (0 unlabeled rows existed in either query_family
before triggering) but is **not structurally guaranteed** — `listPendingShadowReview()`
has no `query_family` filter and the admin page doesn't render it; flagged, not
fixed, per founder instruction.

**Measurement-integrity defect found and fixed (2026-08-30).** While attempting
to found­er-review the 3 temporal-validation candidates, labels weren't
persisting. Root-caused read-only: `labelShadowReview()` called
`recordShadowOutcome()`, which performs a **full-row upsert** on `fingerprint` —
every successful founder-label write was silently nulling
`exclusion`/`opportunity_score`/`answerability_status`/`tier`/`intent_type`/
`buying_stage` on that same row (the label-write payload hard-coded those to
`null`). Confirmed against production: **all 72 previously-labeled Shadow rows**
(the original 22-candidate Checkpoint 5 sample + 50 `CONTROL_PARITY_V1` rows)
lost those fields. **Core precision KPIs already reported are unaffected** — FAP/
Shadow-only precision/Recovery Rate depend only on `shadow_review_label`/
`category`/`retrieved_by_radar1`, none of which this bug touches; only
supplementary analytical fields were lost. `opportunity_score` and
`answerability_status` were confirmed recoverable from the untouched
`demand_radar_shadow_funnel_events` `replay_checked` stage (100% coverage,
72/72); `exclusion`/`intent_type`/`buying_stage` are **not** recoverable from
any retained table — permanently lost for those 72 rows. **No backfill
performed** (not authorized).

**Fix — deployed:**
- `updateShadowOutcomeReviewLabel()` (new, `shadow-funnel.ts`) — a plain
  two-column `UPDATE` (`shadow_review_label`, `shadow_reviewed_at`) scoped by
  `fingerprint`; structurally cannot touch any other column. `recordShadowOutcome()`
  itself is unchanged, still used correctly by the two run-time experiment files.
- `review_label_submitted` / `review_label_failed` added to
  `SHADOW_FUNNEL_STAGES` — de-identified request observability (fingerprint/
  category/query_family/is_test/generic detail only) on the Shadow Review PATCH
  path, so a future non-arriving or failed submission is distinguishable from a
  successful one. `submitted` means the server received AND persisted the
  label; `failed` means the request reached the server but persistence failed;
  no event means the request never arrived.
- Regression suite: `tests/growth/shadow-review-label-integrity.test.ts` (new,
  9 tests) proves — by pinning the exact `.update()` payload key-set — that a
  label write can never touch the analytical fields, that repeated/relabeling
  stays safe, that a failure can't partially mutate a row, and that the new
  funnel events carry no forbidden (personal-data) field. Full suite:
  **148/148 suites, 2454/2454 tests passing**, `tsc --noEmit`/`eslint` clean.
- Commit: `7978a2f57b4302519c2979e9858a192405e314ff`. Railway deployment:
  `a515384c-aea5-43d8-86de-50ec5ff0333b` (service `tawveeri-main`, production).
  Clean boot verified, `GET /api/health` → 200. Deployed commit hash confirmed
  via Railway's own deployment metadata to exactly match `HEAD`.
- Post-deploy, read-only confirmed: the 3 temporal-validation candidates remain
  unlabeled; all 72 historical rows unchanged (original Checkpoint 5 label
  distribution still exactly `valuable:13 / not_a_lead:8 / exclusion_noise:1`);
  `review_label_submitted`/`review_label_failed` event count = 0 (**zero
  production review events have occurred since deployment** — no labeling was
  attempted per founder instruction); Radar 1 state/counts show only its own
  independent, healthy scheduler activity, untouched by this deploy.

**Status: the fix is deployed and test-verified, but not yet founder-validated
end-to-end in production** (no real founder label has gone through the fixed
path yet). No historical backfill. No new X poll performed. Radar 1 untouched.
**Checkpoint 6 remains blocked.**

### Label-integrity gate — PASSED (2026-08-30)

The founder labeled all 3 temporal-validation candidates through the
production Shadow Review UI. Full read-only verification passed all 6 gates:
exactly 3 `review_label_submitted` events (0 `review_label_failed`), all 3
labels persisted against the correct candidate IDs, `shadow_reviewed_at`
populated correctly, pre-existing analytical metadata byte-for-byte
unchanged after labeling, zero unrelated Shadow rows touched. Founder labels:
air_conditioner `b8f16296…` → `valuable`, laptop `9aff4ac5…` → `valuable`,
mobile `9a6e9927…` (the ad_seller override) → `not_a_lead` (confirms the
override's judgment in substance).

**KPIs computed for this n=3 batch** (kept analytically separate from the
original 22-candidate Checkpoint 5 sample throughout): FAP 66.7% (2/3),
Shadow-only recovery 2/2 confirmed-valuable-and-net-new (recorded only as
"2/2 founder-confirmed valuable candidates were Shadow-only" — **not** a
stable Missed Opportunity Recovery Rate; that formal KPI stays unconfirmed
until the evidence floor is reached), the ad_seller override's exclusion-class
judgment agreed with the founder's label, zero legitimate-intent-regression
evidence. **n=3 is far below the ≥30 evidence floor — none of these numbers
are stable estimates.** Decision: **CONTINUE TEMPORAL VALIDATION** (not
ROLL BACK, not SUFFICIENT EVIDENCE TO ADVANCE — the rules leave exactly one
answer at n=3).

### Near-duplicate suppression audit — approved, built, deployed (2026-08-30)

Suppressed near-duplicates were previously unmeasurable (never reached
founder review). Adds a capped (5/run), deterministically-selected (sorted
by identity fingerprint, not arrival order) audit sample into Shadow Review,
tagged `PRODUCT_RECOMMENDATION_SUPPRESSION_AUDIT` — analytically isolated by
construction (distinct `query_family` excludes these from every primary-track
KPI query; never counted toward the ≥30 evidence floor; never touches
`demand_opportunities`/email/draft). No LLM classification call for audit
rows — category comes from the query spec that matched the suppressed
candidate, domain is always `product` for this family, both free. Production
near-duplicate suppression itself is byte-for-byte unchanged. 16 new tests
(`shadow-suppression-audit.test.ts`), full suite 149/149 suites passing.
Commit `955a1611a73ead683b2d1423897ff4efdec95256`, Railway deployment
`3ca9c86c-6824-4b5f-9c56-b3ff6a6d3253` — clean boot, `/api/health` → 200,
deployed commit hash confirmed to match `HEAD`. **Not yet exercised by a
real near-duplicate in production** — deployed and ready, zero audit rows
exist yet.

### Continuation observation log

- **2026-08-30, ~14:49 UTC — zero-yield run, valid observation.** First
  production run with the suppression-audit path deployed. All 3 category
  requests (mobile, laptop, air_conditioner) returned HTTP 200; **zero
  matching posts returned** (`totalPolled: 0`). No X errors, no rate/quota
  issue, `stoppedEarly: false`. This is a **valid temporal observation, not
  a failed run** — per the locked rule, zero yield is expected sparse-window
  behavior, not evidence of anything wrong. Read-only confirmed: Radar 1
  completely unaffected (all Phase 1 counts identical before/after); no
  unexpected write anywhere; `x-shadow-recommendation-v1`'s cursor unchanged
  (nothing new to advance past), only `last_poll_at` updated. **No evidence
  threshold changed as a result of this run** — queries, categories, scoring,
  thresholds, and sampling were not altered based on this single zero-yield
  result, per standing instruction.

### Current state (2026-08-30, latest)

- Primary founder-reviewed evidence: **3/30**.
- Suppression-audit candidates reviewed: **0** (mechanism deployed, not yet
  exercised).
- Radar 1: unaffected throughout.
- **Checkpoint 5.1 decision: CONTINUE TEMPORAL VALIDATION.**
- **Checkpoint 6 remains blocked.**

### Locked next action (do not alter without new founder approval)

Continue the same daily-cadence manual trigger of the unchanged
`PRODUCT_RECOMMENDATION × {mobile, laptop, air_conditioner}` experiment —
same queries, same Checkpoint 5.1 exclusion rules, same near-duplicate logic,
same suppression-audit sampling, same Shadow isolation boundaries — until
**≥30 founder-reviewed primary candidates AND ≥1 week of observation**,
whichever is later, is reached. After each run: capture a read-only
before/after baseline, report the primary track and suppression-audit
results **separately** (never pooled), do not compute FAP/Shadow-only
precision/Recovery Rate for any new candidates until founder review of
those specific candidates is complete, and do not alter queries, categories,
scoring, thresholds, or sampling based on any single run's yield — zero or
otherwise. No Checkpoint 6. No widening.
