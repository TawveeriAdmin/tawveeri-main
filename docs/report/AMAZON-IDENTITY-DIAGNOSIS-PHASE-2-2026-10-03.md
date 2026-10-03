# AMAZON IDENTITY DIAGNOSIS — PHASE 2

**Date:** 2026-10-03 · **Mode:** READ-ONLY / DIAGNOSTIC (no code, DB, config, identity, ranking, scraper, link or deploy change; nothing committed; temporary replay harnesses were deleted after running) · **Production authority:** `vyceqrzttspyycdpojtn` · **Live build:** `63d67a9e`

**Evidence folder:** [`docs/evidence/amazon-diagnostic-2026-10-03/phase2/`](../evidence/amazon-diagnostic-2026-10-03/phase2/) — every query (`p2a.cjs`, `p2prop.cjs`, `p2norm.cjs`, `probe.cjs`), every raw result (`p2a.json` 4.9 MB, `p2prop.json`, `p2live.json`), the local analyses (`p2analysis.*`, `p2phonecheck.cjs`), the counterfactual simulation (`p2sim.*`) and the two offline plugin replays (`p2replay.json`, `p2replay2.json`). SQL ran in `REPEATABLE READ READ ONLY` sessions (captures 15:50–16:10Z); the plugin replays imported the production plugins in-process on exported titles and touched no database; the 22 amazon.sa page fetches were single GETs 6 s apart.

**Baseline accepted from Phase 1** (not re-argued): 1,312 valid Amazon identities; 275 (21.0%) shared with eXtra/Almanea; eligibility 77% vs 84/83%; 43/59 live compare pages; cheapest 20/34; MODEL: share 22.6% vs 44/43%; brand Unknown 57%; 123 split ASINs; phones 286→68; laptops 19/248 multi-store; 53 stale-with-rival (15 no storefront row, 20 fresh storefront write, 4 sibling, 16 unexplained).

**Labels:** VERIFIED · PARTIALLY VERIFIED · SIMULATED · ESTIMATED · NOT VERIFIED · UNKNOWN. Where code reading and runtime evidence disagreed, both are shown and the runtime wins (see §7, §12).

**Decision Register searched first:** ADR-058 (key-space schism), 073 (registration standard), 100 (GTIN lever), 183, 299, 305, 310–313, 356, 370–371, 380–381, 394–402, EXECUTIVE_DIRECTIVE §1 (GTIN 0 coverage; Icecat brand-restricted).

---

## Executive Answer (one page)

**1. Why is Amazon coverage lower than eXtra/Almanea?** Because Tawveeri's identity is *title-driven for Amazon and identifier-driven for the control stores*, and because two Tawveeri-side rules reject Amazon's own titles before any identity is built. Every non-Samsung `MODEL:` key in production comes from a payload field (`modelNumber`/`model`) that eXtra's UNBXD feed (`modelNumber` filled 970/1,200 daily rows) and Almanea's feed (`model` filled 15,033/15,245) supply and Amazon never does (VERIFIED, code + data). Amazon's only identifier is the ASIN, which is correctly excluded from cross-store keys; its product pages expose **no GTIN on any of 22 live pages, no JSON-LD, and an "Item model number" only for appliances** (5/7 appliance pages; 0/13 TV, laptop, phone, tablet, vacuum pages) — VERIFIED live. On top of that structural asymmetry, the phone detector and the brand lists reject or void most of Amazon's phone catalogue (replay: of 286 real titles, 146 rejected by `detect()`, 49 `invalid`, 91 valid — VERIFIED by in-process replay).

**2. Top 5 causes, ranked by measured impact**
| # | Cause | Side | Measured impact |
|---|---|---|---|
| 1 | **Mobile `detect()` substring rejects on phone vocabulary** ("camera", "AMOLED", "speaker", "stand") + missing brand-family rules (Motorola, Nothing, AGM…) | Tawveeri | 195 of 286 phone titles produce no identity (146 + 49); 0/84 matched titles contain "camera" vs 107/202 unmatched. Simulated guard + title-brand: shared phone identities **38 → 67** (SIMULATED) |
| 2 | **Key-space schism** — control stores mint `brand\|MODEL:<feed model>` (85% of control laptop offers; 152 of 381 control mobile keys are Samsung colour-SKU MODEL keys), Amazon mints spec tuples | Source (no MPN exposed) + Tawveeri (two key spaces never bridged) | Laptops: 3 of 314 Amazon offers share a key; even a spec-tuple on both sides reaches only 8 (eXtra laptop names lack CPU/RAM: 114/236 `invalid`). Tablets 28/114. PDP-table enrichment adds only **+6** shared keys overall (SIMULATED) |
| 3 | **Normalization coverage** — detectors/`invalid` keys drop rows silently: 2,074 of 3,493 Amazon PDP observations in 7 d (59%) never reach `normalized_product_observations`, 72% of them TPS-like titles | Tawveeri | e.g. TV detector needs a `4k\|uhd\|8k\|qled\|oled\|…\|smart\|led` cue — "Samsung 43 Inch FHD TV, F6000F" is rejected (VERIFIED replay) → 7 of 53 stale-with-rival offers keep a stale price while the storefront is fresh |
| 4 | **Brand** — tile path hard-codes `Unknown` (1,721 products never saw a PDP); PDP path uses a 21-brand substring list that misses Canon, Logitech, Braun, Skyworth, TCL, Hisense… although the page's spec table states the brand (1,806 products) | Tawveeri | 4,095 Unknown; 345 Amazon offers with a null brand segment; 49 of 123 split ASINs are `unknown\|…` vs `brand\|…`; 17 are Google-TV splits; 5 of the 53 stale cases are sibling keys from "Google TV" |
| 5 | **Category-wide AC low confidence** (275/277 Amazon AC `low_confidence_candidate`; eXtra 348/372; Almanea 202/222) and **eXtra over-splitting** (346 phone keys from 294 products; the same name yields both a spec key and a colour-specific `MODEL:SM-A176BZAEMEA` key; iPhone 16E yields both `16` and `16e`) | Both | AC: 2 Amazon keys valid; eXtra: duplicate control keys hide joins that would otherwise exist (Galaxy A07 matches on the spec key, not the SKU key) |

**3–5. Attribution of the overlap gap (ESTIMATED from measured per-category losses; no single percentage is honest across categories):**
- **Amazon source data (identifier absence):** dominant for laptops and tablets — no MPN/GTIN on the page, model name is a marketing name ("VICTUS", "iPad Pro"); ≈ 229 unshared laptop keys + 86 tablet keys cannot be bridged by any Tawveeri rule alone (would need a manufacturer catalogue or the Creators API `ManufactureInfo`/`ExternalIds`).
- **Tawveeri parsing/normalization/identity:** dominant for phones (195/286 titles lost before identity), TV/appliance brand tokens (Google TV, "LG webOS", unknown vs brand: 76 of 123 split ASINs), TV/HD detector gap, AC sentinels. This is the larger *fixable* share.
- **Propagation/freshness:** 53 of 289 comparison keys (18%): 18 capacity, 15 no storefront row, 8 correctly unavailable, 7 detector rejects on the fresh PDP title, 5 sibling keys — **0 remain UNKNOWN at the mechanism level** (the 16 "unexplained" are now 7 detector + 8 unavailable + 1 title-encoding UNKNOWN).

