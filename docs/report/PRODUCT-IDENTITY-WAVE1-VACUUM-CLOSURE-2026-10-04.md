# Wave 1 — Vacuum closure (2026-10-04)

> **File name note.** The brief named this report `…-2026-10-06.md` (end of the 48 h window). The soak ended **early, on a mechanical rollback trigger, at 2026-10-04 14:16 UTC** (≈ 4 h after the web gate went live at 10:20Z), so the report is dated the day it was decided. The 48 h soak was **not** completed; the verdict below rests on integrity evidence, not on a finished soak.

## 1. Executive verdict — **ROLLBACK** (executed 2026-10-04 14:16Z; stands after the founder's review)

`TPS_IDENTITY_GATE` was set to `off` on `tawveeri-worker` and `tawveeri-main`; the isolated runner stays on (signals keep being computed, the scoped projection is rebuilt ungated at its next cycle). TV had been rolled back at 10:15Z for the same class of defect.

**Why — amended after the founder's own review of all 32 family-only groups (gold; completed 2026-10-04 14:2x UTC).** The rollback was triggered at 14:16Z by two blind AI reviewers who agreed on 5 "different device" groups. The founder's answers **do not support that count**: of the 32 family-only groups he labelled **24 exactly the same device, 6 same-family-not-enough-evidence, 1 unsure and 1 different device (V14)**. The rule is that one confirmed false merge is sufficient, and there is one: **V14 — Panasonic 6 L / 1900 W red canister, Extra (page mpn `MC-CG711RY47`, Deluxe series) vs Noon (`MC-CJ911RY47`, Premium series)**, a live comparison presenting two different models as one. The rollback therefore **stands**, on a much smaller and different basis than first reported: the "5 confirmed false merges" in the 14:16Z decision were an AI-reviewer consensus the founder's review did not confirm and are **withdrawn as a count** (see §3 for the disagreements, two of which conflict with codes anyone can check).

