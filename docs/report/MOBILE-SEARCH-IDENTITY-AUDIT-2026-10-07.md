# Mobile Search × Identity × Catalog closure — 2026-10-07

## Executive result

SUCCESS: الإصلاح منشور ومتحقق منه على الإنتاج في نطاق الأدلة أدناه. هذه خلاصة الإغلاق وتستبدل حالة التدقيق الأولية؛ النسخة التاريخية محفوظة في [initial-audit-report.md](../evidence/mobile-audit-2026-10-07/initial-audit-report.md).

## What changed

- البحث العربي والإنجليزي يفصل الموديل والجيل وPlus/Pro/Ultra والسعة، ويمنع الإكسسوارات وتلوث العلامة والدمج عبر هوية وسيطة مجهولة. تحليل السعة يتجاوز RAM إلى storage الفعلي، والبحث بالميزانية للعلامة المجردة يثبت نية الجوال.
- البحث والمقارنة وبطاقات فئة الجوالات وواجهة TPS تعيد التحقق من العروض الحالية المؤهلة: سعر موجب، توفر صريح، رصد خلال 168 ساعة، بلا عزل أو supersession. بيانات الفهرس والتاريخ لا تعيد عرضًا معزولًا إلى أفضل سعر.
- condition مصدرها عنوان عرض التاجر/الدليل الخاص به عبر resolver القائم، وليست اسم canonical أو تخمين NEW. مجموعات NEW وUNKNOWN وRENEWED وREFURBISHED وUSED منفصلة؛ العنوان يعرض الحالة، والمقارنة تستبعد اختلاف الحالة من أفضل سعر.
- حواجز ASIN في Amazon PDP والمسار الاحتياطي والـ normalizer؛ /go يمنع العروض الخمسة المتعارضة قبل تسجيل النقر. Ranking لا يفضل عمولة أو علاقة تجارية، وأزيل affiliate tie ordering من مقارنة الجوالات.
- رسالة عربية واضحة عند عدم وجود عرض موثوق للموديل. لا استبدال بإكسسوارات.

| Finding | Before evidence / root cause | Change + regression test | After / production evidence |
| --- | --- | --- | --- |
| Wrong Amazon ASIN | asin-conflicts.json; selected SKU differs from URL ASIN | 5-row quarantine; scraper/normalizer/go guards; amazon-product-price, phone-current-offers, phone-identity-exit tests | asin-quarantine-verify.json; 5 production exits return 410; correct 256GB returns 302 |
| New/renewed/unknown mixing | initial audit and comparison snapshots; canonical grouping did not isolate merchant condition | phone-condition pools and product-grouper isolation; phone-condition tests | golden-production.json condition fields; 9 comparison checks |
| Search model/accessory contamination | golden-before.json; broad fallback and weak model/brand parsing | exact intent and group compatibility; phone-model-intent, merge-same-listing-cards, amazon-brand-detection tests | 24 production golden queries |
| S26 film and brand-budget appliance results | golden-local-first-pass.json; film term absent and bare-brand budget ambiguous | film detector, anchored phone-budget intent; regression tests | golden-local.json and golden-production.json |
| Quarantined offer revived by merging | golden-local-before-merge-quarantine.json; legacy/fuzzy data merged after earlier gate | authoritative post-merge current-offer gate; five-conflict pool tests | production golden plus comparison and go checks |
| Unknown stock treated as eligible | availability-source-evidence.json; legacy comparison eligibility admitted unknown | strict explicit availability; null-availability condition regression | closure-verification-production.json |
| RAM interpreted as capacity | source title with RAM before storage; first-token capacity parser | skip RAM tokens; phone-model-intent tests | local and production model set |
| Zero-result explanation absent | old exact-zero responses lacked explicit trusted-offer wording | search-client no-trusted-offer copy | browser-production.json and zero-ux-production.png |

Validation: 349 suites / 4620 tests passed; build passed; targeted ESLint passed. TypeScript measured separately: 812 before / 812 after, zero regressions. Coverage unchanged: statements 89.36%, branches 67.6%, functions 100%, lines 97.33%. Existing branch threshold 70% was not lowered; the AGENTS.md owner exception of 2026-09-16 applies. Coverage command exits 1 for that existing shortfall; its collection scope is only utils.ts and product-filter.ts, not whole-system coverage.

## Data corrections

Exactly five current-offer rows were changed to invalid with an identity-quarantine marker. observed_at, prices, raw observations, canonicals, normalized observations and relationships were not rewritten. No merge, deletion, migration, broad refresh or backfill ran. [Export and apply evidence](../evidence/mobile-audit-2026-10-07/asin-quarantine-apply.json), [integrity checks](../evidence/mobile-audit-2026-10-07/data-integrity.json), [rollback](../evidence/mobile-audit-2026-10-07/ROLLBACK.md).