**6. Still UNKNOWN:** the exact rule that rejects `Samsung WA80F13B6LYL …` in production (the same title passes in replay; suspected non-ASCII whitespace in the stored `raw_name`); the production impact of the `/s+/g` typo (no live page in the sample has multi-line availability text; cannot be measured without replaying pages); whether ADR-396's unverified tiles (`updated_at=null`) ever win on the storefront product page in practice.

**7. Ranking bias?** **No.** `get-comparison.ts` orders by lowest eligible page-confirmed price; `applyAffiliateTrueTieOrder` acts only on an exact tie (ADR-304); `affiliate_best_url` is null on all 9,405 projection rows; Phase 1 §9–10 (VERIFIED).

**8. Affiliate bias?** **No.** Tag and `ascsubtag` are applied at exit only, on human-evidenced exits; 54/54 Amazon exits in 30 d went to the correct `/dp/ASIN`; no affiliate field enters identity, eligibility or ranking (VERIFIED).

**9. Can Amazon be improved without Amazon-specific ranking preference?** Yes — every lever in §13 is a generic identity rule (detector vocabulary guard, brand lists, brand-family rules, model-code normalization, sibling-key reconciliation) that applies to all stores; none touches ranking, freshness or eligibility.

**10. Maximum provable improvement by simulation (no production change):** shared identities 275 → **≈ 310 (23.6%)**: +29 phone identities (P3 replay) and +6 from PDP identifiers (D) — SIMULATED on today's data. The phone matches carry **2 known false merges in 40 reviewed pairs** (HONOR X7e↔X7c, X9d↔X9c: the mobile key drops the letter suffix) and one risky truncation (HONOR 600 Lite keyed as `60`), so the gain is conditional on fixing the suffix rule first (§9). Nothing above these numbers is supported by replay.

---

## 1. Global reference (primary sources, accessed 2026-10-03) — what the field says

| Rule | Source (body, date) | Applies |
|---|---|---|
| GTIN identifies a trade item per sellable variant (colour/size/capacity/pack/region → new GTIN); model number is a *family* key, GTIN a *variant* key; GTIN equality proves identity, inequality across markets does not disprove it | GS1 GTIN Management Standard rel. 1.1 (2023), gs1.org (NOT ACCESSIBLE directly — 403; read via GS1 Malaysia mirror + Google gtin spec) | DIRECT |
| Unique product identifiers = GTIN, MPN, brand; without GTIN "provide brand and MPN"; each colour/size/storage variant needs its own GTIN; duplicates judged on `gtin + multipack + condition`; variants grouped by `item_group_id` (colour, size, storage) | Google Merchant Center help 160161, 6324461, 6324507, 12470642 (undated, live) | DIRECT |
| `gtin`, `gtin13`, `mpn`, `sku` (merchant-specific), `model`, `isVariantOf`, `ProductGroup.variesBy` | schema.org Product / ProductGroup | DIRECT (feed/JSON-LD semantics) |
| Child ASIN = purchasable variant, parent ASIN = family; ASIN is catalogue-specific, never a cross-market key (Amazon itself matches across catalogues by content, GEM KDD 2021) | Seller Central variation help (NOT ACCESSIBLE — ECONNRESET; corroborated by snippets); Amazon Science | DIRECT / DESIGN-REF |
| Creators API exposes `ItemInfo.ExternalIds` (EAN/UPC), `ManufactureInfo` (ItemPartNumber, Model), `ByLineInfo` (Brand, Manufacturer), `ParentASIN`, `VariationAttributes`, `GetVariations` | Creators API docs (NOT ACCESSIBLE directly; field list corroborated) | DIRECT once eligible (§12) |
| Title-only matching ceilings: TF-IDF F1 0.57, co-occurrence 0.64–0.75, DeepMatcher 0.76–0.90 *with* 200 k labelled pairs; ground truth itself was built from identifiers (gtin/mpn/sku) | WDC Product Corpus v2, Primpeli/Peeters/Bizer 2019 | DIRECT |
| Blocking → matching; DL helps only on textual/dirty EM; precision/recall trade-off explicit | Mudgal et al., SIGMOD 2018 (DeepMatcher/Magellan) | DESIGN-REF |
| Extract product codes from titles as first-class attributes; merchant-typed UPCs are error-prone | Köpcke/Thor/Thomas/Rahm, EDBT 2012 | DIRECT |
| Three-way outcome link / possible / non-link; rare tokens (full model code) carry high weight, common ones (brand, "55 inch") little | Fellegi & Sunter 1969 (JSTOR/DOI NOT ACCESSIBLE; methodology papers) | DIRECT |
| Default analyzers destroy model codes (`XL500` → `XL`, `500`); index model codes as keyword with a normalizer (lowercase, strip `-`/`/`/space), keep original | Elastic / OpenSearch docs (word_delimiter_graph, normalizer, pattern_replace) | DIRECT |

**Rules adopted as the yardstick for this diagnosis:** identity ladder GTIN → brand+normalized MPN → corroborated title code → review tier; comparable commercial variant = GTIN level (storage/capacity/condition/region split, colour is a variant axis but shares price in practice); never key on ASIN across stores; never merge variants to manufacture comparisons; treat merchant-typed identifiers as evidence, not proof. **Not adopted:** LLM/embedding similarity as decider (below the precision bar; ADR-002).

---

## 2. Amazon.sa as a marketplace — what the page actually exposes (22 live pages, 8 categories, 0 CAPTCHA, all HTTP 200) — VERIFIED

| Category | n | Brand (byline/spec) | Item model number | Model name | Part number | GTIN/EAN anywhere | JSON-LD | Variation data | Parent ≠ child |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| air_conditioner | 1 | 1 | **1** (AM182C0.UK1) | 0 | 0 | 0 | 0 | 1 | 0 |
| refrigerator | 3 | 3 | **3** (HR-68SLUK2SA, HRF-525MB, Df45020n) | 0 | 0 | 0 | 0 | 3 | 1 |
| washing_machine | 3 | 3 | 1 (DWT050) | 0 | 0 | 0 | 0 | 3 | 1 |
| tv | 3 | 3 | **0** | 0 | 0 | 0 | 0 | 3 | 3 |
| laptop | 3 | 3 | **0** | 2 ("VICTUS", "Lenovo Thinkpad") | 0 | 0 | 0 | 3 | 0 |
| mobile | 4 | 4 | **0** | 4 ("iPhone 15", "X5c Plus", "realme 15") | 0 | 0 | 0 | 4 | 3 |
| tablet | 3 | 3 | **0** | 3 ("iPad Pro", "HEY-W09") | 0 | 0 | 0 | 3 | 2 |
| vacuum | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |

