# P0_FINDINGS — 2026-07-28

**ADRs checked before this work:** ADR-048, ADR-051, ADR-087, ADR-090, ADR-091, ADR-105, ADR-124, ADR-125. Labels: **[MEASURED today]** / **[INFERRED]** / **[ASSUMPTION]**.

---

## Item 1 — "توفير حقيقي" badge — DONE (system correct, former case)
**[MEASURED]** The badge renders `توفير حقيقي {real_saving_pct}٪ — كان {observed_max}` (`price-truth-client.tsx:94`). Builder `build-listing-facts.ts:97` sets `obsMax = max(observed price)` from `price_history`, kept **separate** from the merchant's `claimedWas` (line 106); the verdict `verified_drop` (`price-intelligence.ts:253`) requires `current ≤ observedMax·(1−REAL_DROP_MIN)` over `≥ MIN_DISTINCT_DAYS`. The badge uses `observed_max` (**our observation**), never `claimedWas`.
**Verdict:** the badge requires a drop **we observed**. Spot-check "بيسوس كفر… كان 69 · تتبّعنا 4 يوم" → the 69 is our `observed_max` across 4 tracked days, not a merchant field. The 925/10,296 split is precisely the precision-first behaviour. **No correction needed** (aligns with C4/C6 — do not restate as deception).

## Item 4 — float artifact — EXECUTED
**[MEASURED]** Source: `observed_max`/`current` are raw observed prices carrying float noise (`69.000001`, `369.000501`), rendered raw. **Fixes (rounded to 2 dp, `Math.round(x*100)/100`):** `price-truth-client.tsx:94` (render), `discount-integrity/route.ts` `real_deals` map (API choke — all consumers), `price-intelligence.ts:226,255` (stored `verified_drop` text, future builds). Build green. Real cents (e.g. 2449.01) preserved; only sub-cent noise removed.

## Item 2 — SAVINGS_GATE — EXECUTED (ADR-129)
**[MEASURED]** **Correction to my earlier claim** (`EXTRA_PARSER_FIX §7`): "`original_price` NULL 428/428" was a dedup-query artifact and is **WRONG**. Truth today: served `product_stores` has **2,713 offers with a merchant "was", 2,476 with a real gap**; `price_history.original_price` populated 48,531/78,911. So unverified merchant-"was" savings **do render** on served surfaces → the gate is a real fix.
**Implemented** (`NEXT_PUBLIC_SAVINGS_GATE`, default **on** = suppress; zero per-request query; ADR-129):
- Search decision card — gated `خصم %` (`route.ts` `buildReasonAr`).
- Comparison card — gated `save X` pill (`comparison-card.tsx`).
- Product page — gated merchant `originalPrice` → `null` when on (`product-detail-client.tsx`).
- Deals page — gated `-{discountPct}٪` **and** `بدلاً من {averagePrice}`. **⚠ Flag for your call:** `averagePrice` is a **cross-store average from OUR data**, not a merchant "was" — I gated it conservatively; you may un-gate this one reference (`NEXT_PUBLIC_SAVINGS_GATE=off` shows all, or narrow the gate to merchant-was only).
- **Unaffected (correctly):** `/price-truth` + landing RealDeal — they read the verified observed-drop pipeline, not `original_price`.
**Rollback:** `NEXT_PUBLIC_SAVINGS_GATE=off`. **Not deployed** (build verified; awaiting your deploy decision). **Follow-up (Tier 2):** bake per-offer `verified_drop` verdict into the served layer so verified savings can be shown there too.

