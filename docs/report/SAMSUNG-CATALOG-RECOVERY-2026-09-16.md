# Samsung Saudi catalog recovery — 16 September 2026

## Executive state

**Production worker completion recorded; final evidence checks are listed below.** This extends the narrower [ADR-372 runtime audit](SAMSUNG-COVERAGE-AUDIT-2026-09-16.md), under ADR-373. Samsung alone is the ingestion/repair scope. Amazon/Noon files and all three protected check directories were left outside this work.

**CLOSED under the owner’s final close-out directive.** Final category-search code is deployed and verified. The same seven saved queries and one previously frozen shared-watch journey passed; no source/category expansion or extra worker cycle was needed. Automatic push approval was resolved by the owner’s close-out directive. Full row snapshots remain in the local-only evidence branch; code, ADR/report and aggregate results are published.

The independently verified consumer universe is **1,284 full Saudi manufacturer variants**, not 423 legacy rows or a count of URLs. At 2026-09-16T13:22:42.804Z, all **1284** have an exact active canonical, serving projection and valid current Samsung observation; **590** have a positive price and affirmative purchase availability. “Valid observation” does not mean “available to buy.”

## FACT — independently enumerated source universe

Samsung Saudi consumer category pages expose the public product-finder endpoint. Its totalRecord counts families; modelList/modelCount describe separately sold variants. The implementation walks all declared pages in both sa_en and sa, checks family/model completeness, and rejects repeated or incomplete responses. The two locale sets differ.

- Bilingual finder: **1,277** distinct complete manufacturer codes.
- Eight current Saudi sitemaps: **37** additional PDP-confirmed models.
- Independently revalidated known PDP: **one** currently purchasable earphone, EO-IC100BBEGWW, absent from both finder and sitemap.
- Combined candidates: **1,315**; exclusions: **31**; included: **1,284**; unresolved source identities: **0**.
- Exclusions: 19 multi-product bundles, four replacement assemblies, one decorative collaboration item, two business Flip accessories and five HVAC installation panels.
- **2,697** exact-model URLs map to the included models: **1,413 additional aliases**, with no URL assigned to two included models. The broader sitemap traversal has 4,016 URLs including navigation; it is not a product denominator.

Policy v1 had 1,291 included models. Seven additional commercial components were subsequently excluded on official Saudi evidence. That is an explicit scope correction, not negative or positive recovery growth; the earlier capture is preserved. Independently sold functional accessories remain included, including color variants where a distinct official commercial SKU exists. Consumer filters, stacking kits and evidenced room-AC controllers are retained; enterprise installation panels and spare assemblies are not treated as ordinary consumer alternatives.

Frozen included-source completeness: **1,284 names and full model codes**, **1,260 images**, **611 positive current prices**, **348 explicit reference prices**, **347 positive-price discounts**, and **589 affirmative purchasable offers**. One explicit zero promotion is preserved as zero, never replaced with its SAR24 reference price. The 1,277 finder models expose no nonempty GTIN/EAN/UPC field in the examined responses. Missing identifiers are not invented; unknown stock is not asserted as either purchasable or confirmed out of stock.

The microwave source type includes four actual cookers/ranges and three microwaves. Categories below follow physical PDP evidence. No standalone projector or Saudi laptop was confirmed in the examined bilingual finder, eight sitemaps and consumer navigation; these are bounded Saudi-source findings, not claims about Samsung globally or retailer imports. “iPad” is an Apple brand; Galaxy Tabs are counted as tablets.

Reproduce with enumerate-samsung-catalog.cjs, reconcile-samsung-source.ts and close-samsung-denominator.ts. Preserve the dated raw finder/sitemap inputs when producing a new capture. [Source reconciliation](../evidence/samsung-recovery-source-reconciliation-2026-09-16.json) · [category enumeration](../evidence/samsung-recovery-source-category-counts-2026-09-16.json).

## FACT — before / after on the same source cohort

### Separate pipeline stages