Findings: (a) **brand is always stated** on the page (byline + "Brand" row) — the 57% Unknown is entirely Tawveeri-side; (b) **manufacturer model numbers are exposed for appliances only**; TVs carry the model code in the *title* (Samsung `QA65S90HAEXSA`, LG `OLED55CS6VA`, Skyworth `55Q6800H`) — which the TV plugin already extracts (154/203 Amazon TV keys are `MODEL:`); phones/tablets/laptops carry a marketing "Model name" that is not an MPN; (c) **no GTIN, UPC or EAN is exposed anywhere** (page, embedded state, JSON-LD) — GS1 rung 1 is unreachable from amazon.sa without the API; (d) every page carries variation ("twister") data and phones/tablets/TVs sit under a different **parent ASIN** — the child ASIN is the GTIN-level variant, matching the Amazon model in §1; (e) availability text is single-line on all 22 pages; `#outOfStock` governs the unavailable state.

Population confirmation from stored PDP payloads (1,312 valid offers; `raw_observations.payload.specifications`): PDP evidence exists for 765; a spec table for 633; a "Brand" row for 606; "Item model number" for **62**; a usable "Model name" for 64; "Manufacturer" 193; Part/MPN **0**. By category — AC 131/187 PDPs carry an item model number, refrigerator 32/53, washer 22/49; TV 0/181, laptop 0/107, mobile 0/55, tablet 0/61. (Phase 1 stated these tables were in `products.specifications`; they are not — that column holds Tawveeri-derived keys only. Corrected here.)

---

## 3. Control group — why eXtra and Almanea reach identities (VERIFIED, code + data)

| Field | Amazon source → payload | eXtra source → payload | Almanea source → payload | Read by normalize? | Enters identity key? |
|---|---|---|---|---|---|
| Merchant SKU | ASIN → `sku` | UNBXD `uniqueId`/`productCode`; page `sku`/`mpn` | feed `sku` (e.g. 170215206999005) | only the Samsung gate (`progressive-engine.ts:288-291`) | only as `samsung\|MODEL:` when it equals a verified Samsung SKU |
| **Manufacturer model / MPN** | page `model` = **title minus brand** (rejected by the shape test: whitespace); tile `model` = regex fragment (rejected) | UNBXD **`modelNumber`** (970/1,200 daily rows filled; e.g. `MYDV3AH/A`, `D80WREA`, `FX607VJB-RL143W`) | feed **`model`** (15,033/15,245 filled; e.g. `WFR1114MB`, `MJL94AF/A`) | `extractManufacturerModel` reads `mpn, modelNumber, model_number, model` only (`store-identifiers.ts:33`) | **yes → `brand\|MODEL:x`** for tv/laptop/tablet/appliance; **never for mobile** (`mobile/parser.ts:263` → null) |
| GTIN / EAN / barcode | none | UNBXD **`barCode`** filled 1,200/1,200 (JSON array, e.g. `["6295199251874"]`, GTIN-13/12 shaped) — **not read by the engine** (`p.gtin` only) | feed `gtin` key present, **0/15,245 filled** | `p.gtin` → `_gtin` staging only | no |
| Brand | tile: `detectBrandFromText(title) ?? 'Unknown'` (longest alias wins; "google" beats "tcl"); page: 21-brand substring list `?? 'Unknown'` | UNBXD `brandEn`/`brandAr` (1,200/1,200) | feed `brand` (Arabic, 15,245/15,245) | `brandOrNull` (nulls store names only; `'Unknown'` passes) | yes, first segment; `unknown\|` survives only in the AC plugin |
| Category | title | UNBXD `familyEn`/`categoryPath` | feed `category_ids` | per-plugin `detect()` on the title only | yes (plugin) |
| Variant: storage/RAM | title | title + `featureArMemoryInternal`, `featureArMemoryRAMSize` | nested `specifications.storage` (not read by the mobile parser, which reads top-level `storage` only) | mobile: top-level `payload.storage`/title; laptop: title | storage yes (mobile/laptop/tablet); RAM laptop only |
| Colour | title / PDP "Colour" | title / `featureArColor` | `specifications.color` | parsed | no (correct: variant axis that shares price) |
| Condition | title heuristic only ("Renewed") | UNBXD `condition` (281/1,200) | — | not read | no — 21 of 84 matched Amazon phones are refurbished listings keyed like new |
| Page spec table (Brand, Item model number, Manufacturer) | PDP → `payload.specifications` (flat, keys with embedded whitespace/RTL marks) | page extras | `{}` | **never for brand or model** (TV stringifies it for size/panel only) | no |

**The structural answer to the central question:** eXtra and Almanea hand the engine a manufacturer model in a field the engine reads; Amazon hands it a title. The engine is not "better at eXtra" — it is *identifier-first*, and only one side has identifiers. For phones the control stores get a second, independent route: the Samsung manufacturer gate turns any 8+ character `modelNumber`/`model`/`sku` that matches the verified Samsung registry into `samsung|MODEL:<SKU>` (`progressive-engine.ts:288-297`) — a route an ASIN can never take.

---

## 4. Coverage funnel per store (numerator/denominator; first clear divergence marked ◄)

| Stage | Amazon | eXtra | Almanea |
|---|---|---|---|
| Source catalogue (storefront products) | 7,203 | 5,347 | 1,468 |
| Valid source products (priced row) | 7,417/7,429 rows (99.8%) | 5,667/5,667 | 1,468/1,468 |
| Parsed into a TPS-category observation (NPO rows, 30 d) | 8,792 rows / **1,764 keys** | 18,479 / 2,877 | 117,799 / 1,953 |
| Brand-known (storefront `brand` ≠ Unknown) | **3,108 / 7,203 (43%) ◄** | 5,347 (100%) | 1,468 (100%) |
| Model-known (identity key with `MODEL:`) | **373 / 1,653 (22.6%) ◄** | 1,151 / 2,615 (44.0%) | 798 / 1,852 (43.1%) |
| Valid identity | 1,312 / 1,653 (79.4%) | 2,222 / 2,615 (85.0%) | 1,598 / 1,852 (86.3%) |
| Multi-store identity | **431 / 1,312 (32.9%)**; with ext/alm 275 (21.0%) | 931 / 2,222 (41.9%) | 587 / 1,598 (36.7%) |
| Eligible offer (price>0, not OOS, ≤168 h) | ≈820 / 1,312 (62.5%) | ≈1,557 / 2,222 (70%) | ≈1,110 / 1,598 (69%) |
| Fresh offer among keys with an eligible rival | 222 / 289 (76.8%) | 537 / 641 (83.8%) | 408 / 490 (83.3%) |
| Shown on comparison (live sample) | 43 / 59 | — | — |