## Item 3 — duplicate canonical cards — MEASURED + diagnosed (plan)
**[MEASURED]** **21 exact-slug duplicate canonical groups** among active canonicals (smartwatch 7, mobile 4, monitor 2, air_conditioner 1, laptop 1, accessories 1, +others). **This is a floor:** the بيسوس/باسوس case is an **Arabic brand-transliteration variant** with *different letters*, so it is **not** in the 21 (exact-slug can't catch it).
**[INFERRED]** Root cause: Arabic brand transliteration is not normalised in canonical identity/display (بيسوس vs باسوس, both = Baseus). **Plan (not executed):** extend the curated Arabic brand-map (the `BRAND_AR` table already in `scripts/tps-analysis/arabic-titles.js`) into a normalisation applied in the identity key / a dedup pass, then merge variant canonicals via `merge-canonicals.js`. A transliteration-aware count is needed to size it (exact-slug undercounts).

## Item 5 — trust-page ranking — PLAN (not executed)
**[MEASURED]** `/price-truth` `real_deals` are ordered `by real_saving_pct desc` (`discount-integrity/route.ts:43`) → a 19 SAR case / 29 SAR bulb / 69 SAR stand lead, because % is highest on cheap items. **Proposed rule** (deterministic, evidence-first): rank by (1) **model-confirmed multi-store** first (the 166 set — a confirmed comparable product outranks a single-listing accessory), then (2) **absolute saving in SAR** (not %), then (3) `real_saving_pct`; **deprioritise `category='accessories'`** (market study defers to P3). Keep it verdict-gated (`verified_drop` only). This surfaces high-value confirmed products above accessory %-theatre without fabricating anything.

## Item 6 — two open verifications
- **6b — green count: FIXED, one number = 220.** [MEASURED] The instability (220 vs 185) was the colour-dedup key. **Canonical key = `brand | category | round(min) | round(max)`** (the PRICE_INTEGRITY key) → **220**. The EXTRA_PARSER_FIX run used `category | round(min)` (no brand, no max) → 185; that key is wrong. Standardise on `brand|cat|round(min)|round(max)`. **One number: 220.**
- **6a — Almanea anchor: NOT DONE (deferred).** [MEASURED] My first query matched by product name against `tps_listing_price_facts` and returned **0 rows** — the facts are keyed by listing **URL**, not name. The right query joins the 5 Almanea listing URLs → `tps_listing_price_facts` and reports, per listing: `verdict`, `distinct_days`, `observed_max` vs `claimed_was` (did our history ever contain an observation at the claimed "was"?). This is a **coverage** question (C4), not an accusation. Deferred to next turn with the URL-keyed query.

---

---
## Update — evening 2026-07-28 (this directive)

**★ DEPLOYED & VERIFIED LIVE (commit `caba8de`, pushed to `main` → Railway).** Items **2 (SAVINGS_GATE)** and **4 (float)** — plus P0-2 relabel and P0-4 ranking — executed and deployed today. Production verification via `/api/v1/tps/discount-integrity`: `category` field now present + `observed_max` rounded (no float noise) + **top deal = Hisense 85" Mini-LED TV, 8,800 SAR real saving (61%)** instead of a 19 SAR accessory; **`verified_deals=20`**. **SAVINGS_GATE default-on** (`NEXT_PUBLIC_SAVINGS_GATE` unset in Railway → gate on → merchant-"was" savings suppressed on search/comparison/product; `/price-truth` verified-drop savings unaffected). **Rollback:** `NEXT_PUBLIC_SAVINGS_GATE=off` in Railway env + redeploy (NEXT_PUBLIC is build-time inlined, so a rebuild is required to toggle). Build green (exit 0) before push.

**P0-2 averagePrice — EXECUTED.** Deals page: un-gated `averagePrice` (our cross-store measurement, not a merchant "was"), relabelled to *"أقل من متوسط السوق بـ {delta} ريال"* + *"-{pct}٪ عن المتوسط"*; gate narrowed to merchant `original_price` only. Build green.

**P0-4 trust-page ranking — EXECUTED.** `/price-truth` real-deals now sort **non-accessory first → absolute SAR saving → real%** (verdict-gated). The "model-confirmed multi-store first" tier needs a canonical/store-count join not on the facts row (follow-up). Build green.

**P0-3 duplicates — MEASURED (transliteration-tolerant).** [MEASURED] Folding Arabic letter-variants + dropping the brand word → **32 duplicate canonical groups (32 surplus cards)**, up from 21 exact-slug. Still a **floor**: the بيسوس/باسوس pair (names differ beyond the brand word) is NOT caught even here — true count is higher; Levenshtein/brand-normalised matching would catch more. **Root fix = normalise Arabic brand transliteration in the identity key** (extend `BRAND_AR`), then `merge-canonicals.js`. Not executed (measurement + plan only, per directive).

**P0-5 Almanea anchor — DONE (URL-keyed, coverage framing).** [MEASURED] Of the 5 (joined to `tps_listing_price_facts` by URL): **1 `verified_drop`** (LG Split 18000 — we observed 4489, the "was" matched, real 45%); **2 `inflated_reference`** (Toshiba 15kg: obsMax 3079 vs claimed 4739; Samsung fridge: 3549 vs 6349 — we observed the current price but our **3-day window never saw the higher "was"**); **2 `insufficient_history`** (2-day windows). **This is a COVERAGE result, not an accusation** — the cash prices were verified 5/5 (ALMANEA_VERIFY), and «we never observed the was» ≠ «the discount is false». Deep Saudi clearance/accessory discounts are frequently genuine (founder C4). As tracking deepens, more move to `verified_drop`.

## P1 / P2 — status this turn
Items **7, 8, 9, 10** (P1 diagnosis) and the **REVENUE_THESIS.md** memo (**11A–G**) are substantial measurement + strategy work and were **not started** — they need their own turns to do at the required depth. Note for item 8: its premise ("`original_price` NULL 428/428") is **corrected above** — it is populated (48,531 price_history / 2,713 product_stores), so item 8 must be re-scoped to "where is the merchant `original_price` dropped *for the specific offers that lack it*", not globally.
