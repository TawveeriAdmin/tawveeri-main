# AMAZON SAUDI × TAWVEERI — FULL READ-ONLY DIAGNOSTIC

**Date:** 2026-10-03 · **Mode:** READ-ONLY (no code, DB, config, job, link or deploy change; nothing committed) · **Authority:** production `vyceqrzttspyycdpojtn` only · **Live build:** `63d67a9e`

**Evidence:** every query, raw result and the live-probe transcript are in [`docs/evidence/amazon-diagnostic-2026-10-03/`](../evidence/amazon-diagnostic-2026-10-03/) (`baseline.cjs/json`, `batch2–6`, `live-probe.js`, `live-probe-classified.json`). All SQL ran inside `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` and ended with `ROLLBACK`. Capture window 14:17Z–14:45Z. Control group = eXtra (`store_id 4`) and Almanea (`store_id 5`); Amazon = `store_id 2`.

**Decision Register searched first:** ADR-058, 085, 183, 204, 211, 212, 284, 299, 304, 305, 310–313, 337, 369–371, 377–381, 393–402. Nothing below re-derives a number those ADRs already hold without citing it; where this diagnostic contradicts one, it says so.

**Labels:** VERIFIED (direct production/code evidence) · PARTIALLY VERIFIED · INFERRED · NOT VERIFIED · NOT ACCESSIBLE.

---

## 1. Executive Summary

**ما يحدث فعليًا:** أمازون **ليست** ممثَّلة تمثيلًا ناقصًا في طبقة المقارنة نفسها. حيث تملك أمازون نفس الهوية التي يملكها إكسترا/المنيع مع عرض منافس صالح، تكون أمازون مؤهلة بنسبة **77%** (إكسترا 84%، المنيع 83%)، وتظهر فعلًا على صفحة المقارنة في **43 من 60** عينة حية، وتكون الأرخص في **20 من 34** حالة ظهور كامل. الفجوة الحقيقية **قبل** المقارنة: من 1,312 هوية أمازون صالحة، **275 فقط (21%)** تشترك مع إكسترا/المنيع في مفتاح واحد. سبب ذلك ثلاثي: (1) **انقسام فضاء المفاتيح** — إكسترا/المنيع يأخذان رقم الموديل من feed مهيكل فيبنيان مفاتيح `MODEL:` بنسبة 44%، بينما أمازون من العنوان فقط (22.6%) فتبقى اللابتوبات والتابلت في فضاء مواصفات لا يلتقي؛ (2) **عائد التطبيع للجوالات**: 286 منتج جوال أمازون في storefront ينتج عنها **68** هوية TPS فقط (إكسترا: 294 → 346)؛ (3) **العلامة التجارية**: 57% من منتجات أمازون brand = `Unknown`، والمفاتيح تلتقط ضجيج العنوان («Google TV» → brand google؛ «LG webOS» → lg) فتتشظى الهوية الواحدة (123 ASIN على أكثر من مفتاح). النضارة عند طبقة المقارنة متقاربة بين المتاجر (stale 19% / 16% / 17%)؛ الذيل غير المقارَن قديم بسبب السعة (ADR-402) لا بسبب الترتيب. لا دليل على حجب/CAPTCHA في السجلات، ولا أداة تكشفه. **الامتثال هو البند P0**: كشط صفحات amazon.sa أثناء العضوية في Associates يخالف نصًا Program Policies §2(b) وIP License §1 وConditions of Use §3/§5 (مصادر رسمية، §11).

**In one line:** Amazon's deficit is an *identity-overlap* problem (model numbers, phone normalization, brand noise) and a *compliance* problem — not a scraper outage, not an eligibility bias, not a search/index bias, and only secondarily a refresh-capacity problem (which bites the non-comparison tail).

---

## 2. Current Amazon Baseline (production, 2026-10-03 14:17Z)

### 2.1 Catalog / observations — VERIFIED

| Measure | Amazon | Source |
|---|---:|---|
| ASIN universe ever seen in `raw_observations` (`payload.sku`) | **8,837** | batch2 `amz_asin_universe` |
| ASINs observed last 30 d / 7 d | 6,855 / 3,380 (PDP 1,002, tiles 2,639) | same |
| `product_stores` rows / distinct `product_id` / distinct ASIN (from URL) | 7,429 / 7,203 / **6,743** | baseline `ps_summary`, `amazon_asin` |
| rows whose URL carries no parseable ASIN | 97 (all `/sspa/click?…url=%2F…` sponsored redirects) | `amazon_no_asin_sample` |
| ASINs with >1 row / ASINs under >1 product / products with >1 ASIN | 421 / **366** / 12 (589 surplus rows) | `amazon_asin` |
| products active / with canonical / with model / with brand ≠ Unknown / with image | 6,805 / 1,269 (17.6%) / 2,240 (31%) / **3,108 (43%)** / 1,828 | `products_fields` |
| `raw_observations` total / 7 d / 30 d / with `price` column | 81,535 / 6,376 / 33,847 / 52,309 | `raw_obs` |
| raw by method: `amazon-search` (tiles) / `scraper` (PDP) | 52,309 (7 d 2,884) / 29,226 (7 d 3,492) | `raw_obs_method` |
| `processing_status` | pending 81,496 · done 39 (column is not maintained by the TPS path — same for all stores) | `raw_obs_status` |
| GTIN/EAN/UPC | **none captured** (ADR-EXEC §1: 0 coverage; no field in `ScrapedProduct`) | code audit |

Category (storefront products): laptop 1,299 · accessories 1,067 · kitchen 897 · appliance 750 · tablet 503 · tv 473 · air_conditioner 353 · monitor 306 · audio 302 · smartphone 286 · smartwatch 264. Brand: **Unknown 4,095 (57%)**, Samsung 374, Apple 262, Lenovo 210, Google 175 (brand noise, see §7), HP 163, LG 132.

### 2.2 Offers (knowledge layer, `tps_current_offers`) — VERIFIED

| Measure | Amazon |
|---|---:|
| offer rows / `valid` / `low_confidence_candidate` / `invalid` | 1,653 / **1,312** / 341 (AC 275, laptop 66) / 0 |
| valid with price > 0 / null price | 1,285 / **28** (ADR-396 "unavailable" product-only observations) |
| valid with `_availability` = out_of_stock / unstated | 42 / 257 (19.6%) |
| valid & fresh ≤168 h (PICK gate) / ≤24 h / ≤7 d | **835 (63.6%)** / 146 / 861 |
| identity keys with a `MODEL:` segment | 373 of 1,653 (**22.6%**) |
| distinct identity keys | 1,647 |
| confidence = 100 | 1,097 (83.6% of valid) |
| **eligible for comparison** (valid ∧ price>0 ∧ not OOS ∧ ≤168 h) | **≈ 820** (835 fresh minus OOS-marked within window; exact per-key figure in §4) |
| excluded: stale / OOS / no price | 477 / 42 / 28 |

### 2.3 Freshness — VERIFIED (no averages; buckets + percentiles)