| Stage | Before this mission | Final measured state | Definition / evidence boundary |
|---|---|---|---|
| SOURCE UNIVERSE | No independent complete denominator established | 1,284 included variants | Dated Saudi public-source union; not URL count |
| INGESTED | 600 | 1,284 | Full manufacturer-SKU Samsung raw observations in the same frozen cohort |
| CANONICAL | 236 | 1,284 | Exact full-model identities, not generic or legacy links |
| SEARCHABLE | 236 indexed identities; population-wide API retrieval not measured | 1,284 indexed identities; 590 current purchasable offers reconciled to API evidence | Projection readiness and actual retrieval are separate: frozen 593-offer census plus every subsequent price/eligibility delta |
| COMPARISON-ELIGIBLE | No comparable exhaustive baseline captured | 590 Samsung purchasable offers | Current eligible offers backed by normalized evidence and exits; not a claim of multiple retailers for every identity |
| CURRENTLY SELLABLE | No same-cohort baseline with the final strict stock definition | 590 | Positive current price plus affirmative stock; unavailable identities remain in the catalog |

Unknown baseline fields are not replaced with zero or the incompatible 423 legacy count. Source completeness and sellability use different denominators; no aggregate sellability uplift is inferred.

The initial legacy database count was **423 products and 423 product_stores rows**, of which **282** were canonical-linked. That count was real, but was not a catalog-completeness denominator. The TPS audit measured 413 current rows and the later recovery baseline 414; that one-row pre-repair difference was not attributed to this work.

The table measures full-SKU Samsung raw evidence and exact manufacturer canonicals separately. Before raw uses immutable timestamps before the recovery application; before canonical/projection uses the saved pre-realization snapshot. A canonical can pre-exist through another merchant even when Samsung has no prior full-SKU raw evidence. These are different stages, not contradictory totals.

| Category | Source models | Samsung raw before → after | Exact canonical before → after | Projection after | Purchasable Samsung after |
|---|---:|---:|---:|---:|---:|
| Phones | 254 | 91 → 254 | 0 → 254 | 254 | 158 |
| Tablets | 127 | 86 → 127 | 96 → 127 | 127 | 46 |
| Watches | 25 | 19 → 25 | 0 → 25 | 25 | 16 |
| Audio | 38 | 36 → 38 | 0 → 38 | 38 | 10 |
| Rings | 33 | 33 → 33 | 0 → 33 | 33 | 5 |
| Functional accessories | 404 | 0 → 404 | 4 → 404 | 404 | 240 |
| Pens | 20 | 20 → 20 | 0 → 20 | 20 | 14 |
| Trackers | 3 | 3 → 3 | 0 → 3 | 3 | 1 |
| Televisions | 120 | 107 → 120 | 117 → 120 | 120 | 44 |
| Refrigerators | 25 | 21 → 25 | 0 → 25 | 25 | 8 |
| Dishwashers | 7 | 5 → 7 | 3 → 7 | 7 | 1 |
| Microwaves | 3 | 3 → 3 | 1 → 3 | 3 | 2 |
| Cookers / ranges | 4 | 4 → 4 | 4 → 4 | 4 | 3 |
| Washers / dryers | 33 | 30 → 33 | 0 → 33 | 33 | 12 |
| Air conditioners | 49 | 39 → 49 | 0 → 49 | 49 | 9 |
| Vacuums | 2 | 2 → 2 | 2 → 2 | 2 | 0 |
| Monitors | 136 | 101 → 136 | 9 → 136 | 136 | 21 |
| Cooker hoods | 1 | 0 → 1 | 0 → 1 | 1 | 0 |
| **Total** | **1284** | **600 → 1284** | **236 → 1284** | **1284** | **590** |

Full-SKU raw representation is **46.73% → 100%** of this verified 1,284-model cohort. This is not a claim of complete discovery of every conceivable Saudi product or full purchasability. Current legacy rows remain **423**, linked **406**, active **229**; new source variants are served through TPS rather than inflated legacy row counts.

