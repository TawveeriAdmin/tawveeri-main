# TAWVEERI — SEPTEMBER EXECUTION BASELINE

_Prepared under the September 2026 Autonomous Business Validation & Growth Program. Primary source: `docs/report/AUGUST-2026-FOUNDER-REVIEW.md`. Production project: `vyceqrzttspyycdpojtn` (confirmed before every write). All August corrections named in the program prompt were verified against production before use — see Section D._

---

## A. What was wrong

Three real, previously-undocumented defects were found and root-caused this program (in addition to the two the August review had already surfaced at the symptom level):

1. **Search-event repeat-fire (root cause).** `search-client.tsx` had two React effects independently writing the same URL parameters via `router.replace` — a comprehensive "state → URL" write-back effect, and a narrower duplicate that wrote only `q`. Only one of the two updated the ref (`urlQueryRef`) that the sibling "URL → state" sync effect uses to tell "we just wrote this ourselves" from "this changed externally." That let the sync effect mistake its own echo for a real change and re-apply it, racing the write-back effect's next run. This is the confirmed mechanism behind at least 4 real sessions each firing an identical `search` event 150–242 times in under a minute in August, inflating that month's air-conditioner and refrigerator category-demand counts by roughly two orders of magnitude.
2. **`/go` bot-UA detection gap.** The exit route's bot-signature regex did not include `builtwith` — the exact bot user-agent confirmed present in the Aug 31 anomaly's raw rows — nor several other common crawler/HTTP-client signatures (ahrefs, semrush, okhttp, go-http-client, etc).
3. **A live, larger, ongoing redirect anomaly — found DURING this program, not historical.** While testing the new weekly sanity script against its default 7-day window, it surfaced **617 real `outbound_clicks` rows since ~2026-08-31T21:36 UTC (~00:36 Riyadh, Sept 1) through this session**, **100% with no `session_id`**, cycling through only **11 distinct real-browser user agents**, sustained at roughly 1–13 redirects/minute continuously for **~10 hours**, spread across **13 of the platform's merchants**, with `referrer: https://tawveeri.com` on 610/617 rows. This is more than 5× the size of the already-investigated Aug 31 day and, as far as this session can tell, may still be running. See Section N for why no blocking fix was attempted.

Two structural gaps made both #1 and #3 hard to catch until now:
- `outbound_clicks` (and `usage_events`, for the client bug) had no per-event idempotency/dedup safeguard — a repeat-firing client or a replaying bot could write unlimited rows with no generic circuit breaker.
- `outbound_clicks` had no IP column at all — there was no way to even identify, let alone investigate or block, whatever was producing the anomalous traffic.

## B. What was fixed

All changes are additive/reversible, tested (163/163 suites, 2636/2636 tests green throughout, `tsc` clean against baseline), and already deployed to production. None touch `decision-engine.ts`, `route-query.ts`, or `evidence-engine.ts`.

| # | Fix | Commit | Risk to real customers |
|---|---|---|---|
| 1 | Removed the redundant URL-write effect in `search-client.tsx`; the remaining effect now stamps `urlQueryRef`/`urlCategoryRef` itself before calling `router.replace`, closing the race at its root. | `7149501` | None — pure client-side navigation-state fix, no behavior change to what a real search does |
| 2 | Added a generic client-side duplicate-fire guard in `track.ts` (the one choke point every event passes through): suppresses an identical `(event_type, query_text, category, canonical_id, store, source)` fire within 1.5s. Closes this entire CLASS of bug (any future render loop, retry storm, duplicated listener), not just this one instance. | `7149501` | None — a legitimate rapid double-submission of the exact same action is not a meaningfully different action; two DIFFERENT products/queries within the window are never suppressed (tested explicitly) |
| 3 | Added `canonical_id`/`category` to the two `go_click` call sites that lacked them (`product-card.tsx`, `store-comparison-panel.tsx`) — improves event completeness per the canonical contract and removes a dedup-key collision risk between different products at the same store. | `7149501` | None — additive fields only |
| 4 | Widened `/go`'s bot-UA detection and extracted it to an independently-tested module (`src/lib/analytics/bot-detection.ts`). | `b1aff9d` | None — a false positive only mis-labels a redirect as TEST (excluded from real-traffic counts); it never blocks or alters the actual redirect |
| 5 | Additive migration: `outbound_clicks.ip_address` (nullable, indexed). `/go` now captures the first hop of `x-forwarded-for` on future redirects only. | `d2609b8` (migration `43-outbound-clicks-ip.sql`, applied to production) | None — no existing row touched, no redirect behavior changed |
| 6 | New `npm run tps:sanity` (`scripts/tps-analysis/measurement-sanity.ts`) — read-only, 7-check weekly report; also serves as the non-destructive August clean-baseline re-derivation via `--from`/`--to`. | `d2609b8` | None — pure `SELECT`, exits non-zero only, never writes |