**Knowledge layer (`tps_current_offers.observed_at`, valid rows)**

| Bucket | Amazon | eXtra | Almanea |
|---|---:|---:|---:|
| ≤24 h | 146 (11.1%) | 491 (22.1%) | 0 (feed lands 02:52Z daily) |
| 24–72 h | 331 (25.2%) | 595 (26.8%) | 1,128 (70.6%) |
| 3–7 d | 384 (29.3%) | 471 (21.2%) | 37 |
| 7–14 d | 166 | 186 | 51 |
| 14–30 d | 163 | 147 | 73 |
| >30 d | 122 (9.3%) | 332 (14.9%) | 309 (19.3%) |
| **median / p75 / p90 / p95 (h)** | **98 / 284 / 698 / 908** | **92 / 194 / 788 / 932** | **37 / 252 / 1,035 / 1,035** |

**Storefront layer (`product_stores.updated_at` = last credible write)**

| | Amazon | eXtra | Almanea |
|---|---:|---:|---:|
| ≤24 h / 24–72 h / 3–7 d / 7–14 d / 14–30 d / >30 d | 311 / 1,224 / 1,996 / 1,201 / 992 / 1,693 | 1,312 / 1,928 / 1,133 / 427 / 274 / 593 | 301 / 5 / 6 / 18 / 189 / 949 |
| median / p75 / p90 / p95 (h) | 200 / 578 / 1,637 / 1,637 | 48 / 158 / 1,002 / 1,580 | 1,640 (×4) |
| last attempt (`last_checked_at`) median / p90 | 290 / 445 | 186 / 356 | 1,487 / 2,335 |

Reading: Almanea's storefront rows are almost never refreshed, yet its comparison layer is the freshest — because its offers come from a daily feed straight into the knowledge layer. The storefront table is **not** the comparison surface; §4 therefore measures the knowledge layer.

---

## 3. Amazon vs eXtra vs Almanea — apples to apples (VERIFIED)

| Metric | Amazon | eXtra | Almanea |
|---|---:|---:|---:|
| Storefront rows / products | 7,429 / 7,203 | 5,667 / 5,347 | 1,468 / 1,468 |
| raw observations 7 d (priced) | 6,376 (2,884 col / all payload) | 9,270 (7,188 feed + 2,082 PDP) | 93,149 (feed) |
| Normalized observations (NPO) 7 d / 30 d | 2,058 / 8,792 | 3,898 / 18,479 | 24,835 / 117,799 |
| Distinct identities (NPO keys) — valid / low-conf | 1,419 / 345 | 2,491 / 386 | 1,745 / 208 |
| Current offers valid / low-conf / invalid | 1,312 / 341 / 0 | 2,222 / 381 / 12 | 1,598 / 202 / 52 |
| Keys with `MODEL:` | **22.6%** | 44.0% | 43.1% |
| Availability unstated among valid | 19.6% | **83.2%** | 23.7% |
| Fresh ≤24 h / ≤7 d (valid) | 146 / 861 | 491 / 1,557 | 0 / 1,165 |
| **Comparison-eligible share of valid** | 63% | 70% | 73% |
| Keys shared with ≥1 other store | 431 (32.9%) | 931 (41.9%) | 587 (36.7%) |
| Keys shared with the other two control stores | 275 with ext/alm | 360 ext∩alm | 360 |
| Keys with an **eligible** rival | 289 | 641 | 490 |
| …of which this store eligible | **222 (76.8%)** | 537 (83.8%) | 408 (83.3%) |
| …excluded as stale (median age of the stale) | 56 (19.4%, 627 h) | 104 (16.2%, 396 h) | 85 (17.3%, 890 h) |
| In projection / in Algolia | 1,235 (94.1%) | 2,123 (95.5%) | 1,463 (91.6%) |
| Projection rows with `has_comparison` | 440 | 860 | 576 |
| `cheapest_store` on comparison rows (of 1,725) | 204 (11.8%) | 564 (32.7%) | 247 (14.3%) |
| price_update 30 d: runs partial/failed, rows updated | 64 / 52, 4,522 | 66 / 53, 12,277 | 1 / 0 (feed-fed) |
| price_update last 7 d: rows written | 1,219 (5 lane days) | 1,143 | — |
| Discovery 30 d: runs success/partial/failed; products touched | 16 / 34 / 5; 7,202 | 59 / 0 / 7; 867 | — |
| New products / week (last 4) | 1,772 · 1,579 · 1,004 · 696 | 3,625 · 520 · 225 · 88 | 156 · 7 · 6 · 1 |
| Refresh **success** (valid usable observation per attempt, last 2 cycles) | 126/148 = 85% (ADR-402) | not measured per attempt (feed) | n/a |
| Exits 30 d (`outbound_clicks`) | 54 (54 to `/dp/ASIN`, 54 tagged, 0 with `interaction_id`) | 56 | 8 |

Catalogue size alone does not explain the gap: Amazon has the largest storefront, the most discovery, the most `valid` identities after eXtra — and the **lowest overlap share** (21% with ext/alm vs ext∩alm 360 keys).

---

## 4. Coverage Funnel (Amazon; control stores alongside)

Denominators change by stage on purpose and are stated. "Eligible" is the production rule (`offer-eligibility.ts`): price>0 ∧ availability≠out_of_stock ∧ observed ≤168 h.