**First divergence:** *brand-known* (43% vs 100%) and *model-known* (22.6% vs 44%) — both before "valid identity". Amazon's valid-identity rate (79%) and eligibility (77%) are within a few points of the controls; the catalogue leaves the funnel at the brand/model stage.

Per-category key overlap today (Amazon keys with ≥1 other store / with ext or alm): mobile 49/68 (**72%**, 45 with ext/alm) · washing_machine 42/66 (64%) · tv 73/203 (36%) · tablet 36/114 (32%) · refrigerator 25/79 (32%) · laptop **19/248 (7.7%, 3 with ext/alm)** · air_conditioner 2/2 (of 277). The phone keys that exist overlap *better* than any other category — the loss is that only 68 exist.

---

## 5. Brand = Unknown: the 4,095 dissected (VERIFIED, population)

| Class | n | % | Stage of failure | Example (spec Brand ⇐ title) |
|---|---:|---:|---|---|
| C — PDP seen, page spec table states "Brand", the 21-brand substring list (`amazon-scraper.ts:574-592`) missed it | **1,806** | 44.1% | PDP parse | Canon ⇐ "Canon EF 75-300mm…"; GoodCook; Braun; Logitech; Sandisk |
| A — tile-only product, never a PDP; tile path writes `detectBrandFromText ?? 'Unknown'` and the product row was created from the tile | **1,721** | 42.0% | discovery/tile | "How to Do Everything MacBook" (books), accessories |
| E — PDP seen, no "Brand" row in the spec table (genuinely unbranded or books) | 537 | 13.1% | source | "Air Fryer 2", technical books |
| B — PDP brand known at both levels, storefront row never updated | 27 | 0.7% | storefront write | UGREEN, meross, ASUS |
| D — PDP payload brand known, storefront not updated | 4 | 0.1% | storefront write | SKYWORTH "50G6520G" |

Recoverability: a "Brand" row exists in PDP evidence for **1,833 (44.8%)**; the title's first token is a known brand for **1,071 (26.2%)**. By category the Unknowns are mostly outside TPS categories (accessories 621, kitchen 616, laptop 544 — of which many are bags/chargers, appliance 409, tablet 261, tv 223, monitor 217, AC 182). **Effect on identity:** 345 Amazon offers carry a null brand segment; in the AC plugin `unknown|` survives into keys (49 split ASINs are `unknown|…` vs `brand|…` twins); in every other plugin an unknown brand voids the row. The "brand field conflict / seller name as brand / platform token as brand" classes exist but are small: 57 of 573 offers whose spec Brand disagrees with the key brand (10%), dominated by "Google" (Google TV), "Apple" (Apple TV app, "Impex"), "soundcore/Anker", "SONY MUSIC", "DOLCE GUSTO/De'Longhi".

---

## 6. The 123 split ASINs — taxonomy (VERIFIED, all 123 classified; rows in `p2analysis.json`)

| Class | n | % | Example (ASIN: keys) | Correct identity | Safe to merge? | Confidence |
|---|---:|---:|---|---|---|---|
| BRAND_unknown_vs_detected (AC plugin keeps `unknown`) | 49 | 39.8% | B01DBGHI8G: `unknown\|split\|NO_SERIES\|27000\|NO_TECH\|cool_only` ‖ `hisense\|split\|…` | the branded key | yes, when the spec tuple is identical and the brand row/title names the brand | HIGH |
| SPEC_FIELD_DIFF (storage/connectivity/screen sentinel) | 17 | 13.8% | B08X1RMTR3: iPhone 12 mini `64` ‖ `128`; B0D3J83VPF iPad Air `1024\|5g` ‖ `1024\|wifi` ‖ `256\|wifi` | **genuinely different commercial variants under one ASIN** — the ASIN is a *parent/family* listing whose tile and PDP observations named different children | **no** — keep split; the defect is the ASIN-level listing identity, not the key | HIGH |
| BRAND_TOKEN_platform ("Google TV" → `google`) | 17 | 13.8% | B0FGDMJJHK: `google\|MODEL:55Q6800H` ‖ `skyworth\|MODEL:55Q6800H` | `skyworth\|MODEL:55Q6800H` | yes (same model code) | HIGH |
| MODEL_vs_SPEC_keyspace (tile vs PDP title variance) | 16 | 13.0% | B007TVJRNE: `sharp\|MODEL:242INW` ‖ `sharp\|solo\|20` | the `MODEL:` key | yes (same ASIN, same product) | HIGH |
| MODEL_token_variance (truncation / dimension string) | 10 | 8.1% | B0BZSJQKT9: `MODEL:QA85QN900CUXSA` ‖ `MODEL:QN900C`; B09965CFDB `NIK50MEU4STN` ‖ `NIK50MEU` | the full code | yes for same ASIN; cross-store needs a prefix rule | MEDIUM |
| BRAND_TOKEN_other ("LG webOS" → `lg`/`vision`, "Apple" from Apple TV app) | 10 | 8.1% | B0F8JK45YM: `lg\|MODEL:65QNED86A6A` ‖ `vision\|MODEL:65QNED86A6A` | the brand in the "Brand" row | yes | HIGH |
| CATEGORY_MISMATCH | 4 | 3.3% | B08SKNFQBS: `philips\|MODEL:HD7432` ‖ `philips\|drip\|0.6` | one category | case by case | MEDIUM |

No case was caused by Arabic/English transliteration, punctuation or hyphen removal; one (B0BK9CFSGP `CBOA314` vs `CBOA314-1H`) is hyphen truncation. **None of the merges above is executed.**

---

## 7. Phones: 286 → 68, replayed with the production plugin (VERIFIED by replay)

| Stage | Amazon | eXtra |
|---|---:|---:|
| Storefront smartphone products | 286 | 294 |
| Phone-like ASINs observed in 30 d (raw) | 332 | — |
| Titles the mobile `detect()` **accepts** | **140 / 286** (146 rejected: 137 as no category, 7 as *camera*, 2 as *audio*) | — |
| Accepted titles with a **valid** key | **91** (49 `invalid: null in critical: family, generation, variant` — brand Unknown 37, Motorola 10, others 2) | — |
| Distinct valid keys | 56 (replay) / 68 (current offers incl. older observations) | NPO 30 d: 273 keys from 351 names; current offers 346 |
| Keys shared with a control store | 38 (replay) / 45 (Phase 1, current) | 120 |
| Control over-splitting | — | same name → 2 keys for Samsung (spec + colour SKU `MODEL:SM-A176BZAEMEA`) and iPhone 16E/17E (`16` and `16e`); 152 of 381 control mobile keys are MODEL keys |