**Attribution:** 684 cohort models have their first full-SKU raw observation after recovery began. Of these, **671** carry the newly implemented samsung_public_finder provenance. The remaining **13** were first observed through PDP paths in the recovery window; timestamps alone do not establish exclusive attribution over ordinary concurrent scraping. The exact-canonical increase is **1,048 identities**, not 1,048 newly discovered physical products. Changes in priced, purchasable or multi-store counts during ordinary refreshes are not reported as causal coverage uplift. The before multi-store instrument lacked normalized stock metadata, so no before/after multi-store-growth percentage is asserted.

[Aggregate stage and category measurements](../evidence/samsung-recovery-measurement-summary-2026-09-16.json) · [attribution evidence](../evidence/samsung-recovery-attribution-2026-09-16.json).

## FIX — causes, decisions and alternatives

1. **Discovery architecture.** The old bounded English sitemap path and accessory filter did not enumerate PLP variants or Arabic-only rows. eXtra uses paginated UNBXD and Almanea structured Algolia feeds; their ingestion was inspected read-only. Samsung now combines full bilingual finder refresh, sitemap delta and known PDP-only refresh. Existing legacy URLs are refresh seeds, not proof of availability.
2. **Identity.** Frozen generic normalization left 574 finder codes without a valid identity and produced 107 keys shared by different complete codes. Officially corroborated full manufacturer codes now retain suffix/color/capacity distinctions. Eighty-five conflicting generic model claims were released with pre-write snapshots. Other merchants may join only through a declared complete MPN in the independently verified registry; title fragments, image filenames and global suffix stripping were rejected.
3. **Variant exit.** Family marketing pages can lose the selected SKU. Live source probes verified server-side modelCode on the official buying tool for distinct Fold variants. Exact exit checks now retain that selector. This was not a reason to broadly relax arbitrary URL parameters or affiliate rules.
4. **Price and availability.** Finder promotionPrice is the current public price when present; price is the reference price. An exact-SKU public card-detail response outranks demonstrably stale PDP analytics/JSON-LD on the dynamic price bar. Stock remains independent. Superseded generic offer history cannot reappear as a current offer; unavailable product identity remains available to the catalog without a purchasable Samsung offer.
5. **Search.** First-page-only canonical reads silently omitted later accessories; the measured pool had 4,495 accessory canonicals. Stable pagination now precedes relevance filtering. Late legacy enrichment had overwritten 12 exact keys and left 19 duplicate result identities in a 593-offer census; verified keys and complete declared MPN evidence are preserved, with deduplication before pagination. Manufacturer-confirmed category terms support short official names; non-phone categories additionally require agreement with the recorded normalization parser. Washer/dryer and earphone/speaker subtypes remain distinct. Three real Top Mount Freezer Refrigerator titles collided with the accessory word mount; only the appliance-layout phrase is removed from accessory scanning. Watch9/Watch8 lacked a word boundary and two verified watches had code-only titles. Numbered watch tokens and verified category evidence repair eligibility while cover/compatibility exclusions remain. Arabic category nouns use the same character folding as queries. The statistical cheap-price heuristic no longer overrules an independently verified device category: the official SAR48 wired earphone is not a false accessory simply because premium earbuds set a higher median. Real accessory hints and unknown cheap rows remain excluded. Ranking weights and affiliate logic are unchanged.
6. **Comparison realization.** An existing 1.5× price-distance heuristic removed the official SAR499 Buds3 FE offer beside a verified SAR299 Almanea offer for the exact same Saudi SKU. The heuristic remains for unverified/mixed groups; an independently corroborated complete manufacturer code shared by every offer is stronger identity evidence. Accessory and temporal price-transition guards still apply. Three missing Samsung normalized observations were replayed. Separately, the first layer pass overwrote current state before the second pass checked whether price changed. Both passes now compare with the same pre-sweep state. Recovery appended **48 real price events: 26 founding events and 22 missed updates**, preserving original observation times. Post-repair cohort inspection found **zero missing Samsung normalized evidence and zero missing priced history**.
7. **Old and excluded serving rows.** Twenty-three existing out-of-scope offer/identity pairs were retired after confirming no shared merchant offer, preserving raw/history. One orphaned generic legacy soundbar identity was retired from serving only after a fresh official redirect to the audio category and proof of no current offer or other-merchant evidence. The worker rechecks the two old legacy URLs; final active-state verification is recorded after its completion.
8. **Runtime.** Retained source packaging, direct Node/tsx loading, TCP keepalive, lease heartbeats and async child execution address measured runtime failures. A real Railway spawn failed with EAGAIN before starting a child; bounded due-checked retries and authenticated cgroup evidence were added. Failed/deferred starts are never marked successful. Full discovery, delta, price-stock refresh, normalization, projection and storefront synchronization have separately recorded completion/health fields.
9. **Scope boundary.** Automatic approval review rejected an operator request for a global projection rebuild. The implemented alternative restricts source reads, writes and pruning to full Samsung manufacturer identities with store-6 evidence, and rejects unrelated output before writes. Its applied run wrote **1,284 rows**, pruned **0**, skipped **0**, and took **10.2 seconds**. The normal global entry point retains its existing behavior; the Samsung worker invokes the scoped mode.