**What the rollback does and does not do — stated because it is not obviously beneficial.** The gate did what it was built for: it removed **2 comparisons** and **4 lowest-price claims** that rested on listings the verifier had flagged (Hitachi `CV-965NBLGSA` vs `CV-960F`, Panasonic `MC-YL620KY47` vs `MC-YL690GY47` …), and changed **no** cheapest merchant. Rolling back **re-exposes those 2 comparisons and 4 claims**, and does **not** remove the one confirmed false merge (V14), which exists at baseline too and is invisible to the verifier (its decisive evidence — Extra's mpn — is not in our payload). With the founder's labels the remaining exposure is **uncertainty, not demonstrated harm**: 6 + 1 of 56 verified groups are unproven as exact. Re-enabling the gate is one variable (`TPS_IDENTITY_GATE=vacuum` on both services); whether to re-gate now or after the Extra mpn fix is the founder's decision (§9).

## 2. Operational reliability

Actual runner cycles (the isolated `identity_gate` job; manual health checks are **not** counted):

| # | UTC | mode | steps | core / total | note |
|---|---|---|---|---|---|
| 1 | 06:57:52 | shadow (signals only) | 1/1 | 13.6 s job | 56 signals written, projection byte-unchanged |
| 2 | 08:45:25 | shadow | 1/1 | 17.9 s job | 4 rows rewritten (a store's listing in a Hitachi canonical changed) |
| 3 | 10:12:05 | gated (signals + scoped projection) | 2/2 | **29.2 s** (14.6 s projection) | first gated cycle; no monitor step yet |
| 4 | 13:08:58 | gated + monitor | 3/3 | **63.4 s** total | first persisted monitor row (`tps_identity_wave_log` #4, HEALTHY) |
| 5 | 14:08:56 | gated + monitor | 3/3 | **64.1 s** total | row #5, HEALTHY; the last gated cycle |

* **Runs 5 / successes 5 / failures 0.** Runtime metrics are **not comparable across rows**: 29.2 s is the two core steps (signals + projection) only; 63–64 s is the whole three-step job including the monitor (≈ 34 s of surface sampling and scans). With n = 5 and three different job shapes, **p50 / p95 are not meaningful**; only min / max / last per shape are reported (signals-only 13.6–17.9 s, two-step 29.2 s, three-step 63.4–64.1 s).
* **Signal age.** Gaps between successful runs: 108, 87, **176 (2.94 h)**, 60 min. **Near-miss events (> 2.5 h): 1** (10:12 → 13:08, 2.94 h). **Stale events (> 3 h): 0.** The persisted rows record the 2.94 h figure; the monitor's `SCHEDULING_MARGIN_WARNING` (> 2.5 h) as a live warning was **not** implemented during the soak (no behaviour change allowed) — the near-miss is derived from the persisted gaps.
* **Cause of the near-miss — both contributed.** (a) *Restarts*: three deploys (10:16, 10:55, 12:05) reset the 60-minute interval timers, and a boot-kick skips a job whose last success is < 48 min old. (b) *Single-consumer queue*: after the 12:05 restart `discovery` took the slot first (≈ 60 min) and `identity_gate` waited behind it; it is served first among queued jobs but never preempts. Without my own deploys the designed worst case is ≈ 135 min (cycle + longest job in flight). **Isolating the runner into its own service is not justified by this data** — the SLO held (age ≤ 3 h) and the pressure came from my restarts; it remains the next operational improvement if the pattern recurs under normal operation.
* **Kill switch** proven 2026-10-04 08:49Z (worker logged `identity_gate disabled`, did not schedule).
* **Unrelated jobs:** the broad `refresh` chain was never run (job state unchanged since 2026-09-29), `WORKER_JOB_REFRESH_ENABLED=0` and `OBSERVATION_SYNC_ENABLED=0` unchanged.
* **Health:** `/api/health/deep` 200 throughout.

## 3. Identity integrity

**Evidence strength of the 56 verified Vacuum groups at soak start** (kept un-merged in the report, as instructed): **STRONG_EXACT_EVIDENCE = 24** (20 with an exact model key, 4 with ≥ 2 agreeing stated codes) · **FAMILY_LEVEL_EVIDENCE = 32** (`brand|NA|watt` and similar spec-family keys with no agreeing stated code). The 24 strong groups were not independently reviewed.

**Founder's review of all 32 family-only groups (gold)** — label-free sheet (merchant, title, brand, source model fields, extracted attributes, specs, URL; no verdict, no key), narrow question *"if a shopper buys the cheapest listing instead of any other, do they get exactly the same device?"*:

| founder's answer | groups |
|---|---:|
| SAME_EXACT_COMMERCIAL_VARIANT | **24** (75 %) |
| SAME_FAMILY_NOT_ENOUGH_EVIDENCE | **6** (V02, V06, V13, V18, V19, V32) |
| UNSURE | **1** (V01) |
| DIFFERENT_VARIANT | **1** (V14) |

* **Exact same:** 24 / 32. **Family / insufficient:** 6. **Different:** 1. **Unsure:** 1.
* **Agreement with the verifier** (which let all 32 stand as comparisons): **75 %** (24 / 32) — the verifier's family-level match was right for three groups in four.
* **Confirmed false merges: 1** (V14). **Confirmed false splits:** not observable in this set (the verifier merged all 32).
* **Share of family-only groups that are actually exact variants: 75 %** (founder) — against 50 % by the AI-reviewer consensus.
* In **all 8** non-exact groups the founder flagged **Extra's listing as the odd one** (V01, V02, V06, V13, V14, V18, V19, V32). In 7 of the 8 that Extra listing carries only the generic `model` field (a title fragment) — no `mpn`/`modelNumber` — i.e. Extra is the weakest-evidenced side, exactly where the page-level mpn is missing from our payload (186 of 264 Extra Vacuum offers carry `modelNumber`).
* Integrity (strict), founder's labels: **24 strong-evidence + 24 reviewer-confirmed exact = 48 / 56 (86 %)**; confirmed false merges **1 / 56 (1.8 %)**; unproven (family / unsure) **7 / 56 (12.5 %)**. Coverage and Integrity are reported separately and are **not** combined. (The 24 strong-evidence groups were not independently reviewed.)
* Verdicts at the last cycle: **10 review, 1–2 reject** (share 8.9–9.8 %); candidate scan for two different stated codes in verified groups: 0.

**Two blind AI reviewers (provisional corroboration; different models, one reverse order, web search allowed, no repository access) disagree with the founder in places that matter:** agreement with the founder 18 / 32 and 19 / 32 (both 14 / 32); they agreed with each other 22 / 32 (16 both-EXACT, 5 both-DIFFERENT, 1 both-FAMILY, 10 mixed). The five groups they both judged different were labelled by the founder **V12 EXACT, V26 EXACT, V02 / V13 / V19 FAMILY**. Two of these conflict with codes that can be checked outside our data and are **flagged for the founder to re-confirm, not overridden**: **V12** (Almanea `2026K` vs Extra "21 L dry / 15 L wet" — Bissell `2026E` is 21 L, `2026K` is 23 L with different tools) and **V26** (Extra `2027E` PowerClean drum 21 L vs Almanea `1994K` carpet & hard-floor cleaner). V02 (2 L vs 18 L), V13 (10 L vs 15 L) and V19 (1.5 L vs 0.44 L; `A9K-CORE` vs `A9K-PRO`) state conflicting capacities or codes in the titles; the founder marked them *not enough evidence* rather than *different* — a legitimate difference of standard (absence of a code is not a conflict; the titles' capacity figures may be unreliable), recorded as such. Disputed single-reviewer cases: V07 (reviewer A: different on Extra-page mpn; founder EXACT), V14 (reviewer A DIFFERENT, reviewer B EXACT; founder DIFFERENT).

**Why the verifier could not see them** (evidence extraction, not rule softness): capacity and form-factor conflicts have no vacuum rule; low-digit codes (`A9K-CORE`) fail the name-lane density test; Extra product pages carry an mpn that 78 of 264 Extra Vacuum payloads lack; Noon states `model_number` inside `specifications`, a path no lane reads.

## 4. Commercial impact (identity effect only — prices held fixed)

Computed inside one snapshot of current offers per cycle, so it excludes price drift. Stable across both cycles:

| metric | value |
|---|---:|
| comparisons before → after (projection, 08:52 baseline vs gated) | 65 → 63 (−2, all identity: see next row) |
| comparisons removed by identity | **2** |
| comparisons verified / retained after dropping unconfirmed offers | 54 / 1–2 |
| comparisons **recovered** | **0 — by construction** (Wave 1 is read-path only; it can only withhold) |
| lowest-price claims removed (would have been backed by an unconfirmed listing) = false best-price claims prevented | **4** |
| cheapest merchant changed **by identity** | **0** (0 cycles) |
| unconfirmed listings now | review 10, reject 1–2 (5–6 canonicals) |
| Amazon: unconfirmed listings / in verified comparisons / cheapest in them | 2 / 12 / 12 |

**Amazon.** In the current verified Vacuum comparison sample, Amazon was cheapest in 12/12 appearances, median advantage approximately 10%, with no observed outlier. It is not a marketing claim and changes no matching or ranking. Amazon sits in 1 of the 7 disputed groups (V07, Tefal). Merchant participation in verified comparisons (listings): Extra 52, Almanea 27, Amazon 12, Najm 10, Noon 7, Shaker 3, Blackbox 1, Alnakheel 1.

## 5. Freshness debt (separate from identity)

15 of 63 Vacuum comparisons (24 %) are older than 168 h and therefore carry **no price claim** (median observation age 37.9 h, p90 382 h). `reobserve` has been failing since 2026-10-01 (statement timeout). Classified **PRICE FRESHNESS / COVERAGE DEBT**, not an identity defect; **not repaired here**; a separate operational item after the identity mission.

## 6. Surface consistency

Live `/api/compare` sample (6 keys per measurement) — 3 measurements (2 runner cycles + 1 manual), 18 / 18 requests ok, no failures; one residual warning every time (the Hitachi / Najm case below). Search cards for Panasonic 1500 W render the Extra and Noon listings as two separate single-store cards (no merged "N stores / best price" claim). Product-page sibling merge and search-card merge are gated (ADR-405); the agent endpoints `decide` and `home-mission` read observations through the verdict table.
**Hitachi / Najm residual — classified.** A lone Najm offer for Hitachi 2200 W shows `is_verified: true` in the API because the hidden/excluded SWSG listing is what caused the review verdicts in the signals table. The page says no updated comparison exists, shows no cheapest and no savings, store count 1, and excludes the offer from lowest/highest. **No false same-model, cheapest, store-count or comparison claim** — a **display-semantics / API-label artefact, not an identity defect**; left unfixed during the soak.
`/api/v1/tps/search` reads the TPS Algolia index only for candidate ids and recomputes everything from gated live observations (index stale since 2026-09-28; consumer = mobile search): **DEPRECATED / RECALL DEBT, not an integrity blocker**. Risk if future code trusted index contents directly: it would bypass the gate.

## 7. Residual risks

* **One** confirmed false merge (V14) stands in production at baseline level until Extra's mpn is captured; 6 + 1 further groups are unproven (family-level) and should not carry an exact claim.
* The 24 strong-evidence groups were not independently reviewed.
* The founder's labels and the blind reviewers disagree on V02, V12, V13, V19, V26 (and V07); V12 and V26 conflict with checkable model codes — founder to re-confirm.
* The soak lasted ≈ 4 h gated, not 48 h: operational conclusions (3 successful monitored-era cycles, 1 near-miss) are thin; none of them drove the verdict.

## 8. Final decision

**ROLLBACK** — one founder-confirmed false merge (V14) in a live Vacuum comparison that the gate cannot see, applying the standing rule as written. Not PASS WITH MONITORING, which required "no confirmed harmful false merge". The founder's review lowers the severity (1 confirmed false merge, 75 % of family-only groups exactly the same device, 7 unproven) and shortens the path back, but does not change the rule's outcome. A re-gate before the Extra mpn fix would keep one known false merge visible-but-unfixable; after it, the evidence supports re-gating.

## 9. Recommended path back to a gated Vacuum (nothing below is implemented; priorities updated by the founder's review)

1. **Extra mpn ingestion** — highest value: Extra is the odd listing in all 8 non-exact groups, V14's decisive evidence is Extra's page mpn, and 30 % of Extra Vacuum offers lack `modelNumber`. Also read Noon `specifications.model_number` (MEDIUM trust, 4.2 % traps).
2. **Vacuum capacity-conflict rule** (both sides state litres and differ by > 15 %): paper-tested on the 32 groups against the *blind-reviewer* consensus — catches 3 of 5 (V02, V13, V19) with 0 of 16 exact groups flagged. **Caution:** the founder labelled V02 / V13 / V19 *family*, not *different*, so this rule is **not validated against the founder's labels** and must be re-tested before it is adopted.
3. A **low-digit code lane** for titles (`A9K-CORE` / `A9K-PRO`) — the same class as the TV short codes.
4. A form-factor rule (drum/barrel vs carpet / stick / handheld) only if V26 is confirmed different on re-check.
5. Repeat the independent review of all family-only groups in shadow, then re-gate.

Evidence: `phase3b/review/` (sheets, blind answers, key, `founder-vacuum32-answers.json`), `phase3b/wave1/` (baselines, monitor rows, soak log), `tps_identity_wave_log` rows 1–5.
