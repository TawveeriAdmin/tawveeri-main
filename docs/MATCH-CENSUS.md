# Single-Store Match Census — how many "single-store" products have an unconfirmed twin?

**Status:** read-only analysis. No writes, no threshold changes, no merges, no plugin-file edits. Feature freeze respected — this doc is the only change.
**Date:** 2026-08-23. **Governs identity:** ADR-001 (three-layer TPS model; identity requires ≥2-store corroboration on an exact `identity_key` match; `raw_observations` immutable; `price_history` append-only). Also drew on ADR-032/077/266/267/269 (category-specific identity design and `requireValidTier` decisions) for methodology fidelity.

## The question

Of Tawveeri's single-store products (no cross-store comparison shown today), how many are genuinely alone in the market vs. have a plausible but unconfirmed twin at another store that the identity matcher just didn't corroborate (because it's exact-key matching, not fuzzy)?

## Method

Tawveeri's matcher does not use a continuous 0–1 confidence score for corroboration — corroboration is **exact `identity_key` string equality across ≥2 distinct `store_id`s**. There is no numeric "threshold" to hold constant in the sense the word usually implies; the real threshold is binary (same key or not). So "reuse existing matcher scoring, don't change thresholds" was honored by:

1. Reading every category's `identity_key` **exactly as already computed and stored** by the production pipeline in `tps_current_offers` (the HOT current-state table, one row per `category, identity_key, store_id`) — never recomputing identity from raw text myself.
2. Including exactly the status tiers each category's own plugin already treats as corroboration-eligible in production, per `scripts/tps-core/category-registry.ts`'s `requireValidTier` flag — `valid`-only for `tv`/`mobile` (`requireValidTier: true`), `valid` + `low_confidence_candidate` for `air_conditioner`/`refrigerator`/`washing_machine`/`laptop` (`requireValidTier: false`, per ADR-077's explicit finding that AC's `low_confidence_candidate` rows are mostly legitimate). Getting this wrong the first pass **materially changed the AC numbers** (see Limitation 1 below) — worth flagging since it's exactly the kind of thing that silently corrupts a census like this.
3. Grouping by `identity_key` to get store count per product; single-store = exactly 1 distinct `store_id`.
4. For every single-store product, searching all *other* keys in the same category **sharing the same brand token** (brand mismatch is never a candidate) for a plausible twin, using a new, clearly-labelled classification layer — **not part of the production matcher, built only for this census**:
   - **MODEL-tier keys** (`brand|MODEL:xxx`, used by `tv`/`laptop` when a manufacturer part number is extractable): compare the model string via bigram similarity.
   - **Multi-field spec keys**: compare field-by-field. A field is a **MATCH** (equal), a **SOFT-GAP** (one side is a sentinel like `NO_SERIES`/`NO_TECH`/`NO_STORAGE`/`NO_SCREEN` — unstated, not conflicting), or a **CONFLICT** (both sides state a real, different value).
   - **A** = all non-brand fields MATCH or SOFT-GAP, at most one SOFT-GAP, zero CONFLICT — near-identical, blocked only by one missing attribute.
   - **B** = exactly one CONFLICT, or ≥2 SOFT-GAPs with no CONFLICT — plausible, weaker.
   - **C** = no same-brand candidate at all, or every candidate has ≥2 CONFLICTs.

Scratch scripts and raw JSON output live outside the repo at `%TEMP%\claude\...\scratchpad\match-census\` — not committed, per the read-only/doc-only instruction.

## Results by category

| Category | Total products | Single-store | Multi-store (today) | A (near-miss) | B (weak) | C (no candidate) |
|---|---|---|---|---|---|---|
| tv | 574 | 460 | 114 (19.9%) | 89 (19.3%) | 145 (31.5%) | 226 (49.1%) |
| air_conditioner | 675 | 573 | 102 (15.1%) | 76 (13.3%) | 192 (33.5%) | 305 (53.2%) |
| refrigerator | 366 | 303 | 63 (17.2%) | 0 (0%) | 135 (44.6%) | 168 (55.4%) |
| washing_machine | 327 | 215 | 112 (34.3%) | 0 (0%) | 90 (41.9%) | 125 (58.1%) |
| mobile | 263 | 212 | 51 (19.4%) | 89 (42.0%) | 84 (39.6%) | 39 (18.4%) |
| laptop | 552 | 514 | 38 (6.9%) | 33 (6.4%) | 232 (45.1%) | 249 (48.4%) |
| **Aggregate (these 6 categories)** | **2,757** | **2,277 (82.6%)** | **480 (17.4%)** | **287** | **878** | **1,112** |

**Note on the "~89%" figure:** the platform-wide single-store rate cited elsewhere covers *every* TPS category (including oven, blender, kettle, monitor, printer, smartwatch, tablet, audio, camera, coffee_maker, air_fryer — not censused here). This census's 6-category slice measures **82.6% single-store**, a bit lower than the platform-wide figure — expected, since these 6 are exactly the categories with the most identity-pipeline investment (per the ADR history), so they should already skew somewhat better than average, not worse.

**Coverage if every A were confirmed** (naive: `(current multi-store + A) / total`, does not correct for pair-merging arithmetic — see Limitation 3):

| Category | Current rate | If all A confirmed |
|---|---|---|
| tv | 19.9% | **35.4%** |
| air_conditioner | 15.1% | **26.4%** |
| refrigerator | 17.2% | 17.2% (no A found — see Limitation 2) |
| washing_machine | 34.3% | 34.3% (no A found — see Limitation 2) |
| mobile | 19.4% | **53.2%** |
| laptop | 6.9% | **12.9%** (treat cautiously — Limitation 4) |
| **Aggregate** | **17.4%** | **27.8%** |

## Limitations — read before acting on the numbers above

1. **The AC/laptop status-tier bug I caught mid-analysis.** My first pass filtered every category to `status='valid'` only. That's correct for `tv`/`mobile`, but AC's own production pipeline (ADR-077) deliberately corroborates on `low_confidence_candidate` too — 783 of AC's 812 rows (96%) carry that status. The first pass measured AC on 14 total products; the corrected pass (matching what production actually treats as comparable) measures 675. Laptop had a smaller version of the same bug (382 → 552 products, `low_confidence_candidate` is also production-eligible there per `requireValidTier:false`). Fixed before finalizing this report, but it's a reminder that this dataset is sensitive to matching the real pipeline's own inclusion rule exactly, category by category.
2. **Refrigerator and washing_machine structurally cannot produce an "A" under this method.** Their identity keys (`brand|type|capacity|tech`, `brand|type|kg|dryer`) never use a sentinel/unknown token — every field is always a stated value once the key exists at all. So there is no SOFT-GAP mechanism for these two categories: a near-candidate is either an exact match (already corroborated, not single-store) or has a real CONFLICT on capacity/type/tech (classified B, one real spec difference). **A=0 for these two categories is a byproduct of the key design, not evidence they're more "genuinely single-store" than TV or AC.** Some of their 135/90 "B" pairs are likely capacity values that differ only by rounding or listing-description imprecision (e.g. 350L vs a nearby size) and would reward a numeric-tolerance pass — deliberately not attempted here since that would mean inventing a new threshold, which was out of scope.
3. **The "if A confirmed" coverage numbers are a simplified upper bound, not exact arithmetic.** Confirming a same-store-count pair (two currently single-store products turning out to be the same item) removes 2 products and adds 1 comparable one — the total product count actually *shrinks*. Confirming a single-store product as a twin of an *already* multi-store product just adds a store to that canonical. I did not attempt to net this out per category; the "if A confirmed" figures assume each A adds one new comparable slot without removing the count it displaced. Directionally correct, not decimal-precise.
4. **Laptop's "A" pairs are the lowest-trust in this report and deserve extra scrutiny before any human review.** Laptop's fallback identity key (`brand|family|cpu|ram|storage|screen|gpu`) uses a deliberately *coarse* `family` token — e.g. `thinkpad`, not `ThinkPad X1 Carbon Gen 9` — and a generation-stripped CPU tier (`i7`, not `i7-1165G7`). Spot-checking the laptop A-pairs surfaced clear false positives: a **ThinkPad X12 Detachable 2-in-1** paired against a **ThinkPad X1 Carbon Gen 9** — genuinely different laptops that happen to share brand+coarse-family+CPU-tier+RAM+storage, differing only in screen size (one title omits it, satisfying the "≤1 soft-gap" rule for A). Same pattern hit a ThinkPad E16 vs E14 Gen 7 pair and a ThinkPad E14 vs T14 Gen 2 pair. **All laptop A-pairs are excluded from the example table below for this reason** — they are still counted in the aggregate stats above (33 for laptop) so the number isn't hidden, but they should not be the first thing a human reviewer sees, and probably shouldn't be trusted at the same rate as TV/AC/mobile A's without a stricter model-line check first.
5. **The TV MODEL-string-similarity examples with the largest price gaps are themselves suspect — read the price gap as a warning sign, not a feature.** Samsung/LG model numbers encode the year/revision in what is often a single trailing letter (`...UXSA` vs `...FUXSA`-style suffixes). A gap of 130–203% (examples #1–#3 below) is *not* typical of the same real product at two Saudi retailers — normal cross-retailer spread in this dataset's genuinely-corroborated AC/mobile examples runs 14–79%. The likely explanation for #1–#3 is a genuinely different model year mis-flagged as a spelling variant by bigram similarity, not two stores pricing the same TV wildly differently. **Recommend a human reviewer treat any TV pair with >100% price gap as probably-different unless a second signal (identical listing photo, identical panel spec) confirms it** — this report deliberately did not add a price-band filter to "clean up" the results, since that would be changing matching logic beyond the read-only brief; flagging it here instead.

## 20 example A-pairs (first human-review batch)

Selected to spread across categories, deliberately favoring the more trustworthy AC/mobile soft-gap pairs alongside the TV MODEL-similarity ones (see Limitation 5 on the largest TV gaps). All 8 stores shown are on Tawveeri's approved/displayable retailer list — these are real comparison opportunities if confirmed, not phantom stores.

### TV (MODEL-tier, string-similarity based — check price gap against Limitation 5)

| # | Store A — product — price | Store B — product — price | Gap | Held apart by |
|---|---|---|---|---|
| 1 | أمازون — Samsung 85" Neo QLED QN900C 8K, Mini LED, Tizen (2023 KSA) — 34,847 SAR | اكسترا — Samsung 85" NEO QLED 8K AI Upscaling, 165Hz, Glare Free — 11,500 SAR | 23,347 SAR (203%) | `MODEL:QA85QN900CUXSA` vs `MODEL:QA85QN900FUXSA` (85% similar) |
| 2 | اكسترا — Samsung 85", 4K Micro RGB, 165Hz — 29,999 SAR | المنيع — Samsung 85" 4K UHD Smart RGB LED TV, Tizen, WiFi – MRA85R85HAUXSA — 12,699 SAR | 17,300 SAR (136%) | `MODEL:MRA85R95HAUXSA` vs `MODEL:MRA85R85HAUXSA` (88% similar) |
| 3 | اكسترا — Samsung 75", 4K Micro RGB, 165Hz — 22,999 SAR | المنيع — Samsung 75" 4K UHD Smart RGB LED TV, Tizen, WiFi – MRA75R85HAUXSA — 9,999 SAR | 13,000 SAR (130%) | `MODEL:MRA75R95HAUXSA` vs `MODEL:MRA75R85HAUXSA` (85% similar) |
| 4 | اكسترا — Samsung 85" NEO QLED 8K AI Upscaling 240Hz, Glare Free — 27,699 SAR | نون — 75" NEO QLED 8K, 8K AI Upscaling, 240Hz, Mini-LED QA75QN990FUXSA — 19,199 SAR | 8,500 SAR (44%) | `MODEL:QA85QN990FUXSA` vs `MODEL:QA75QN990FUXSA` (85% similar) |
| 5 | اكسترا — Samsung 83", 4K Smart TV, OLED 165Hz — 19,999 SAR | المنيع — Samsung Smart TV 83" 4K OLED, Tizen OS - QA83S85HAEXSA — 12,999 SAR | 7,000 SAR (54%) | `MODEL:QA83S95HAEXSA` vs `MODEL:QA83S85HAEXSA` (83% similar) |
| 6 | اكسترا — Samsung 75" NEO QLED 8K AI Upscaling, 165Hz, Glare Free — 12,999 SAR | نون — 75" NEO QLED 8K, 240Hz, Mini-LED QA75QN990FUXSA — 19,199 SAR | 6,200 SAR (48%) | `MODEL:QA75QN900FUXSA` vs `MODEL:QA75QN990FUXSA` (92% similar) |
| 7 | نون — 85" 4K UHD Smart TV UA85CU8000UXSA Titan Grey — 9,999 SAR | اكسترا — Samsung UHD 4K TV, 85", Dynamic Crystal Color, 120Hz — 4,399 SAR | 5,600 SAR (127%) | `MODEL:UA85CU8000UXSA` vs `MODEL:UA85DU8000UXSA` (83% similar) |
| 8 | اكسترا — Samsung 85" 4K Smart TV, NeoQLED, 144Hz — 11,499 SAR | المنيع — Samsung Smart TV 65" 4K Neo QLED, Tizen OS - QA65QN80HAUXSA — 5,999 SAR | 5,500 SAR (92%) | `MODEL:QA85QN80HAUXSA` vs `MODEL:QA65QN80HAUXSA` (85% similar) — **note: this pair also differs in screen size (85" vs 65") despite high string similarity; likely a false positive, kept in the list as an example of the technique's failure mode** |

### Air conditioner (spec-key, soft-gap based — the most trustworthy tier in this report)

| # | Store A — product — price | Store B — product — price | Gap | Held apart by |
|---|---|---|---|---|
| 9 | المنيع — Samsung Split AC, 20,500 BTU, Hot/Cold, Inverter — 3,649 SAR | اكسترا — Samsung WindFree Smart Split AC, 20,500 BTU Hot/Cold — 2,040 SAR | 1,609 SAR (79%) | series: `NO_SERIES` vs `WindFree` |
| 10 | اكسترا — AUX Split AC, 22,000 BTU, Hot & Cold, Inverter, WiFi — 3,799 SAR | نجم الأجهزة — اوكس هايبر كول مكيف سبليت 22000 حار وبارد WiFi انفيرتر — 2,443 SAR | 1,356 SAR (56%) | technology: `Inverter` vs `NO_TECH` |
| 11 | المنيع — LG Split AC Green 17,500 BTU Cold, NV182C1 — 3,600 SAR | شاكر — LG Green Inverter Split AC 17,500 BTU – Inverter Cool — 2,323 SAR | 1,277 SAR (55%) | technology: `NO_TECH` vs `Inverter` |
| 12 | نجم الأجهزة — ال جي فريش مكيف سبليت 18000 وحدة انفيرتر بريش مزدوجة — 3,446 SAR | متجر النخيل — مكيف ال جي سبليت جت كول وطني واي فاي 18000 وحدة — 2,199 SAR | 1,247 SAR (57%) | series: `FreshDV` vs `NO_SERIES` |
| 13 | اكسترا — Samsung WindFree Smart Split AC, Cool Only, 20,000 BTU — 4,599 SAR | المنيع — Samsung Split AC, 20,000 BTU Cold, AR24DVFZAWK/MG — 3,549 SAR | 1,050 SAR (30%) | series: `WindFree` vs `NO_SERIES` |
| 14 | متجر النخيل — مكيف ال جي مكيف دولابي اسلامي 46000 وحدة حار بارد — 6,999 SAR | اكسترا — LG Freestanding AC, Deluxe, Smart Inverter, 46,000 BTU — 8,000 SAR | 1,001 SAR (14%) | technology: `NO_TECH` vs `Inverter` |
| 15 | اكسترا — LG Split AC 18,000 BTU, AirFit, Dual Inverter, Cool Only — 3,499 SAR | متجر النخيل — مكيف ال جي سبليت 18000 وحدة سمارت انفرتر بارد فقط — 2,599 SAR | 900 SAR (35%) | series: `AirFit` vs `NO_SERIES` |
| 16 | اكسترا — LG Split AC 21,500 BTU, Cool, Fresh DV, Dual Inverter — 3,699 SAR | متجر النخيل — مكيف ال جي سبليت جداري 21500 وحدة بارد فقط انفيرتر — 2,899 SAR | 800 SAR (28%) | series: `FreshDV` vs `NO_SERIES` |

### Mobile (spec-key, storage soft-gap — renewed/refurb listings routinely omit storage)

| # | Store A — product — price | Store B — product — price | Gap | Held apart by |
|---|---|---|---|---|
| 17 | اكسترا — Apple iPhone 17 Pro Max, 5G, 6.9", 2TB, Cosmic Orange — 8,699 SAR | جرير — Apple iPhone 17 Pro Max (storage not stated) — 5,699 SAR | 3,000 SAR (53%) | storage: `2048` vs `NO_STORAGE` |
| 18 | جرير — Renewed Grade B Apple iPhone Air (storage not stated) — 4,099 SAR | المنيع — ابل ايفون اير، 1 تيرابايت، أزرق سماوي — 6,699 SAR | 2,600 SAR (63%) | storage: `NO_STORAGE` vs `1024` |
| 19 | جرير — Renewed Grade B Samsung Galaxy S26 Ultra (storage not stated) — 3,999 SAR | المنيع — سامسونج جالاكسي S26 ألترا، 512 جيجا، 12 جيجا رام — 6,299 SAR | 2,300 SAR (58%) | storage: `NO_STORAGE` vs `512` |
| 20 | اكسترا — Samsung Galaxy S26 Ultra, 5G, 1TB, Pink Gold — 6,299 SAR | جرير — Renewed Grade B Samsung Galaxy S26 Ultra (storage not stated) — 3,999 SAR | 2,300 SAR (58%) | storage: `1024` vs `NO_STORAGE` |

## Scale estimate

At ~30 seconds per human yes/no/unsure decision:

| Scope | A-pairs | Time |
|---|---|---|
| tv + air_conditioner + refrigerator (the requested first-batch subset) | 89 + 76 + 0 = **165** | 82.5 min ≈ **1.4 hours** |
| All 6 categories | **287** | 143.5 min ≈ **2.4 hours** |
| — of which: tv | 89 | 44.5 min |
| — of which: air_conditioner | 76 | 38.0 min |
| — of which: mobile | 89 | 44.5 min |
| — of which: laptop (low-trust, Limitation 4 — review last, separately) | 33 | 16.5 min |

For context only (not the primary ask): clearing the larger, weaker **B** queue (878 pairs, one real spec conflict each) would take ~7.3 hours — a lower-priority pool, useful mainly if the founder wants to sanity-check whether the A/B split itself is well-calibrated.

## Minimal human-review surface (spec only — not built)

**No existing admin UI does anything like this today** — `src/app/[locale]/admin/products/`, `/stores/`, `/coupons/`, `/growth/`, and the rest of the admin route tree were checked; none touch `identity_key`, `canonical_products`, or a pairwise offer comparison. A review surface would need to be built from scratch, but it's small: one screen showing a queue of A-pairs (title/store/price/photo if available, side by side, one pair at a time or a short list), three buttons — **نفس المنتج** (same product) / **مختلف** (different) / **غير متأكد** (not sure) — and a decision recorded in a new, lightweight table (e.g. `tps_match_review_decisions(category, key_a, key_b, decision, reviewer, decided_at)`), kept separate from any live merge action so a human "yes" doesn't itself trigger a write to `canonical_products` — a confirmed decision would feed a future promotion step using the same pattern already established by `write-model-canonicals.ts`/`write-alias-canonicals.ts` (backup → dry-run → collision-aware promote), not a new merge mechanism. That table is also where the matcher could later learn from — e.g. auditing which SOFT-GAP fields most often turn out to be real matches vs. real misses (the AC `series`/`technology` gaps in this report look far more reliable than the laptop `family`-token gaps) to prioritize future review batches or refine field-level trust, without ever auto-merging on its own.
