# TAWVEERI 1.0 — MARKET PROOF, PHASE 1: BASELINE TRUTH & MEASUREMENT AUDIT

**Prepared:** 2026-09-09 · Production project: `vyceqrzttspyycdpojtn` (confirmed on every query). Method: read-only production SQL (same governed functions/pattern as `command-center-queries.ts`/`tps:usage`/`tps:sanity`), plus code/ADR reading. One safe measurement fix made and shipped (ADR-328, commit `f70bcdb8`) — see §9.

**ADRs checked before writing this:** 245, 250, 257, 277–279, 282, 284, 286, 294, 295, 298, 299, 304, 309, plus the untracked `docs/report/AUGUST-2026-FOUNDER-REVIEW.md` and `SEPTEMBER-2026-EXECUTION-BASELINE.md` from prior sessions (used as prior-state context, not re-defended).

---

## 0. The one finding that reframes everything else

**The platform's own measurement tools were quoting the wrong exit number.** `npm run tps:sanity` still reproduces, live, through 2026-09-06, the exact automated-client pattern ADR-309 root-caused on 2026-09-08 (a non-JS HTTP client following raw `<a href="/go/...">` markup, bypassing the real-click handler — confirmed again this session: 2026-09-02 alone shows 1,887 redirects, 100% session-less, against 9 real sessions and 4 search actions that day). ADR-309's fix was deliberately scoped to the retailer-facing report only; it never touched `tps:usage`, `tps:sanity`, or the live `/admin/command-center` funnel. Those tools' headline "REAL outbound_clicks" count (2,687 this week, 4,822 all-time) is therefore still dominated by that traffic, not shoppers.

The codebase already has the correct number: `first_party_interactions` (ADR-286) — a row can only be written by a real `onClick` firing, exact-ID joined, never inferable from a bare GET. Queried directly this session: **21 REAL rows, all-time** (ledger went live 2026-09-03), against 2,687 raw "REAL" redirects this week alone — **0.8% overlap**.

