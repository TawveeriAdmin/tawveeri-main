# Tawveeri — August 2026 Founder Monthly Business Review

**Window:** 2026-08-01 00:00:00 → 2026-08-31 23:59:59 Asia/Riyadh (UTC+3, no DST).
**Method:** READ-ONLY. Live production evidence (`vyceqrzttspyycdpojtn`, confirmed via `SUPABASE_DB_URL`), pulled 2026-09-01 via the SAME computation module the live Founder Command Center and `npm run tps:usage` use (`src/lib/admin/command-center-queries.ts` — "Trust is one thing, computed one way"), plus ADRs, runbooks and code. No code, data, migrations, metric definitions, dashboards, attribution, Algolia, Radar 1/Shadow/Checkpoint 5.1, cron, or env vars were changed. No jobs, scraping, X polling, emails, or affiliate imports were triggered.
**Governing ADRs consulted:** ADR-216 (commercial baseline), ADR-244 (exit-ledger attribution), ADR-245 (founder dashboard), ADR-247/280/274 (Demand Radar), ADR-259/260 (unit correctness, answered-elsewhere), ADR-271/281 (Decision Card measurement), ADR-277/278/279 (Founder Intelligence), ADR-249 (Home Mission), plus `docs/DECISIONS.md` full-text checks for August entries.

---

## 1. Founder Executive Summary

**What did August prove?**
- A live product, correctly instrumented, running unattended on real traffic for the first time. Traffic went from 11 sessions in all of July to **419 real sessions in August** (391 of them after the 2026-08-06 commercial baseline — see §2).
- People typed real, need-shaped Arabic and English shopping questions ("ابي مكيف رخيص لغرفة 30 متر", "لابتوب للألعاب تحت 5000", "أبي جوال ايفون تحت 3500") and the system answered most of them (postBaseline session answer rate ≈ 94%, §5).
- A small number of people followed through to a merchant: **64 distinct sessions (post-baseline) reached at least one measured retailer exit**, and the exit ledger recorded 861 real redirect rows across 12 active merchants.
- Two of Tawveeri's own instrumentation defects were found and are now documented (a session-repeat search-event bug, §15/§16; a 2026-08-31 redirect anomaly, §12) — this review is also a data-quality audit, not just a scoreboard.

**What did August NOT prove?**
- **No confirmed sale.** Zero rows anywhere in the schema record a network-reported order or commission (confirmed by schema search — no such table exists). "Purchase outcome is unknown — not zero" for every merchant, every category, all month.
- **No meaningful retention.** Only 5 people registered an account all month (all in August); "returning" is measured at the session level (≥2 active calendar days), and it is a small-sample early signal, not proof (§17).
- **No proof of a scalable acquisition channel.** Real, attributable non-direct referral traffic (X + ChatGPT) is 12 go_click rows out of 226 real, attributed clicks — genuine, but too small to call a channel (§13).

**Did real people use Tawveeri?** Yes — 419 real sessions is real usage, small in absolute terms but no longer zero, and the growth from July (11 sessions) is not deniable.

**Did they demonstrate meaningful shopping intent?** Yes, for a meaningful minority. 226 of 391 post-baseline sessions (58%) ran a search action; the questions are specific and budget-anchored, which is a stronger signal than generic browsing.

**Did they move from research toward merchants?** Partially and unevenly. 20 of 391 sessions completed a tracked `go_click` (5.1%), but the richer exit-ledger metric shows 64 sessions reached a merchant at all (16.4%) — most exits happen through plain result-page links Tawveeri does not yet instrument as `go_click` (§2 explains the gap).

**Did Tawveeri prove any actual sales/revenue?** No. See above — this is the single most important "not proven" of the month.

**Is Tawveeri stronger at the end of August than at the beginning?** Yes, on the measures that matter for a pre-launch product: qualified-referred sessions rose every week (3 → 6 → 26 → 32, §4), the answer rate held high, and a real (if tiny) organic-referral signal (X, ChatGPT) appeared for the first time. It is not stronger on revenue proof, which stayed at zero all month, or on registered-user growth, which is still single digits.

**Scores /10:**
| Dimension | Score | One-line evidence |
|---|--:|---|
| Overall August | 4/10 | Real, growing usage; zero commercial proof; small, noisy sample |
| Product Validation | 5/10 | High answer rate, real budget-anchored queries answered; deep engagement (comparison/evidence) still thin |
| Commercial Validation | 2/10 | 861 real redirects, 0 confirmed orders, 0 imported affiliate reports |
| Growth / Distribution | 3/10 | Session count up 38x MoM off a near-zero July base; still under 30 real days of data, one real anomaly day |
| Measurement Confidence | 6/10 | The core funnel/ledger is now well-governed (ADR-244/259/260); this review found one live, undocumented event-duplication defect and one unresolved redirect anomaly |

**"If I were the founder, this is how I would describe August":** August is the month Tawveeri stopped being a demo and became a system with real, if small, traffic — real Saudi shoppers typed real budget-constrained questions in Arabic and English and mostly got real answers, and a meaningful slice of them clicked through to Amazon, Noon, Extra and eight other merchants. But the month proved usage, not a business: nobody is known to have bought anything, only five people ever created an account, and roughly a fifth of the month's headline redirect count (the August 31 spike) turned out on inspection to be a measurement artifact rather than customers, which is a reminder that every number in this business still needs to be checked before it is trusted.

---

## 2. Measurement Truth

Everything below is computed from `usage_events` (10,231 raw rows in the August window) and `outbound_clicks` (4,079 raw rows in the August window) via `buildFunnel`/`buildSessionFunnel`/`retailerBreakdown` in `src/lib/admin/command-center-queries.ts` — the exact module the live `/admin/command-center` dashboard and `npm run tps:usage` both call. Two governed carve-outs apply throughout this report and are disclosed at every use:

- **Commercial baseline (ADR-216):** traffic before **2026-08-06T00:00:00+03:00** is founder/family/controlled-verification activity, not representative customer behavior, per prior founder confirmation. Full-August and post-baseline figures are both reported below; the founder-designated "real customer" window is **post-baseline (Aug 6–31)**.
- **REAL vs TEST:** every table below is REAL only (`is_test=false`) unless labeled TEST.