## FACT — cross-merchant verification

The frozen eXtra/Almanea snapshot contained **485 Samsung-branded offers**. Accepting the exact Arabic manufacturer name alongside Samsung increased full-MPN registry matches to **303**; **182** remain unmatched to the verified current source. This does not establish that all 182 are missing Samsung products. Official probes for selected retailer-only models reached support/legacy surfaces rather than current Saudi commerce. Retailer inventory is not automatically a current Samsung-direct catalog obligation.

Six frozen shared cases span three eXtra and three Almanea categories. The completed supplemental browser run has **10/12 Samsung offers in comparison**, **10/12 exact merchant destinations**, and two source-unavailable controls. In actual unequal-price cases eXtra led the SAR1199 vs SAR1299 watch, and Almanea led SAR775 vs SAR949 phone / SAR2399 vs SAR2549 tablet comparisons. Ties and existing affiliate handling were not modified to promote Samsung.

## RESULT — prices, search, rendered journeys and exits

- The original ORDER BY random() ten-row cohort was frozen, not reselected. Latest completed price check: **5 positive current-price matches**, **10/10 reference-price states correct**, **10/10 exact stock labels**, **10/10 search purchase states correct**, and **0 errors**. Five source offers are purchasable and five have no current purchase price; this is **5/5 priced matches plus 5 suppressed offers**, not ten price matches. The earlier in_stock versus limited_stock difference is preserved in the pre-worker capture; the latest check was repeated after the actual scheduled refresh.
- Targeted washer WD12TP34DSX/YL: cached HTML said SAR4099; the rendered official page and exact public card-detail endpoint said **SAR3999**, matching Tawveeri. The explicit reference price was SAR7149. The screenshot and selected commerce response are retained; tracking requests are not part of evidence.
- Frozen **593-offer search census:** 593 HTTP200, 593 Samsung present, 593 single exact cards, 593 prices matching the frozen production snapshot, zero errors. This tests retrieval and internal price consistency, not 593 independent current merchant-page price validations.
- **Comparison census:** 593/593 have one Samsung offer; 593/593 match the frozen current price; 593/593 have an observation-backed exit; 593/593 preserve ascending price order. The initial overly fast audit received 106 HTTP429 responses; it was stopped, preserved, and resumed below the service's 30/minute bucket with Retry-After handling. Limits were not changed and throttled reads were not labeled catalog losses.
- **Rendered main cohort:** 21 tested, 19 Samsung present, 19 in comparison at matching search prices, 19 exact merchant variants confirmed, 0 errors. The other two are unavailable controls. With the supplemental cohort: **29 available journeys across 33 frozen cases**, with four unavailable controls.
- Actual Arabic “جوال سامسونج” reached 63 Samsung results in the first 100, 12 in the first 20 after the manufacturer-category fix. Samsung chargers qualified in the full result set but did not lead the first 20 cheaper offers; no ranking boost was added.
- Merchant destinations were resolved through the exact normalized-observation UUID and independently opened read-only. The audit did not generate affiliate/outbound click events. UI Smart Pick plus the same grid product is not counted as a duplicate result identity.
- After the actual scheduled refresh, purchasable offers changed from 593 to 590. The complete price/eligibility delta contains **9 changed models**; all changes plus the two old redirect controls passed **11/11** live search/comparison checks. This is a source refresh outcome, not attributed coverage growth. The two old legacy products are now inactive; the two previously inactive soundbars are correctly unavailable after fresh source stock verification.
- Final category-query and deployed frontend measurements: [release evidence](../evidence/samsung-recovery-final-release-2026-09-16.json), SHA **e9a2eb628bdf5e3b9d36d35aff64e4d5f28822ab**, Railway deployment **1f1c7983-be73-4051-a5d6-0be7afe2f574**. The earlier frozen exact API census remains separately timestamped.