**Where cardinality collapses:** (1) `detect()` — `FOREIGN_CATEGORY_SIGNALS` are *substring* tests (`mobile/detector.ts:43-87`): "camera" (50 MP Camera), "oled" inside "AMOLED", "speaker", "stand" inside "standby" reject spec-rich Amazon titles; control titles ("Apple iPhone 12, 5G, 256GB, Red") never contain them. **0 of 84 matched Amazon titles contain "camera"; 107 of 202 unmatched do.** (2) brand → family: `canonicalizeBrand('Unknown')` returns the truthy `"unknown"`, so `inferBrand()` never runs (`mobile/parser.ts:209` dead code), and brands without a `BRAND_FAMILIES` entry (Motorola, Nothing, AGM, Nokia) are `invalid`. (3) Key construction deliberately drops colour, RAM, network and region (correct for price identity) — but also drops the **letter suffix** (X7c/X7e → `Honor X|7`, X9c/X9d → `Honor X|9`) and reads "+" only after "pro" ("S23+" → `S23`): two **over-merge** classes that exist in production today.

**Simulation (same plugin code, titles pre-processed; nothing written):**
| Scenario | detect reject | valid | distinct keys | **shared with control** |
|---|---:|---:|---:|---:|
| P1 as-is | 146 | 91 | 56 | 38 |
| P2 + brand from title when Unknown | 146 | 100 | 59 | 40 |
| P3 + phone-vocabulary guard (camera/AMOLED/speaker/standby neutralised) | 33 (accessories only) | **185** | 90 | **67** |

Reviewer-1 pass over the 40 listed P3 matches: 37 same commercial variant (e.g. `apple|iPhone|17|Pro|512` ↔ eXtra «آيفون 17 برو، 512»; `samsung|Galaxy S|S26|Ultra|256`), **2 false merges** (HONOR X7e↔X7c, X9d↔X9c — suffix dropped), 1 risky (HONOR 600 Lite keyed `60`). The remaining 68 `invalid` are 46 Unknown-brand accessories/feature phones and 10 Motorola. eXtra's 346 is **not** the target: the correct commercial identity for a phone is brand+family+generation+variant+storage (colour excluded), which eXtra reaches on its spec key and then duplicates on a colour SKU.

---

## 8. Laptops (replay on 314 Amazon and 236 control offers)

- Amazon: 296 spec-tuple keys from 314 offers; 5 `MODEL:` keys in the 60-row sample; 18/60 carry `NO_FAMILY`/`NO_SCREEN`; 6/60 are "(Renewed)". PDP evidence: 107 offers have a PDP, **0 have "Item model number"**, 90 have a "Model name" that is a marketing family ("VICTUS", "Latitude 7470", "Lenovo Thinkpad").
- Control: 201 of 236 offers are `MODEL:` keys (HP `D80WREA`, Apple `MDVK4AB/A`, Lenovo `83US0034AD`, ASUS `FX607VJB-RL143W`); replaying the control *names* through the laptop plugin yields a valid spec tuple for only **48** (114 `invalid: null in critical: ram`, 45 undetected) — eXtra names are thin ("HP Laptop, Core 7-150U,16GB, 512GB,15.6 FHD…" lacks a family).
- Current shared keys: 3. **Simulated spec-tuple overlap: 8** (MacBook Pro M5 variants, IdeaPad Slim 3, ROG Strix, Vivobook).
- Mismatch causes, in order: missing manufacturer part number on Amazon (source, structural) › control names lacking CPU/RAM/family (source) › family-name heterogeneity ("IdeaPad Slim 3 15IRH8" vs "Ideapad slim 3") › regional SKU suffixes (`-RL143W`) › Amazon title noise ("Beats i9-10880H"). **Verdict:** the current laptop identity (spec tuple with `NO_SCREEN`/`NO_FAMILY` sentinels on one side, MPN on the other) is **not suited to cross-store laptop comparison between these sources**; neither title-only side can reach rung 2 without an MPN↔configuration catalogue (manufacturer data) or the Creators API `ManufactureInfo.ItemPartNumber`. ADR-058's alias-graph approach (co-occurrence of both key spaces on one observation) cannot fire because no observation carries both.

---

## 9. Manufacturer identifiers outside the title — can they link what failed? (VERIFIED + SIMULATED)

