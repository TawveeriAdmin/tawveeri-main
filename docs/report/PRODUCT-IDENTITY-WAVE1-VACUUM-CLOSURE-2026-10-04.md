# Wave 1 — Vacuum closure (2026-10-04)

> **File name note.** The brief named this report `…-2026-10-06.md` (end of the 48 h window). The soak ended **early, on a mechanical rollback trigger, at 2026-10-04 14:16 UTC** (≈ 4 h after the web gate went live at 10:20Z), so the report is dated the day it was decided. The 48 h soak was **not** completed; the verdict below rests on integrity evidence, not on a finished soak.

## 1. Executive verdict — **ROLLBACK** (executed 2026-10-04 14:16Z)

`TPS_IDENTITY_GATE` was set to `off` on `tawveeri-worker` and `tawveeri-main`; the isolated runner stays on (signals keep being computed, the scoped projection is rebuilt ungated at its next cycle). TV had been rolled back at 10:15Z for the same class of defect.

**Why.** The independent review of **all 32** family-only Vacuum groups (the verified comparisons that rest on spec-family evidence, not on an exact model key) found **5 groups both blind reviewers independently judged different devices**, 2 more that one reviewer judged different on evidence in merchant pages (disputed), and only 16 that both judged exactly the same. The founder's standing rule is that one confirmed false merge is sufficient to roll the category back. Four of the five are visible in the titles themselves (Midea **2 L** vs **18 L**; Panasonic **10 L** vs **15 L**; LG **A9K-CORE** vs **A9K-PRO**, 1.5 L vs 0.44 L; Bissell drum vs carpet cleaner); the fifth (Bissell 2026K vs 2026E) needs product knowledge.

**What the rollback does and does not do — stated because it is not obviously beneficial.** The gate did what it was built for: it removed **2 comparisons** and **4 lowest-price claims** that rested on listings the verifier had flagged (Hitachi `CV-965NBLGSA` vs `CV-960F`, Panasonic `MC-YL620KY47` vs `MC-YL690GY47` …), and changed **no** cheapest merchant. Rolling back **re-exposes those 2 comparisons and 4 claims**, and does **not** remove the 5–7 false merges, which exist at baseline too and are invisible to the verifier. The rollback is the standing order applied as written; the lasting fix is evidence extraction (§9). Re-enabling the gate is one variable (`TPS_IDENTITY_GATE=vacuum` on both services).

The founder's own review of the same 32 groups (artifact `https://claude.ai/artifact/VTGsTsNmsZy2r4q64DraRV`, collection `vacuum32`) is pending and **prevails over the AI reviewers' counts below**; this report must be amended when it arrives.

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

**Independent review of all 32 family-only groups** (label-free: merchant, title, brand, source model fields, extracted attributes, specs, URL; no verdict, no key; two blind reviewers — different models, one in reverse order, web search allowed):

| both reviewers | groups |
|---|---:|
| SAME_EXACT / SAME_EXACT | **16** |
| SAME_EXACT / SAME_FAMILY (either direction) | 8 |
| SAME_FAMILY / SAME_FAMILY | 1 (V30 Midea 2200 W, no code either side) |
| **DIFFERENT / DIFFERENT** | **5** (V02, V12, V13, V19, V26) |
| DIFFERENT / other (disputed) | 2 (V07 Tefal 900 W, V14 Panasonic 1900 W — reviewer A read Extra product pages showing an mpn our payload lacks: TW4B25HA vs TW4B71HA; MC-CG711RY47 vs MC-CJ911RY47) |
| **reviewer agreement** | 22 / 32 (69 %) |

* **Exact same count:** 16 (consensus) – 25 (either reviewer). **Family / insufficient:** 1 consensus (+ 8 mixed). **Different:** 5 consensus – 7 either. **Unsure:** 0.
* **Agreement with the verifier** (which let all 32 stand): **50 %** (16 / 32) on consensus.
* **Confirmed false merges: 5** (consensus); 2 more disputed. **Confirmed false splits: not observable** in this set (the verifier merged all 32); none seen in the 22 TV groups either.
* **Share of family-only groups that are actually exact variants: 50 % (consensus) to 78 % (either reviewer)**, i.e. 16–22 % are different devices.
* Integrity (strict): 24 structural + 16 reviewer-confirmed exact = **40 / 56 (71 %)**; confirmed false merges **5 / 56 (8.9 %)**, all inside the family-only 32. Coverage and Integrity are reported separately and are **not** combined.
* Verdicts at the last cycle: **10 review, 1–2 reject** (share 8.9–9.8 %); candidate scan for two different stated codes in verified groups: 0.

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

* The 5–7 confirmed false merges stand in production at baseline level until an extraction/rule fix ships.
* The 24 strong-evidence groups were not independently reviewed.
* The AI reviewers are provisional; the founder's answers prevail.
* 2 of the 7 are disputed between the reviewers; V07/V14 rest on Extra product pages, not on our data.
* The soak lasted ≈ 4 h gated, not 48 h: operational conclusions (3 successful monitored-era cycles, 1 near-miss) are thin; none of them drove the verdict.

## 8. Final decision

**ROLLBACK** — confirmed false merges (5 consensus, 7 either) in live Vacuum comparisons that the gate cannot see. Not PASS WITH MONITORING: that option required "no confirmed harmful false merge".

## 9. Recommended path back to a gated Vacuum (nothing below is implemented)

1. Vacuum **capacity-conflict rule** (both sides state litres and differ by > 15 %): paper-tested on the 32 groups — catches 3 of the 5 consensus false merges and flags 0 of the 16 both-reviewer-exact groups.
2. A **low-digit code lane** for titles (`A9K-CORE` / `A9K-PRO`) — the same class as the TV short codes.
3. **Extra mpn ingestion** for the 30 % of Extra Vacuum offers whose payload lacks `modelNumber`; read Noon `specifications.model_number` (MEDIUM trust, 4.2 % traps).
4. Form-factor rule (drum/barrel vs carpet / stick / handheld) for the remaining Bissell-type cases.
5. Repeat the independent review of all family-only groups after 1–4 in shadow, then re-gate.

Evidence: `phase3b/review/` (sheets, blind answers, key), `phase3b/wave1/` (baselines, monitor rows, soak log), `tps_identity_wave_log` rows 1–5.