Final paired production queries, Samsung result counts: washing machine **0 → 10**, refrigerator **3 → 8**, Arabic earphones **0 → 10**, watch **4 → 16**, tablet **0 → 46**, Arabic refrigerator **3 → 8**, dryer **4 → 4**. Every saved query returned HTTP200. Samsung model identities, active projection, current price and stock were unchanged across the paired snapshots, separating search repair from ingestion growth. One existing frozen shared Watch8 journey passed rendered search, comparison price equality, neutral ordering and exact official destination. The worker implementation is byte-unchanged from the completed scheduled run; no additional six-hour cycle was manufactured for closure.

## RESULT — gates and deployment

Latest full gate: **3,840 tests / 260 suites passed**. Directly measured coverage before and after: **89.36% statements, 67.6% branches, 100% functions, 97.33% lines**. The global 70% branch threshold still fails. Release proceeded under the owner's explicit unchanged-coverage exception; no threshold or test was weakened. This coverage configuration measures its configured utils/product-filter scope, not every repository file.

Next.js compilation/prerender completed. The package's Linux cp post-step is unavailable on Windows; equivalent Node filesystem copies completed standalone assets. Railway's Linux build is verified separately. Existing repository TypeScript drift is not presented as a clean typecheck. Earlier demand-radar clock-boundary failures were rerun unchanged; their isolated and subsequent full runs passed. Jest reported a worker-teardown warning also present in earlier gate logs; the 3,840 assertions passed. Raising the pre-existing global coverage baseline to 70% is a separate follow-up, not implemented or conflated with catalog recovery.

Full browser regression: 83/111 before, 88/110 candidate; paired identical query/locale/subject rows contain **zero newly failing baseline successes**. Exact-model accuracy was 32/32 and full exact-model journeys 28/32. This is not an all-green global regression or a causal aggregate uplift: timing, live data and measurement instrumentation differ. Additional real laptop and LG-TV checks passed **4/4** full journeys and **4/4** comparisons, including eXtra/Amazon destinations; shared Samsung checks cover eXtra/Almanea. No other merchant ingestion was modified.

Verified recovery runtime SHA: **407ea79a2291e70bd2ed28c9613fc2e19a6e1198**. The deployment ledger and authenticated monitor retain the actual Railway deployment ID and boot timestamp; subsequent documentation-only commits must not be confused with a different verified worker implementation.

**Completed inside Railway.** Run `d214346b-f3cd-4d86-bea0-40dba23a188f`: 2026-09-16T12:21:47.261+00:00 → 2026-09-16T12:33:43.372031+00:00; scheduler success 2026-09-16T12:33:44.885868+00:00. This is distinct from the earlier operator-run realization.

The separate operator run 65adbf83-e761-4b33-91ac-30abcb5598b1 completed **10:03:42 → 10:26:10 UTC**, realizing the original policy-v1 cohort. It is production-data evidence, not scheduled execution proof. The first operator attempt lost its PostgreSQL session before ingestion; its failed status was repaired explicitly. The first Railway spawn failed with EAGAIN. Both failures remain documented rather than overwritten with later success.

## Operational design and rollback