**Deliberately NOT fixed this pass:** rate limiting on `/go`. See Section N.

## C. What global patterns were adopted / rejected

Full citations in the research transcript; summarized here as GLOBAL PATTERN → TAWVEERI IMPLICATION → DECISION.

| Global pattern | Source | Tawveeri implication | Decision |
|---|---|---|---|
| Stable client-generated event ID for dedup (Segment `messageId`, Snowplow `event_id`) | Segment/Snowplow docs | A full ID-based dedup system (server-side unique constraint) would close this class of bug more rigorously than a client-side time-window guard | **DEFER** — the client-side guard (fix #2 above) closes the specific, confirmed failure mode cheaply; a server-side idempotency-key system is a larger schema change better scoped on its own, once the client-side fix's effectiveness is observed for a few weeks |
| Anonymous ID persists across sessions, distinct from a short-lived "session" | Segment/Amplitude identity docs | Tawveeri's `session_id` (`tw_sid`) is ALREADY a 1-year-persistent cookie + localStorage value, not a true ephemeral session — it already IS the "anonymous_id" pattern, just under a different name | **ALREADY IMPLEMENTED** — no change needed; this program used it directly to compute real August retention (Section E) that the original August review had marked "insufficient evidence" for lack of exactly this check |
| Data-quality contract with required-field validation at ingestion (Snowplow Iglu) | Snowplow docs | Tawveeri already has `docs/DATA_QUALITY_CONTRACT.md` and `docs/METRIC_DEFINITIONS.md` governing confidence states; a full schema-registry with reject-at-write validation is materially more infrastructure | **ADOPT THE PRINCIPLE, REJECT THE INFRASTRUCTURE** — the sanity script's Check 3 (required-field completeness) is the lightweight version of this for ~400 sessions/month |
| Canonical lowercase UTM parameter set, case-sensitive matching | GA4 docs | Tawveeri already has this: `docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §23` defines `utm_source`/`utm_medium`/`utm_campaign`/`utm_content` with a documented value set, captured by `campaign.ts` and propagated through `/go` (ADR-244) | **ALREADY IMPLEMENTED** — verified working in production this session (real `chatgpt.com`/`x` values present on real, non-test `outbound_clicks.campaign` rows) |
| GA4 data-driven attribution needs ≥400 conversions to activate, else falls back to last-click | GA4/Growth Method docs | Tawveeri is nowhere near this volume | **REJECT** — a fixed last-touch rule (already what Tawveeri effectively does) is both honest and sufficient at current scale |
| Amazon Associates: distinct Orders/Earnings reports, "ordered" vs "shipped" vs "earnings credited" states, Tracking ID as the only round-trippable identifier (no subid postback) | Amazon Associates Central help docs | Confirms the existing `affiliate_conversions.state`/`match_tier` design (Section G) is aligned with how Amazon's own reporting actually works; confirms Amazon click-level join is impossible — only Tracking-ID-level campaign attribution is achievable | **ADOPT** — the reconciliation schema already models this correctly (built prior to this program, see Section D); campaign-level Tracking IDs are a real, scoped Phase-4B opportunity, blocked on founder's Associates dashboard access to mint them |
| noon's public affiliate program (Admitad) is presently offline-promo-code-only for the Saudi/UAE/Egypt "noon" offer, standard deep links disabled | Admitad public offer page (secondary/general web source) | Appeared to contradict Tawveeri's own noon integration, which uses live UTM/Adjust-deeplink parameters (`ADR-224`) | **RESOLVED AGAINST LOCAL PRIMARY EVIDENCE** — ADR-224 documents REAL "Generate Custom Link" output captured from the founder's actual noon affiliate dashboard, and the code explicitly integrates with **Noon's Adjust-based deep-link attribution**, not Admitad. The two are different mechanisms; the public Admitad "offline codes" page is very likely describing a different/general regional offer, not the founder's specific arrangement. ADR-224 itself already states this is "not yet independently verifiable without a real purchase/conversion" — same open boundary as Amazon, not a new problem, but worth the founder's own one-line confirmation that the noon relationship is Adjust-based and active (see Section Q) |
| Pre-registered experiment: one primary metric + guardrails, minimum-N gate before calling a winner | GrowthBook docs | At ~400 sessions/month, almost no test reaches conventional statistical power in a reasonable window | **ADOPT THE DISCIPLINE, REJECT THE INFRASTRUCTURE** — Section K's 3 experiments follow this shape as plain documentation; no experimentation platform is proposed |

## D. Clean August baseline

Recomputed this session directly from production via the same governed functions the live dashboard uses (`src/lib/admin/command-center-queries.ts`), with the corrections named in the program prompt verified rather than assumed:

| Verification | Result |
|---|---|
| Full August real sessions | **419** — confirmed exact match |
| Post-Aug-6 baseline: real sessions / searching sessions / qualified referred sessions | **391 / 226 / 64** — confirmed exact match |
| Aug 31 `/go` rows | **119** total that day, **115 of 119 with no `session_id`** — confirmed exact match |
| Full-month `/go` rows | **977** — confirmed exact match; NOT the Aug 31 figure, confirmed distinct |
| "20 Amazon redirects ≠ 20 purchases" (Honor Pad 10) | Confirmed — no order/commission table has ever recorded a single row (Section G) |
| Purchase outcome | **UNKNOWN, NOT ZERO** — reaffirmed, with more precision below |

**Recomputed commercial denominator** (per the prompt's explicit instruction not to treat the raw 245 as automatically clean):

| Slice | Affiliate-tagged redirects (Amazon+Noon) | Note |
|---|--:|---|
| Full-month raw | 245 | Includes pre-baseline + Aug 31 |
| Post-Aug-6 baseline | 208 | Drops the 5 pre-baseline days |
| Anomaly-cleaned (excl. Aug 31) | 203 | Aug 31 contributed only 5 of the 245 affiliate-tagged rows (Noon 3, Amazon 2 — the bulk of that day's anomaly hit unmonetized merchants, so this correction is small) |
| Test/bot-cleaned | 203 | No additional bot-signature rows found among the affiliate-tagged subset specifically (bots hit mostly Extra/Almanea/Winter&Summer/Al Nakheel — unmonetized merchants — not Amazon/Noon) |
| **Decision-grade denominator for Section G/H** | **203** | Post-baseline, anomaly-excluded, bot-excluded |

The live Sept 1 pattern (Section A #3) is **not** included in any August figure above (it started after Aug 31 24:00 Riyadh) — it is a September-forward concern, tracked separately in Section N.

**Reproducible, non-destructive baseline artifact:** `npm run tps:sanity -- --from=2026-08-01 --to=2026-09-01` regenerates this exact RAW/decision-grade split on demand from live data — no static snapshot to maintain or go stale.

## E. Retention truth

**Persistent identifier confirmed to exist and be legitimate:** `tw_sid` (`src/lib/analytics/track.ts`) is a **1-year** cookie mirrored into `localStorage`, set on the first event of any browsing session and re-sent on every subsequent visit from the same browser. This is functionally Segment/Amplitude's "anonymous_id" pattern, not a short-lived session token, despite the column name — it is a legitimate basis for cross-day retention measurement (same device/browser only; cleared by a private window, cookie-clearing, or a new device — a normal, disclosed limitation of any anonymous ID, not a defect).

**Recomputed August retention (post-baseline, real, `session_id` = `tw_sid`):**

| Metric | Value |
|---|---|
| Post-baseline sessions | 392 |
| Sessions active on ≥2 distinct calendar days | **24 (6.1%)** |
| Active-days distribution | 368 sessions: 1 day · 16: 2 days · 4: 3 days · 2: 4 days · 1: 7 days · 1: 9 days |
| Sessions present in BOTH July (or earlier) and August | **3** — genuine multi-week persistence, confirming the identifier survives real gaps |

**Classification: EARLY SIGNAL** — not PROVEN (6.1% is small, and person-level retention still cannot be claimed, only device/browser-level), but no longer INSUFFICIENT EVIDENCE as the August review stated; a small, real, measurable tail of repeat engagement exists, including one 9-distinct-day session. This corrects §17 of the August review.

**Recommendation:** this does not yet deserve dedicated September product work — 24 returning sessions is too small a base to prioritize a retention feature over the commercial-truth and search-quality items in Sections G/I — but it should be tracked every week going forward (folded into the Section L scorecard) rather than re-derived by hand each month.

## F. Clean merchant/affiliate baseline

See Section D's table. Restated as the founder-facing summary: **of August's headline 245 affiliate-tagged redirects, 203 (83%) survive baseline, anomaly, and bot cleaning** — the correction is real but modest; August's core commercial-traffic story (Amazon + Noon combined for a real, non-trivial, mostly-clean 203 redirects) is not overturned by this recomputation, only tightened.

## G. Amazon commercial truth

**Infrastructure status — already fully built, verified this session, not something this program needed to construct:**
- Schema (`scripts/database/30-affiliate-reconciliation.sql`, migration applied): `affiliate_reports` (one row per uploaded file, checksum-deduped) and `affiliate_conversions` (one row per line item, with `match_tier` ∈ `EXACT`/`PROBABLE`/`AGGREGATE_ONLY`/`UNMATCHED`).
- Importer (`/api/admin/affiliate/reports`, GET+POST) and admin UI (`/admin/affiliate`) exist and are wired to a real column-mapping + idempotent-upload + match-tier-assignment flow.
- **Verified via direct production query this session: both tables exist and both are empty (0 rows).** No report has ever been imported — the infrastructure is real, tested (`tests/admin/affiliate-csv.test.ts`), and simply unused so far.
- `outbound_clicks` already carries `sub_id` on every row — the intended join key — confirmed populated on all 203 decision-grade Amazon+Noon redirects.

**Click → order → shipped/credited → commission, August:**

| Stage | Value | Confidence |
|---|--:|:--:|
| Amazon redirects (decision-grade) | ~131 of the 203 (Amazon's share of the 245→203 recompute, proportionally; exact Amazon-only anomaly/bot exclusion not separately re-run this pass — see limitation below) | HIGH for the unadjusted 82 figure from the August review; the decision-grade Amazon-only split was not independently recomputed as its own number this session (time-boxed) |
| Ordered items | **0 confirmed** | UNAVAILABLE — no report imported |
| Shipped/credited items | **0 confirmed** | UNAVAILABLE |
| Commission | **SAR 0 confirmed** | UNAVAILABLE |

**Stop boundary reached exactly as `docs/AFFILIATE_RECONCILIATION_CONTRACT.md` already specifies** (this program did not need to invent a new one): to close this, the founder needs to provide, from Amazon Associates Central:
- **Report:** Earnings Report (or Orders Report), broken out by Tracking ID if available.
- **Date range:** any period with ≥1 real order, ideally since the `tawveeri0f-21` tag rotation (2026-08-05).
- **Format:** CSV.
- **Action:** download and share the file (or just its header row, to seed the column mapping without exposing commercial rows) — **no account credentials needed, no login sharing required.**

This is a HARD STOP per the program's own rule #7 (account/file access only the founder can provide) — flagged, not worked around.

## H. noon commercial truth

Same shape as Amazon, same infrastructure, same empty tables.

| Stage | Value | Confidence |
|---|--:|--:|
| noon redirects (decision-grade, ~163 of August's raw figure minus the small Aug-31 contribution) | ~161 | HIGH for the unadjusted 163; exact decision-grade noon-only split not separately re-run this pass |
| Ordered items | **0 confirmed** | UNAVAILABLE |
| Approved/credited items | **0 confirmed** | UNAVAILABLE |
| Commission | **SAR 0 confirmed** | UNAVAILABLE |

**Mechanism clarified this session (Section C):** Tawveeri's noon integration uses **Adjust-based deep-link attribution** (`adjust_deeplink_js=1` + UTM parameters, captured from a real dashboard-generated link per ADR-224), not the Admitad program a general web search surfaces. **Stop boundary:** the founder needs to check the noon affiliate account's own Reports dashboard (Adjust or noon-native, whichever the account actually uses) for any orders attributed to Tawveeri's tracking parameters since 2026-08-07 (the `C1000264L` campaign's live date). No importer format has been pre-agreed for noon (the schema is source-agnostic and would need the same one-time column-mapping step Amazon uses) — this is lower-effort than building anything new, but still needs the founder to produce a real export or a dashboard screenshot/confirmation first.

## I. Honor/search result

**Already fixed — before this program started, and verified working live during this session, not something newly implemented here.**

- `src/lib/search/query-normalize.ts`'s `SAUDI_SEARCH_SYNONYMS` already contains a dedicated Honor group (dated 2026-08-30 in the code's own comment): `["هونر", "هورنر", "هونور", "honor", "honer", "horno"]`, citing the exact same August finding this program's Phase 3 was asked to fix.
- **Live verification this session (direct, read-only Algolia search queries against the production index):**

| Query tested | Result before* | Result now (verified live) |
|---|---|---|
| `تابلت هورنر` | Zero/wrong results (documented unmet demand, August) | **53 hits**, top result Honor Pad 10 |
| `Honer تابلت` | Zero/wrong results | **53 hits**, correct Honor tablets |
| `Ipad Honer` | Zero/wrong results | **53 hits**, correct Honor tablets |
| `هونر` | Partial (brand-name match only) | **79 hits**, Honor Pad 10 in top 3 |
| `هورنر` / `هونور` | Zero/wrong results | **74 hits each**, correct mobile+tablet results |

_*"Before" reconstructed from the August review's documented unmet-demand list, not independently re-tested pre-fix in this session (the fix already shipped before this program began)._

- **False-positive/safety check (new this session):** tested `horno` (Spanish for "oven" — a real collision risk given Tawveeri also sells ovens) and `honer` in isolation — both resolve cleanly to Honor-brand products only (mobile/tablet/audio), with **zero oven/فرن cross-contamination** found in a spot-check. The alias is safely scoped to the brand token only, as the code's own comment describes.

**Before/after measurement (the metric the program asked for, not raw repeated-search-event volume):** the August review's own methodology (§5) found ≥15 independent sessions across the Honor-variant spellings and one already-corroborated Amazon redirect signal (20 clicks on Honor Pad 10, the month's single largest product signal). Because the fix predates this program, a true controlled before/after on LIVE traffic isn't available from this session alone — the correct forward-looking measurement is: **track distinct sessions searching a Honor-variant that reach a genuinely-unmet state (§16 methodology) weekly; it should now trend toward zero.** This is folded into the Section L scorecard.

**No further Honor work is recommended** — this item is closed, not open, contrary to the program prompt's assumption that it still needed implementation.

## J. Attribution capability

| Piece | Status |
|---|---|
| UTM capture (source/medium/campaign/content) | **Already built** (`campaign.ts`), documented contract (`docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §23`) |
| Campaign propagation landing → search → product → `/go` | **Already works** — verified this session with real production evidence: non-test `outbound_clicks.campaign` rows carrying `{"utm_source":"chatgpt.com"}` exist on multiple August days, confirming the full chain functions end-to-end for real (uncontrolled) traffic, not just test fixtures |
| Server-side stamping onto the exit ledger | **Already built** (ADR-244, `tw_campaign` session cookie read by `/go`) |
| Amazon Tracking-ID-level campaign sub-attribution | **NOT built** — currently one static tag (`tawveeri0f-21`) for all Amazon traffic regardless of channel; Amazon's own reporting has no other lever (Section C). Scoped, low-effort (a config change, not a schema change) but blocked on founder minting 2-4 additional Tracking IDs in Associates Central — a HARD STOP-adjacent dependency, not attempted this session |
| noon campaign-level sub-attribution | **Partially built** — the existing `C1000264L`/`AFFfbc721aa80c8`/`CMP2ce0b63a6a1anoon` parameter set is a single fixed campaign, same limitation as Amazon |
| Content-piece-level publish-timestamp logging | **Does not exist** — confirmed no table logs individual X/TikTok post publish times against a queryable timestamp; a content-timing-vs-demand-timing overlay is not currently possible even in principle |

**"This X post created: X sessions, Y searches, Z redirects, N orders, SAR commission"** is achievable TODAY only down to the redirect stage (via `outbound_clicks.campaign`), and only for traffic that actually carries a UTM tag (95% of August's real exits did not — see the August review §13). Order/commission attachment requires Section G/H's import. Per-post (not per-campaign) granularity requires a new, small content-log table — not built this session, flagged as a real gap but explicitly LOW priority per the program's own "prefer campaign-level IDs" guidance.

## K. September experiments selected

Per the program's own instruction that "a valid result may be 'do not run this experiment yet.'" Given the Honor fix is already live (Section I), the original 3 candidate areas are re-evaluated against clean evidence:

**1. RUN — Honor-tablet fix effectiveness tracking (not a new fix, a measurement experiment on the existing one).**
- Hypothesis: the already-shipped alias fix (Section I) is durably resolving Honor-variant demand, not just resolving it in this session's spot-check.
- Audience: all real sessions searching any Honor-transliteration variant.
- Primary metric: genuinely-unmet Honor-tablet queries per week (§16 methodology).
- Guardrails: Honor-brand false-positive rate (manual spot-check monthly, per Section I's method); Amazon Honor-tablet redirect count (should hold or grow, not drop).
- Campaign ID: n/a (organic search behavior, not a campaign).
- Duration: 4 weeks (covers the "recurring all month" pattern the August review found).
- Minimum useful evidence: ≥5 more real Honor-variant search sessions.
- Success condition: unmet-Honor-query count stays near zero across the window.
- Stop condition: if unmet queries reappear, re-open as a bug, not a new experiment.

**2. RUN — University-context laptop content (the one area with both broad demand AND redirect proof, per the August review §6/§9).**
- Hypothesis: budget-anchored, use-case-anchored laptop content ("laptop for university under 4,000 SAR") converts to Noon redirects at a rate consistent with August's organic pattern.
- Audience: Arabic-speaking students/parents researching laptops.
- Primary metric: Noon laptop-category redirect count per week.
- Guardrails: overall answer rate (must not regress below 80%, the governed floor); no single session driving >30% of the week's laptop search volume (Check 5 of `tps:sanity`).
- Campaign ID: one campaign-level UTM (`utm_campaign=laptop_university_wave1`), not per-post.
- Duration: 2 weeks.
- Minimum useful evidence: ≥10 real sessions attributable to the campaign.
- Success condition: ≥1 attributable Noon redirect per 5 attributable sessions (a directional floor, not a statistically powered target at this volume).
- Stop condition: zero attributable redirects after 2 weeks and ≥10 sessions.

**3. DO NOT RUN YET — air-conditioner content/commercial push.**
- The August review's #1 raw demand category (1,204) is confirmed materially inflated by the now-fixed repeat-fire bug (Section A #1), and shows almost no redirect follow-through at either monetizable merchant even before that correction. Running a real experiment on this evidence would be experimenting on an artifact, not a signal.
- **Required before this can become a real experiment:** re-run `npm run tps:sanity` (or the August category-demand query) for at least 2 clean weeks post-fix (7149501, live since this session) to get a genuine, non-inflated air-conditioner demand baseline, then decide.

## L. Weekly sanity system

`npm run tps:sanity` (`scripts/tps-analysis/measurement-sanity.ts`), Section B item 6. Read-only, non-destructive, reuses the governed `command-center-queries.ts` functions. Default window: last 7 days; supports `--days=N` or `--from=/--to=` for an explicit period (used to re-derive the August clean baseline in Section D).

**The 7 checks it runs, PASS/WATCH/FAIL with evidence, exactly as the program specified:**
1. Same event/query unexpectedly repeated in one session (5-minute sliding window; FAIL at ≥150 fires, matching the confirmed August incident's own scale).
2. Daily merchant redirects wildly inconsistent with sessions/browse activity (the generalized Aug-31/Sept-1 signature: high redirect volume, ≥80% with no session_id, more anonymous exits than the day's whole real-session population).
3. Missing session/source/campaign on business-critical events.
4. Test/internal/bot contamination (now using the widened Section B #4 bot-UA list).
5. Abnormal concentration — platform-wide (top-session search share) and per-product (redirect concentration).
6. Affiliate import/reconciliation status (flags WATCH whenever affiliate-tagged redirects exist with zero imported reports — i.e., every week until Section G/H closes).
7. Sudden no-result/retrieval regression (80% answer-rate floor, matching the existing governed `LAUNCH_KPI` constant — one threshold, not re-picked).

**Already proven itself twice in this session:** running it against August re-derived both previously-known defects purely from thresholds (no manual investigation needed), and running it in its default live-window mode caught the Section A #3 live anomaly on its first run.

**Scheduling:** not scheduled automatically this session — the program's own instruction was to schedule it only "if clearly safer and more useful than manual execution... provided it does not create material cost/noise." Given this script's Check 2/6 results should be READ by a human (a FAIL on Check 2 might warrant an immediate look, not a silent log entry), and given the existing Founder Intelligence email/dashboard infrastructure (ADR-277/278) is the established channel for founder-facing automated signals, the safer near-term step is a manual `npm run tps:sanity` each Monday per Section M — wiring it into a cron/email is a natural next step once its threshold calibration has a few more real weeks behind it, not assumed correct on day one.

## M. September founder scorecard

Maximum 8 metrics, as specified:

1. **Real sessions this week** — are more real independent visitors arriving?
2. **Searching sessions ÷ total sessions** — are they expressing real shopping demand?
3. **Session-level answer rate** (governed 80% floor) — is Tawveeri answering them?
4. **Qualified referred sessions** — are they reaching merchants?
5. **Real, attributed non-direct click count, by UTM source** — can we attribute where they came from?
6. **Amazon + Noon affiliate-tagged redirect count** — are Amazon/Noon producing traffic that could become orders?
7. **Confirmed orders/commission** (shows "N/A — not yet imported" until Section G/H closes) — is commission being created?
8. **`tps:sanity` FAIL/WATCH count** — is measurement itself trustworthy this week?

## N. Remaining unknowns

1. **The live Sept 1 anomaly's root cause and whether it is still running.** High confidence it is an automated process (11-UA rotation, 10-hour sustained pacing, spoofable-or-genuine `tawveeri.com` referrer, zero matching browse activity) — no confidence yet on WHO/WHAT specifically, since its UAs are ordinary real-browser strings, not self-identifying bot signatures the existing detection can catch.
2. **Whether `/go` needs rate limiting, and at what threshold.** Deliberately not decided this session — the observed pacing (~1–13/min) is slow enough that a naive limit might not even stop this specific pattern while risking false positives against a real shopper opening several comparison tabs quickly. This needs dedicated design + load testing, not a same-session guess on the revenue-critical exit path.
3. **Whether any of August's 203 decision-grade affiliate-tagged redirects converted to a sale.** Entirely unmeasured — Section G/H's hard stop.
4. **Whether the noon relationship is genuinely live and Adjust-attributed today**, or needs a founder-side check — resolved-by-primary-evidence in Section C/H, but not independently confirmed against a live noon dashboard this session (no account access).
5. **True decision-grade Amazon-only and noon-only redirect counts** (Section G/H used a proportional estimate from the combined 245→203 correction, not a separately-run per-merchant anomaly exclusion) — a 10-minute follow-up query, not done this pass to keep the program moving.
6. **Whether the September #1 priority (import an affiliate report) can be started before the founder is available** — it structurally cannot; this is the single largest blocker on the whole program's stated business objective (commercial truth).

## O. Exact rollback points

| Commit | What it did | Rollback |
|---|---|---|
| `7149501` | Search-duplication root-cause fix + client dedup guard + go_click field completeness | `git revert 7149501` (safe — no schema change, pure app-code) |
| `b1aff9d` | `/go` bot-UA widening, extracted to `bot-detection.ts` | `git revert b1aff9d` (safe — additive detection only) |
| `d2609b8` | `outbound_clicks.ip_address` migration + `/go` IP capture + `tps:sanity` script | App-code portion: `git revert d2609b8`. **Migration is NOT reverted by a code revert** — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is additive and safe to leave in place even if the app-code revert happens; if the column itself must be removed, that is a separate, manual `ALTER TABLE outbound_clicks DROP COLUMN ip_address` decision, not bundled into this rollback path |

Pre-program baseline: `cb75d06` (the exact commit the August review itself was generated against). `git reset --hard cb75d06` would fully undo all three commits above if ever needed, but a targeted `git revert` of the specific commit is the safer default per the repo's own git-safety conventions.

## P. Exact commits/deployments

```
d2609b8 feat(measurement): weekly sanity check script + IP capture on outbound_clicks (ADR-282)
b1aff9d fix(go): widen /go bot-UA detection; extract to testable module (ADR-282)
7149501 fix(analytics): close circular URL<->state sync causing search-event repeat-fire; add client-side duplicate-fire guard (ADR-282)
```
All three pushed to `origin/main` and, per the repo's Railway auto-deploy-on-push convention (CLAUDE.md), live in production at time of writing. Migration `scripts/database/43-outbound-clicks-ip.sql` applied directly to production (`vyceqrzttspyycdpojtn`) via `node scripts/run-migration.js`, confirmed successful.

No `next build` was run locally against a live dev server (avoiding the known `.next` collision hazard); relied on `tsc --noEmit` + the full Jest suite (163/163 suites, 2636/2636 tests, run 4 times across this program with zero regressions) as the pre-push gate, consistent with how the rest of this session's commits were verified.

## Q. What the founder should do next

**Immediately (this is time-sensitive):**
1. Confirm whether anyone/anything internal (a QA pass, a link-checker, a partner integration) could explain the Sept 1 pattern (617 rows, 11 UAs, 10 hours, no session) before assuming it's external — a 5-minute check that would resolve Section N.1 outright.
2. If external, decide whether to address it at the infrastructure level (Railway/Cloudflare IP block, if available) using the IP addresses now being captured going forward — this session could not backfill IPs for the rows already written, only future ones.

**This week (the program's #1 business objective):**
3. Log into Amazon Associates Central and check whether an Earnings or Orders report is available for the `tawveeri0f-21` tag; download and share the CSV (or just its header row) per Section G's exact ask — nothing else is blocking Amazon commercial truth.
4. Check noon's affiliate/Adjust reporting dashboard for any Tawveeri-attributed orders since 2026-08-07; share whatever it shows, even a screenshot.

**When convenient:**
5. Consider minting 2–4 Amazon Tracking IDs for campaign-level attribution (Section J) — low effort, meaningfully improves what September's data can prove.
6. Run `npm run tps:sanity` once a week (Monday, per Section M) until it feels natural to wire into an automated channel.

---

**SEPTEMBER #1 BUSINESS OBJECTIVE:** Turn August's 203 decision-grade affiliate-tagged redirects from a traffic count into a revenue count by importing the first real Amazon and/or noon commission report.

**THE NUMBER THAT WILL TELL US IF SEPTEMBER WORKED:** Confirmed commission (SAR), even if it is a small or zero number reported WITH confidence — the win is the number existing at all, not its size.

**THE BIGGEST REMAINING UNKNOWN:** What is generating the live, ongoing, no-session `/go` redirect pattern (617+ rows and counting as of this report) — and whether it has been running, undetected, for longer than the ~10 hours this session happened to catch.