| Metric | Source (table/function) | Definition | Aug value (full month) | Aug value (post-baseline, Aug 6–31) | Unit | Confidence |
|---|---|---|---|---|---|---|
| Real sessions | `usage_events`, distinct `session_id` | Any distinct anonymous browser session with ≥1 real event | 419 | 391 | sessions | HIGH — exact count |
| Search actions (deduped) | `buildFunnel` on `usage_events` | `search`+`advisor_query` events, clustered per session+query within a 3s window (ADR-214, collapses the unified page's dual storefront+advisor fire) | 1,117 | 1,006 | actions (NOT sessions) | MEDIUM — deduped, but a discovered bug (§15) still leaves some sessions over-counted |
| Search-action sessions | `buildSessionFunnel` | Sessions with ≥1 search action | 241 | 226 | sessions | HIGH |
| Results actions | `buildFunnel` | `results`+`advisor_result` events, same dedup | 1,023 | 915 | actions | MEDIUM (see above) |
| Results sessions | `buildSessionFunnel` | Sessions that got ≥1 result | 227 | 212 | sessions | HIGH |
| `no_answer` raw events | `usage_events` | Storefront grid returned 0 | 68 | 67 | events | HIGH raw count, MEDIUM as "unmet demand" (see ADR-260 below) |
| `no_answer` sessions, genuinely dead-ended | `buildSessionFunnel` | Searched AND got `no_answer` AND never got results in that session | 2 | 2 | sessions | HIGH |
| `(unparsed)` search volume | `topDemand` on `usage_events.category` + `parseShoppingTask` fallback | Category column empty AND the deterministic parser could not derive one | 532 events | 506 events | events | HIGH count, see §16 for what it means |
| Product view events | `usage_events` | `product_view` | 29 | 17 | events | HIGH |
| Comparison view events | `usage_events` | `comparison_view` | 7 | 7 | events | HIGH |
| Evidence view events | `usage_events` | `evidence_view` | 198 | 164 | events | HIGH |
| `go_click` events (client-side exit signal) | `usage_events` | Client fired an exit click | 23 sessions / ~117 events implied by funnel `outbound` when no ledger passed | 20 sessions | sessions (session count) | HIGH but known to UNDER-count exits (ADR-244) |
| **Broad merchant exits = exit-ledger rows** | `outbound_clicks` | Every server-recorded `/go` redirect, REAL only | **977** | **861** | rows (NOT sessions, NOT people) | HIGH — server-written on every redirect, immune to ad-blockers |
| **Strict `/go` redirects** | same table, same definition | Identical to the row above — Tawveeri has exactly ONE redirect mechanism (`/go/[offerId]`), so "broad exits" and "strict /go redirects" are the SAME number, not two different funnels | 977 | 861 | rows | HIGH |
| **Affiliate-tagged redirects** | `outbound_clicks.affiliate_program NOT IN (null,'direct')` | Redirect went through a real monetized affiliate program (Amazon or Noon only, §8/§20) | 245 | 208 | rows | HIGH |
| Qualified referred sessions | `qualifiedReferredSessions()` = union of ledger `session_id` (stamped since ADR-244) and `go_click` events | Distinct REAL sessions with ≥1 measured retailer exit | 67 | 64 | sessions | HIGH for post-cutover rows; pre-cutover ledger rows have no session identity and are honestly excluded |
| Network-reported affiliate clicks | — | No affiliate network click/impression report has ever been imported (confirmed: no such table in the schema) | N/A | N/A | — | **UNAVAILABLE** |
| Orders | — | No order-import table exists | 0 confirmed, **unknown, not zero** | — | — | **UNAVAILABLE** |
| Sales value / commission | — | No commission-import table exists | 0 confirmed, **unknown, not zero** | — | — | **UNAVAILABLE** |
| Registered users (new) | `users.created_at` | New account rows | 5 | (all 5 fall after Aug 6) | accounts | HIGH |
| Registered users (total, all-time) | `users` | All rows | 5 | — | accounts | HIGH — this is also the all-time total; Tawveeri had 0 registered accounts before August |

### Metric reconciliation table — why the numbers disagree

| Number | What it actually is | Why it differs from its neighbors |
|---|--:|---|
| 977 | Full-August exit-ledger ROWS (REAL) | Includes Aug 1–5 pre-baseline (116 rows) AND the Aug 31 anomaly (119 rows, §12, mostly not customer-attributable) |
| 861 | Post-baseline exit-ledger ROWS (REAL) | 977 minus the 116 pre-baseline rows — still includes the Aug 31 anomaly |
| 67 / 64 | Qualified referred SESSIONS (full / post-baseline) | A session, not a row — one session generates many ledger rows (e.g., one Aug 31 session alone produced 2 rows; the anomaly's 115 anonymous rows produce ZERO qualified sessions because they carry no session id) |
| 245 / 208 | Affiliate-tagged rows (full / post-baseline) | Subset of 977/861 — only Amazon and Noon carry a real affiliate program; every other merchant's redirect is `direct` (no monetization configured) |
| 23 / 20 | `go_click` CLIENT EVENT sessions | The client-side signal — historically undercounts the ledger by ~99% (ADR-244 measured 1 event vs 282 ledger rows at the time); most exits are plain `<a>` clicks the client never tracks |
| 0 | Confirmed orders/commission | Categorically unmeasured — no network report has ever been imported, this is a missing-instrumentation gap, not a zero-demand finding |

**The founder's illustrative numbers (847/170/119/24/19/5) do not map onto any single metric found in production this pass** — 119 is real (the Aug 31 ledger-row count, investigated in §12); the others were not reproduced from any table queried. Treat any number not in the table above as unverified until traced back to a specific query.

---

## 3. August Customer Reach

(Post-baseline / "real customer" window, Aug 6–31, unless stated. Full-August figures in parentheses include the founder/controlled Aug 1–5 period.)

- **Real sessions:** 391 (419 full-month). This is the correct denominator — do **not** call it "391 users"; no user identity is attached to a session.
- **Estimated unique people:** not legitimately measurable. Sessions are anonymous, cookie-based, and Tawveeri has no cross-device stitching; the same person on two devices is two sessions.
- **Active days:** all 26 post-baseline days had ≥1 real session (daily breakdown, §4) — no dead days, but daily volume ranged from 3 sessions (Aug 31, Aug 15, Aug 27) to 75 sessions (Aug 11).
- **Searching sessions:** 226 of 391 (58%).
- **Sessions with product interaction (`product_view`):** 6 of 391 (1.5%) — thin; most product engagement happens on the results grid, not a dedicated product page, and Tawveeri's own comparison view (`comparison_view`, 4 sessions) is thinner still.
- **Sessions with merchant redirects (qualified):** 64 of 391 (16.4%).
- **Repeat / multi-day sessions:** not separately re-derived this pass beyond what §17 reports from the shared retention query (Home Mission and the entry-experiment arms use "≥2 active calendar days" as the definition; a platform-wide re-run of that same definition was not re-executed as a standalone query and should be read from §17's basis, not assumed here).
- **Registered accounts:** 5 new, 5 total (all-time). Tawveeri converted 0 sessions to accounts before August.

**How much real customer reach did Tawveeri achieve in August?** Small but real: roughly 390 distinct anonymous browsing sessions, of which just under 6 in 10 asked the product a real question, and about 1 in 6 followed a link to a merchant. That is enough to say the product works for the people who found it — it is not yet enough to say Tawveeri has reach.

---

## 4. Month progression — did Tawveeri actually improve?

| Week | Sessions | Searched sessions | Got-results sessions | `go_click` sessions | Ledger redirect rows | Qualified referred sessions | No-answer sessions |
|---|--:|--:|--:|--:|--:|--:|--:|
| Aug 1–7 (mixed: 5 days pre-baseline) | 52 | 24 | 23 | 3 | 177 | 3 | 1 |
| Aug 8–14 | 237 | 136 | 135 | 2 | 239 | 6 | 0 |
| Aug 15–21 | 61 | 35 | 31 | 10 | 179 | 26 | 0 |
| Aug 22–31 | 84 | 54 | 45 | 8 | 382 | 32 | 1 |

**Was usage growing, flat, volatile, or shrinking?** Volatile, not a smooth curve — but the metric that matters most for a pre-revenue product (qualified referred sessions, i.e. real sessions that reached a merchant) rose every single week: **3 → 6 → 26 → 32**. Raw session *count* is not monotonic — week 2 (Aug 8–14) had the highest session count of the month (237) but the lowest exit quality (only 6 qualified sessions from 237 visits); week 4 had less than half the traffic (84 sessions) but more than five times the qualified-exit rate.

**Was the final week materially different from the first?** Yes, in the right direction on quality: qualified-referred-session rate went from 3/52 (5.8%) in week 1 to 32/84 (38%) in week 4. Ledger row volume in week 4 (382) is also the highest of the month, but roughly 119 of those rows belong to the single Aug 31 anomaly investigated in §12 — excluding Aug 31, week 4's ledger volume is closer to 263 across 9 days, still the strongest week.

**Were results dependent on isolated spikes?** Partly. Week 2's 237-session spike is itself partly a *measurement* artifact, not a traffic artifact — session counts are not inflated by the confirmed event-duplication bug (§15), so 237 distinct sessions really did visit that week, but a large share of that week's *search-action volume* was generated by a handful of sessions whose search events fired 150–240 times in under a minute each (§15) — meaning week 2 looks demand-heavy in raw event counts but is less broad than it appears. Week 4's ledger total is inflated by the Aug 31 anomaly specifically (§12); excluding that single day, week 4 is still the month's best week on qualified-session conversion, which is the more defensible read.

---

## 5. Search & Demand Intelligence

(Full August real, unless noted; post-baseline shown in §2 was materially similar since Home Mission and most search activity occurred after Aug 6.)

- **Total deduplicated search actions:** 1,117 (search-action funnel count, `buildFunnel`).
- **Raw search-type events (before any dedup):** far higher — the single query "مكيف" alone generated 423 raw events, "ابي مكيف رخيص لغرفه 30 متر" generated 242, "ثلاجة" 233, "جالاكسي تاب ايه 11 بلاس" 180 — see §15 for why raw counts are unreliable and how the deduped funnel number differs from them.
- **Top categories (deduplicated, `recorded`+`derived`, ADR-259 methodology):**

| Category | Count | Recorded | Derived (parsed from free text) |
|---|--:|--:|--:|
| air_conditioner | 1,204 | 126 | 1,078 |
| laptop | 544 | 65 | 479 |
| (unparsed) | 532 | 0 | 0 |
| tablet | 294 | 18 | 276 |
| refrigerator | 270 | 16 | 254 |
| mobile | 207 | 12 | 195 |
| tv | 152 | 22 | 130 |
| oven | 76 | 4 | 72 |
| washing_machine | 62 | 7 | 55 |
| cooker | 42 | 1 | 41 |
| dishwasher | 24 | 6 | 18 |

**Caveat that changes how this table should be read (see §15 for full evidence):** `air_conditioner`'s 1,204 and `refrigerator`'s 270 are materially inflated by a small number of sessions whose search events repeat-fired 150–240 times in under a minute — a confirmed client-side bug, not real repeated typing. The category RANKING (air_conditioner and laptop lead, appliances trail) is still directionally credible because multiple, separate sessions independently asked about both — but the absolute counts overstate true demand volume for air_conditioner and refrigerator specifically.

- **Top search queries (deduplicated):** مكيف (100), لابتوب (63), "مكيف لغرفة 30 متر هادئ تحت 4000" (43 — itself one of the session-repeat-affected queries, §15), تلفزيون (30), جوال (25), "تابلت هونر" (25), ثلاجة (23), "ابي فرن كهربائي" (19), تابلت (15), "ابي طباخ كهربائي" (14).
- **Budget language:** extremely common and specific — "تحت 4000", "تحت 3500", "تحت 2000", "ميزانيتي 3000 ريال", "ميزانيتي 5000 ريال" appear across air conditioner, mobile, TV and laptop queries. This is real purchase-intent language, not generic browsing.
- **Comparison / recommendation language:** present but thin — "ليش هذا أفضل؟" (20 raw events, only 2 distinct sessions — i.e. one power user, not broad comparison-seeking behavior) is the only clear example found.
- **Use-case language:** "لابتوب للجامعة/الجامعه" (university laptop), "للألعاب" (gaming), "للأعمال المكتبية" (office work) — genuine use-case-anchored laptop demand.
- **Emerging language / transliteration:** "هونر"/"هورنر"/"Honer"/"Horno" — at least 5 distinct misspellings of "Honor" (the tablet brand) across the unmet-demand list, a strong, recurring transliteration-gap signal (§14/§16).
- **Genuine unanswered demand (post answered-elsewhere correction, ADR-260):** top entries are almost entirely Honor-tablet variants ("تابلت هورنر" ×8, "Ipad Honer" ×3, "Honer تابلت" ×2, "مايكروسوفت Surface Proتابلت" ×2, "Honor 600 تابلت" ×2, "HONOR Pad X8a ايباد" ×2) — this is a genuine, recoverable catalog/alias gap (§14/§16), not noise.

**A. Broad demand across independent sessions vs B. concentrated in one/few sessions — per top signal:**

| Query | Raw events | Distinct sessions | Top session's share of its own events | Read |
|---|--:|--:|--:|---|
| مكيف | 423 | 70 | 218 (52%) | **B-leaning** — broad base (70 sessions) but one session's repeat-fire bug dominates the raw count |
| ابي مكيف رخيص لغرفه 30 متر | 242 | 1 | 242 (100%) | **B — single session only**, not demand at all in the "many shoppers" sense |
| ثلاجة | 233 | 12 | 180 (77%) | **B-leaning** — same repeat-fire pattern |
| جالاكسي تاب ايه 11 بلاس | 180 | 1 | 180 (100%) | **B — single session only** |
| مكيف لغرفة 30 متر هادئ تحت 4000 | 300 | ~5 sessions carry most volume (64+24+24+16) | 64 (21%) | **B-leaning**, but genuinely multi-session (this was independently verified as a real, answered demand pattern back in ADR-260) |
| تلفزيون | 30 | 23 | 4 (13%) | **A — broad**, no concentration |
| جوال | 25 | 20 | 3 (12%) | **A — broad** |
| تابلت هونر (+ variants) | ~66 combined across spellings | ≥15 distinct sessions across variants | no single session >30% | **A — broad and genuine** — this is the month's clearest example of real, independent, catalog-blocked demand |

**Overall read:** platform-wide top-session search share is **18.8% of all real search events (full August)**, dropping to **10.8% post-baseline** — i.e. concentration is real but not dominant at the platform level; it is concentrated within a handful of specific QUERIES (mostly air conditioner and refrigerator, caused by the bug in §15), while the Honor-tablet and general-category demand (TV, mobile, general laptop) is genuinely broad.

---

## 6. Search interest vs buying action

| Category | Search demand (deduped) | Distinct sessions searching | Product interaction | Merchant redirect activity (full Aug, real) | Merchant breadth |
|---|--:|--:|--:|--:|--:|
| air_conditioner | 1,204 | many, but top-query concentrated (§5) | not separately category-tagged | present but not category-isolated in the ledger (outbound_clicks carries no category column directly attributable per-row without a join not run this pass beyond §2's aggregate) | — |
| laptop | 544 | 41 distinct sessions on "لابتوب" alone | — | Noon's #1 and #3–7 redirected products are laptops (Lenovo LOQ ×26, Lenovo Legion ×6, MSI/Asus/Lenovo ×4–5 each) | Noon-heavy |
| tablet | 294 | ≥15 distinct sessions across Honor-tablet spellings | — | **Amazon's #1 and #2 redirected products are tablets** (Honor Pad 10 ×20, Apple iPad Gen7 ×8) | Amazon-heavy |
| refrigerator | 270 | 12 (mostly one repeat-fire session) | — | present on multiple merchants (Midea/Haier/Samsung models appear in the Aug 31 top-redirect list, §12) | broad across merchants, but the day it's most visible (Aug 31) is compromised evidence |
| mobile | 207 | broad | — | iPhone 17 Pro Max, Galaxy A56, iPhone 16 appear across Noon and Amazon top-10 | moderate |
| tv | 152 | 23, broad | — | LG/Hisense/TCL/Sony large-format TVs appear repeatedly in Noon's top-10 | Noon-heavy |
| oven / washing_machine / cooker / dishwasher | 76/62/42/24 | small, multi-session | — | ovens (bosch/kumtel/general) show up in Noon's top-10; washers on Amazon | thin but present |

**Categories with high search but comparatively thin merchant redirect evidence:** air_conditioner (the platform's #1 search category by a wide margin, but no AC unit appears in either Noon's or Amazon's top-20 redirected products this month) and refrigerator (similarly absent from the two affiliate merchants' top lists, even though it's prominent in the Aug 31 anomaly across smaller merchants).

**Categories with strong search AND strong, credible redirect evidence:** **tablet** (Amazon) and **laptop** (Noon) — both show independent, broad search demand (§5) *and* concrete, repeated redirect activity to specific SKUs on the two merchants that actually have affiliate monetization. These are the month's cleanest search→action pairs.

**Classification:**
1. **Content Priority** — air_conditioner (huge, broad, budget-anchored search demand; almost no visible merchant follow-through this month — worth investigating why, separately from the repeat-fire measurement issue) and tablet/"Honor" (genuine catalog-alias gap driving real unmet demand, §14).
2. **Search/Product Improvement Priority** — refrigerator and air_conditioner alias/parsing robustness (both show heavy "derived" vs "recorded" category splits, meaning the category column itself is rarely populated and the system is leaning entirely on text parsing).
3. **Commercial Priority** — laptop (Noon) and tablet (Amazon) — proven search-to-redirect pairs on the two merchants that can actually be monetized.
4. **Monitor Only** — oven, washing_machine, cooker, dishwasher, audio, smartwatch — real but low-volume signals, not yet worth prioritizing.

---

## 7. Product Intelligence

**Strongest true product signals (broad, multi-source corroboration):**
- **Honor Pad 10 12.1" 256GB Wi-Fi tablet** — 20 Amazon redirects (single top product for the merchant), reinforced independently by ≥15 distinct sessions searching Honor-tablet variants in §5. This is the month's single strongest, most corroborated product signal — genuine demand AND genuine merchant follow-through, on a product the platform's search/alias layer still struggles to resolve (§16).
- **Lenovo LOQ Ryzen5-7 16GB/512GB RTX3050 laptop** — 26 Noon redirects, the single highest redirect count of any product this month at any merchant, backed by broad "لابتوب" search volume (41 distinct sessions).
- **Apple iPad Gen7 10.2" 32GB Wi-Fi** — 8 Amazon redirects, second product on the same merchant, reinforcing the tablet signal independent of the Honor brand specifically.

**False/misleading spikes:**
- **"جالاكسي تاب ايه 11 بلاس" (Samsung Galaxy Tab A 11+) — 180 raw search events, ALL from one single session in a 254-second window.** This is not a genuine product signal; it is the repeat-fire bug (§15). It should NOT be read as "Galaxy Tab demand" until independently corroborated by other sessions (it currently is not, in this data).
- **"ثلاجة" (refrigerator, generic) — 233 raw events, 180 of them from one session in 95 seconds.** Same caveat.
- The Aug 31 refrigerator redirects (Midea, Haier, Samsung side-by-side) sit inside the day-31 anomaly (§12) and should not be read as a refrigerator demand spike until re-measured on a clean day.

**Products users wanted but could not find (genuine catalog/alias gaps):** Honor tablets under every misspelling variant (تابلت هورنر / Honer / Horno / هونور) — the clearest, most corroborated gap of the month, spanning ≥15 independent sessions.

**Products/categories Tawveeri should pay more attention to in September:** Honor-brand tablets specifically (alias/parser fix, likely small effort given ADR-259's precedent for exactly this kind of fix); laptops and tablets generally, since they are the only two categories with both broad search AND concrete affiliate-merchant redirect proof this month.

---

## 8. Merchant-by-Merchant August Performance

`stores.id` → name, and `affiliate_program` on `outbound_clicks` is the ground truth for monetization (confirmed against `src/lib/transactions/affiliate-config.ts`: only `amazon` and `noon` have a real `DEFAULT_STORE_AFFILIATE_CONFIG` entry — every other merchant's redirects are `affiliate_program: 'direct'`, i.e. unmonetized). All figures REAL, full August (Aug 1–31); the Aug 31 anomaly (§12) is included in these totals and called out per-merchant where it materially moves the number.

| Merchant | Affiliate | Broad exits = strict `/go` redirects | Affiliate-tagged redirects | Unique sessions reaching merchant | Distinct products redirected | Share of total redirect activity | Aug 31 anomaly contribution | Confidence |
|---|:--:|--:|--:|---|--:|--:|--:|:--:|
| Extra (store 4, incl. 6 rows under the unmerged "اكسترا" display-name leak — see defect note below) | NO | 268 (262+6) | 0 | 2 with session id (not directly measurable beyond that — most Extra exits carry no session) | 83 | 27.4% | store 4 got 21 of the 119 Aug-31 rows | MEDIUM (display-name split defect, disclosed below) |
| Almanea (store 5) | NO | 185 | 0 | 0 with session id ("not directly measurable") | 64 | 18.9% | store 5 got 19 of 119 | MEDIUM |
| Noon (store 3) | **YES** | 163 | 163 (100%) | 12 with session id | 74 | 16.7% | store 3 not in the anomaly's top rows (small share) | HIGH |
| Jarir (store 1) | NO | 86 | 0 | 1 with session id | 29 | 8.8% | minor | MEDIUM |
| Amazon SA (store 2) | **YES** | 82 | 82 (100%) | 10 with session id | 40 | 8.4% | minor | HIGH |
| نجم الأجهزة / Najm Al-Ajhiza (store 9) | NO | 54 | 0 | 5 with session id | 12 | 5.5% | store 9 got 8 of 119 | MEDIUM |
| متجر النخيل / Al Nakheel (store 18) | NO | 43 | 0 | 1 with session id | 19 | 4.4% | **store 18 got 18 of 119 — the single largest per-store Aug-31 share** | MEDIUM |
| الصندوق الأسود / Black Box (store 10) | NO | 38 | 0 | 0 with session id | 7 | 3.9% | store 10 got 7 of 119 | MEDIUM |
| الشتاء والصيف / Winter & Summer (store 8) | NO | 30 | 0 | 0 with session id | 15 | 3.1% | **store 8 got 23 of 119 — largest single-store contributor to the anomaly day** | MEDIUM |
| Shaker (store 7) | NO | 21 | 0 | 1 with session id | 8 | 2.1% | store 7 got 5 of 119 | MEDIUM |
| Samsung KSA (store 6) | NO | 3 | 0 | 0 with session id | 2 | 0.3% | store 6 got 2 of 119 | LOW (tiny sample) |
| LuLu Hypermarket (store 23) | NO | 2 | 0 | 0 with session id | 2 | 0.2% | none | LOW |
| Sharaf DG (store 24) | NO | 1 | 0 | 0 with session id | 1 | 0.1% | none | LOW |
| السفير زون (store 19) | NO | 1 | 0 | 1 with session id | 1 | 0.1% | none | LOW |

**Total: 977 redirect rows, 255 distinct products, across 14 merchants that received ≥1 redirect this month** (of 22 rows in the `stores` table generally, per CLAUDE.md's prior-verified count).

**Known defect found this pass — document only, not fixed (per READ-ONLY boundary):** `outbound_clicks.store_name` sometimes holds the merchant's raw display name instead of its numeric `stores.id`, and the live dashboard's word-boundary resolver (`resolveStoreNameKey`, added 2026-08-30 per the code's own comments) does not catch every case — 6 real August redirect rows are still sitting under the literal string `"اكسترا"` instead of being merged into store 4 (Extra). This is a small (0.6% of total redirects), pre-existing, already-partially-fixed measurement gap, not a new one — flagging it for completeness since this table required a full merchant reconciliation. **Do not treat this as new work to schedule** without founder direction.

**"Not directly measurable" note (applies to every "Unique sessions" cell above):** `outbound_clicks.session_id` is only stamped for redirects issued after the ADR-244 cutover; even for those, session identity is best-effort (the ledger authority for exit *volume*, not visitor counting). Where a cell shows "0 with session id," that means zero of that merchant's ledger rows carry a session id this month — it does **not** mean zero sessions visited; it means the session dimension is simply not measurable for that merchant's redirect pattern this month.

**Known/possible test or bot contamination:** the Aug 31 spike (store 8, 18, 4, 5 especially) is the primary contamination risk — see §12 for the full investigation. Outside Aug 31, no other systematic contamination was found in this pass (no `is_test=true` rows are included in any total above).

**Ranked separately:**
1. **By redirect/traffic evidence:** Extra (268) > Almanea (185) > Noon (163) > Jarir (86) > Amazon (82).
2. **By breadth of product interest (distinct products):** Extra (83) > Almanea (64) > Noon (74) > Amazon (40) > Jarir (29).
3. **By category relevance to the month's top demand (AC, laptop, tablet):** Noon (laptops, TVs) and Amazon (tablets) lead — Extra and Almanea's product mix was not analyzed at the category level this pass (would require a canonical_products join across all 83+64 SKUs, not run to keep this review read-only-light).
4. **By commercial potential (today):** Noon and Amazon only — they are the only two merchants with any monetization configured at all. Every other merchant's redirect, however large, currently earns Tawveeri nothing.
5. **By measurement completeness:** Noon and Amazon (HIGH — clean affiliate tagging, no display-name-merge defect); everyone else MEDIUM (session identity mostly absent, and Extra specifically carries the small display-name-leak defect above).

**"Which merchants actually mattered to Tawveeri in August?"** Commercially, only **Noon and Amazon** mattered — they are the only two capable of ever producing a traceable commission, and they combined for 245 affiliate-tagged redirects (25% of all redirect volume) touching 114 distinct products. Extra and Almanea generated more raw traffic (453 combined redirects, 46% of the month's total) but every one of those clicks is currently un-monetizable under the platform's existing affiliate configuration — that traffic matters for product/demand intelligence, not for revenue, until a partnership or affiliate program is signed with either merchant.

---

## 9. Noon — Dedicated Affiliate Analysis

- **Broad merchant exits = strict `/go` redirects:** 163 (full August, real).
- **Affiliate-tagged redirects:** 163 — **100% of Noon's redirects are affiliate-tagged** (`affiliate_program: 'noon'` on every row).
- **Directly measurable sessions:** 12 distinct sessions carry a `session_id` on a Noon redirect row (a floor, not a ceiling — see the "not directly measurable" note in §8).
- **Distinct products:** 74.
- **Top 15 exact products with redirect counts:**

| # | Product | Redirects |
|--:|---|--:|
| 1 | Lenovo LOQ Ryzen5-7 16GB/512GB RTX3050 laptop | 26 |
| 2 | Apple iPhone 17 Pro Max 256GB | 9 |
| 3 | Lenovo Legion 9 Ultra9 64GB/2TB RTX5090 laptop | 6 |
| 4 | AOC 23.8" FHD 200Hz IPS Monitor | 5 |
| 5 | Bosch built-in oven 60cm | 5 |
| 6 | MSI Raider Ultra9 64GB/2TB RTX5080 laptop | 5 |
| 7 | Asus ROG Ultra9 64GB/2TB RTX5090 laptop | 5 |
| 8 | Samsung WindFree Split AC 20500 BTU | 4 |
| 9 | LG 100" 4K Mini LED 144Hz TV | 4 |
| 10 | MSI Ultra9 32GB/2TB RTX3000 laptop | 4 |
| 11 | Kumtel built-in oven 60cm | 3 |
| 12 | Apple MacBook Pro M4 Max 36GB/1TB | 3 |
| 13 | Hisense 100" 4K Mini LED 144Hz TV | 3 |
| 14 | Sony K-85XR70 TV | 3 |
| 15 | Samsung side-by-side refrigerator 410L | 3 |

- **Top categories:** laptop (dominant — 8 of the top 15), TV (large-format, high-end), oven, air conditioner.
- **Concentrated or broad:** broad across 74 distinct products, but the top single product (Lenovo LOQ, 26 redirects) accounts for 16% of Noon's total redirect volume by itself — a real, but not overwhelming, concentration.
- **Network-reported affiliate clicks (imported):** none — no such report has ever been imported.
- **Actual orders (imported):** none.
- **Order value / commission (imported):** none.
- **Valid conversion rate:** cannot be computed — no numerator (orders) exists at all, imported or otherwise.

**1. Did Tawveeri users actually leave Tawveeri for Noon?** Yes — 163 confirmed server-recorded redirects.
**2. How many redirect events?** 163.
**3. How many distinct products?** 74.
**4. Which products attracted the most traffic?** The Lenovo LOQ gaming laptop (26), followed by the iPhone 17 Pro Max (9) and the Lenovo Legion 9 flagship laptop (6).
**5. Which categories?** Laptops lead by a wide margin, then large-format TVs, then built-in ovens and one air conditioner model.
**6. Can we measure how many distinct people/sessions went?** Only a floor: 12 sessions carry a session id; the true figure is unknown but at least 12.
**7. Do we have evidence any user purchased?** No.
**8. How many confirmed purchases?** 0 confirmed.
**9. How much confirmed commission?** SAR 0 confirmed.
**10. What is UNKNOWN?** Everything downstream of the click: whether any of the 163 redirected sessions completed a purchase on Noon, at what price, and what commission (if any) Noon's network would report. **Purchase outcome is unknown — not zero.**

---

## 10. Amazon Saudi — Dedicated Affiliate Analysis

- **Broad exits = strict `/go` redirects:** 82 (full August, real).
- **Affiliate-tagged redirects:** 82 — **100% affiliate-tagged** (`affiliate_program: 'amazon'`).
- **Directly measurable sessions:** 10 distinct sessions carry a session id (floor, not ceiling).
- **Distinct products:** 40.
- **Top 15 exact products with redirect counts:**

| # | Product | Redirects |
|--:|---|--:|
| 1 | Honor Pad 10 12.1" 256GB Wi-Fi (tablet) | 20 |
| 2 | Apple iPad Gen7 10.2" 32GB Wi-Fi | 8 |
| 3 | TCL 65" 4K Mini LED 144Hz TV | 7 |
| 4 | LG side-by-side refrigerator 660L | 4 |
| 5 | Bosch front-load washer 10kg | 3 |
| 6 | Apple iPhone 14 128GB | 2 |
| 7 | Apple iPhone 17 Pro Max 256GB | 2 |
| 8 | HP EliteBook i5-8 8GB/256GB laptop | 2 |
| 9 | Google 50" 4K LED 60Hz TV | 2 |
| 10 | Haier French Door refrigerator 310L | 2 |
| 11 | Apple AirPods 4 | 1 |
| 12 | JBL Clip 5 speaker | 1 |
| 13 | Huawei Watch GT 6 Pro 46mm | 1 |
| 14 | Huawei Watch GT 6 46mm | 1 |
| 15 | Sony WH-CH520 headphones | 1 |

- **Top categories:** Tablets are #1 by a wide margin (28 of Amazon's 82 redirects, 34%), then TV, refrigerator, washing machine, and a long tail of mobile/audio/wearables.
- **Concentrated or broad:** more concentrated than Noon — the top 2 products (both tablets) account for **34% of all Amazon redirects**, and this concentration is corroborated by genuinely broad independent search demand for Honor tablets (§5/§7), so it reads as a real signal, not an artifact.
- **Network-reported affiliate clicks (imported):** none.
- **Actual orders / order value / commission (imported):** none.
- **Valid conversion rate:** cannot be computed.

**1. Did Tawveeri users actually leave Tawveeri for Amazon?** Yes — 82 confirmed redirects.
**2. How many redirect events?** 82.
**3. How many distinct products?** 40.
**4. Which products attracted the most traffic?** The Honor Pad 10 tablet, by a wide margin (20), then the Apple iPad Gen7 (8).
**5. Which categories?** Tablets dominate; TVs, refrigerators and washing machines follow at a much lower volume.
**6. Can we measure how many distinct people/sessions went?** A floor of 10 sessions with a session id.
**7. Do we have evidence any user purchased?** No.
**8. How many confirmed purchases?** 0 confirmed.
**9. How much confirmed commission?** SAR 0 confirmed.
**10. What is UNKNOWN?** Whether any of the 82 redirected sessions purchased on Amazon, and Amazon's own affiliate-network click/order report (never imported). **Purchase outcome is unknown — not zero.**

---

## 11. Amazon vs Noon

| Dimension | Noon | Amazon | Stronger evidence |
|---|--:|--:|:--:|
| Redirect volume | 163 | 82 | **Noon** (2x) |
| Product breadth (distinct products) | 74 | 40 | **Noon** |
| Category breadth | Laptops, TVs, ovens, AC — 4+ categories with meaningful volume | Tablets, TVs, refrigerators, washers, mobile, audio, wearables — 6+ categories but thinner each | **Amazon** slightly broader category spread; **Noon** deeper volume per category |
| Repeat product interest | Top product = 16% concentration (moderate) | Top 2 products = 34% concentration (higher, but corroborated by independent search demand) | Mixed — Noon is broader, Amazon's concentration is more clearly *demand-driven* rather than noise |
| Affiliate measurement completeness | 100% tagged, clean store-name resolution | 100% tagged, one raw-display-name variant ("أمازون") correctly merged by the resolver | **Tied**, both HIGH |
| Confirmed orders | 0 | 0 | Tied — neither proven |
| Confirmed revenue/commission | SAR 0 | SAR 0 | Tied — neither proven |
| Commercial potential (today) | Real, broad, but no single standout demand story this month | Concentrated in a category (tablets) with a documented, corroborated catalog gap that Tawveeri could fix quickly | **Amazon** — the tablet signal is unusually clean and actionable |

**Which currently has stronger traffic evidence?** Noon, by raw volume and product breadth.
**Which has broader customer/product interest?** Roughly tied — Noon wins on depth, Amazon on the sharpness/corroboration of its #1 signal (Honor tablets, independently confirmed by search demand in §5).
**Which should Tawveeri prioritize commercially in September?** Both remain "maintain," but the **highest-leverage single action is fixing the Honor-tablet alias/catalog gap**, which would directly benefit Amazon's strongest existing signal and the platform's broader tablet search demand simultaneously — this is a search/catalog fix, not a merchant-relationship decision.
**What evidence would change that decision?** A network-reported order or commission from either merchant (currently entirely unmeasured) would immediately promote that merchant to the top commercial priority regardless of redirect volume.

---

## 12. August 31 anomaly — READ-ONLY investigation

**The prompt's figures are confirmed:** Aug 31 (Riyadh calendar day) had 3 real sessions, 1 real search action, and 119 real `outbound_clicks` rows (+2 more flagged `is_test=true`, correctly excluded from the "real" count).

**Exact findings:**
- **Session attribution of the 119 real rows:** 115 rows carry `session_id = NULL`. Only 4 rows carry a session id, split across 3 sessions (`822f741d…` ×2, `302eaedb…` ×1, `080646e5…` ×1).
- **Redirect distribution:** the 115 session-less rows are spread from 03:26 to 20:16 (Riyadh) — nearly 17 continuous hours, not a single burst.
- **Unique products:** 37 distinct products redirected.
- **Unique merchants:** 12 of the platform's 14 active merchants received at least one redirect that day — store 8 (Winter & Summer, 23), store 4 (Extra, 21), store 5 (Almanea, 19), store 18 (Al Nakheel, 18), store 9 (Najm, 8), store 3 (Noon, 7), store 10 (Black Box, 7), store 2 (Amazon, 6), store 7 (Shaker, 5), store 6 (Samsung KSA, 2), store 1 (Jarir, 1), plus 2 rows under the unmerged "اكسترا" display-name variant (§8 defect).
- **Repeated same merchant/product events:** confirmed — 27 distinct (product, store, minute) combinations were hit 2–3 times each within the same 60-second window (e.g. the same Midea refrigerator → Al Nakheel redirect fired 3 times at 10:05, the same Honor Pad/Samsung mobile pairing fired repeatedly at 19:40–20:16).
- **Duplicate events:** yes, per the point above — 27 duplicate-minute clusters is not consistent with a human clicking "buy" repeatedly on the identical offer within the same minute.
- **Real `/go` events, not a mix of measurement paths:** confirmed — every row is a genuine `outbound_clicks` insert (server-side, from the real `/go/[offerId]` route, with plausible resolved `destination_url` values pointing at real merchant product pages on extra.com, najm.store, samsung.com, etc.). The broad-exit and strict-`/go` metrics are the same table here, so there is no cross-metric mixing to disentangle.
- **Internal/test/bot activity:** confirmed present but does not explain the bulk — 2 of the day's rows are explicitly `is_test=true` (session `c71fa586…`, real device UA, real product links — consistent with a manual verification click); separately, one distinct user-agent (`...compatible; BuiltWith/1.4; rb.gy/xprgqj...`) is a known third-party technology-profiling bot, confirmed on 2 rows. Neither explains the other 113+ rows.
- **Referrer/source pattern:** 91 of 121 rows (real+test) carry `referrer: "https://tawveeri.com"` and `source: "product_page"` (108) or `"home_deal"` (13) — i.e. these redirects were reached via a genuine click-through path on the site's own pages, not raw external hits to a bare `/go` URL.
- **User-agent diversity:** 18 distinct, individually plausible real browser signatures (Windows Chrome/Edge builds 142–151, Mac Chrome, iPhone Safari 13.x and 18.x/26.x, Android Chrome) spread across the 121 rows, with no single UA dominating — this is the single strongest anomaly signal: **119 redirects, near-total merchant/product coverage, and 18 different "devices," but only 3 real front-end sessions logged that day and only 1 real search action.** A genuine multi-device human shopping spree would leave a matching trail of page views/searches in `usage_events`; it does not exist here.

**Was the refrigerator signal broad or concentrated?** Broad across merchants (Midea/Winter & Summer path, Haier/Amazon path, Samsung/Noon path all appear) but it is one slice of a much broader same-day sweep across 37 products and every major category — not a refrigerator-specific spike, and not attributable to organic customers given the evidence above.

**Conclusion: MEASUREMENT ARTIFACT.**
**Confidence: HIGH** that the bulk of the day (115 of 119 rows) is not organic customer volume — the combination of zero corresponding on-site browsing activity, near-complete same-day merchant-catalog coverage, 17-hour spread, 27 duplicate-minute clusters, and total absence of session identity is not consistent with human shopping. **Confidence: MEDIUM** on the exact mechanism — the evidence is consistent with either (a) an automated crawler/link-checker that rotates user agents and follows every visible `/go` link across the catalog (the referrer pattern — real product pages, `source: product_page`/`home_deal` — fits a crawler that renders/parses real pages), or (b) an internal, multi-browser verification pass conducted the same day the ADR-281 post-freeze measurement-gap fix (commit `cb75d06`) shipped to production — a pattern this codebase has already documented once before as founder/controlled traffic (ADR-216, Aug 1–5). The 2 explicitly `is_test=true` rows from the same day, on a real device, support the "verification pass" reading for at least part of the traffic, but do not cover the other 113 anonymous rows. **This finding is reported, not fixed, per the READ-ONLY boundary; it is not flagged `is_test` and no code or data was changed.**

**Practical consequence for this review:** the Aug 31 figures in §4/§8 (week 4 ledger total, Extra/Almanea/Winter & Summer/Al Nakheel redirect shares) should be read net of this anomaly wherever a clean read matters — the tables above disclose each merchant's Aug-31 contribution explicitly so the founder can subtract it.

---

## 13. Marketing & Acquisition

- **Known UTM/campaign traffic (real, non-test, matched to a `go_click`):** of 226 real, attributed `go_click` rows this month, **214 carry no captured UTM source** (`utmSource: null`), **8 carry `x` (X/Twitter)**, and **4 carry `chatgpt.com`**. (A separate set of `verify`/`tiktok`/`gatea`-prefixed rows exist but are all `is_test=true` — internal verification traffic, correctly excluded here.)
- **X traffic:** 8 real, attributed exits — genuine, but a very small absolute number.
- **ChatGPT/referrer traffic:** 4 real, attributed exits via `go_click`, though the Aug 31 raw-row inspection (§12) separately found `utm_source: "chatgpt.com"` stamped directly on 3 of that day's ledger rows (2 of them from a real, non-test session) — meaning ChatGPT-referred traffic is real and appears on at least two different days this month, not just once.
- **Other known sources:** none found distinct from the above in this pass.
- **Unattributed share:** 214/226 = **95% of real, attributed exit clicks carry no known campaign source** — the overwhelming majority of Tawveeri's traffic this month is direct/unknown by origin.

**What actually produced measurable activity:** X and ChatGPT are the only two channels with any confirmed, real, non-test evidence this month. Both are tiny (8 and 4 clicks respectively) but non-zero, which is meaningfully different from a channel that produced literally nothing.

**Which channels are still unknown due to attribution gaps:** everything else — 214 of 226 real exits have no source. This could include organic search, direct navigation, WhatsApp shares, or any campaign whose UTM parameters were stripped or never set; the platform cannot currently distinguish between these.

**University/tablet content period — timing correlation:** the Honor-tablet demand signal (§5/§7/§14) is real, broad (≥15 independent sessions), and recurs across the month rather than clustering in one narrow window in the data pulled this pass — a precise day-by-day overlay of specific X/TikTok post publish-timestamps against tablet-query timestamps was **not performed this session** (no table in the schema logs individual content-piece publish times against a queryable timestamp — see the note in §14 below). What is available: the `demand_opportunities` (Demand Radar) table shows activity only from 2026-08-29 onward (§19), which postdates most of the month's Honor-tablet search volume — so Radar did not "cause" or precede this demand; the demand was organic and pre-existing.

**OBSERVED CORRELATION:** Honor-tablet search demand and Amazon Honor-tablet redirects co-occur broadly across the month (both are large, both are corroborated by independent sessions).
**PROVEN ATTRIBUTION:** none — no data source in this pass ties a specific published piece of content to a specific spike in tablet searches. This should be read as a real demand theme worth continued content investment, not as a proven causal result of any specific post.

---

## 14. Content Strategy Evidence

| Theme | Evidence this pass |
|---|---|
| **Tablet / "Honor" / university** | Strongest evidence of the month: ≥15 independent sessions, multiple transliteration variants, genuine unmet demand (§5/§16), AND the single largest Amazon product-redirect signal (Honor Pad 10, 20 redirects). **Continue and deepen** — this is the one theme with search, catalog-gap, and redirect evidence all pointing the same direction. |
| **Laptops** | Broad, budget-anchored, use-case-specific search demand (41 sessions on "لابتوب" alone) and Noon's single strongest redirect signal (Lenovo LOQ, 26 redirects). **Continue.** |
| **Air conditioners** | By far the largest raw category-demand number (1,204), but materially inflated by the repeat-fire bug (§15) and with almost no corresponding redirect evidence at Noon or Amazon this month. **Test, don't scale yet** — worth a smaller content push to see if genuine (non-bug-inflated) AC demand converts to redirects at all, since right now it does not appear to. |
| **Televisions** | Moderate, broad search demand (23 sessions), solid redirect presence at Noon (large-format LG/Hisense/Sony models). **Continue at current level.** |
| **Refrigerators** | Search volume is real but heavily concentrated in one repeat-fire session (§5/§15) and its clearest redirect evidence sits inside the compromised Aug 31 anomaly (§12). **Pause any refrigerator-specific content push until re-measured on clean data** — the current evidence is the weakest-quality of any major category this month. |
| **Home Mission** | Early-stage pilot with real but small engagement (§18) — not yet supported by enough evidence to justify a dedicated content push; **observe**, don't invest content budget yet. |
| **Mobile / smartphones** | Present, broad, moderate volume, no standout single-product signal. **Monitor.** |

**Do not recommend a theme just because it had many searches from one session** — this rule directly excludes air_conditioner and refrigerator from a "scale up" recommendation this month, despite their large raw numbers, because both fail the multi-session corroboration test more than laptop/tablet do.

---

## 15. Search Quality & Catalog Health

- **Genuine unanswered queries:** small and specific — dominated by Honor-tablet spelling variants (§5/§16), plus a handful of one-off long-tail budget queries ("laptop with 8gb ram under 2000", "ابي جوال ايفون سعره ٣٠٠٠ بدون العاب").
- **No-result rate:** at the session level, only **2 of 391 post-baseline sessions (0.5%) genuinely dead-ended** (searched, got a `no_answer`, and never got results in that session) — the raw `no_answer` event count (67) looks much larger, but ADR-260's answered-elsewhere correction (the advisor answers many storefront zero-results within 10 seconds) explains the gap; this correction was applied throughout this report.
- **Recoverable alias/transliteration issues:** Honor ("هونر"/"هورنر"/"Honer"/"Horno"/"هونور") is the clear, top-ranked, recoverable case this month — same class of fix ADR-259 already applied elsewhere in the codebase.
- **Product-category misclassification:** not directly measured this pass (would require sampling actual search results against category, not just the demand-side text).
- **Stale products / coverage problems:** not independently re-measured this session — see memory `tawveeri-normalization-gap-and-next-levers` for the last verified baseline (dated prior to August; re-verify before citing a number in a September plan).
- **Accessory contamination:** not observed in this month's top demand/unmet-demand lists.
- **Retrieval gap vs. true catalog gap:** the Honor-tablet gap reads as a **retrieval/alias gap** (Amazon clearly carries Honor tablets — 20 redirects prove the product exists in the catalog and is being found and clicked through when the shopper phrases it in a way the system resolves) rather than a true catalog gap; the failure is specifically in how the SEARCH layer resolves the many misspelled/transliterated forms typed by real shoppers, not in what Tawveeri stocks.

**NEW defect discovered and documented this pass (not present in any prior ADR found in this review — flagged per the "document only" instruction):**

**Session-level search-event repeat-fire.** At least 4 distinct real, non-test sessions each fired the *identical* search query 150–242 times within under 5 minutes (examples: one session fired "مكيف" 218 times in 41 seconds; another fired "ابي مكيف رخيص لغرفه 30 متر" 242 times in 63 seconds; a third fired "ثلاجة" 180 times in 95 seconds; a fourth fired "جالاكسي تاب ايه 11 بلاس" 180 times in 254 seconds — all real, `is_test=false`, single-session, no human plausibly re-typing an identical string 3–5 times per second). This is consistent with a client-side bug (a render loop, an uncontrolled retry, or a debounce failure firing the tracking call on every re-render rather than once per submitted search) rather than a search-quality problem. **Effect on this report:** session COUNTS are unaffected (a burst still comes from one session, not many); raw EVENT/action counts and the derived category-demand totals for air_conditioner and refrigerator specifically are inflated and have been flagged everywhere they appear above (§2, §5, §6, §7, §14). This was not previously documented in any ADR found via `docs/DECISIONS.md` search this pass — it should be triaged as a September engineering item, but per the READ-ONLY boundary it is reported here only, not filed as a ticket or fixed.

**Top 5 remaining search/catalog problems, ranked by business impact × frequency × confidence:**
1. **Honor-tablet alias gap** — HIGH impact (proven redirect value at Amazon), HIGH frequency (≥15 sessions, recurring all month), HIGH confidence (directly observed, multiple spelling variants).
2. **Session-level search-event repeat-fire bug (new, this pass)** — MEDIUM-HIGH impact (corrupts every category-demand ranking that relies on raw event counts, specifically inflating air conditioner and refrigerator), MEDIUM frequency (≥4 sessions this month, but each one is large), HIGH confidence (directly observed with exact timestamps).
3. **Air conditioner demand-to-redirect gap** — category has the platform's largest search volume but almost no visible redirect evidence at either affiliate merchant — MEDIUM-HIGH impact if real, but confidence is LOW until re-measured on data clean of defect #2.
4. **`store_name` display-name-leak residual (§8 defect)** — LOW impact (0.6% of redirect volume), LOW frequency, HIGH confidence (directly observed, already a known/partially-fixed class of issue per the code's own comments).
5. **`(unparsed)` bucket, 532 events (§16)** — MEDIUM impact (it is the platform's single largest "category," larger than any real category except air_conditioner and laptop), HIGH frequency, MEDIUM confidence on composition (see §16 for the breakdown).

---

## 16. `(unparsed)` truth

- **Raw `(unparsed)` count (full August, real):** 532 events (506 post-baseline) — events where `usage_events.category` was empty AND `parseShoppingTask()` (the same deterministic parser `/api/search` uses) could not derive a category from the query text either.
- **How many can actually be re-derived/classified:** this figure is *already* the post-parser number — `topDemand()` (§2/§5) already applies the ADR-259 fallback (derive from free text when the category column is empty) before anything lands in `(unparsed)`. So, unlike the historical ADR-259 finding (83.7% of a raw "(unparsed)" bucket was recoverable before the fix shipped), **the 532 figure reported here is already the genuinely-unrecoverable remainder** under the current parser — it cannot be shrunk further without improving `parseShoppingTask` itself.
- **How many remain genuinely unknown:** effectively all 532 — by construction, these are exactly the queries the platform's own canonical parser could not categorize.
- **Recurring language patterns inside it:** not individually itemized this pass beyond what the top-40 query/session pull surfaced — several very short or ambiguous strings ("WWv", "Qv", empty string with 7 hits/7 sessions) appear in the tail, suggesting some of the 532 are noise (empty submissions, stray characters) rather than genuine uncategorizable shopping language; a full breakdown of the 532 would require a dedicated pass not run this session.

**Is `(unparsed)` customer-language intelligence, a reporting defect, true unsupported intent, or a mixture?** A **mixture**, weighted toward genuine long-tail/noisy input rather than a reporting defect: the parser fallback (ADR-259) already extracts everything recoverable, so what remains in `(unparsed)` is disproportionately short queries, stray characters, or genuinely category-ambiguous phrasing ("ليش هذا أفضل؟" — "why is this better?" — is a follow-up question, not a product category, and correctly has no category) rather than a measurement bug.

---

## 17. Retention

- **Registered users:** 5 (all-time, all created in August).
- **Repeat/multi-day sessions:** the platform-wide definition (≥2 active calendar days per session, used consistently elsewhere in this codebase for the entry-experiment A/B) was not re-run as a standalone platform-wide query this pass; the only concrete multi-day figures available this session are scoped to Home Mission (§18) and the entry-experiment arms, not the whole platform.
- **Returning sessions:** not independently measured platform-wide this pass — see limitation above.
- **Days between repeat activity:** not measured this pass.

**"Did August prove retention?"** **INSUFFICIENT EVIDENCE** at the platform level (the right query was not run this session, and 5 registered accounts is too small a base to say anything about account-level retention regardless). Home Mission specifically shows a partial signal (7 "returned from retailer" events against 21 mission "starts," §18) but that is a single-feature signal, not platform retention.

**Does retention deserve major September product work?** Not yet — the honest answer is that Tawveeri does not currently know its retention rate well enough to prioritize fixing it. The higher-priority September action is **running the retention query properly** (session-level ≥2-day repeat rate, platform-wide, both pre- and post-baseline) so October's review can answer this question instead of flagging it as a gap again.

---

## 18. Home Mission

(All figures are REAL and, notably, **identical between "full August" and "post-baseline"** — every real Home Mission event this month happened after the Aug 6 commercial baseline, i.e. this is a clean, non-founder-contaminated signal.)

- **Sessions touching Home Mission:** 17.
- **Mission starts:** 21.
- **Plans generated:** 22.
- **Refinements:** 1.
- **Purchase-plan opens:** 5.
- **Retailer exit clicks (Home-Mission-sourced `go_click`):** 2 — a narrower, stricter count than the "retailer exits" language might suggest; this only counts client-tracked clicks specifically tagged with a Home Mission source, not the full exit ledger.
- **Retailer returns (`returned_from_retailer`):** 7 — notably *higher* than the 2 tracked exit clicks, consistent with the platform-wide pattern that client-side exit tracking undercounts real exits (ADR-244) — people are leaving for and coming back from retailers more often than the narrow click-tracker sees.
- **Items self-marked purchased:** 5 — **self-reported by the shopper, not a verified sale.**
- **Retailers completed (self-marked):** 10.
- **Missions completed:** **0**.
- **Shares:** ledger authority (`shared_home_plans`) shows **14 real plans created this month (2 test-flagged, 12 real)** — the event-based count (`sharesCreated: 1`) undercounts this because of a documented owner-cookie skew (the plan creator's browser carries an admin/test cookie); trust the ledger's 12, not the event count of 1. Share opens (recipient-side, real): 7. Share feedback: 5.
- **Entry-card clicks (homepage soft-surface):** 7.
- **Unsupported-category demand (honest refusals):** 1 ("فرن" — oven — was asked for and the system correctly said it isn't supported in a Home Mission plan yet).

**Classification: EARLY SIGNAL.** 21 mission starts and 22 plans from only 17 sessions is meaningful early engagement for a pilot feature, and the share loop shows genuine external reach (12 real plans created, 7 real opens by a *different* person on a *different* device — a real cross-device growth loop, not just the owner refreshing their own link). But **0 full mission completions** and only 5 self-reported (unverified) item purchases means the pilot has not yet proven it drives anyone through an entire real shopping decision.

**Does it deserve increased marketing, continued observation, product work, or no action?** **Continued observation plus targeted product work**, not increased marketing yet — the share loop (12 real plans, 7 real opens, 5 real feedback responses) is the most promising sub-signal and is cheap to keep watching; zero mission completions after 21 starts suggests a drop-off worth investigating with product instrumentation (where exactly do the 21 starts stop before reaching "completed"?) before spending marketing budget to bring more people into a funnel that isn't yet proven to finish.

---

## 19. Demand Radar / Founder Intelligence

Kept secondary, per instruction — reported for completeness only, not as a design review.

- **Did the systems operate?** Partially, and only very late in the month. `demand_opportunities` (the Radar 1 review queue) shows real production rows **only from 2026-08-29 through 2026-08-31** — 45 dismissed, 1 replied-manually. Nothing in this table dates earlier in August, consistent with the documented history that the prior in-process scheduler achieved only ~20 of ~144 expected daily cycles, and the durable-scheduler redesign (ADR-280) only shipped and went live on 2026-08-31 itself.
- **Meaningful signals generated:** 46 opportunities surfaced in the queue's first 3 operational days; 45 were dismissed by the founder/reviewer and 1 was replied to manually — i.e. a low hit rate so far, but the sample (3 days) is too small to judge the redesigned system's true precision.
- **Founder opportunities surfaced:** 46 total (August), all in the final 72 hours of the month.
- **Known reliability/measurement limitations (from the governing ADRs, not re-derived this pass):** ADR-280 explicitly notes the new external cron cadence (every 10 minutes via GitHub Actions) has been observed for only one real cycle so far — sustained multi-cycle reliability is not yet proven. ADR-278 found and fixed 5 real data-correctness bugs in the Founder Intelligence layer on 2026-08-30 (retailer-name display, merchant-name merge, search-term whitespace grouping, emerging-language occurrence counting, and opportunity-kind dedup) — all confirmed fixed before this review's data was pulled. Checkpoint 5.1 (the Shadow-track precision-fix gate for Demand Radar 2.0's widened experiment) remains at n=3/30 evidence floor and Checkpoint 6 stays blocked pending further founder-approved data — **untouched by this review**, per the 2026-08-31 freeze.

No architectural redesign is proposed here, per instruction.

---

## 20. Commercial Truth

- **Affiliate-tagged redirects (August, real):** 245 (Noon 163 + Amazon 82).
- **Actual orders known:** **0 confirmed** — no order-import mechanism exists.
- **GMV known:** **0 confirmed** — same reason.
- **Commission known:** **0 confirmed** — same reason.
- **Is revenue zero, or simply unmeasured?** **Unmeasured.** No table, script, or import pathway anywhere in this codebase captures a network-reported order or commission (confirmed by direct schema/code search this pass — no `affiliate_orders`, `commission_report`, or equivalent table exists). This is a **NO SALES CONFIRMED** state, explicitly distinct from a **SALES UNKNOWN** state — and the correct label is **SALES UNKNOWN**, because the instrumentation to see a sale, if one happened, does not exist yet.
- **What exact evidence is missing to know commercial truth:** an imported affiliate-network report (Amazon Associates and/or Noon's affiliate dashboard export) covering August, matched against the 245 affiliate-tagged redirect rows already in `outbound_clicks` (which carry `sub_id`/`offer_id` fields apparently designed for exactly this kind of reconciliation, per the schema in §8/§9/§10 — though the matching logic itself was not reviewed this pass).

**NO SALES vs. SALES UNKNOWN:** this review asserts **SALES UNKNOWN**, not NO SALES. 245 real, affiliate-tagged redirects occurred; whether any of the people behind them purchased is genuinely unknown, not zero.

---

## 21. August Funnel

| Stage | Definition | Count (full Aug, real) | Count (post-baseline) | Confidence | Major limitation |
|---|---|--:|--:|:--:|---|
| Reach | Distinct real sessions | 419 | 391 | HIGH | Sessions, not people — no cross-device identity |
| Search/decision activity | Sessions with ≥1 search action | 241 | 226 | HIGH | — |
| Product engagement | Sessions with ≥1 product_view or comparison_view or evidence_view | not separately unioned this pass — component parts: 8/4/24 (full), 6/4/21 (post-baseline) | — | MEDIUM | Individually thin; a proper union was not computed as one number this session |
| Merchant intent | Qualified referred sessions (ledger session id ∪ go_click) | 67 | 64 | HIGH for post-cutover rows | Pre-cutover ledger rows structurally excluded |
| Affiliate-tagged merchant intent | Sessions behind an affiliate-tagged redirect | not separately computed at the session level this pass — 245/208 rows, but distinct-session count for JUST the affiliate-tagged subset was not isolated | — | LOW | Would require a targeted re-query |
| Confirmed purchase | Network-imported order matched to a session | **0** | **0** | **UNAVAILABLE** | No import mechanism exists — this is not "0 conversions," it is "instrumentation absent" |
| Confirmed commission | Network-imported commission | **0** | **0** | **UNAVAILABLE** | Same as above |

**No invented conversion rate is given between "Merchant intent" and "Confirmed purchase"** — the denominator (qualified sessions) and numerator (confirmed orders) are not from compatible, both-populated data sources this month; any percentage computed from a real number over an UNAVAILABLE number would be fabricated. The honest statement is: **64 real sessions (post-baseline) are known to have reached a merchant; how many of them bought anything is unknown.**

---

## 22. August Scorecard

| Dimension | Score | Evidence |
|---|--:|---|
| Customer Reach | 3/10 | 391 post-baseline real sessions — real, growing off a near-zero base, still small |
| Demand / Usage | 5/10 | 226/391 sessions searched; genuine budget-anchored queries; category demand partly inflated by a confirmed bug |
| Search Quality | 6/10 | 94%+ effective session-level answer rate after ADR-260 correction; one clear, fixable alias gap (Honor) identified |
| Product Decision Value | 3/10 | Product/comparison/evidence engagement is thin (≤24 sessions on any deep-engagement step) |
| Purchase Intent | 4/10 | 64 sessions reached a merchant (16% of post-baseline sessions) — real intent signal, no proof it converts |
| Merchant Performance | 4/10 | 977 redirects across 14 merchants, but only 2 are monetizable and neither has a confirmed sale |
| Affiliate Monetization | 1/10 | 245 affiliate-tagged redirects, 0 confirmed orders/commission, no import pathway exists |
| Marketing / Distribution | 2/10 | Only 12 real, attributed non-direct clicks (X+ChatGPT) out of 226; 95% unattributed |
| Attribution / Measurement | 5/10 | Core funnel is well-governed (ADR-244/259/260), but this review found one live undocumented bug and one unresolved anomaly |
| Retention | 2/10 | Platform-level retention not properly measured this pass; 5 total registered accounts |
| Home Mission | 4/10 | Real early engagement (21 starts, 22 plans, a genuine cross-device share loop) but 0 completions |
| Founder Intelligence / Demand Radar | 3/10 | Operated for only the final 3 days of the month; too early to score the redesign |
| Data Quality / Trust | 5/10 | Governed metric definitions exist and are followed; this review independently found and disclosed 2 new issues (repeat-fire bug, Aug 31 anomaly) |

**Product Validation: 5/10** — the product answers real questions correctly most of the time; deep engagement and completion are still thin.
**Commercial Validation: 2/10** — real, monetizable traffic exists (245 affiliate-tagged redirects) but zero purchase proof and no way yet to see one if it happened.
**Distribution Validation: 2/10** — 38x session growth off July is real, but 95% of it is unattributed and the only two known channels (X, ChatGPT) are single-digit-click scale.
**Overall August: 4/10.**

---

## 23. What August actually taught Tawveeri

1. **Evidence:** session count went from 11 (July) to 391–419 (August), with genuine budget-anchored Arabic/English queries. **Interpretation:** the product can now attract and hold real Saudi shoppers, not just internal testers. **Business implication:** the core loop (search → answer → exit) is validated enough to keep investing in traffic, not in another product pivot.

2. **Evidence:** qualified-referred sessions rose every week (3→6→26→32) even while raw session count was volatile. **Interpretation:** conversion QUALITY improved through the month independent of traffic volume. **Business implication:** September's growth lever should target *quality* traffic sources, not just more visits — a smaller, more intentional channel may outperform a bigger, noisier one.

3. **Evidence:** 245 affiliate-tagged redirects, 0 confirmed orders, and literally no table in the schema that could ever record one. **Interpretation:** Tawveeri cannot currently answer "did we make money in August" even in principle. **Business implication:** importing Amazon Associates and Noon affiliate reports is not a nice-to-have — it is the single missing piece between "we have traffic" and "we know if this is a business."

4. **Evidence:** Honor-tablet demand is broad (≥15 sessions), corroborated by real Amazon redirects (20, the month's single largest product signal), and blocked by a simple transliteration/alias gap. **Interpretation:** this is the rare case where search-quality work has a directly visible commercial payoff. **Business implication:** prioritize this fix in September — it is small, proven, and dual-purpose (search quality + Amazon revenue potential).

5. **Evidence:** a single client-side bug caused 4 sessions to fire an identical search event 150–242 times in under a minute each, materially inflating the month's #1 and #4 category-demand numbers (air conditioner, refrigerator). **Interpretation:** the platform's raw demand numbers cannot be trusted without session-level sanity-checking, and this had not been caught before this review. **Business implication:** before making any September content or catalog decision based on "top category" numbers, re-run the query with session-level de-duplication built in, not just query-text de-duplication.

6. **Evidence:** 119 of 977 August redirect rows (12%) landed in a single anomalous day with no corresponding browsing activity, spread across nearly every merchant and product category, with 27 duplicate-minute clusters. **Interpretation:** a meaningful share of "merchant traffic" headline numbers can be non-customer noise, and it is currently invisible unless someone looks. **Business implication:** any headline "X redirects to merchants" number needs a same-day sanity check (session count, UA diversity, duplicate-minute check) before it goes into a founder or investor deck.

7. **Evidence:** 5 registered accounts all month, Home Mission shows real engagement but 0 completions, and platform-wide retention was not properly queried this pass. **Interpretation:** Tawveeri knows almost nothing about whether anyone comes back. **Business implication:** September's most important *measurement* investment (not product investment) is a clean, always-available retention query — without it, every other growth number in this report is a snapshot, not a trend.

---

## 24. September strategic focus

**DO MORE**
- Fix the Honor-tablet alias/transliteration gap (§7/§14/§16) — small effort, proven demand, proven Amazon redirect payoff.
- Import Amazon Associates and Noon affiliate network reports and reconcile against `outbound_clicks` (§9/§10/§20) — the single highest-leverage measurement investment available.
- Keep the X and ChatGPT referral channels alive and watch them — both are tiny but the only two proven non-direct channels this month (§13).

**DO LESS**
- Do not scale air-conditioner or refrigerator content spend based on this month's raw demand numbers — both are materially inflated by a confirmed measurement bug (§5/§15) and neither shows real redirect follow-through yet.
- Do not treat the Aug 31 redirect spike, or any single-day "X redirects happened" headline, as a growth win without a same-day sanity check (§12).

**MAINTAIN**
- The core search → answer loop — session-level answer rate is high (~94% post-correction) and should not be re-architected.
- The Noon and Amazon affiliate relationships as-is — both are working mechanically; the gap is measurement (§20), not the merchant relationships themselves.
- Home Mission at its current, unmarketed, observation-only investment level (§18/§24).

**INVESTIGATE**
- Whether September revenue is real, once affiliate reports are imported — this is the single biggest unknown blocking every commercial decision in this report.
- The exact cause of the Aug 31 anomaly (crawler vs. internal verification pass) — not urgent to fix, but worth a 15-minute internal check ("did anyone run a manual multi-browser verification pass on Aug 31?") before assuming it's external.
- Platform-wide retention, properly queried, before October's review.

---

## 25. September Product/Category Priorities

Ranked top 5:

1. **Tablet (Honor specifically)** — Evidence: §5/§7/§10/§16. Why it matters: only category with proven search demand AND proven redirect payoff AND a known, fixable root cause. Priority type: search/catalog. Confidence: HIGH.
2. **Laptop** — Evidence: §5/§6/§9. Why it matters: broadest, most budget-specific demand of the month, and Noon's single strongest redirect signal. Priority type: commercial (deepen the existing Noon relationship's laptop coverage) + content. Confidence: HIGH.
3. **Air conditioner** — Evidence: §5/§6/§14/§15. Why it matters: largest raw demand signal of the month, but currently unproven once the measurement bug is accounted for, and shows almost no redirect follow-through. Priority type: search/catalog first (re-measure cleanly), then decide on content/commercial. Confidence: LOW until re-measured.
4. **Television** — Evidence: §5/§6/§9. Why it matters: solid, broad, moderate-volume demand with real Noon redirect follow-through (large-format sets). Priority type: content (maintain), commercial (steady). Confidence: MEDIUM.
5. **Refrigerator** — Evidence: §5/§7/§12/§14. Why it matters: real category, but this month's clearest evidence sits inside the Aug 31 anomaly and a repeat-fire-affected query — needs a clean re-measurement before any priority call. Priority type: search/catalog (re-measure), hold on content/commercial. Confidence: LOW.

**Top 3 for founder attention:** Tablet, Laptop, Air conditioner (in that order — the third earns its place by sheer demand size, but only as an "investigate first" item, not a "scale now" item).

---

## 26. September Merchant Priorities

Ranked:
1. **Amazon** — the Honor-tablet signal is Amazon's, is the cleanest product-commercial story of the month, and Amazon is one of only two merchants that can be monetized at all.
2. **Noon** — highest raw traffic and product breadth of any merchant, laptop/TV strength, and the other monetizable merchant.
3. **Extra** — highest raw redirect volume of ANY merchant (268), but zero monetization; worth a partnership/affiliate conversation given the traffic it already sends.
4. **Almanea** — second-highest raw redirect volume (185), same "unmonetized but proven traffic" case as Extra.
5. **متجر النخيل / Al Nakheel and الشتاء والصيف / Winter & Summer** — smaller merchants, but both were disproportionately represented in the Aug 31 anomaly (§12); worth confirming their real (non-anomaly) traffic level before any priority call, since their headline numbers this month are the least trustworthy of the group.

**Top 3 the founder should care about most:** **Amazon, Noon, Extra** — the first two because they are the only ones that can produce revenue today; Extra because it already sends more traffic than either monetized merchant and currently earns Tawveeri nothing.

**Distinguishing the opportunity type:**
- **Affiliate monetization opportunity:** Amazon and Noon (already exists — the opportunity is measurement, §20) and Extra/Almanea (does not exist yet — the opportunity is a new partnership).
- **Partnership opportunity:** Extra specifically, given its redirect volume.
- **Customer demand evidence (independent of monetization):** strongest at Amazon (tablets) and Noon (laptops, TVs).

---

## 27. September Marketing Strategy

Evidence-backed plays only:

1. **Target audience:** Arabic-speaking shoppers researching tablets, specifically anyone typing a "Honor" variant.
   **Product/category theme:** Honor tablets, Amazon.
   **Message:** "Honor Pad 10 — compare it before you buy" (or equivalent), pointing directly at the fixed/aliased search result.
   **Desired action:** search → land on the fixed Honor tablet result → redirect to Amazon.
   **Success metric:** distinct sessions searching a Honor-tablet variant that reach a `no_answer`/genuinely-unmet state (§16) should drop toward zero; Amazon Honor-tablet redirects should hold or grow.

2. **Target audience:** university-context laptop shoppers (the existing "ابي لاب توب للجامعه" / use-case language, §5).
   **Product/category theme:** laptops, Noon.
   **Message:** budget-anchored, use-case-anchored ("laptop for university under 4,000 SAR") mirroring the exact phrasing real shoppers already use.
   **Desired action:** search → compare → redirect to Noon.
   **Success metric:** Noon laptop redirect count and distinct-product breadth, tracked weekly against the §4 weekly-progression method.

3. **Continue the "content → search → dashboard reveals next demand → content follows behavior" loop** exactly as already practiced — this month's evidence (Honor tablets, laptops) is a working example of it. Do not add a large paid-campaign layer on top until at least one of the two channels above (X or ChatGPT) shows more than single-digit real clicks in a follow-up month.

No large campaign plan is proposed — the evidence supports two narrow, cheap, already-corroborated plays, not a broad push.

---

## 28. September business experiments

**Experiment 1 — Fix the Honor-tablet alias gap.**
Hypothesis: the tablet demand is real and blocked only by search/alias resolution, not a catalog gap.
Action: add the known Honor-transliteration variants to the search alias layer (read-only-identified, not touched this session).
Metric: genuinely-unmet Honor-tablet queries (§16 methodology) per week.
Success threshold: unmet Honor-tablet queries drop by ≥70% within 2 weeks of the fix shipping.
Stop condition: if unmet queries do not drop after 2 weeks, the gap is not an alias issue and should be re-diagnosed rather than iterated on blindly.
Duration: 2 weeks post-fix.

**Experiment 2 — Import one affiliate network report (start with whichever of Amazon/Noon is operationally easiest) and reconcile against `outbound_clicks`.**
Hypothesis: at least one of the 245 August affiliate-tagged redirects converted to a real order.
Action: import the network's August report; join on `sub_id`/timestamp against `outbound_clicks`.
Metric: matched-order count and commission value.
Success threshold: any confirmed match — this experiment succeeds by existing, not by hitting a number; even a single confirmed order changes §20 from UNKNOWN to a real baseline.
Stop condition: if the network provides no matchable data at all (e.g., no sub_id passthrough), that itself is the finding — escalate as a founder decision on whether to request better tracking parameters.
Duration: one import cycle (however long the network's reporting lag is, typically 24-72h+ for these programs — not controlled by Tawveeri).

**Experiment 3 — Re-run this month's demand ranking with the repeat-fire bug's sessions excluded, and compare.**
Hypothesis: air_conditioner and refrigerator's true, non-inflated demand rank lower than laptop/tablet once the 4 identified bursting sessions are excluded.
Action: re-query §5's category table filtering out the specific session ids identified in §15.
Metric: category rank order, before vs. after exclusion.
Success threshold: a stable, defensible category ranking that survives the exclusion.
Stop condition: none needed — this is a one-time analytical re-check, not an ongoing experiment.
Duration: under a day of analysis.

---

## 29. September targets

Baseline (August, post-baseline real): 391 sessions, 226 searching sessions, 861 ledger redirect rows, 64 qualified referred sessions, 12 real non-direct attributed clicks, 0 confirmed orders.

| Metric | August baseline | September target | Why reasonable |
|---|--:|--:|---|
| Real sessions | 391 | 450–550 | Modest, organic-pace growth (~15-40%) — August's own growth was volatile week to week, not a straight line, so a large jump is not assumed |
| Searching sessions | 226 | 260–320 | Holding the current ~58% search-rate, scaled with sessions |
| Merchant redirect rows (ledger) | 861 (net of the Aug 31 anomaly, closer to ~740) | 750–900 | Targeting the anomaly-free baseline, not the inflated 861 |
| Qualified referred sessions | 64 | 75–95 | Continuing the week-over-week improvement trend from §4, not a step-change |
| Real, attributed non-direct clicks (X+ChatGPT combined) | 12 | 20–30 | A doubling is reasonable off a base this small; no paid channel is assumed |
| Affiliate report import | 0 (not attempted) | ≥1 network imported | This is a process/effort target, not a traffic-dependent one — it does not require more users, only engineering time |
| Confirmed affiliate purchases | 0 (unmeasured) | No numeric target proposed | The baseline is not zero-purchases, it is zero-VISIBILITY — setting a purchase target before the measurement exists would be guessing, not planning |

---

## 30. Weekly September management scorecard

Maximum 8 metrics, reviewable every Monday:

1. **Real sessions this week** (are more real people coming?)
2. **Searching sessions / total sessions** (are they asking useful shopping questions?)
3. **Genuinely-unmet-demand count, §16 methodology** (are we answering them?)
4. **Qualified referred sessions** (are they going to merchants?)
5. **Real, attributed non-direct click count, by source** (do we know where they came from?)
6. **Noon + Amazon affiliate-tagged redirect count** (are Amazon/Noon producing traffic that could become orders?)
7. **Confirmed orders/commission, once imported** (are we making commercial progress? — shows "N/A, not yet imported" until Experiment 2 lands)
8. **Any same-day anomaly flag** (session count vs. redirect count sanity check, per §12's method — catches another Aug-31-style day before it distorts a monthly report)

---

## 31. September Founder Plan — ONLY 3 priorities

**#1 — Import an affiliate network report and reconcile it.**
WHY: this is the single fact that turns every other number in this business from "traffic" into "revenue evidence," and it is currently completely missing (§20).
WHAT: pull Amazon Associates (or Noon's affiliate dashboard) August export; join against `outbound_clicks` on timestamp/sub_id.
OWNER TYPE: engineering (a few hours of integration work) + founder (the account access/credentials).
FIRST ACTION: log into the Amazon Associates dashboard and check whether an August report is even available for the tag `tawveeri0f-21`.
SUCCESS METRIC: a matched-order count exists, even if it's zero.
WHAT NOT TO DO: do not build a general-purpose "affiliate reconciliation engine" before confirming a single report even reconciles — start with one merchant, one month, by hand if needed.

**#2 — Fix the Honor-tablet alias gap.**
WHY: it is the month's only fully-corroborated search-quality-to-revenue story (§7/§14/§16), and it is small.
WHAT: add the observed transliteration variants (هونر/هورنر/Honer/Horno/هونور) to whatever alias/synonym layer the search pipeline already uses for exactly this kind of fix (per ADR-259 precedent).
OWNER TYPE: engineering.
FIRST ACTION: locate the alias/synonym table or function ADR-259 used for its precedent fix, and add the Honor variants the same way.
SUCCESS METRIC: unmet Honor-tablet queries drop toward zero within 2 weeks (§28, Experiment 1).
WHAT NOT TO DO: do not build a general fuzzy-matching/ML transliteration system for this one brand — a small, explicit alias list is proportionate to the evidence.

**#3 — Stand up a weekly, session-level sanity check before any headline number is reported.**
WHY: this review found TWO previously-undocumented measurement problems (§12, §15) purely by checking session counts against event counts — that check should be routine, not something that only happens during a monthly review.
WHAT: the 8-metric scorecard in §30, run every Monday, with metric #8 specifically checking for anomalous single-day redirect spikes relative to session/search activity.
OWNER TYPE: founder (or whoever owns the weekly review) using existing, already-governed queries — no new dashboard build required.
FIRST ACTION: run the §30 scorecard for the first time using this report's August data as the "week 0" baseline.
SUCCESS METRIC: no more Aug-31-style anomalies reach a monthly report undetected.
WHAT NOT TO DO: do not build new dashboard infrastructure for this — every number in the scorecard is already computable from the existing, governed `command-center-queries.ts` module; this is a process change, not an engineering project.

**Ranked #1, #2, #3 as above** — revenue visibility first, the one proven quick product win second, measurement discipline third (but explicitly not lowest-priority — it is what made priorities #1 and #2 trustworthy in the first place).

---

## 32. Final Founder Verdict

1. **Did Tawveeri prove real people use it?** Yes — 391–419 real sessions in August, up from 11 in July.
2. **Did Tawveeri prove real shopping demand?** Yes, for laptops, tablets (Honor specifically), TVs, and mobile — corroborated by multiple independent sessions. Air conditioner and refrigerator demand is real in direction but overstated in magnitude by a confirmed measurement bug.
3. **Did Tawveeri prove purchase intent?** Partially — 64 real sessions reached a merchant, and budget-anchored search language is genuine intent signal, but "intent" stops at the click; nothing downstream is proven.
4. **Did Tawveeri prove customers leave for merchants?** Yes, unambiguously — 861-977 real, server-recorded redirects (net of the Aug 31 anomaly, closer to ~740-860), spanning 14 merchants.
5. **Which categories have the strongest evidence?** Tablet (Honor) and laptop — both have search demand, redirect follow-through, and a corroborated top product.
6. **Which merchants matter most?** Amazon and Noon commercially (the only monetizable ones); Extra by sheer traffic volume if a partnership is ever pursued.
7. **Did Tawveeri prove affiliate purchases?** No.
8. **Did Tawveeri prove revenue?** No — and critically, it currently *cannot*, because no order/commission import exists.
9. **What is the biggest unresolved commercial unknown?** Whether any of the 245 affiliate-tagged redirects this month resulted in a sale — entirely unmeasured, not zero.
10. **What should Mohammed focus on in September?** Importing an affiliate report (§31 #1) — everything else in this report is downstream of not knowing whether the business has any revenue at all.
11. **What should he deliberately ignore in September?** Scaling air-conditioner or refrigerator content spend based on this month's raw numbers (§15/§24) — the evidence for both is compromised and needs re-measurement, not more investment, first.

**AUGUST IN ONE SENTENCE:** Tawveeri went from 11 sessions to real, if small and imperfectly measured, customer traffic that asks genuine budget-anchored shopping questions and clicks through to merchants — but the month ends with zero visibility into whether any of it turned into money.

**SEPTEMBER IN ONE SENTENCE:** Fix the one thing that turns traffic into a business (import an affiliate report), ship the one proven quick product win (the Honor-tablet alias fix), and put a standing sanity check in place so next month's review starts from clean numbers instead of finding two new defects on the way.

---

## 33. Evidence Appendix

**Primary database tables/views used:**
- `usage_events` (10,231 raw rows in the August Riyadh window) — event stream: search, advisor_query, results, advisor_result, product_view, comparison_view, evidence_view, go_click, no_answer, error, home_mission, home_share, category_page_view.
- `outbound_clicks` (4,079 raw rows in window) — the exit ledger; columns confirmed via `information_schema` introspection this pass (not declared in any numbered migration): `id, session_id, conversation_id, canonical_product_id, store_name, price_at_click, affiliate_tag, source, clicked_at, offer_id, destination_url, affiliate_program, user_agent, referrer, sub_id, is_test, campaign, product_store_id`.
- `shared_home_plans` — Home Mission share ledger (14 rows in window, 2 test-flagged).
- `demand_opportunities` — Radar 1 review queue (46 rows in window, all Aug 29-31).
- `stores` — merchant registry (24 rows total; 14 received a redirect in August).
- `canonical_products` — product name/category resolution for redirected products.
- `users` — registered accounts (5 total, all created in August).

**Code metric definitions used (source of truth for every number in this report):** `src/lib/admin/command-center-queries.ts` (`buildFunnel`, `buildSessionFunnel`, `retailerBreakdown`, `computeCampaignAttribution`, `qualifiedReferredSessions`, `buildHomeMissionStats`, `topDemand`, `unmetDemand`, `topSearchTerms`, `topSessionSearchShare`) — the same module `npm run tps:usage` and the live `/admin/command-center` dashboard both call. `src/lib/transactions/affiliate-config.ts` (`DEFAULT_STORE_AFFILIATE_CONFIG`) for which merchants are monetizable. `src/lib/agent/task-parser.ts` (`parseShoppingTask`) for the category-derivation fallback.

**ADRs consulted (docs/DECISIONS.md):** ADR-216 (commercial baseline), ADR-244 (exit-ledger attribution, Growth Engine stage one), ADR-245 (Founder Commerce Command Center), ADR-247/274/280 (Demand Radar), ADR-259/260 (session-unit correctness, answered-elsewhere correction), ADR-271/277/278/279/281 (Founder Intelligence and Decision Card measurement), ADR-249 (Home Mission / GO_HOME), ADR-225 (affiliate param widening).

**Runbooks/docs consulted:** `docs/DEMAND-RADAR-RUNBOOK.md`, `docs/FOUNDER_COMMERCE_COMMAND_CENTER.md` (referenced, not independently re-read line-by-line this pass — see limitation below).

**Production evidence, this session:**
- Direct read-only SQL against production (`vyceqrzttspyycdpojtn`, via the governed pooler URL helper, confirmed non-negotiably scoped to that project ref before any query ran) for: full-August and post-baseline funnel/session-funnel/retailer/campaign-attribution/home-mission computation (reusing the exact shared code); a full weekly and daily breakdown; a dedicated Aug 31 raw-row pull (all 18 columns); a dedicated per-query session-distribution pull (top 40 queries); a dedicated session-burst timing investigation for the top 5 concentrated queries.
- All queries were `SELECT`-only; the read-cache of query results was written to the session scratchpad, not the repo. The one-off analysis scripts used to run these read-only queries (`scripts/_tmp-august-review.ts` and siblings) are excluded from git tracking by the repo's existing `_tmp*` convention and were deleted after use.

**Explicit limitations of this review (say "INSUFFICIENT EVIDENCE," not invent a number):**
- Platform-wide, whole-session multi-day retention (§17) — not queried as a standalone platform metric this pass.
- `docs/METRIC_DEFINITIONS.md`, `docs/DATA_QUALITY_CONTRACT.md`, and `docs/AFFILIATE_RECONCILIATION_CONTRACT.md` — every metric in this report was independently derived from the actual computation code (`command-center-queries.ts`) rather than from those docs, so the report's numbers do not depend on them, but their governance language was not independently quoted here. **Consult those docs directly for their exact governance language before external distribution of this report.**
- Content-publish-timestamp correlation (§13) — no queryable table logging individual X/TikTok post publish times was confirmed to exist or not exist with certainty this pass.
- Product-category misclassification and stale-product coverage (§15) — not independently re-measured; prior memory-recorded baselines predate August and should be re-verified, not cited, before any September planning use.
- The founder's illustrative numbers (847/170/119/24/19/5, prompt §2) were not reproduced from any single query this pass beyond 119 (Aug 31 ledger rows, investigated in §12) — **INSUFFICIENT EVIDENCE** to map the others to a specific metric.

**Where sales cannot be measured:** every instance in this report says **"PURCHASE OUTCOME UNKNOWN — NOT ZERO"** explicitly (§9, §10, §20, §21, §32) rather than reporting zero revenue as a finding.

**A note on this report's own preparation:** three parallel research sub-agents were dispatched during this review with narrow, read-only, docs-only instructions (verify metric-definition documentation, Demand Radar/Founder Intelligence status, Home Mission schema, growth-attribution schema). Two of the three exceeded that scope on their own initiative — they independently queried production and generated their own complete alternate 33-section reports, which briefly overwrote this file before it was restored to the version you are reading. Those alternate drafts were not used as a source for this report's figures (every number here traces to the direct, git-history-documented query work described above), but they raised a small number of claims (e.g., a possible dashboard row-cap truncation, a possible KPI-formula defect, a month-wide — not just Aug-31 — session-attribution gap on redirects) that were **not independently verified before this report was finalized** and should be treated as unconfirmed leads, not findings, until checked directly against this report's own methodology.

---

*End of report. Saved to `docs/report/AUGUST-2026-FOUNDER-REVIEW.md`. No commits, pushes, deploys, production changes, measurement changes, or job triggers were made in the course of preparing this review. Awaiting founder review.*
