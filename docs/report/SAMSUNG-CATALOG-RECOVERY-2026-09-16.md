# Samsung Saudi catalog recovery — 2026-09-16

## Release state

**Candidate implementation; expanded recovery not yet deployed.** This report extends the earlier [ADR-372 runtime audit](SAMSUNG-COVERAGE-AUDIT-2026-09-16.md). Production counts below are a before-state, not claimed recovery. Deployment, data realization and live journeys must be appended before completion.

## FACT — independent source denominator

Samsung's consumer PLP HTML declares a public `searchapi.samsung.com/v6/front/b2c/product/finder/global` endpoint. Its `totalRecord` counts **families**, while `modelList` contains separately purchasable manufacturer variants. Enumeration follows actual pagination bounds, verifies every family's `modelCount`, and rejects repeated/incomplete pages. Both `sa_en` and `sa` are required: their model sets differ.

The frozen independent enumeration contains **1,277 distinct complete manufacturer codes**. Eight fresh Saudi sitemap documents add **37 distinct PDP-confirmed models** absent from the finder. A separate known-PDP cross-check adds **one** currently purchasable earphone, EO-IC100BBEGWW (SAR 48), absent from both current enumerations. The explicit scope policy excludes **24 finder models**: 19 multi-product bundles, four replacement assemblies, and one decorative collaboration item. Result: **1,291 included identified models**, **611 with a positive observed price**, **589 with affirmative stock/purchase evidence and a positive payable price**, and **1,260 with an image**. A model with no current direct-purchase offer remains product evidence; it is not an available offer.

Evidence: [source reconciliation](../evidence/samsung-recovery-source-reconciliation-2026-09-16.json), [eight sitemap captures](../evidence/samsung-recovery-sitemaps-2026-09-16.json), [category counts](../evidence/samsung-recovery-source-category-counts-2026-09-16.json). Reproduce with `enumerate-samsung-catalog.cjs`, then `reconcile-samsung-source.ts`; preserve the raw enumeration input when capturing a new dated snapshot.

| Physical category | Models | Positive price | Purchasable |
|---|---:|---:|---:|
| Phones | 254 | 159 | 158 |
| Tablets | 127 | 47 | 46 |
| Watches | 25 | 16 | 16 |
| Audio | 38 | 15 | 10 |
| Rings | 33 | 5 | 5 |
| Functional accessories | 411 | 249 | 240 |
| Pens | 20 | 14 | 14 |
| Trackers | 3 | 1 | 1 |
| Televisions | 120 | 46 | 43 |
| Refrigerators | 25 | 8 | 8 |
| Dishwashers | 7 | 1 | 1 |
| Microwaves | 3 | 2 | 2 |
| Cookers/ranges | 4 | 3 | 3 |
| Washers/dryers | 33 | 13 | 12 |
| Air conditioners | 49 | 11 | 9 |
| Vacuums | 2 | 0 | 0 |
| Monitors | 136 | 21 | 21 |
| Cooker hoods | 1 | 0 | 0 |
| **Total** | **1,291** | **611** | **589** |

The source's microwave finder type includes four actual ranges: reporting its seven returned models as seven microwaves would be a category error. The physical-category table uses the verified PDP category. Projector navigation exists but the two-locale finder returns zero standalone projectors; current sitemap product matches are projector accessories. No Saudi laptop/Book/notebook product path was found in either locale's homepage navigation or these eight sitemaps. These are bounded source observations, not claims about Samsung's global catalog or imported retailer stock. “iPad” is Apple's brand; Samsung tablets are counted as tablets.

## FACT — before-state and failure mechanisms

- [Read-only database snapshot](../evidence/samsung-recovery-baseline-2026-09-16.json): 423 legacy Samsung products; 282 linked to a canonical. The recovery snapshot has 414 current-offer rows; the earlier audit had 413 at a different time. The extra row predates this local candidate and is **not** attributed to recovery.
- Existing generic identity rules left 574 of the frozen 1,277 source codes without a valid identity, and produced 107 keys shared by multiple full manufacturer codes. [Frozen identity audit](../evidence/samsung-recovery-identity-dry-2026-09-16.json). Shared codes are a collision signal, not automatically 107 proven physical mismerges.
- 85 existing canonical rows claim a complete source model under a different generic identity. Their claims conflict with insertion of the independently evidenced exact variant. [Canonical snapshot](../evidence/samsung-recovery-canonicals-before-2026-09-16.json).
- Family PDP URLs can redirect to marketing pages and lose the selected variant. Samsung's buying tool accepts `?modelCode=FULL_SKU` server-side: independently verified with two distinct Fold variants. [Deeplink evidence](../evidence/samsung-recovery-variant-deeplink-2026-09-16.json).
- Finder `price` is the reference/list price when `promotionPrice` exists. `whereToBuy` is the Saudi commerce CTA even when its optional text is absent. Stock must independently confirm availability. Unknown availability must not silently become in-stock.
- Exact-model queries previously depended on a category guess. Current-state search price winners could lose their outbound observation UUID, and stale priced history could outlive a fresh unavailable observation.

## FIX — candidate decisions