| Identity / storage | Raw observation | URL ASIN | Stored SKU ASIN | Source title | Observation UTC | Correction |
| --- | --- | --- | --- | --- | --- | --- |
| apple\|iPhone\|18\|Pro\|1024 | 3206948 | B0HJ9ZYZQR | B0HJB3HBM8 | Apple iPhone 18 Pro 1 TB: – Black | 2026-10-02T20:11:48.169+00:00 | Amazon: quarantined; historical records retained |
| apple\|iPhone\|12\|Standard\|128 | 3294480 | B0DLBDMG2Q | B0CQ2NFQ5Q | Apple (Refurbished) iPhone 12 (128GB) - Black | 2026-10-05T13:36:19.491+00:00 | Amazon: quarantined; historical records retained |
| apple\|iPhone\|11\|Standard\|128 | 3294523 | B0CQ2RM6TX | B0CQ2LYYWV | Apple (Refurbished) iPhone 11 (128GB) - Black | 2026-10-05T13:40:39.46+00:00 | Amazon: quarantined; historical records retained |
| apple\|iPhone\|12\|Standard\|64 | 3215464 | B0DLBDMG2Q | B0CQ2Q2QDB | Apple (Refurbished) iPhone 12 (64GB) - Purple | 2026-10-03T02:14:02.289+00:00 | Amazon: quarantined; historical records retained |
| apple\|iPhone\|12\|Mini\|128 | 2686947 | B08X1RMTR3 | B0CQ2S4G3C | Apple (Refurbished) iPhone 12 mini (128GB) - Black | 2026-09-15T20:08:37.032+00:00 | Amazon: quarantined; historical records retained |

Exact URL-ASIN/SKU/title/capacity/observation evidence is retained per case in asin-quarantine-before.json and asin-conflicts.json. iPhone 18 Pro 1TB retains valid Almanea; its wrong Amazon link is blocked. Correct iPhone 18 Pro 256GB retains Amazon/Almanea offers. No selected-ASIN replacement URL was guessed. Condition changes are read-time classifications, not fabricated writes to raw source data.

S26 Ultra 512GB with/without ram=12: **C — evidence insufficient, no merge**. Extra lists 12GB; Amazon evidence includes KSA/Care bundle; Jarir includes renewed grades; only one side has a retired manufacturer-code observation. There is no common verified manufacturer/region/condition proof across both identities. See closure-freshness-fragmentation.json.

## Before vs After

[Same 24-query tables](../evidence/mobile-audit-2026-10-07/golden-before-after.md) show result count, Top 1 identity, condition, price, eligible store count and actual observation time before/local/production. Full Top 3 and all returned offers are in the corresponding JSON. Before results included wrong tiers/accessories and unclassified condition. Production passes 24/24. Do not compare the old oracle's PASS total to the stricter final oracle; evidence criteria were expanded for quarantine and condition.

iPhone 16 Pro now has a naturally observed Jarir RENEWED offer (2026-10-07T07:11:54.626Z). iPhone 17e also acquired a valid Jarir offer at SAR 3299, observed 2026-10-07T11:57:00.153Z and present in the final current-state read. These are genuine intervening source observations, not invented refreshes caused by this task. The original predeploy snapshot is retained; production responses were re-evaluated offline against the final snapshot without replacing their HTTP evidence.

Representative Rakhys benchmark: 8 queries, 4 brands × Arabic/English, not a census. Rakhys shows broader Pixel/merchant coverage and region/bundle labels. Tawveeri's tested exact-tier isolation, Arabic relevance and explicit trustworthy-zero behavior are stronger in this sample. Rakhys freshness/stock and true duplicate SKUs were not independently established. [Detailed comparison and source URLs](../evidence/mobile-audit-2026-10-07/closure-benchmark.md).

## Production verification

- tawveeri-main: 6c9af582-0bae-44a3-8a06-107636b552b7, SUCCESS.
- tawveeri-worker: de2fbe24-9b7e-4446-b3ce-e6f17407ff5e, SUCCESS.
- Source: isolated archive of 869529fb8f6a36ef12a42f66ee5901192c8f23a8 with 30 scoped source/test overlays; SHA256 manifest retained. No unrelated dirty files or local environment files included.
- Golden set: 24/24 on https://tawveeri.com after deployment.
- Comparison: 9/9; /go: 6/6. Five bad exits 410; correct Amazon 256GB exit 302 to B0HJ9ZYZQR.
- Exit checks use HEAD, bot User-Agent and test cookie, with redirect following disabled. No merchant purchase flow or affiliate attribution change.
- Mobile-browser exact-zero message captured on production: [screenshot](../evidence/mobile-audit-2026-10-07/zero-ux-production.png).
- Additional health, TPS API and phone-category page checks: 3/3; category condition labels visible and quarantined Amazon offer absent from the sampled TPS response.
- [Machine-readable verification](../evidence/mobile-audit-2026-10-07/verification.json) and release/deployment/rollback artifacts preserve the evidence chain. No flags or refresh schedules changed.