Every Samsung run refreshes the full bilingual finder and known PDP-only products, computes sitemap delta/aliases, normalizes store6 under the existing writer lane, rebuilds the Samsung projection, and synchronizes only Samsung legacy/index IDs. A shared legacy product ID causes an explicit refusal. Successful schedule state is updated only after worker exit0. Pressure, boot cooldown, serialization and failure retries remain active. Monitor last completed full/delta/price-stock timestamps, source counts, PDP failures, missing model/availability, exact canonical/current-offer/NPO/price-event/projection gaps and category drift. A valid product without a payable offer is not a failed identity.

The principal application journal completed at **09:44:27 UTC**: 85 model claims released, 685 raw observations replayed, 460 canonical writes (not new-product count), 671 normalized writes, 241 timestamp-preserving price events and 315/315 superseded current offers retired. Later commerce, scope and legacy-ghost repairs have separate pre-write journals.

Rollback is a reviewed serving-state restoration, not deletion of observed facts. Revert to the reviewed prior code; restore the scope-retirement and legacy-ghost snapshots where applicable; run rollback-samsung-recovery.ts against samsung-recovery-realization-apply-1789551289270.json in its default dry mode, then append --apply only for an actual rollback. Restore prior derived canonical/current-offer/NPO/match/legacy/index state and deactivate introduced cohort canonicals. The final dry rehearsal includes **1,055 introduced canonical IDs**, including the seven policy-v1 identities excluded by policy v2; a consumer-policy exclusion must not accidentally leave an introduced identity active after rollback. It plans restoration of **503 prior canonicals, 710 current-offer rows and 423 legacy offers**. No rollback was actually applied. Retain immutable raw observations and price history. Rebuild the affected Samsung serving projection with the corresponding code. Do not blindly rerun the old full application after new source cycles.

## Remaining limits and evidence publication

- Saudi source completeness is bounded by the enumerated public surfaces and dated snapshots. Source availability, prices and SKU assortments continue to change.
- Missing GTINs, unconfirmed Saudi laptops/projectors and unavailable offers are source facts/limitations, not fabricated coverage or purchasability.
- The raw/canonical/offer census is exhaustive for the frozen cohort; rendered browser/merchant-page verification is representative, not a claim to have visually opened all 1,284 products.
- Scheduled completion is recorded above; consult the final snapshot for any actual remaining health gap.
- This GitHub repository is public. Automatic approval review rejected publishing full production and rollback row snapshots. Code-only deployments proceeded; complete evidence is retained locally pending the owner’s publication decision. Earlier accepted dry/source artifacts were already published, so this is not a claim that all historical evidence remained private. Aggregate measurements can be reviewed separately from full journals.

### Evidence map

- [Stage/category summary](../evidence/samsung-recovery-measurement-summary-2026-09-16.json)
- [Release status: live runtime versus local follow-up](../evidence/samsung-recovery-release-status-2026-09-16.json)
- [Final deployed release and bounded close-out](../evidence/samsung-recovery-final-release-2026-09-16.json)
- [Final database snapshot](../evidence/samsung-recovery-production-closeout-2026-09-16.json)
- [Actual Railway monitor](../evidence/samsung-recovery-railway-runtime-monitor-2026-09-16.json)
- [Search census](../evidence/samsung-recovery-purchasable-search-final-2026-09-16.json)
- [Comparison census](../evidence/samsung-recovery-comparison-census-final-2026-09-16.json)
- [Rendered main journeys](../evidence/samsung-recovery-journeys-commerce-repaired-final-2026-09-16.json)
- [Rendered supplemental journeys](../evidence/samsung-recovery-journeys-supplemental-commerce-final-2026-09-16.json)
- [Frozen random price check](../evidence/samsung-recovery-live-prices-2026-09-16.json)
- [Post-repair comparison evidence](../evidence/samsung-recovery-comparison-loss-after-2026-09-16.json)
- [Validation gates](../evidence/samsung-recovery-validation-gates-2026-09-16.json)

Generated from dated evidence at 2026-09-16T13:24:53.459Z.