| Stage | Amazon num/den (%) | Lost | Main loss reasons | eXtra | Almanea |
|---|---|---:|---|---|---|
| Source universe (ASINs ever) | 8,837 | — | — | n/a (feed) | n/a |
| Ingested into storefront (distinct ASIN) | 6,743 / 8,837 (76%) | 2,094 | dead/retired ASINs (ADR-397 retired 378 products), gate drops (no ASIN, price≤0) | 5,347 products | 1,468 |
| Valid observation (storefront row priced) | 7,417 / 7,429 rows (99.8%) | 12 | — | 100% | 100% |
| Observed in last 30 d (ASIN) | 6,855 / 8,837 (78%) | 1,982 | tail never revisited (ADR-402: 17–19 d/pass) | — | — |
| Identifiable (normalized in 30 d → distinct key) | 1,764 keys from 8,792 NPO rows; storefront 7,203 products → **1,647 TPS keys (22.9%)** | ~5,500 products | categories without a TPS plugin (kitchen/accessories/audio…), AC 99% low-conf, laptop 21% low-conf, phone yield 68/286 | 2,611 keys / 5,347 products (48.8%) | 1,850 / 1,468 |
| Mapped to canonical | 16,251 / 16,251 NPO rows (100%); storefront `products.canonical_product_id` 1,269 / 7,203 (17.6%) | — | storefront link lag (ADR-311 class), not a knowledge-layer loss | 2,147 / 5,347 | 1,270 / 1,468 |
| Valid offer | 1,312 / 1,653 (79.4%) | 341 | `low_confidence_candidate`: AC 275, laptop 66 | 2,222 / 2,615 (85%) | 1,598 / 1,852 (86%) |
| Has usable price | 1,285 / 1,312 (97.9%) | 28 | ADR-396 "currently unavailable" product-only rows | 2,222 (100%) | 1,598 (100%) |
| Fresh ≤168 h | 835 / 1,312 (63.6%) | 477 | refresh capacity on L3/tail; 20/53 stale-with-rival rows HAVE a fresh storefront write that did not reach the layer (§6.4) | 1,557 / 2,222 (70%) | 1,165 / 1,598 (73%) |
| Not explicitly unavailable | 1,270 / 1,312 (96.8%) | 42 | ADR-396 state; honest | 2,222 (0 OOS, 83% unstated) | 1,522 (76 OOS) |
| **Eligible for comparison** | ≈820 / 1,312 (62.5%) | ≈492 | stale ≫ OOS > null | ≈1,557 | ≈1,110 |
| Has a rival with an eligible offer | 289 / 1,312 (22.0%) | **1,023** | **overlap** (67% of Amazon keys are single-store; see §7 for why) | 641 / 2,222 (28.8%) | 490 / 1,598 (30.7%) |
| Eligible AND rival eligible | 222 / 289 (76.8%) | 67 | stale 56, OOS 10, null 7 (some overlap) | 537 / 641 (83.8%) | 408 / 490 (83.3%) |
| Retrievable by search (projection/Algolia) | 1,235 / 1,312 (94.1%) | 77 | projection excludes some categories (laptop 15, tablet 10, microwave 9 …); 2 shared keys have no canonical row at all | 2,123 / 2,222 (95.5%) | 1,463 / 1,598 (91.6%) |
| Appears on comparison page (live sample, keys shared with ext/alm) | **43 / 59 (73%)** shown as a current offer; 34 with an eligible rival; Amazon cheapest 20 / 34 | 16 | stale 12, OOS/unavailable 3, no-canonical 1 | — | — |
| Affiliate outbound valid | 54 / 54 exits in 30 d → `/dp/ASIN` with `tag=tawveeri0f-21` | 0 | — (0 carried an `interaction_id`, i.e. no human-evidenced exit in the window) | — | — |

**Largest leakage points, in order:** (1) **Identifiable → shared identity**: 7,203 products → 1,647 keys → 275 shared with ext/alm. (2) **Fresh ≤168 h** for the non-comparison tail (capacity, ADR-402). (3) Stale within the comparison layer: 56 keys (19%) — of which 15 have **no storefront row** so the price_update lanes can never refresh them, and 20 have a fresh storefront write that did not propagate. Everything after eligibility (search, projection, page, exit) leaks ≤6% and store-neutrally.

---

## 5. Discovery Diagnosis

**Verdict: Amazon has a refresh/identity problem, not a discovery problem — with one category exception (phones).**

- Discovery is the **most active** of the three stores: new ASINs first seen per week (raw_observations, last 10 weeks): 52 · 733 · 432 · 290 · 296 · 333 · 444 · **1,246 · 820 · 557**; new storefront products last 4 weeks 1,772 / 1,579 / 1,004 / 696 (eXtra 3,625 / 520 / 225 / 88 — a one-off feed import; Almanea ≈ 0). 55 discovery runs in 30 d (16 success, 34 partial, 5 failed). VERIFIED.
- Path (code audit, VERIFIED): `discover-firecrawl` cron → `amazonAdapter.fetchBatch` → `AmazonSearchScraper.search` over **26 fixed queries, 2 pages each, 8 pages/call** → ADR-396 gate (new ASINs verified on the detail page, cap 40/run) → tiles never reprice existing rows. Despite the route name, **no Firecrawl API is called anywhere**. Worker category discovery is off for Amazon (`INGEST_CATEGORIES.amazon = []`). `product-recovery` writes tiles **without** the ADR-396 gate (code L160) — NOT VERIFIED whether it fires for Amazon in practice.
- Dead/replaced ASINs: 223 graveyard groups (ADR-402); 2,094 ASINs seen historically but no longer in storefront (retired by ADR-397 or dropped). Discovery saw 13 "unavailable" ASINs re-sighted (tiles as resurrection signal, ADR-396).
- **Category/brand coverage is where discovery under-serves comparison**: TPS valid keys per category Amazon vs eXtra — mobile **68 vs 346**, tablet 114 vs 373, tv 203 vs 386, laptop 248 vs 163, AC 2 vs 23, washing 66 vs 192, fridge 79 vs 111. The phone gap is **not** discovery alone: the storefront already holds 286 Amazon smartphones (eXtra 294) → the loss is at normalization (§7). Laptop is the inverse: Amazon has more laptop identities than eXtra, but only **19 of 248** are multi-store (key-space, §7).
- 97 storefront rows carry sponsored-redirect URLs (`/sspa/click?…`) that no ASIN regex parses: invisible to the lanes, exit builder has to decode them. VERIFIED (13 of them are current valid offers, 7 "eligible").

---

## 6. Refresh / Freshness Diagnosis