1. Refresh all finder models on every Samsung worker run, plus both-locale sitemap discovery and known PDP-only products. Preserve full manufacturer codes, region suffixes, exact variant URLs and source timestamps. Keep URL aliases separate from physical products.
2. Use `samsung|MODEL:FULL_CODE` only when the official Saudi URL or verified buying-tool selector corroborates that exact code. Distinct color/capacity/size codes do not collapse to a generic specification key. Add manufacturer-evidence-only accessory/projector/hood categories; generic title detection cannot enter them.
3. Join another merchant only on its **declared complete model/MPN**, independently present in the verified manufacturer registry. No image-filename matching, suffix stripping, fuzzy title matching, or merchant ingestion changes. Read-only eXtra/Almanea observations are captured separately.
4. Preserve public current/list prices separately, including halalas; never treat aggregate `highPrice`, installments, trade-in values or conditional coupons as a universal original/current price. Preserve current availability through normalization, projection, search and comparison.
5. Reconcile derived identities through the normal atomic writer, retaining original observation timestamps and immutable raw/price history. Release only proven conflicting generic model claims. Retire superseded current offers explicitly so historical prices do not reappear under the old identity. Snapshot every affected derived layer before applying.
6. Search exact full manufacturer codes directly, retain the latest matching normalized observation ID for exits, and recognize Galaxy Watch/Buds/Ring category language. Ranking and affiliate logic are unchanged.
7. Resolve retained source runtime for reobservation, serialize Samsung realization with the scheduler and normalizer lane, and record real source/realization completion metrics. A scheduled tick or an unresolved canonical is not a successful realization.

## RESULT — gates measured so far

- Final coverage run: **3,799 tests / 253 suites passed**. Statements **89.36%**, branches **67.6%**, functions **100%**, lines **97.33%**: identical to the directly recorded [before gate](../evidence/samsung-validation-gates-2026-09-16.json). Coverage exits nonzero solely for the pre-existing branch threshold. Owner authorization permits release without additional approval when the change does not worsen coverage; thresholds remain unchanged. Coverage configuration measures only `utils.ts` and `product-filter.ts`, not the entire repository.
- An earlier full test run passed 3,791 tests and failed one demand-radar clock-boundary test outside Samsung. Isolated rerun passed, followed by the all-pass coverage run above. No unrelated test was weakened.
- Next.js compiled/prerendered the candidate. The package build's Linux `cp` post-step failed on Windows; equivalent Node filesystem copies completed the standalone assets. The built app starts locally with scheduler and demand-radar writers disabled. Existing Edge/runtime warnings and repository TypeScript schema drift are not represented as a clean typecheck.
- Frozen category journey cohort: [21 actual models](../evidence/samsung-recovery-journey-cohort-2026-09-16.json), including explicit source-unavailable controls. Candidate browser regression completed **88/110** successful journeys versus **83/111** before; paired identical queries/subjects have **zero newly failing baseline successes**. The missing baseline row was already failing. Exact-model accuracy is **32/32**, full exact-model journeys **28/32**. This is not an all-green regression, and aggregate improvement is not attributed to this change because execution environment/time and Samsung recognition instrumentation differ. [Paired evidence](../evidence/samsung-recovery-regression-diff-2026-09-16.json). Production journeys remain pending.

The final source count includes the independently verified orphan earphone after the zero-promotion correction below: +1 model, +1 positive price, +1 purchasable offer, +1 image. This separate source addition explains why the final 611/589 matches the earlier uncorrected totals numerically; the underlying cohort differs.

## Remaining work before completion

Complete regression, review the reversible data-recovery journal, commit/deploy and verify Railway SHA, apply the exact-evidence reconciliation under the production writer lane, observe completed full/delta/price-stock runs, and measure the fixed source cohort through database/search/comparison/rendered UI/exact merchant exits. No production uplift is claimed yet.

## Cross-retailer verification before realization

The frozen current-offer snapshot contains 485 Samsung-branded rows from eXtra/Almanea. The first strict declared-MPN pass matched 199 because the new eligibility condition incorrectly accepted only the English brand. Actual Almanea payloads declare `brand=سامسونج`; accepting this exact manufacturer name alongside `Samsung` raises verified matches to **303**, with **182 not matched to the independently verified Saudi model set**. Unmatched does not prove discontinued inventory, and this sample does not enumerate the retailers' complete catalogs. Manufacturer suffixes, complete MPN proof, ranking and retailer ingestion remain unchanged. The Arabic-brand fix passed the full **3,799-test / 253-suite** coverage gate again, with the same **89.36 / 67.6 / 100 / 97.33** percentages, and Next production build completed again.

[Classification evidence](../evidence/samsung-recovery-cross-merchant-classification-2026-09-16.json) preserves every declared model and source counterpart. A further [12-case frozen cohort](../evidence/samsung-recovery-supplemental-cohort-2026-09-16.json) covers flagship/midrange phones, soundbar, washer, dryer, standalone audio, and three distinct shared categories for each retailer. Its pre-realization APIs returned HTTP 200 for 12/12, with Samsung present in 7/12. Original 21-case and random-ten-price cohorts remain unchanged.

## Measurement correction: explicit zero promotion

The first candidate count (611 priced / 589 purchasable) treated the Ring Sizing Kit promotion `0` as missing and fell back to its SAR 24 reference price. Actual PDP analytics confirm `model_price=0`, `list_price=24`. The corrected counts are 610 / 588; one explicit-zero source product stays identified without fabricating a positive payable offer. This is a measurement/parser correction, not a source-stock change or recovery uplift. Two additional apparent stock disagreements were parser precedence: exact-model `data-saleable=true` and the finder agreed; the older JSON-LD status did not. The candidate now respects the exact current saleable flag, confirmed by fresh requests in [source-disagreement evidence](../evidence/samsung-recovery-source-disagreements-2026-09-16.json).
