# ALMANEA_VERIFY — live verification of Almanea (المنيع) pricing

## ملخّص تنفيذي (عربي)

- فُحصت 5 صفحات منتجات حيّة للمنيع (WebFetch يعمل على النطاق) وقورنت بأسعارنا المسحوبة.
- **النتيجة: 5/5 مطابقة تمامًا — فرق صفر ريال في كل الحالات.** السعر الحيّ النقدي = سعرنا المسحوب بالضبط.
- كلها **مباعة من المنيع مباشرة** (لا بائع طرف-ثالث)، **متوفرة في المخزون**، وبلا خصم عضوية مطروح من السعر.
- **الخلاصة: المنيع مصدر موثوق** — يقرأ السعر النقدي الحقيقي الذي يراه العميل. الخلل السعري خاص بإكسترا وحده.
- تطابق إكسترا-المنيع الذي لاحظه المؤسس سببه أن المنيع = السعر الحقيقي (≈ سعر إكسترا الحقيقي)، بينما سحب إكسترا وهمي.

> Labels: **[MEASURED today 2026-07-28]** via live WebFetch on `m.dev-almanea.com` (the customer-facing surface) vs our scraped `price_history`. Not circular — the source (Almanea PDP) is independent of our scraper.

---

## Results — 5/5 exact match, delta 0 **[MEASURED]**

| # | Product | Live cash (SAR) | Our scraped (SAR) | Δ | Live "was" / disc. | 3rd-party seller? | Membership deducted? | Stock | Model |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Toshiba top-load 15kg | **3,079** | 3,079 | **0** | 4,739 / 35% | No — Al-Manea direct | No (Tabby offered, not deducted) | In stock | AW-DUHN1600LUPBB(SG) |
| 2 | LG Split AC 18000 H/C | **2,449** | 2,449 | **0** | 4,489 / 45% | No | No | In stock | LK182H0.NK0/UK0 (HEAT+COOL) |
| 3 | Gree AI PLUS Split 18000 | **2,629** | 2,629 | **0** | 3,795 / 31% | No | No (Tabby offered) | In stock | GWC18AVDXE-S6DTA1B |
| 4 | Samsung single-door fridge | **3,549** | 3,549 | **0** | 6,349 / 44% | No | No | In stock | RR39M71407FH |
| 5 | LG Split AC 18000 cool-only | **3,919** | 3,919 | **0** | 4,899 / 20% | No | No (Tabby offered) | In stock | NF182C2.NK1/UK1 |

## Findings **[MEASURED]**

1. **Price accuracy: perfect.** All 5 live cash prices equal our scraped prices exactly (Δ = 0 SAR). Almanea's scraper reads the real customer-facing cash price.
2. **No third-party sellers** in the sample — all Al-Manea-fulfilled. (Contrast: Extra runs a marketplace and mislabels sellers — see EXTRA_PARSER_FIX §4.)
3. **No membership price captured as effective price** — Tabby instalment options are shown but the cash price we scraped is the standard cash price, not a members-only figure. Membership-deduction rule respected.
4. **Stock:** all in stock. (Contrast: Extra ingests out-of-stock Unbxd records as in-stock.)
5. **`cooling_mode` corroboration:** #2 confirms the AC-identity fault — Almanea LK182H0 is **HEAT+COOL**, and it was merged with Extra "Cold" units (see AC_IDENTITY_ADR_DRAFT). Almanea's data is right; the merge is wrong.

## Conclusion **[MEASURED + INFERRED]**

**[MEASURED]** Almanea is a **trustworthy price source** (5/5 exact, real cash price, first-party, in-stock).
**[INFERRED]** The "Extra price == Almanea price exactly" pattern the founder observed is explained: **Almanea = the true market price (≈ Extra's real price), while our Extra scrape is the phantom.** There is no saving because both retailers genuinely sell near the same price; the Extra parser invented the gap. **The fault is isolated to Extra; no Almanea remediation is required.**

**Caveat [ASSUMPTION]:** 5 products (all appliances) is a small sample. Almanea is verified for these; a wider electronics sample would harden the conclusion, but every signal here is clean.

> Diagnosis only. No changes made.