Identifier availability on stored PDP evidence (1,312 valid Amazon offers): usable item model number **62**, usable model name (non-phone/tablet) 64 → 112 offers with any usable code; Part/MPN 0; GTIN 0. Scenario C (model enrichment, brand-guarded, control index built from control `MODEL:` keys + raw `model`/`modelNumber` fields, 3,458 control keys) links **4** additional offers (LG LTT7CBBSI, Hitachi HRTN7489DFBSLSA, LG LS25CBBDIK, Haam HM250WRF-O23DF — all refrigerators, all matching Almanea's `model` field; the control side keyed them as *spec tuples*, so even a shared model code does not meet a shared key today). Scenario B (brand cleanup from the spec "Brand" row) links **+2** and merges 1 Amazon key pair. **Answer: of the ~1,037 Amazon offers without a control match, ≈ 6 could have been linked by an identifier that was on the page and unused** — the page-identifier lever is small because amazon.sa does not print MPNs for the categories where overlap is lost (TV, laptop, phone, tablet).

---

## 10. Counterfactual simulation — summary (all SIMULATED on 2026-10-03 data; nothing written)

| Scenario | Amazon valid | Shared | Overlap | vs eXtra | vs Almanea | Model matches | Ambiguous | Amazon key collisions | FP risk |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A current (OBSERVED) | 1,312 | 275 | 21.0% | 220 | 116 | — | — | 0 | — |
| B brand cleanup (PDP "Brand", platform tokens) | 1,312 | 280 | 21.3% | 226 | 115 | — | — | 1 | low (brand row is authoritative) |
| C model enrichment (PDP Item model number / Model number, brand-guarded) | 1,312 | 279 | 21.3% | 220 | 120 | 4 | 0 | 0 | low (exact code) |
| D = B + C | 1,312 | 284 | 21.6% | 226 | 119 | 4 | 0 | 1 | low |
| E = D + relaxed brand guard | 1,312 | 285 | 21.7% | 227 | 119 | 5 | 1 | 1 | medium |
| **P3 phones** (detector guard + title brand; §7) | +94 valid phone rows | **+29 keys** | → **≈ 23.6% combined with D** | +27 | +2 | — | — | 2 known over-merges (suffix) | medium until the suffix rule is fixed |
| F deterministic GTIN/EAN/UPC | 0 Amazon identifiers exist; eXtra `barCode` (1,200/1,200) unread; Almanea `gtin` empty | 0 | — | — | — | — | — | — | UNKNOWN until a source exists |

Over-splits found on the control side (not Amazon): Samsung colour SKUs and iPhone 16E/17E double keys (§7). Over-merges found on the Amazon side: HONOR letter suffix, "+" models, HONOR 600→60 (§7). ESTIMATED ceiling of all simulated rules combined on today's data: **≈ 310 shared identities (23.6%)**; the gap to eXtra's 41.9% multi-store rate is structural (identifier access) for laptops/tablets and categorical (AC) elsewhere.

---

## 11. Precision over coverage — human-review sample (no DB change)

A 40-pair reviewer-1 sample from P3 (phones) is listed in `p2replay2.json → phones.P3.shared_keys` with Amazon and control names side by side; the 5 model-code matches of scenario E and the 8 laptop spec overlaps are in `p2sim.json → review_sample` and `p2replay.json → laptops.overlap_examples`. Reviewer-1 labels (mine; not ground truth): phones 37 SAME_VARIANT / 2 DIFFERENT (X7e≠X7c, X9d≠X9c) / 1 UNSURE (600 Lite keyed 60) → **precision 92.5%, FP rate 5%**; model-code matches 5/5 SAME_FAMILY of which 4 SAME_VARIANT and 1 UNSURE (Haam HM250WRF: Amazon "inverter" vs Almanea "non inverter" in the name — the model code is identical, so the *name* is the suspect); laptop spec overlaps 8/8 SAME_CONFIGURATION (screen 14.2 vs 14 and 16.2 vs 16 reconciled by the plugin). Recall cannot be measured without ground truth; a stratified 150-pair founder review (50 phones, 50 TV/appliance model codes, 50 laptops) is the proposed Phase-3 gate before any rule ships.

---

## 12. The propagation cases, traced (VERIFIED; `p2analysis.json → propagation.rows`, all 53 with ASIN, timestamps, prices, keys, offer ids)

| Cause | n | Stage where it stopped |
|---|---:|---|
| STOREFRONT_ALSO_STALE — never refreshed within 168 h (capacity/back-off) | 18 | scheduler |
| NO_STOREFRONT_ROW — knowledge-layer offer with no `product_stores` row (tile-only identity), unreachable by any lane | 15 | acquisition |
| FRESH_OBSERVATION_IS_OUT_OF_STOCK — fresh PDP says unavailable; correctly ineligible (e.g. B0CHXS73N7 iPhone 15, B0GQVC1VFT iPad Air) | 8 | eligibility (correct) |
| FRESH_PDP_RAW_EXISTS_BUT_NO_NORMALIZED_ROW — the fresh PDP title is rejected by the detector, so the old key's offer keeps its old timestamp (B0F9KPTKJG "Samsung 43 Inch FHD TV, F6000F…": `WEAK_TV_SIGNALS` need a `4k\|uhd\|8k\|qled\|oled\|…\|smart\|led` cue — `tv/detector.ts:54-57`; B0DD413Q9J EarPods; B0G5ZJYGQ4/B0H9RF7V9K/B0HD17NYHD phones rejected or `invalid` on the PDP path) | 7 | normalization |
| FRESH_PDP_NORMALIZED_TO_A_DIFFERENT_KEY — sibling key (`google|…` from "Google TV") | 5 | identity |
| UNKNOWN — B0FB9R7Y6S "Samsung WA80F13B6LYL 13KG top load…": detected and valid in replay, no NPO row in production (suspect non-ASCII whitespace in the stored title) | 1 | — |

Population measure of the normalization stage (7 d): Amazon PDP rows 3,493 → 1,419 normalized (41%); tiles 2,893 → 693; eXtra PDP 2,082 → 665, UNBXD 7,194 → 70; Almanea feed 8,100 → 1,084. The engine stages a row only when a plugin's `detect()` accepts it **and** the key is not `invalid` (`progressive-engine.ts:293-299`); everything else is "scanned, undetected, skipped" (its own comment at L129-130). Of the 2,074 unnormalized Amazon PDP rows, 1,494 have TPS-category titles. **Not** sibling-key, dedup, FK, transaction-order, scheduler-timing, query-behaviour or current-row-selection problems — none of those appeared.

---

## 13. Secondary checks requested

**`/s+/g` (amazon-scraper.ts:409, 411) — static + data impact:** used only in `isUnavailablePage`, applied to the buy-box text and the `#availability` text before testing `/currently unavailable|غير متوفر حالي/i`; the intent is clearly `\s+` (collapse whitespace). It cannot corrupt a model, brand or key (it touches availability text only). Measured: on 22 live pages every `#availability` text is single-line, and `#outOfStock` (checked first) governs the unavailable state; in 14 d of PDP observations 162 rows were classified out_of_stock. **No measurable impact in the sample; impact bounded above by the 15 unsplittable nulls per 148 attempts (ADR-402).** Classification: correctness hygiene, not a cause.

**`get-comparison.ts:243` null-price current rows:** intended (ADR-396: a product-only "unavailable" observation must not become a price); applies to every store equally (the loop is store-agnostic) — eXtra never produces such rows (its feed has no OOS state; 0 of 2,222), Almanea does (76), Amazon does (28 null-price + 42 OOS). Why 3/60: the newest Amazon observation was `out_of_stock`/null while an older price_history row existed, so Amazon dropped out of `offers` instead of appearing as "unavailable". **Decision options (no change made):** (a) keep hiding (current; honest but the shopper cannot see Amazon carried it); (b) show the store with an explicit «غير متوفر حالياً» badge and no price (consistent with ADR-396's "unavailable is a state"); (c) show last known price with a stale/unavailable label (rejected by ADR-401's "unobserved ≠ unchanged" ruling). Option (b) is the one consistent with existing rulings; founder's call.

**Refresh architecture (identity vs freshness separated):** per-page fetching costs Amazon on *freshness* (median write age 164 h on the tail, 18 h on L1) and on *identifier richness* (titles only), not on discovery (most active store) or on comparison-layer freshness (77% vs 84/83%). Feed stores get identifiers *and* freshness from one daily pull (eXtra 1,000–1,200 listings/day, Almanea 3,500 listings/day); Amazon gets ≤385 pages/day. The identity problem (§3–§9) would persist even at infinite throughput; the freshness problem (18 capacity cases of 53) would persist even with perfect identity. They are separable and should be fixed separately.

---

## 14. Compliance review (official sources; Phase 1 §11 stands; account facts applied)

| Item | Status |
|---|---|
| Program Policies §2(b): prices/availability only via Amazon-served link or Creators/PA API — scraped PDPs are neither | **VERIFIED (text); NON-COMPLIANT as practised** |
| Conditions of Use §3/§5 (no data mining/robots; no own price database) | VERIFIED (text, updated 2025-09-09) |
| Which Operating Agreement governs the Tawveeri account (the .sa page served the UAE entity schedule) | **REQUIRES OWNER CONFIRMATION** |
| Creators API eligibility: ≥10 qualifying shipped sales / trailing 30 d; account at **2** | **ACCOUNT-SPECIFIC — NOT AVAILABLE NOW** (founder statement; auto-pause rule after 30 d without sales also applies) |
| English text of the .sa Agreement | NOT ACCESSIBLE |

**What the Creators API would change for identity (future state, not a plan):** `ItemInfo.ExternalIds` (EAN/UPC) → GS1 rung 1 for the first time on any Tawveeri source; `ManufactureInfo.ItemPartNumber`/`Model` → rung 2 for laptops/TVs/phones where the page prints nothing; `ByLineInfo.Brand` → ends the Unknown class; `ParentASIN` + `VariationAttributes`/`GetVariations` → the ASIN-family problem of §6 (17 SPEC_FIELD_DIFF cases) becomes explicit. Redesign needed at eligibility: identity ladder (GTIN → brand+MPN → title) with the feed stores' `barCode`/`gtin` finally read; ≤24 h cache + hourly-or-timestamped refresh; `condition=Any` to satisfy the new+used rule; API-vended links unmodified. None of this is actionable at 2/10 sales.

---

## 15. Root-cause table (ranked by measured impact)

| Rank | Root cause | Affected products | Share of gap | Evidence | Confidence | Side | Fixable now (read-only verdict) |
|---|---|---:|---|---|---|---|---|
| 1 | Mobile detector substring rejects + dead `inferBrand` + missing brand families | 195 / 286 phone titles; P3 +29 shared keys | ESTIMATED largest single Tawveeri-side lever (phones are 72% overlap once keyed) | §7 replay | HIGH | Tawveeri | yes, generic (vocabulary guard + families), after suffix fix |
| 2 | Key-space schism (feed MPN vs Amazon title) — laptops/tablets | 229 laptop + 86 tablet unshared keys | structural; 3→8 even with spec tuples | §3, §8 | HIGH | Source + Tawveeri | no (needs an identifier source) |
| 3 | Normalization silently skips rejected titles (TV "FHD/HD" cue gap, phone rejects) | 2,074 / 3,493 PDP rows per week; 7 / 53 stale cases | medium (freshness of existing keys) | §12 | HIGH | Tawveeri | yes, generic |
| 4 | Brand: tile `Unknown` hard-code; 21-brand PDP list; spec "Brand" row unused; platform tokens | 4,095 products; 76 / 123 split ASINs; 5 / 53 stale | medium | §5, §6 | HIGH | Tawveeri | yes, generic |
| 5 | AC category-wide low confidence (sentinel-heavy keys) | 275 / 277 Amazon AC (eXtra 348/372) | category-specific | §4 | HIGH | Both | partly (ADR-313/319 scope) |
| 6 | Tile-only identities without storefront row (unrefreshable) | 15 / 53 stale cases | small-medium | §12 | PARTIALLY VERIFIED (subset) | Tawveeri | yes |
| 7 | ASIN = family listing (SPEC_FIELD_DIFF) and model-token variance | 17 + 10 ASINs | small | §6 | HIGH | Source (parent/child) + Tawveeri | partly |
| 8 | Control-side over-splitting (Samsung colour SKUs; 16E/17E) hides joins | ≥15 eXtra names with 2 keys; 152 MODEL mobile keys | small-medium (precision-neutral) | §7 | HIGH | Tawveeri | yes, generic |
| 9 | `/s+/g`, null-price page behaviour | unmeasured / 3 of 60 | negligible / UX decision | §13 | VERIFIED (code) | Tawveeri | hygiene / decision |

---

## 16. Phase 3 Candidate Remediation — DO NOT IMPLEMENT (awaiting founder review)

**P0 — correctness / compliance / wide identity corruption**
1. **Compliance route decision** (unchanged from Phase 1): Amazon price display sits on a route Amazon does not sanction; Creators API is not available (2/10). Options: Amazon-served widgets, written consent, or accept the exposure explicitly. *Problem:* §14 · *Products:* all 1,312 · *Evidence:* official text · *Benefit:* risk removal · *FP risk:* n/a · *Scope:* founder decision · *Rollback:* n/a · *Test:* n/a · *Generic.*
2. **Mobile key over-merge: letter suffix and "+"** (`Honor X|7` for X7c and X7e; `S23` for S23+). *Products:* every phone with a letter-suffixed or "+" model on any store (HONOR X-series, Galaxy S+, iPhone 16E already handled) · *Evidence:* §7 (2 FP in 40) · *Benefit:* precision · *FP risk:* removes FPs; may split keys that were correctly merged only by accident · *Scope:* `mobile/parser.ts` family rules + regression fixtures from real titles (ADR-073 standard) · *Rollback:* revert · *Test:* replay on 286 Amazon + 351 eXtra titles, 0 cross-variant merges · *Generic.*

**P1 — highest coverage return at high precision**
3. **Phone detector vocabulary guard**: treat "camera", "AMOLED/OLED", "speaker", "standby" as phone-spec vocabulary when a strong phone signal is present (word-boundary, context-aware) instead of substring foreign-category rejects. *Products:* 146 Amazon phone titles (and any store with spec-rich titles) · *Evidence:* §7 replay (+29 shared keys, 0/84 vs 107/202) · *Benefit:* ≈ +64% shared phone identities · *FP risk:* accessories (33 still rejected in P3; keep the accessory list) · *Scope:* `mobile/detector.ts` · *Rollback:* revert · *Test:* replay corpus; precision review of 50 new pairs · *Generic.*
4. **Brand from evidence, not lists**: (a) PDP path reads the spec "Brand" row before the 21-brand list; (b) tile path never writes the literal `Unknown` as a brand (write null); (c) `canonicalizeBrand` returns null for unknown so `inferBrand()` runs; (d) platform-token stop-list (Google TV, Android TV, webOS, Apple TV, Alexa) in brand detection. *Products:* 1,806 + 1,721 + 17 + 10 · *Evidence:* §5, §6 · *Benefit:* removes 49 + 27 split keys, enables families for ~9 phones immediately · *FP risk:* low (page-stated brand) · *Scope:* `amazon-scraper.ts`, `amazon-search-scraper.ts`, `brand-map.ts` · *Rollback:* revert · *Test:* split-ASIN count 123 → <50 on the same data · *Generic.*
5. **Brand-family rules for Motorola, Nothing, Nokia, AGM** (and the 600→60 truncation). *Products:* 10 + · *Evidence:* §7 · *Generic.*
6. **TV detector cue gap** (`fhd|hd|hdr|crystal` as TV cues when a size and "tv" are present). *Products:* 2 of 7 stale cases, unknown population (cheap Samsung/LG HD sets) · *Evidence:* §12 · *FP risk:* monitors (already rejected by `MONITOR_SIGNALS`) · *Generic.*
7. **Read eXtra `barCode` and Almanea `gtin` into `_gtin`** and index them — zero Amazon benefit today, but it builds GS1 rung 1 for the day an Amazon identifier source exists and lets eXtra↔Almanea corroborate deterministically. *Evidence:* §3 (1,200/1,200 filled, unread) · *FP risk:* validate check digit; brand consistency (Köpcke) · *Generic.*
8. **Storefront row for every knowledge-layer Amazon offer** (15/53 unrefreshable). *Evidence:* §12 · *Generic (ingest invariant).*

**P2 — later**
9. Sibling-key reconciliation of the 123 split ASINs through the alias graph (ADR-058) once 4 and 2 are in (49 + 17 + 16 + 10 become evidence-backed merges; the 17 SPEC_FIELD_DIFF stay split).
10. Control-side over-split: when a Samsung colour SKU key and a spec key coexist on the same observation, treat the SKU as a *variant* attribute of the spec identity (keeps price comparison at the commercial-variant level; colour remains visible).
11. Laptop identity: no title-side rule closes it (§8). Options are a manufacturer MPN↔configuration catalogue (data acquisition, ADR-100 class) or the Creators API `ItemPartNumber` at eligibility. Until then, publish laptops as single-store honestly.
12. Null-price unavailable rows on the compare page: founder decision between options (a)/(b) in §13.
13. `/s+/g` typo: one-line hygiene with no measured impact.

---

## 17. Evidence matrix (selected; full detail in the evidence folder)

| ID | Finding | Source / query | Captured | Num / den | Label |
|---|---|---|---|---|---|
| P2-01 | Every non-Samsung `MODEL:` key comes from payload `mpn/modelNumber/model_number/model` | code: `store-identifiers.ts:33`, `tv/laptop/tablet identity.ts`, `progressive-engine.ts:288-299` | — | — | VERIFIED |
| P2-02 | eXtra UNBXD `modelNumber` 970/1,200, `barCode` 1,200/1,200 (unread); Almanea `model` 15,033/15,245, `gtin` 0 | `p2prop.cjs` extra_feed_fill, `probe.cjs` | 15:55Z | as stated | VERIFIED |
| P2-03 | amazon.sa pages: no GTIN/JSON-LD; model number only on appliances | `p2live.json` (22 pages) | 15:40–15:45Z | 5/7 vs 0/13 | VERIFIED |
| P2-04 | Stored PDP evidence: Item model number 62, model name 64, MPN 0 of 1,312 | `p2a.cjs` amz_offers_ids | 15:50Z | 112/1,312 | VERIFIED |
| P2-05 | Brand Unknown classes C 1,806 / A 1,721 / E 537 / B 27 / D 4 | `p2analysis.cjs` on `brand_unknown` | 15:50Z | 4,095 | VERIFIED |
| P2-06 | 123 split ASINs taxonomy (49/17/17/16/10/10/4) | `p2analysis.json → split_asins` | 15:50Z | 123 | VERIFIED |
| P2-07 | Mobile replay: 146 detect-rejected, 49 invalid, 91 valid of 286 | `p2replay.json`, `p2replay2.json` (in-process plugin) | 16:05Z | 286 | VERIFIED (replay) |
| P2-08 | 0/84 matched vs 107/202 unmatched Amazon phone titles contain "camera" | `p2phonecheck.cjs` | 16:00Z | 286 | VERIFIED |
| P2-09 | P3 simulation: shared phone keys 38 → 67 | `p2replay2.json` | 16:05Z | — | SIMULATED |
| P2-10 | Laptops: 3 shared now; 8 on spec tuples; 114/236 control names `invalid: ram` | `p2replay.json → laptops` | 16:05Z | 314 / 236 | VERIFIED + SIMULATED |
| P2-11 | Scenarios B/C/D/E: 280/279/284/285 shared (vs 275) | `p2sim.json` | 16:00Z | 1,312 | SIMULATED |
| P2-12 | Normalization coverage 7 d: Amazon PDP 1,419/3,493; 1,494 TPS-like unnormalized | `p2norm.cjs` | 15:58Z | as stated | VERIFIED |
| P2-13 | TV detector rejects "43 Inch FHD TV, F6000F" (needs `4k|uhd|…|led` cue) | `tv/detector.ts:54-57`, replay probe | 16:05Z | 6/6 probes | VERIFIED |
| P2-14 | Propagation causes 18/15/8/7/5/1 | `p2analysis.json → propagation` | 15:55Z | 53 | VERIFIED (1 UNKNOWN) |
| P2-15 | eXtra over-splitting: same name → spec key + colour SKU key; 16E→`16`+`16e` | `p2a.cjs` phones_ext_keys_per_name | 15:50Z | 15 names shown | VERIFIED |
| P2-16 | HONOR X7e↔X7c, X9d↔X9c over-merge in the mobile key | `p2replay2.json` shared_keys | 16:05Z | 2/40 | VERIFIED |
| P2-17 | `/s+/g` only affects availability text; all 22 live availability strings single-line | code + `p2live.json` | 15:45Z | 22 | VERIFIED (impact NOT measurable) |
| P2-18 | Creators API field set and 10-sales gate; account at 2 | official docs (partly NOT ACCESSIBLE), founder statement | 2026-10-03 | — | VERIFIED / ACCOUNT-SPECIFIC |

Contradictions resolved: (a) Phase 1 said PDP spec tables were in `products.specifications` — they are in `raw_observations.payload.specifications` only (P2-04); (b) the code-reading claim that `pdp-evidence.ts` exists under `scripts/tps-core` — the real files are `scripts/tps-plugins/ac/pdp-evidence.ts` and `model-mpn-evidence.ts`, both unwired; (c) the washer title B0FB9R7Y6S passes in replay but is unnormalized in production — runtime wins, cause UNKNOWN.

---

**Task ledger (founder's §0–§25):** §0 rules — DONE (read-only; two temporary replay files were created under `scripts/tps-analysis/` for one run each and deleted; nothing committed); §1 baseline — accepted; §2 Creators API — treated as future state only; §3 — DONE (§3–§4, §15); §4 research — DONE (§1; several primary pages NOT ACCESSIBLE from this network, listed); §5 — DONE (22 live pages; §2); §6 — DONE (§3); §7 — DONE (§5); §8 — DONE (§6); §9 — DONE (§7, replay); §10 — DONE (§8); §11 — DONE (§9); §12 — DONE (§10, A–F; F = 0/UNKNOWN); §13 — DONE with a reviewer-1 pass, founder review sample proposed (§11); §14 — DONE (§12; 1 UNKNOWN); §15 — DONE (§13); §16 — DONE (§13); §17 — DONE (§13); §18 — DONE (§14); §19–§22 — this document; §23 — the success criterion is adopted as the yardstick (§1 rules, §16); §24 — labels applied throughout; §25 — STOPPED. NOT DONE: ground-truth precision/recall (no labelled set exists; reviewer-1 labels are mine and are marked as such); the production cause of the one UNKNOWN washer title.