**Fixed this session (ADR-328, safe/small/reversible, matches this mission's own pre-authorization for proven measurement blockers):** both CLI tools now print the decision-grade count alongside the raw one, with an explicit warning on the raw one. The launch-readiness gate's PASS/FAIL wording was **deliberately left unchanged** — that is a bigger, founder-level call (see §8 recommendation), not something to flip silently mid-baseline-audit.

**Practical consequence for the rest of this report:** every number below is reported from BOTH ledgers where possible, labeled RAW (volume, contaminated) vs QUALIFIED/DECISION-GRADE (first_party_interactions, small but trustworthy). Do not average them or treat RAW as a shopper count.

---

## 1. System-by-system classification

| System | Status | Evidence |
|---|---|---|
| Sessions (`tw_sid`, 1-year cookie) | **READY** | `src/lib/analytics/track.ts`; confirmed legitimate cross-day identity, `SEPTEMBER-2026-EXECUTION-BASELINE.md` §E |
| Searches (storefront + advisor) | **READY**, action-deduped | `command-center-queries.ts` `dedupeFunnelActions` (ADR-214/259) |
| Advisor / need-based search | **READY** | same funnel, `advisor_query`/`advisor_result` types |
| Product views | **READY** | `usage_events.event_type='product_view'` |
| Comparison views | **READY** | `usage_events.event_type='comparison_view'` |
| Home Mission usage | **PARTIAL** | `buildHomeMissionStats()` + `shared_home_plans` ledger exist and are queried; item/mission completion is **self-reported only**, never verified (tps:usage's own disclosure) |
| Price alerts | **UNKNOWN / NOT INSTRUMENTED** in the funnel — table exists (`price_alerts`) per CLAUDE.md schema list but no usage-report/command-center query surfaces alert-creation or trigger volume. Not checked further this pass (outside the three named missions). |
| `outbound_clicks` (raw ledger) | **BROKEN as a shopper-exit count** (see §0) — still a valid, complete AFFILIATE-TAGGING and volume ledger | ADR-309, this session's re-run |
| `/go` route | **READY** as a redirect mechanism; **not** a click-proof mechanism on its own (any GET reaches it) | `src/app/go/[offerId]/route.ts`, ADR-286's own comment predicting exactly this |
| `first_party_interactions` (the real "qualified_outbound_click") | **READY, but 6 days old** — this IS the concept the mandate calls "qualified_outbound_click"; it did not have that exact name anywhere before this audit | ADR-286, `decision-grade-queries.ts` |
| Merchant selection traceable to a real click | **READY** via `first_party_interactions.canonical_product_id` + `outbound_clicks.store_name` exact-ID join; **NOT READY** via raw `outbound_clicks` alone | this session's direct query |
| Campaign/UTM capture + propagation | **READY**, but **thin real usage**: only `x` and `chatgpt.com` appear as real, non-empty `utm_source` values anywhere in the last 30 days | `src/lib/analytics/campaign.ts`, this session's query |
| UTM persistence across session → `/go` | **READY, proven live this session** (see §5) | `tw_campaign` session cookie, ADR-244 |
| Bot/test exclusion (`is_test`, known-UA list) | **PARTIAL** — correctly catches signature bots (0 known-bot rows mis-flagged, 7-day check); **does not and cannot catch** the ADR-309 automated-client class (realistic, non-signature UAs) | `bot-detection.ts`, `tps:sanity` Check 4 |
| Returning-user / retention identity | **READY**, small signal | §6 below |
| Affiliate identifiers (`sub_id`/`ascsubtag`) | **READY** for organic exits (all Amazon/Noon `/go` rows carry `sub_id`) | prior session baseline, unchanged |
| Amazon monetization | **PARTIAL, real but tiny** — one live campaign (tablet, since 2026-09-02): 20 real exposures, **1 real click** to date | ADR-284, this session's direct query |
| Noon monetization | **NOT LAUNCHED** (organic `/go` attribution only; the promoted "campaign" layer is `SHADOW_ONLY`, blocked on clause-8.3 consent + a condition-integrity gate) | ADR-298/299 |
| Revenue/order reconciliation infra | **READY as infrastructure, EMPTY as data** — `affiliate_reports`=0 rows, `affiliate_conversions`=0 rows, confirmed again this session (both the 7d and 30d `tps:sanity` runs) | `docs/AFFILIATE_RECONCILIATION_CONTRACT.md`, unchanged since the Sept baseline doc |
| Founder Intelligence / Command Center | **READY as infra, PARTIAL as scorecard** — see §8 | `command-center-queries.ts`, `founder-home-queries.ts`, `decision-grade-queries.ts` all exist; no single view currently joins buying-mission + channel + money in one place |
| Retailer Partnership Report | **READY**, and already the ONE place ADR-309's classifier is wired in | `retailer-report-queries.ts` |

**Doc-vs-code conflict found:** `docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md` (untracked, prior session) states Noon uses "Adjust-based deep-link attribution" identically to Amazon's organic tag — still true for **organic** exits, but that document pre-dates ADR-294/295/298/299 (all 2026-09-05, three days after commits referenced in that doc) and does not reflect that a separate, **internal promoted-campaign** layer now exists and is Amazon-only by design, with Noon's equivalent explicitly `SHADOW_ONLY`. Treat the September baseline doc's Amazon/Noon section as superseded by ADR-284/298/299, not current.

---

## 2. Baseline funnel — last 7 / 30 complete days (REAL only, `is_test=false`)

| Metric | 7d | 30d | Source |
|---|--:|--:|---|
| Real events | 465 | 3,659 | `tps:sanity` |
| Real sessions (any event) | ~113–265 range depending on stage (see below) | 394 (usage_events, session-bearing) | direct query |
| Searching sessions | 20 | 194 | `tps:sanity` Check 7 |
| Session-level answer rate | 95.0% (19/20) | 93.3% (181/194) | `tps:sanity` Check 7, governed 80% floor |
| RAW outbound_clicks (REAL) | 2,687 | 4,435 | direct query — **contaminated, see §0** |
| RAW outbound_clicks missing session_id | 98% (2,639/2,687) | 94% (4,189/4,435) | `tps:sanity` Check 3 |
| **QUALIFIED outbound (`first_party_interactions`, REAL)** | **21** | **21** (ledger is only 6 days old — 7d and 30d windows are identical) | direct query, cross-validated against `tps:usage`'s new DECISION-GRADE line |
| Affiliate-tagged RAW redirects (Amazon+Noon organic, unfiltered) | 841 | 1,342 | `tps:sanity` Check 6 |
| `affiliate_reports` / `affiliate_conversions` rows | 0 / 0 | 0 / 0 | `tps:sanity` Check 6, both windows |
| TEST-flagged outbound share | 7.7% | 8.6% | `tps:sanity` Check 4 |

**Repeat-fire (Check 1):** clean in the 7-day window; the 30-day window still shows one historical instance (174 fires, session `7f65e52c…`, query `ثلاجة`/refrigerator) that **pre-dates** the 7149501 fix — not a new occurrence, confirmed by its absence from the clean 7-day window.

---

## 3. Buying-mission breakdown (AC vs phone/tablet vs Home Mission), by BOTH ledgers

### RAW outbound (volume, contaminated — shown for completeness, not for a "which mission wins" call)

| Category | 7d clicks | 7d w/session | 30d clicks | 30d w/session (rate) |
|---|--:|--:|--:|--:|
| air_conditioner | 827 | 19 | 1,119 | 97 (8.7%) |
| tv | 385 | 4 | 660 | 11 (1.7%) |
| washing_machine | 386 | 0 | 515 | 0 (0%) |
| refrigerator | 82 | 4 | 483 | 12 (2.5%) |
| mobile | 251 | 2 | 376 | 12 (3.2%) |
| laptop | 182 | 14 | 348 | 24 (6.9%) |
| tablet | 143 | 3 | 262 | **59 (22.5%)** |

### QUALIFIED (`first_party_interactions`, REAL, all 21 rows fall within the last 6 days — the trustworthy number)

| Category | Qualified exits | Distinct sessions |
|---|--:|--:|
| air_conditioner | 5 | 5 |
| refrigerator | 4 | 2 |
| tv | 4 | 3 |
| mobile | 2 | 2 |
| laptop | 2 | 2 |
| tablet | 1 | 1 |
| (unknown product) | 3 | 2 |

**TOP_BUYING_MISSION_BY_QUALITY: air_conditioner, but the margin is not meaningful yet** — 5 of 21 total qualified observations platform-wide in 6 days. Per the mandate's explicit instruction not to hide a stronger category: **refrigerator and TV are statistically indistinguishable from mobile/tablet combined** in the one ledger that actually deserves trust (refrigerator+TV = 8 qualified exits vs mobile+tablet = 3) — neither of the founder's two named "phone/tablet" and implicit-in-AC-adjacent categories is currently the clear #2. Home Mission itself produced 2 shared-plan creations in 7 days / 14 in 30 (its own `shared_home_plans` ledger — see §1's Home Mission caveat about self-reporting) and does not have its own outbound-click category (it spans categories), so it cannot be ranked against AC/phone/tablet on the same axis — it is a distinct, cross-category flow, not a fourth item in this table.

**AC's raw-volume dominance (827–1,119 clicks) is now known to be mostly the ADR-309 automated-client pattern, not demand** — do not use the RAW column to justify an AC-specific spend decision; the QUALIFIED column is the only defensible one, and it is currently too small (n=21) to declare any winner with confidence.

---

## 4. Channel/source truth

- Real, distinguishable non-direct `utm_source` values found anywhere in production, last 30 days: **`x` and `chatgpt.com` only.** (`usage_events.meta`: x=269 raw events, chatgpt.com=122; `outbound_clicks.campaign`: x=11, chatgpt.com=12, both 30d REAL.)
- **~99% of real outbound traffic carries no `utm_source` at all** (2,677 of 2,687 this week) — consistent with the prior session's August finding (95% untagged); the pattern has not improved.
- **Google organic vs. direct is NOT currently distinguishable** — no referrer-based classification exists in any query path checked. Reported as UNKNOWN, not estimated.
- TikTok: **zero real rows found** in any UTM field, any window.
- **Cannot rank channels by "qualified shopper rate"** with today's data — the two distinguishable non-direct sources (`x`, `chatgpt.com`) have single-digit-to-low-teens real click counts each; any rate computed on that base would be noise presented as a metric.

---

## 5. Attribution end-to-end — PROVEN, not just plausible

Confirmed a real (non-test) session where `utm_source=chatgpt.com`, captured on landing, survived through search/browse and into a same-session `/go` exit **that is itself proven by `first_party_interactions`, not just present in the raw ledger**:

- Session `5ececf03…`: `outbound_clicks.campaign = {"utm_source":"chatgpt.com"}`, `clicked_at=2026-09-08T19:41:30.178Z`, `surface=product_page`.
- Same session, `first_party_interactions.interaction_id=ce15d0c3…`, `created_at=2026-09-08T19:41:29.919Z` (0.3s apart), `surface=category_page`, `provenance=first_party_ui_interaction`.

**ATTRIBUTION_HEALTH: PASS for the mechanism** (a real UTM tag does survive landing → browse → a proven real exit) — but the volume that mechanism currently sees is very small (§4).

---

## 6. Return/retention truth (last 30 days)

- Sessions active on ≥2 distinct calendar days: **24 of 394 (6.1%)** — computed fresh this session, directly matching the prior August figure (6.1%) almost exactly. **Stable, not growing, not shrinking.**
- Classification unchanged from the prior session's verdict: **EARLY SIGNAL**, device/browser-level only, not person-level. `RETURN_BEHAVIOR_MEASURABLE = PARTIAL` (the mechanism is sound; the number is real but small and cannot yet support a retention-feature investment case).
- Home Mission's own "returns=7" (all-time, from `tps:usage`) is a separate, smaller, self-reported signal — not merged into the 6.1% figure above (different identity basis).

---

## 7. Money truth

| | Amazon | Noon |
|---|---|---|
| CLICK_PROOF | Organic: `sub_id` on every `/go` row (unchanged). Campaign layer: **20 real exposures, 1 real click** since 2026-09-02 launch (ADR-284) | Organic only: Adjust/UTM params on `/go` rows. No promoted-campaign clicks exist (`AFFILIATE_CAMPAIGNS_MERCHANTS=amazon` excludes it) |
| ORDER_PROOF | Importer built (`/admin/affiliate`), **never used** — `affiliate_reports`=0 rows | Same infra, same zero |
| REVENUE_PROOF | `SAR 0 confirmed` — **UNAVAILABLE**, not zero-by-measurement | Same |
| Stop boundary | Founder downloads an Associates Central Earnings/Orders CSV for `tawveeri0f-21` or `tawveeri0f-tablet-21` | Founder checks Noon's own Adjust/affiliate dashboard for any Tawveeri-attributed order |
| Status change since prior session | Amazon now has one small **live promoted campaign** (was campaign-less before 2026-09-02); still 0 orders confirmed | **Downgraded relative to how the prior baseline described it** — Noon's promoted layer is `SHADOW_ONLY` (ADR-298/299: condition-integrity gate failed for laptop/tablet, the two categories with any real Amazon overlap); only Noon-only (no-comparison) categories are `READY_WITH_LIMITS`, air_conditioner among them |

Also found this session (not in any prior baseline doc): `shadow_commerce_events` now has **2 real rows** — the Amazon-vs-Noon tie-break logic has fired organically twice since ADR-295 went live. Too small to analyze, but it is the first real (non-zero) signal that mechanism produces anything at all.

**FIRST_MONEY_MEASUREMENT_READY = NO** (infrastructure YES, data NO — unchanged verdict, now with a slightly larger but still негligible click base on the Amazon side).

---

## 8. Founder scorecard capability

**Partially exists; assembling one is "reuse existing pieces," not "build new."** Concretely reusable today, by file:
- `command-center-queries.ts` — funnel/session-funnel/campaign-attribution/home-mission/top-demand, all period-filterable.
- `decision-grade-queries.ts` — the ADR-286 authoritative exit count (now also surfaced in the CLI tools, §0/§9).
- `retailer-report-queries.ts` — per-merchant breakdown, already ADR-309-clean.
- `founder-home-queries.ts` — the existing Founder Intelligence surface.

**What has NO existing query to adapt (a real gap, not yet built anywhere):**
1. A single view joining **buying-mission × channel × qualified-outbound × money** — today these live in separate functions/pages, none cross-tabulated.
2. Any query on `first_party_interactions` grouped by category/source (this session's queries were ad-hoc, not committed as a reusable function — a natural next step, not done here per the mission's "baseline only" scope).
3. A revenue column anywhere (structurally correct — there is no revenue data to query yet).

**Recommendation, not executed this pass (a founder-level scope call, per the mission's own boundary rules):** extend `decision-grade-queries.ts` with a category/source-grouped variant, and either (a) add a `DECISION-GRADE` card to `/admin/command-center` next to the existing raw one, or (b) change what "Measured exits" means there — ADR-309's own text already flagged this exact follow-up as unscoped and founder-level.

---

## 9. What was fixed this session (ADR-328, commit `f70bcdb8`, pushed to `origin/main`)

Read §0. Scope: two CLI reporting scripts (`tps:usage`, `tps:sanity`) gained a decision-grade exit count alongside the existing raw one. No schema change, no data write, no change to the live `/admin/command-center` page, no change to the launch-readiness gate's pass/fail logic. Fully reversible (`git revert f70bcdb8`).

---

## 10. Required final report (mandate §15)

```
MARKET_PROOF_MEASUREMENT_READY        = PARTIAL — mechanisms exist and are largely sound;
                                         the one number everyone was about to build decisions
                                         on (exit volume) was wrong until this session's fix,
                                         and its correct replacement has only 6 days of data.
CURRENT_REAL_7D_SESSIONS              ≈ 113–265 (stage-dependent; 20 searching, 394 total in 30d)
CURRENT_REAL_30D_SESSIONS             = 394 (usage_events, session-bearing)
QUALIFIED_SHOPPING_SESSIONS           = 194 searching sessions (30d); 20 (7d)
QUALIFIED_OUTBOUND_SESSIONS           = 21 (first_party_interactions, REAL, all-time —
                                         ledger is 6 days old; do NOT use the raw 2,687/4,435)
QUALIFIED_OUTBOUND_RATE               = UNKNOWN at session-rate precision — n=21 total events
                                         against ~394 sessions is too sparse for a stable rate
TOP_BUYING_MISSION_BY_QUALITY         = air_conditioner leads on tiny sample (5/21); NOT a
                                         confident call — refrigerator/TV rival phone/tablet
AC_BASELINE                           = 5 qualified exits (7d=30d, ledger age); 827–1,119 raw
                                         clicks/window, mostly ADR-309 contamination
PHONE_TABLET_BASELINE                 = 3 qualified exits (mobile 2 + tablet 1); tablet shows
                                         the highest RAW session-attachment rate (22.5%, 30d)
                                         of any category — worth re-checking once more data exists
HOME_MISSION_BASELINE                 = 2 shared plans (7d) / 14 (30d); all-time sessions=19,
                                         completions self-reported only, never verified
TOP_ACQUISITION_SOURCE_BY_QUALITY     = UNKNOWN — only x/chatgpt.com are distinguishable from
                                         direct, both too small (11-12 real clicks/30d) to rank
MERCHANT_OUTBOUND_BREAKDOWN           = RAW ledger dominated by non-affiliate merchants via the
                                         ADR-309 contamination; Amazon campaign = 20 real
                                         exposures/1 real click since 2026-09-02; Noon has no
                                         promoted campaign (SHADOW_ONLY)
RETURN_BEHAVIOR_MEASURABLE            = PARTIAL — 6.1% (24/394) sessions active ≥2 days, stable
                                         vs. prior month, device-level identity only
FIRST_MONEY_MEASUREMENT_READY         = NO — infra ready, affiliate_reports/conversions both
                                         still 0 rows on both networks
AMAZON_RECONCILIATION                 = Click-proof YES (organic + 1 campaign click); order/
                                         revenue proof UNAVAILABLE, founder CSV import required
NOON_RECONCILIATION                   = Organic click-proof YES; promoted layer SHADOW_ONLY
                                         (condition-integrity gate open, ADR-298/299); order/
                                         revenue proof UNAVAILABLE
ATTRIBUTION_HEALTH                    = PASS (mechanism proven end-to-end, §5) but low real
                                         volume (~1% of exits carry any UTM)
BOT_EXCLUSION_HEALTH                  = PARTIAL — known-bot-UA detection PASSES cleanly (0
                                         misses, 7d); the larger ADR-309 automated-client class
                                         is structurally undetectable by UA and remains open
BLOCKERS_FOUND                        = 1 BLOCKS_MARKET_PROOF_NOW (raw-vs-qualified exit gap,
                                         §0); several IMPORTANT_BUT_NOT_BLOCKING (UTM coverage,
                                         price-alert instrumentation gap, no cross-tab scorecard)
BLOCKERS_FIXED                        = 1 (ADR-328 — decision-grade count now surfaced in both
                                         CLI baseline tools)
BLOCKERS_REQUIRING_FOUNDER            = (a) whether to redefine the live launch-readiness gate's
                                         "Measured exits" around the decision-grade count, (b)
                                         whether to extend ADR-309's classifier to the live
                                         Command Center dashboard (not just the retailer report
                                         and now the CLI tools), (c) Amazon CSV import, (d) Noon
                                         dashboard check, (e) whether/how to pursue Noon clause-8.3
NEW_FEATURES_BUILT                    = 0
PRODUCTS_2_CHANGED                    = NO
AC_RESCUE_EXPANDED                    = NO
MARKET_PROOF_SCORECARD_READY          = NO (pieces exist and are reusable, §8; no single
                                         cross-tabulated view exists yet — not built this pass,
                                         correctly out of "baseline only" scope)
BASELINE_SAVED                        = YES — this document + ADR-328 in docs/DECISIONS.md
SAFE_TO_BEGIN_USER_ACQUISITION_TEST   = NOT_YET — the qualified-exit ledger has 6 days of data
                                         and n=21; any acquisition test launched today cannot be
                                         evaluated against a stable baseline for at least another
                                         1-2 weeks of decision-grade accumulation
NEXT_RECOMMENDED_ACTION               = Let first_party_interactions accumulate 2-3 more weeks
                                         under current (zero-spend) organic traffic to get a
                                         stable QUALIFIED_OUTBOUND_RATE baseline; in parallel,
                                         founder decides items (a)-(e) above; do not spend on
                                         acquisition until the qualified baseline is stable.
```

## 16. STOP

`SAFE_TO_BEGIN_USER_ACQUISITION_TEST = NOT_YET`. No paid channel launched, no public post made, no user/merchant contacted. Baseline returned to the founder for coordination with ChatGPT/Grok per the mandate's own closing instruction.