### 6.1 Scheduler & worker — VERIFIED (ADR-394/395/402 + `scraping_runs`)
Amazon price_update: lanes L1 (clicked ASINs, 22) · L2 (comparison-visible, 361) · L3 (TPS-valid, 691) · tail (5,507) · probe (223), quotas 6/50/10/13/1, batch 300, **480 s per-store ceiling** (soft deadline ≈436–442 s), 1–2 s delay, 6 fetch attempts with 2 s×n back-off, 429/503 cooldown `min(30 s·2^(n−1), 480 s)` shared via `rateLimiter`, plain `fetch` (no Browserless, 0 sessions ever), one extra mobile-page fetch for the `#unqualifiedBuyBox` fallback. 12 h selection cutoff + per-miss doubling back-off. Cadence: perpetually "due" (partial never advances `last_success_at`) → **5 cycles/day**. Repetition ≈ 0% (ADR-402).
### 6.2 Capacity vs demand — VERIFIED
≈70–77 attempts/cycle × 5 = **≤385 attempts/day** vs 6,581 live ASIN groups → full pass 17–19 days. Comparison layer (L1+L2 = 383) is covered: 83% attempted ≤48 h. eXtra does not need this: its comparison layer is fed by the UNBXD feed (**1,820 of 2,222 valid offers, 82%**, eligible 73%, median 50 h) with PDP scraping only for 402; Almanea by its feed (1,557 of 1,598, median 37 h). **Amazon is the only control-group store whose comparison freshness depends entirely on per-page fetches.**
### 6.3 Success definition — VERIFIED
Using "attempt produced a valid usable observation": last two cycles 126/148 = **85%**; non-success = 7 UNAVAILABLE (a state) + 15 FAILED, every one `scraper returned null (no price parsed)`. The scraper returns a bare null from six paths and logs a cause only on exception → block vs no-price vs parser **cannot be split** (ADR-402). Pre-ADR-394 history (ADR-393): 48 of 52 runs failed by timeout — that era is over; 0 timeouts since 2026-09-29.
### 6.4 Where freshness is actually lost at the comparison layer — VERIFIED (53 stale/OOS Amazon offers whose rival is eligible)
| Attribute | n |
|---|---:|
| sourced from a search tile, never a PDP (`amazon-search`) | 32 (median age **635 h**) |
| sourced from a PDP (`scraper`) | 21 (median 260 h) |
| **no `product_stores` row at all** → cannot enter any lane | **15 (28%)** |
| storefront row written fresh (≤168 h) while the layer stayed stale | **20 (38%)** — 4 explained by a fresh sibling key on the same ASIN (§7), 16 unexplained (PARTIALLY VERIFIED — normalization of the PDP observation landing on a different key/category or sweep lag; not traced) |
| storefront `scrape_status=failed` | 19 |
| storefront availability OOS | 12 |
Positive controls (164 eligible Amazon offers with eligible rival): **137 PDP-sourced, median age 18 h**; 27 tile-sourced, median 80 h; only 1 without a storefront row. **The structural difference between Amazon that works and Amazon that disappears is whether the identity is reachable by the L2 lane: a storefront row with a parseable `/dp/` ASIN that the lane can refresh.**
### 6.5 Anti-bot / throttling — NOT VERIFIED
Across ~340 captured Amazon worker-log lines (two full cycles + a 2-day filtered pull): **0** lines with 429/503/cooldown/captcha/robot (the three regex hits were digits inside Amazon's `dib` token). No detection instrument exists in the scraper (code audit). Absence of a logged signal is not absence of a block; the 15 nulls/148 are the ceiling of what a block could be costing.
### 6.6 In-stock claims — VERIFIED
3,373 of 6,615 storefront rows claiming `in_stock` have no credible write for >168 h (51%). The compare page never uses these (it reads the knowledge layer), the storefront product page does (`selectBestPriceOffer` falls back to all in-stock offers when none is fresh — code audit).

---

## 7. Identity & Matching Diagnosis

**Model:** Canonical (`canonical_products`, `tps_identity_key`) → Commercial variant (= the identity key's spec tuple or `MODEL:`) → Offer (`tps_current_offers` per store) ↔ Storefront (`products`/`product_stores`, ASIN in `external_id`/URL). ASIN is used correctly as **Amazon listing identity** (lanes group by ASIN; `merchant-listing-identity.ts`; never allowed into a TPS key — `store-identifiers.ts`). The cross-store identity is `plugin.buildIdentityKey(brand, payload, model_number)`, title-driven for Amazon.

### 7.1 Failure taxonomy (counts where measurable)

| Code | Amazon count / denominator | eXtra | Almanea | Status |
|---|---|---|---|---|
| **NO_MODEL** (key without `MODEL:`) | 1,280 / 1,653 (**77.4%**) | 56% | 57% | VERIFIED — eXtra/Almanea receive `_manufacturer_model` from their feeds (372 / 192 payloads); Amazon's PDP spec tables are captured into `products.specifications` but **not used for identity** (`pdp-evidence.ts` unwired) |
| **VARIANT_AMBIGUITY / KEY-SPACE SCHISM** (ADR-058) | laptop: 19 of 248 keys multi-store (7.7%), 3 shared with ext/alm; tablet 36/114 | laptop 53/163; tablet 107/373 | — | VERIFIED — eXtra tablets keyed `apple\|MODEL:ME8F4AB/A`, Amazon `apple\|ipad pro\|m5\|256\|wifi\|11`: same product, two key spaces |
| **BRAND_NORMALIZATION** | storefront brand `Unknown` 4,095 / 7,203 (57%); in keys: `google\|…` for Google-TV sets (Skyworth/Honor/LG), `apple\|` for Nikai, `vision\|`/`lg\|` for OSCAR/TIT ("LG webOS"), `unknown\|split…` for Aston/Mando/Midea/Hisense ACs | 0 Unknown | 0 Unknown | VERIFIED (storefront count), examples VERIFIED, share within keys INFERRED |
| **DUPLICATE_IDENTITY** (one ASIN → >1 key) | **123 / 1,489 ASINs (8.3%)**; 65 across valid; 8 across categories; explains 4 of 53 stale cases | — | — | VERIFIED |
| **LOW_MATCH_CONFIDENCE** | 341 / 1,653 (20.6%): AC 275 (99% of Amazon AC), laptop 66 | 381 / 2,615 (14.6%): AC 348 (94%) | 202 (AC 91%) | VERIFIED — AC is category-wide (NO_SERIES/NO_TECH/NO_MODE sentinels), not Amazon-specific |
| **CATEGORY_MISMATCH** | 8 ASINs valid under two categories; 13/6,866 out-of-vertical (ADR-396) | — | — | VERIFIED small |
| **NO_CANONICAL** | 2 / 275 shared keys (0.7%) — e.g. `beko\|MODEL:DVN05420W`: both stores have it, `/api/compare` → 404 | — | — | VERIFIED |
| **STALE_OFFER** (with eligible rival) | 56 / 289 (19.4%) | 104 / 641 (16.2%) | 85 / 490 (17.3%) | VERIFIED |
| **UNAVAILABLE** | 42 OOS + 28 null-price = 70 / 1,312 (5.3%); 17 in keys with eligible rival | 0 OOS (83% unstated) | 76 OOS | VERIFIED |
| **WRONG_VARIANT / CONDITION** | condition **not captured** from the page (title only); 3 of 42 sampled single-store Amazon keys are "(Renewed)" listings keyed like new (`apple\|ipad\|gen9\|256\|wifi\|NO_SIZE`) | — | — | PARTIALLY VERIFIED (sample) |
| **SEARCH_NOT_RETRIEVED** | 10 / 60 live sample (store-neutral) | — | — | VERIFIED (§9) |
| **ORPHAN_OFFER** (knowledge offer without storefront row) | 15 / 53 stale-with-rival; 1 / 164 eligible | — | — | PARTIALLY VERIFIED (subset only) |
| **SINGLE_STORE** (no rival at all — overlap, not a defect) | 881 / 1,312 (67.1%) | 58.1% | 63.3% | VERIFIED |

### 7.2 Why phones collapse (mobile 286 products → 68 keys) — PARTIALLY VERIFIED
NPO 30-day valid mobile keys: Amazon 65, eXtra 273, Almanea 140. Amazon's storefront phone count equals eXtra's, so the loss sits in the mobile plugin's detector/normalizer on Amazon titles ("International Version", "Dual SIM", colour-first titles, "(Renewed)"). The exact per-title reject reasons were not traced (would need a dry-run of the plugin, out of READ-ONLY scope on the worker). This is the single highest-value identity investigation.

### 7.3 Cross-store duplicates and splits — VERIFIED
130 of 1,012 Amazon canonicals that are shared with ext/alm live on **different `products.id` rows** per store (ADR-381's read-time merge covers `/compare`, not `/search`). Storefront: 366 ASINs under >1 product, 421 ASINs with >1 row (ADR-397 left these deliberately).

---

## 8. Price & Availability Diagnosis

Trace (code audit, VERIFIED): PDP buy-box selectors (`#corePrice_feature_div … #priceblock_dealprice`, ADR-204) → mobile `#unqualifiedBuyBox` fallback (ADR-397) → `ScrapedProduct.current_price` → `product_stores.current_price` (4×/¼ quarantine gate, ADR-211) + `raw_observations.payload` → normalize → `tps_current_offers.price` → eligibility → page. Tiles (`amazon-search`) never reprice existing rows (ADR-396).

| Check | Result | Status |
|---|---|---|
| Knowledge-layer price = storefront price (same ASIN) | 1,013 / 1,160 identical (87%); TPS >10% higher 18, lower 23; **storefront newer than the layer by >1 h: 180 (15.5%)** | VERIFIED — the 180 are the propagation lag of §6.4 |
| Tile price reaching the layer instead of the page price (ADR-396 defect) | **0 of 782** tile-sourced valid offers differ from the page price column | VERIFIED fixed (contradicts a code-reading claim that `_raw` tile price still flows — the data says it does not) |
| Displayed price = list price | 7 of 390 offers with a list price have price = list | VERIFIED small |
| List price captured | PDP yes (`original_price`), **dropped on the storefront write** (`updateProductPrice` takes none); reaches the layer only as `_original_price` (396 rows) | VERIFIED |
| Deal / coupon / Prime-only / seller / shipping / VAT | **not captured** (no selectors; `coupon_code` always null; seller never read; VAT-inclusive page price assumed) | VERIFIED gap |
| Condition (new/used/renewed) | not captured; title heuristic only | VERIFIED gap |
| Quarantined / pending | 11 / 6 Amazon rows (eXtra 2/2, Almanea 2/2) | VERIFIED |
| Availability derivation | `isUnavailablePage` → OOS; else `#availability span` → in_stock default; **typo `/s+/g` (should be `\s+`) at amazon-scraper.ts:409,411** means multi-line "Currently unavailable" text is not collapsed — impact NOT VERIFIED | VERIFIED (code) |
| Null-price "unavailable" current rows on the compare page | skipped (`get-comparison.ts:243`), so an older priced history row is not overridden by the newer unavailable state; Amazon simply disappears from the page (3 of 60 sample) | VERIFIED |
| Fresh price upstream but stale/null shown | storefront fresh & layer stale: **20 rows** among the 53 stale-with-rival; storefront-newer overall 180 | VERIFIED |

---

## 9. Search / Comparison Diagnosis (live, read-only, 60 shared keys, 1 req/3 s, 14:30–14:40Z)

Sample: 60 identity keys where Amazon and eXtra/Almanea both hold a valid offer, drawn by `md5(identity_key)` order (reproducible: `batch2.cjs sample_shared`, `live-probe.js`). Classification on the production rule (168 h).

| Class | n | Share |
|---|---:|---:|
| **A** Amazon present, eligible, shown with an eligible rival | **34** | 56.7% (Amazon cheapest in 20) |
| A2 Amazon present & eligible, rival stale | 9 | 15.0% |
| **C** Amazon present but stale (>168 h) | 12 | 20.0% |
| **G** rightly excluded (page says unavailable / null price) | 3 | 5.0% |
| NO_CANONICAL (`/api/compare` 404 although both stores have the offer) | 1 | 1.7% |
| **B** present in DB, absent on page, mechanism not found (`lenovo\|idea tab\|…`, stale 27 d; price_history row exists) | 1 | 1.7% — NOT VERIFIED |
| D (fresh but unmatched) / E (known, price missing) / F (not discovered) | 0 in this sample by construction (keys were pre-matched); population-level: E = 28 null-price rows, F = see §5 |

**Search retrieval** (`/api/v1/tps/search?q=<projection display name>`): the exact key came back for **50 / 60**; 5 queries returned **0 results for the product's own display name** (e.g. «شاشة aoc 27 بوصة FHD 120Hz IPS», «tcl 98 4k mini_led 144»), 5 returned results without the key. This is a canonical-level search gap, **store-neutral** (the query is the canonical's name, not Amazon's).

Neutrality check (VERIFIED, code): ranking is lowest eligible page-confirmed price; `applyAffiliateTrueTieOrder` only orders an exact tie (ADR-304); no store weight anywhere in `get-comparison.ts` / search route; `affiliate_best_url` is null on all 9,405 projection rows.

---

## 10. Affiliate Integrity — VERIFIED (no bias found)

- Exit path: `/go/[offerId]` → `buildOfferExitLink` → amazon network: `/dp/ASIN`, query cleared, `tag=tawveeri0f-21`, `ascsubtag=<24-hex>`; tag applied only on human-evidenced exits, stripped otherwise (ADR-398). 30-day ledger: 54 Amazon exits, **54/54 to `/dp/<ASIN>`, 54/54 tagged, 0/54 with an `interaction_id`** (eXtra 56, Almanea 8).
- Variant integrity: exits resolve from the offer row's own URL (`tps_current_offers.url` → ASIN); 13 current offers carry sponsored-redirect URLs the exit regex cannot parse (PARTIALLY VERIFIED: ADR-371 class; exit behaviour on those 13 not probed — probing would create exit rows).
- Attribution loss: the internal redirect is a single 302 (IPH18 evidence, ADR-369); `robots.txt` disallows `/go/` but is not honoured by crawlers (ADR-398 — 2,975 of 3,292 September rows crawler-signature).
- Ranking: affiliate status is not a signal (§9).

---

## 11. Amazon Policy / Compliance (official sources, accessed 2026-10-03; full brief with clause text in the evidence folder's agent transcript and summarized here)

| # | Obligation (source) | Tawveeri today | Status |
|---|---|---|---|
| 1 | Prices/availability may be shown **only** via an Amazon-served link or data obtained through **Creators API / PA API** — amazon.sa Program Policies, Participation Requirements §2(b) | scraped PDPs, no API, not API-eligible (<10 shipped sales/30 d) | **NON-COMPLIANT** (VERIFIED, verbatim clause) |
| 2 | No "data mining, robots, or similar data gathering and extraction tools"; no "collection and use of … prices"; no own database of Amazon prices — amazon.sa Conditions of Use §3, §5 (updated 2025-09-09); IP License §1 | scrapes PDPs, stores `raw_observations`/`price_history` | **NON-COMPLIANT** (VERIFIED) |
| 3 | ≤24 h cache then API refresh; only ASINs may be stored indefinitely — IP License §2(h) | observation-stamped storage, scraper cadence | AT RISK (binding once on the API) |
| 4 | Date/time stamp beside price if refreshed less than hourly — §2(i) | Riyadh timestamp beside each Amazon price (ADR-399) | COMPLIANT in form |
| 5 | Exact disclaimer "…accurate as of the date/time indicated and are subject to change. Any price and availability information displayed on Amazon.sa at the time of purchase will apply…" — §2(i) | «قابل للتغيير» only | AT RISK (second sentence missing) |
| 6 | "As an Amazon Associate I earn from qualifying purchases" / «بصفتي مشارك لأمازون، فإنني أكسب من عمليات الشراء المؤهلة» — Agreement §5 | disclosure beside price + footer | COMPLIANT (verify exact wording) |
| 7 | Comparison format must show lowest **new** and, if provided, lowest **used** Amazon price — §2(b) | used/renewed not captured | AT RISK |
| 8 | Links: tag + non-user-identifying sub-tag; API-vended links unmodified — api-rates, §2(a) | `tag` + 24-hex `ascsubtag` | COMPLIANT |
| 9 | Creators API eligibility ≥10 qualifying sales / trailing 30 d; auto-pause after 30 d without sales; amazon.sa supported; OffersV2 returns price, availability type, condition (New/Used/Refurbished) — official docs | not eligible; config-only adapter inert (ADR-398); founder rule "not before 10 sales" (ADR-399) | NOT POSSIBLE today (gate, not a violation) |
| 10 | PA-API 5 | deprecated, returns 403 (official); dates only in blogs | VERIFIED / INFERRED |
| 11 | No PA content on handheld apps without approval — §2(d) | Expo mobile app shows Amazon data | UNCLEAR |

robots.txt on amazon.sa does not disallow `/dp/` or `/s` for generic agents (VERIFIED) — a crawler convention that does not override COU §3/§5. Sources: `affiliate-program.amazon.sa/help/operating/policies/`, `…/agreement` (Arabic only rendered; English NOT ACCESSIBLE), `affiliate-program.amazon.com/creatorsapi/docs/en-us/{introduction, concepts/api-rates, locale-reference/saudi-arabia, api-reference/resources/offersV2, …}`, `amazon.sa/gp/help/customer/display.html?nodeId=201909000`, `amazon.sa/robots.txt`. Anomaly (UNCLEAR): the Agreement text served on the .sa domain names the UAE entity (Amazon.ae/Souq FZ-LLC) and DIFC/LCIA — founder should confirm in Associates Central which schedule governs.

**Reading:** rows 1–2 are structural; the timestamp/disclosure hygiene (ADR-399) sits on top of a route Amazon does not sanction. The only compliant end-states are the Creators API (after eligibility), Amazon-served widgets, or written consent. This is recorded, not acted on.

---

## 12. Positive Controls — what structurally separates Amazon that works from Amazon that disappears (VERIFIED)

| Attribute | Works (164 eligible, rival eligible) | Disappears (53 ineligible, rival eligible) |
|---|---|---|
| Current observation source | PDP (`scraper`) **137**; tile 27 | tile **32**; PDP 21 |
| Median observation age | 18 h (PDP) / 80 h (tile) | 635 h (tile) / 260 h (PDP) |
| Has a storefront row (lane-reachable) | 163 / 164 | **38 / 53** |
| Storefront row written ≤168 h | 163 | 20 (not propagated) |
| URL parseable as ASIN | 164 / 164 (1 sponsored) | 51 / 53 |
| ASIN carries a second identity key | — | 4 / 53 |
| Category mix | tv 30, washing 29, mobile 19, tablet 15, smartwatch 13, audio 13 | tv 15, washing 8, mobile 9, audio 5 |

Live positive cases (sample A, 34): e.g. `honor\|honor pad 20\|…` 1,999 = eXtra 1,999 (tie, Amazon shown second per ADR-304 unless true tie); `hisense\|top_load\|18\|washer` 2,130 vs 2,559; `samsung\|MODEL:QA65S90HAEXSA` 8,098 vs 7,999 (Amazon loses on price, shown); all with `/go` exits to `/dp/<ASIN>`.

**The pattern:** an Amazon identity reaches the comparison page when (a) it has a storefront row with a canonical `/dp/` URL, (b) it sits in lane L2 (comparison-visible) so the PDP refresh keeps it inside 168 h, and (c) its key was built in the same key space as the rival's. Failures are tile-only identities that never acquired a storefront row, PDP refreshes that landed under a different key, and keys in the spec space while the rival is in the MODEL space.

---

## 12b. Hypotheses H1–H13

| H | Hypothesis | Evidence for | Evidence against | Confidence | Impact | How to verify conclusively |
|---|---|---|---|---|---|---|
| H1 | Discovery coverage weak | phone TPS keys 68 vs eXtra 346; only 26 fixed queries | most active discovery of the three (557–1,246 new ASINs/wk; 7,203 products); phone storefront count equals eXtra's (286 vs 294) | HIGH that it is NOT the general cause; MEDIUM for phones | low (general) / medium (phones) | dry-run the mobile plugin on the 286 Amazon phone titles and count rejects by reason |
| H2 | Refresh throughput below demand | 385 attempts/day vs 6,581 groups; live median write age 164 h (ADR-402) | comparison layer L1+L2 83% ≤48 h; stale share with rival 19% ≈ eXtra 16% | HIGH | medium (tail), low (comparison layer) | already measured (ADR-402); re-measure after any lane/quota change |
| H3 | Anti-bot / throttling lowers success | 15/148 bare nulls; `#productTitle` missing is the captcha signature | 0 429/503/captcha lines in ~340 captured; 85% success; no cooldowns fired | LOW either way | ≤10% of attempts at most | tag null paths (`no_title` etc.) and log response status/size per attempt |
| H4 | Scheduler backlog pushes offers past 168 h | 477/1,312 valid Amazon offers >168 h; 56 of them in comparison keys | eXtra 104/641 stale too; Almanea 85/490 — same order | HIGH that it exists, MEDIUM that it is Amazon-specific | medium | compare per-store stale share weekly (query `ineligible_reasons`) |
| H5 | Identity fragmentation around ASIN/variant | 123 ASINs → >1 key; 4/53 stale cases explained by a fresh sibling key; 8 ASINs span categories | keys→multiple ASINs = 0 (no over-merge) | HIGH | medium | alias-graph co-occurrence audit on the 123 ASINs |
| H6 | Model-number extraction worse than eXtra/Almanea | MODEL: 22.6% vs 44/43%; feeds supply `_manufacturer_model`, Amazon is title-only; PDP spec tables captured but unused | — | HIGH | **high** (laptop 19/248 multi-store, tablet 36/114) | dry-run `pdp-evidence` model extraction on Amazon laptop/tablet PDP specs and count resulting MODEL: matches to eXtra keys |
| H7 | Matching loses Amazon despite data present | 275/1,312 overlap; 20/53 storefront-fresh-but-layer-stale; key-space schism examples | 100% of NPO rows carry a canonical; no wrong-canonical links found (0/164) | HIGH (mechanism = H5+H6) | high | same as H6 + trace the 16 unexplained propagation cases |
| H8 | Eligibility excludes Amazon more than others | 76.8% vs 83.8/83.3% | same rule, gap entirely = stale; Amazon has more *stated* availability (80%) than eXtra (17%), i.e. is judged more strictly only where it is more honest | HIGH it is NOT the cause | low | none needed; keep the rule store-neutral |
| H9 | Search/index does not retrieve eligible Amazon offers | 10/60 search misses | misses are canonical-level (query = display name); projection coverage 94% ≈ eXtra 95.5%; `affiliate_best_url` null everywhere | HIGH it is NOT Amazon-specific | low | repeat probe with eXtra-only keys as control |
| H10 | Price extraction captures list or loses deal price | list price dropped on storefront write; coupon/deal not captured | tile-vs-page 0/782 differ; price = list 7/390; 87% storefront/layer agreement | HIGH it is NOT a current error | low (gap, not error) | none; capture deal/coupon only if the compliance route allows |
| H11 | Availability/condition ambiguity excludes sound offers | 42 OOS + 28 null; condition not captured; Renewed titles keyed like new (3/42 sample) | OOS exclusions are page-confirmed (ADR-396) | MEDIUM | low–medium | count "(Renewed)/Used" tokens across Amazon valid keys and their rival matches |
| H12 | Duplicate identities reduce visibility | 366 ASINs under >1 product; 130/1,012 shared canonicals split across product rows; Galaxy A07 precedent (ADR-381) | `/compare` merges at read time; knowledge layer keyed by identity, not product row | MEDIUM | low–medium (search surface) | re-run ADR-381's cross-row check on `/search` |
| H13 | Mixed causes | all of the above | — | HIGH | — | the funnel in §4 is the standing instrument; re-run `baseline.cjs` weekly |

## 13. Root Causes

```
Amazon underrepresentation (relative to eXtra/Almanea)
├── Discovery ............. NOT the cause (VERIFIED) — most active store; exception: phone identities (PARTIALLY VERIFIED, 286→68)
├── Acquisition ........... VERIFIED gap — title-only identity; PDP spec tables unused; no condition/seller/coupon; 97 sponsored URLs
├── Refresh capacity ...... VERIFIED, medium impact — 385 attempts/day vs 6,581; comparison layer covered (83% ≤48 h); tail stale
├── Price extraction ...... NOT the cause now (VERIFIED) — tile-vs-page 0 diffs; list=price 7/390; 15 nulls/148 unsplittable
├── Availability .......... small (VERIFIED) — 70 unavailable/null (5.3%); `/s+/` typo (impact NOT VERIFIED); unavailable rows vanish from page
├── Identity .............. VERIFIED, HIGH impact — MODEL: 22.6% vs 44%; brand Unknown 57%; brand-token noise; 123 ASINs multi-key
├── Matching .............. VERIFIED, HIGH impact — only 275/1,312 keys shared; laptop 19/248 multi-store; key-space schism; 20/53 refreshes not propagated (16 unexplained)
├── Eligibility ........... NOT the cause (VERIFIED) — 76.8% vs 83.8/83.3%, same rule, gap = stale
├── Search/index .......... NOT Amazon-specific (VERIFIED) — projection 94% (ext 95.5%); 10/60 misses are canonical-level
├── UI/render ............. NOT the cause (VERIFIED) — 43/59 shown; 1 unexplained absence
└── Affiliate outbound .... NOT the cause (VERIFIED) — 54/54 correct ASIN+tag; no ranking signal
     + Compliance ........ P0, independent of representation (VERIFIED, official text)
```

Confidence: Identity/Matching HIGH (multiple independent measurements agree); Refresh MEDIUM-HIGH (ADR-394–402 lineage); Anti-bot LOW (no instrument); Compliance HIGH (verbatim clauses).

---

## 14. Evidence Matrix

| ID | Finding | Evidence / source | Code path · table · query | Captured | Num / den | Conf. | Limitations | Reproduce |
|---|---|---|---|---|---|---|---|---|
| F01 | Amazon shares only 21% of its valid identities with ext/alm | `comparison_layer` | `tps_current_offers` | 14:17Z | 275 / 1,312 | VERIFIED | — | `baseline.cjs` |
| F02 | At the comparison layer Amazon is eligible 76.8% vs 83.8/83.3% | `comparison_fresh`, `ineligible_reasons` | same + `offer-eligibility.ts` rule | 14:17Z | 222 / 289 | VERIFIED | `_availability` unstated treated as eligible (production rule) | `baseline.cjs` |
| F03 | MODEL: keys 22.6% (Amazon) vs 44.0 / 43.1% | `tco_summary` | `identity_key like '%MODEL:%'` | 14:17Z | 373 / 1,653 | VERIFIED | — | `baseline.cjs` |
| F04 | eXtra/Almanea comparison layers are feed-fed (82% / 97%) | `ext_tps_source`, `extra_feed_vs_pdp_freshness` | `raw_observations.source_method` join | 14:21Z | 1,820 / 2,222; 1,557 / 1,598 | VERIFIED | — | `batch2.cjs`, `batch4.cjs` |
| F05 | Phone identities collapse 286 → 68 | `products_category`, `tco_category`, `npo_category_status` | products vs TPS keys | 14:17–14:21Z | 68 / 286 | PARTIALLY VERIFIED | reject reasons not traced | `baseline.cjs`, `batch2.cjs` |
| F06 | Brand Unknown on 57% of Amazon products | `products_brand_top` | `products.brand` | 14:17Z | 4,095 / 7,203 | VERIFIED | — | `baseline.cjs` |
| F07 | 123 ASINs carry >1 identity key; brand-token noise examples | `asin_key_fragmentation`, `asin_multi_key_examples` | `tps_current_offers.url` regex | 14:30Z | 123 / 1,489 | VERIFIED | share of brand-noise within the 123 INFERRED | `batch4.cjs` |
| F08 | Laptop keys almost never corroborate | `key_overlap_by_category` | — | 14:25Z | 19 / 248 | VERIFIED | — | `batch3.cjs` |
| F09 | 15 of 53 stale-with-rival Amazon offers have no storefront row | `stale_rival_storefront`, `controls_provenance_total` | lateral join on ASIN | 14:30Z | 15 / 53 | PARTIALLY VERIFIED | subset only | `batch4.cjs` |
| F10 | 20 of 53 have a fresh storefront write not reflected in the layer | same | `product_stores.updated_at` vs `observed_at` | 14:30Z | 20 / 53 (4 explained) | PARTIALLY VERIFIED | 16 untraced | `batch4.cjs` |
| F11 | Tile price never reaches the layer (ADR-396 fix holds) | `tile_vs_page_price` | `o.price` vs `r.price` | 14:25Z | 0 / 782 | VERIFIED | — | `batch3.cjs` |
| F12 | 97 storefront / 13 current-offer URLs are sponsored redirects without parseable ASIN | `amazon_asin`, `amz_offer_url_forms` | regex | 14:17/14:25Z | 97 / 7,429; 13 / 1,312 | VERIFIED | — | `baseline.cjs`, `batch3.cjs` |
| F13 | Live: 43/59 shown, 34 with eligible rival, cheapest 20/34 | `live-probe-classified.json` | `/api/compare?key=`, `/api/v1/tps/search` | 14:30–14:40Z | 43 / 59 | VERIFIED | 60-key sample; one 404 | `live-probe.js` |
| F14 | Search misses its own canonical for 10/60 | same | `/api/v1/tps/search` | 14:40Z | 50 / 60 | VERIFIED | query = display name | `live-probe.js` |
| F15 | 2 shared keys have no canonical row (compare 404) | `shared_keys_without_canonical` | `canonical_products` | 14:42Z | 2 / 275 | VERIFIED | — | `batch5.cjs` |
| F16 | Unavailable/null-price Amazon rows vanish from the compare page | b_rows + `get-comparison.ts:243` | code + data | 14:42Z | 3 / 60 live; 17 / 289 population | VERIFIED | by design (ADR-396) | `batch5.cjs` |
| F17 | `/s+/g` typo in `isUnavailablePage` | `amazon-scraper.ts:409,411` | code | — | — | VERIFIED (code) | impact unmeasured | read file |
| F18 | No captcha/429/503 signal; no detector | worker logs (2 cycles + 2-day filter), code grep | Railway logs | 02:07Z/20:07Z cycles | 0 / ~340 lines | NOT VERIFIED (absence) | log store partial | `railway logs --since … -f price-attempt` |
| F19 | Refresh success 85%; nulls unsplittable | ADR-402 | `[price-attempt]` lines | 10-02/10-03 | 126 / 148 | VERIFIED | two cycles | ADR-402 |
| F20 | Exits: 54/54 correct ASIN + tag, 0 with interaction | `clicks` | `outbound_clicks` 30 d | 14:17Z | 54 / 54 | VERIFIED | interaction join semantics per ADR-398 | `baseline.cjs` |
| F21 | Scraping while an Associate breaches §2(b), IP §1, COU §3/§5 | official pages (reader-proxy renders of the live URLs) | — | 2026-10-03 | — | VERIFIED (verbatim) | .sa Agreement English NOT ACCESSIBLE | URLs in §11 |
| F22 | Storefront price newer than layer for 15.5% of ASINs | `amz_price_agreement` | — | 14:21Z | 180 / 1,160 | VERIFIED | — | `batch2.cjs` |
| F23 | 51% of storefront in_stock claims are >168 h old | `amz_in_stock_but_stale_sf` | `product_stores` | 14:30Z | 3,373 / 6,615 | VERIFIED | storefront surface only | `batch4.cjs` |
| F24 | 130 shared Amazon canonicals split across product rows | `canonical_split_amz` | `products.canonical_product_id` | 14:30Z | 130 / 1,012 | VERIFIED | ADR-381 covers compare only | `batch4.cjs` |

Contradictions with prior documents, stated: (a) row counts — 7,429 today vs 7,393 (ADR-402, 05:00Z) vs 12,321 (ADR-394): the ADR-397 full de-dup pass is the step; (b) "38 multi-product ASINs" (ADR-394) vs 366 today (ADR-396/397 said 388/367): the 38 was lane-selector scope only; (c) a code-reading claim that tile `_raw.current_price` still reaches TPS is **refuted by data** (F11).

---

## 15. Prioritized Remediation Options — DO NOT IMPLEMENT

**P0 — correctness / compliance (founder decisions)**
1. Decide the Amazon price-display route: (a) pursue Creators API eligibility (≥10 qualifying shipped sales/30 d, then ≤24 h cache + `condition=Any` to satisfy the new+used rule), (b) Amazon-served widgets/links that render price, or (c) written consent. Until then, Amazon data display is a documented exposure (F21).
2. Add the second sentence of the §2(i) disclaimer («أي سعر أو توفر يظهر على Amazon.sa وقت الشراء هو الذي يُطبّق») beside/linked to each Amazon price; confirm the §5 disclosure wording is Amazon's exact sentence; confirm no scraped ratings are rendered; confirm the mobile app's Amazon display against §2(d).
3. Fix the `/s+/g` typo (two characters) — correctness of the unavailable detector.

**P1 — coverage / freshness**
4. Make every knowledge-layer Amazon offer lane-reachable: ensure a storefront row (canonical `/dp/` URL) exists for each `tps_current_offers` Amazon row, or let the lane planner read orphans from the layer (F09: 15/53).
5. Trace the 16 "storefront fresh, layer stale" cases (F10): compare the PDP observation's normalized key/category with the stale key; if the PDP observation lands on a different key, that is F07's sibling-key problem and the fix is in identity, not scheduling.
6. Tag the scraper's null with its path (`no_title` / `no_price` / `no_asin` / `exception`) so block vs parser becomes measurable (ADR-402 proposal; instrumentation only).
7. Decode sponsored-redirect URLs at ingest (97 storefront, 13 current offers) to the canonical `/dp/` form (F12).

**P2 — matching / search**
8. Use the already-captured PDP spec-table model number (`products.specifications`, `pdp-evidence.ts`) to mint `MODEL:` keys for Amazon laptops/tablets/TVs — closes the key-space schism with feed-fed stores (F03/F08); store-neutral by construction.
9. Brand-token guard: never derive brand from "Google TV", "LG webOS", "Apple TV", "Android TV" tokens; stop writing `Unknown` as a brand (F06/F07).
10. Phone plugin dry-run on Amazon titles to recover the 286→68 yield (F05) — precision-first, same registration standard as ADR-073.
11. Capture condition (Renewed/Used) from the page, not the title, and keep it out of the new-price comparison (§7.1, policy row 7).
12. Reconcile the 123 multi-key ASINs through the alias graph (ADR-058) as evidence-backed same-listing proofs.
13. Canonical-level search: the 10/60 display-name misses (F14) and the 2 missing canonicals (F15) — store-neutral.

None of the above changes ranking, thresholds, freshness windows or affiliate behaviour for Amazon alone; every item is either a compliance decision or a store-neutral data-quality fix.

---

**Task ledger (founder's §1–§18):** §1 rules — DONE (no writes, no commit); §2 neutrality — DONE (no Amazon-specific change proposed); §3 baseline — DONE; §4 funnel — DONE; §5 layer model/ASIN — DONE; §6 acquisition architecture — DONE (code audit, field matrix in evidence transcript; summarized §5/§8); §7 policy — DONE (official sources; .sa Agreement English NOT ACCESSIBLE); §8 discovery — DONE; §9 price/availability — DONE (counts); §10 freshness/scheduler — DONE (anti-bot NOT VERIFIED for lack of an instrument); §11 identity taxonomy — DONE (counts where measurable, two items sample-based); §12 retrieval sample — DONE with 60 keys (100 was possible but the 30/min API limit and read-only etiquette argued for 60; D/E/F classes are zero by construction of a pre-matched sample and are reported at population level instead); §13 positive controls — DONE; §14 affiliate — DONE; §15 hypotheses — DONE (§13 tree); §16 table — DONE (§3); §17 tree — DONE; §18 report — this file. NOT DONE: per-title phone-plugin reject reasons (needs a plugin dry-run on the worker, outside READ-ONLY); the 16 unexplained propagation cases; exit probing of the 13 sponsored-URL offers (would write exit rows).