## Remaining gaps

Pixel 9/10/11 have no current canonical/offer evidence in the sampled mobile catalogue. Redmi Note 14 5G has stale-only evidence. Galaxy S24 has fresh observations but no eligible current offer; unknown/out-of-stock is not converted to available. S26 Ultra RAM fragmentation remains deliberately unmerged pending manufacturer/region/condition proof. Many merchant titles leave condition UNKNOWN; it is labelled accordingly.

FinOps context: broad refresh and observation_sync are disabled; the parallel audit reports reobserve SQL timeouts. This does not prove an individual merchant/source is unavailable. No manual timestamps, availability inference or heavy refresh was used to hide the gap. The Extra sample of 44 fresh phone rows illustrates why generic available=true is insufficient: an inspected S25 raw row had inStockFlag=false and 97/97 city entries out of stock.

| Focus model | Canonical rows | Commercial variant census | Fresh offer rows | Explicitly available fresh | Preliminary eligible offer rows | Store IDs | Evidence classification |
| --- | ---: | --- | ---: | ---: | ---: | --- | --- |
| iPhone 18 Pro | 5 | Not independently established | 7 | 6 | 6 | 5, 2 | Fresh explicit merchant evidence |
| iPhone 17e | 3 | Not independently established | 1 | 1 | 1 | 1 | Fresh explicit merchant evidence |
| iPhone 16 Pro | 5 | Not independently established | 1 | 1 | 1 | 1 | Fresh explicit merchant evidence |
| Galaxy S26 | 15 | Not independently established | 22 | 12 | 12 | 6, 5 | Fresh explicit merchant evidence |
| Galaxy S26 Plus | 15 | Not independently established | 26 | 14 | 14 | 6, 5 | Fresh explicit merchant evidence |
| Galaxy S26 Ultra | 22 | Not independently established | 37 | 19 | 19 | 4, 5, 6 | Fresh explicit merchant evidence |
| Galaxy S25 | 14 | Not independently established | 18 | 4 | 4 | 6 | Fresh explicit merchant evidence |
| Galaxy S24 | 9 | Not independently established | 8 | 0 | 0 |  | Fresh observations without an available eligible offer |
| Galaxy S24 Ultra | 3 | Not independently established | 1 | 1 | 1 | 1 | Fresh explicit merchant evidence |
| Galaxy A56 | 4 | Not independently established | 4 | 1 | 1 | 2 | Fresh explicit merchant evidence |
| Pixel 9 family | 0 | Not independently established | 0 | 0 | 0 |  | No phone canonical/current merchant offer |
| Pixel 10 family | 0 | Not independently established | 0 | 0 | 0 |  | No phone canonical/current merchant offer |
| Pixel 11 family | 0 | Not independently established | 0 | 0 | 0 |  | No phone canonical/current merchant offer |
| Redmi Note 14 base 5G | 2 | Not independently established | 0 | 0 | 0 |  | Stale data; provider has not produced a fresh offer in the observed table |
| Redmi Note 15 base | 4 | Not independently established | 3 | 2 | 2 | 2, 5 | Fresh explicit merchant evidence |

Canonical rows count persisted identities, not commercial variants or products available to buy. Offer rows are current identity/store observations; store counts are distinct eligible merchants within a condition pool. Commercial variant counts remain unestablished where manufacturer/region/condition proof is missing. Category/raw-listing totals are not used as quality KPIs. Snapshot time: 2026-10-07T12:32:55.144Z.

## Metrics

| Metric | Numerator / denominator | Definition |
| --- | --- | --- |
| golden | 24/24 | Measured sample |
| exactModelSuccess | 14/14 | exact queries with independently observed eligible current offers |
| honestZero | 6/6 | Measured sample |
| accessoryFalsePositives | 0/24 | queries with returned accessory false positives |
| modelFamilyMismatches | 0/20 | exact queries |
| conditionMismatches | 0/149 | returned card appearances across all queries, not unique products |
| staleOnlyModels | 1/15 | Measured sample |
| freshEligibleModelCoverage | 10/15 | 15 focus model definitions; observed current-offer evidence, not market census |

Metrics describe this bounded evidence sample. Exact-model success excludes models without an eligible observed offer; honest-zero is reported separately. Fresh eligible coverage is a current-data measure over 15 focus definitions, not all market devices. No additional merchants were introduced to inflate counts.

SUCCESS
