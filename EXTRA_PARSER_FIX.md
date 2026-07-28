> **⚠ CORRECTION (2026-07-28, see `ANSWERS.md`):** §3 below leaned toward "the Unbxd search price is a phantom decoupled from the PDP." The **decisive Puppeteer test disproved that** — the Extra PDP's own JSON-LD returns **1290/1170 = our scraped prices exactly**, so the price is REAL for the exact URL. The true fault is **identity/variant/seller merging + ingesting out-of-stock listings** (we compared a white out-of-stock clearance / a first-party listing against a different black-variant / marketplace listing), **not a parser field error**. Read §3 with that correction; the seller/stock/`original_price` findings (§4–7) stand.

# EXTRA_PARSER_FIX — Extra price-extraction fault (diagnosis only)

## ملخّص تنفيذي (عربي)

- **الأخطر وفوري:** أرقام "الخصم/وفّر" معروضة **بلا حارس** على صفحة العروض ونتائج البحث (`خصم X%`)؛ حارس نزاهة الخصم (ADR-091) موصول بمسار `decide` فقط. التعرّض محدود حاليًا (العروض ~100% أمازون) لكن الآلية غير محميّة.
- سعر إكسترا المخزّن (1290/1170) هو **سعر وهمي بخصم 69.99%** من فهرس Unbxd، والفهرس نفسه يعلّمه **خارج المخزون** (`inStockFlag=false`)، ولا يطابقه أي سطح حيّ.
- **الاختبار الحاسم غير محسوم آليًا:** صفحة إكسترا تُحمّل بالـJS؛ WebFetch لا يقرأ السعر. سجلّنا للغسالة **أبيض/خارج المخزون/بتاريخ 22-07**، والمؤسس رأى **أسود/متوفر** — فرضية "منتجان مختلفان" واردة ولا يمكن نفيها.
- **المنيع سليم 5/5 تمامًا** (السعر الحيّ = المسحوب، فرق صفر) — الخلل خاص بإكسترا وحده.
- سبق توثيق كل هذا: **ADR-051** (إكسترا 100% خصم مبالغ لكنه الأرخص 60%) و**ADR-091** (الحارس في decide فقط). أُعيد اكتشافه دون الرجوع للسجلّ — وهذا هدر.
- **الأثر:** 337/428 عائلة (79%) و~65% من "الخضراء" تشمل إكسترا → كلها باطلة حتى يُصحَّح تسعير إكسترا.

> All labels below: **[MEASURED today 2026-07-28]** / **[INFERRED]** / **[ASSUMPTION]**. Discipline: no data source was verified using itself — customer-facing claims were checked against the live customer surface (founder-manual for Extra; WebFetch for Almanea), never against Unbxd.

---

## 0. URGENT — unguarded savings live to beta users **[MEASURED]**

- Deals page `src/app/[locale]/(public)/deals/page.tsx:125-126` renders `-{d.discountPct}٪`. **No Discount-Integrity gate.**
- Served search `src/app/api/search/route.ts:370-372` (`buildReasonAr`) returns `خصم ${pct}%`; `is_deal` (442) + `dealBoost` (349) also unguarded.
- `getCanonicalDiscountIntegrity` appears only in `decide` / `dashboard` / `price-truth` / `discount-integrity` routes — **not** search/deals. Matches ADR-091 ("hot search/feed paths are unchanged").
- **Current exposure bounded:** deals are ~100% Amazon (ADR-124); Amazon is `no advertised discounts` / honest (ADR-051) → few inflated claims today. **But the mechanism is ungated**, so an Extra "was" price on search/deals would publish an unsupported saving (Extra = 100% inflated, ADR-051).
- The cross-store "وفّر" from the 428/220 is **not** served (System A isolated, ADR-125) — not live.

---

## 1. Exact field the Extra parser reads **[MEASURED]**

`src/lib/scraping/adapters/extra.ts:55`:
```
const price = pickNum(item.basicPriceValueDiscount) ?? pickNum(item.price) ?? pickNum(item.basicPrimePrice);
```
→ reads **`basicPriceValueDiscount`** from the Unbxd **AR** search index (`ss-unbxd-auk-extra-saudi-ar-prod…564`, host `search.unbxdapi.com`). `original_price` ← `item.basicPrice ?? wasPrice ?? mrp` (line 57). `availability` ← `item.available` (line 69).
Note: my earlier PRICE_INTEGRITY probe hit the **EN** index (`…en…488`, `search.unbxd.io`) — a *different* index than ingestion. That was the circular error.

## 2. Raw Unbxd dump — which field holds what **[MEASURED]**

**SKU 100138655 (LG 9kg, WHITE):**
| field | value |
|---|---|
| `basicPriceValueDiscount` (parser reads) | **1290** |
| `price` / `sellingPrice` / `priceValueDiscount` / `productBasicPrimeDiscountPrice` | 1290 |
| `basicPrimePrice` / `simplePromoBasicPrimePrice` | 1264 |
| `vipPrimePrice` (membership tier) | 1225 |
| `wasPrice` | 4299 |
| `discount` / `basicPrimepriceDiscountPercentage` | **69.99** |
| `isMarketPlaceItem` | "false" |
| `inStockFlag` | **"false"** · `inStock[]` = every city `_outOfStock` · `soldQuantity` 0 · `available` "true" |
| **any field = live 2599** | **NONE** |

**SKU 100228053 (Toshiba 15kg):** `basicPriceValueDiscount`=**1170**, `wasPrice`=3899, `discount`=**69.99**, `isMarketPlaceItem`="false", `inStockFlag`="false" (all cities out), **any field = live 3079: NONE.**

## 3. Why they diverge **[MEASURED + INFERRED]**

**[MEASURED]** No field in the Unbxd AR record equals the customer-facing price. The Unbxd record is an internally-consistent but **phantom** regime: `1290 = 4299 × (1−0.6999)`. The live PDP is a *different* regime: `2599 = 4599 × (1−0.4348)` — **different `was` (4299 vs 4599) and different discount (69.99% vs 43.48%)**.
**[INFERRED]** This is **not** "a wrong field inside a correct record" (no field yields 2599). The Unbxd **search index price is decoupled from the PDP** — likely a stale/old-campaign or non-sellable "basic" price (supported by `inStockFlag=false`). Reading *any* price field from this record is wrong. **Fix direction (not implemented): stop trusting the Unbxd search price; read the PDP JSON-LD `offers.price` (Extra's own `scrapeProductPage` already does this at `extra-scraper.ts:397`).**

### Decisive URL test (founder-requested) — **INCONCLUSIVE by WebFetch [MEASURED]**
Both exact stored URLs are JS-gated; WebFetch returns "price not in static HTML":
- LG: `https://www.extra.com/en-sa/large-appliances-/washing-machines/front-load/lg-9kg-front-load-fully-automatic-washer-with-ai-dd-white/p/100138655` → price absent (JS).
- Toshiba: `https://www.extra.com/en-sa/large-appliances-/washing-machines/topload/toshiba-topload-automatic-washer-with-pump-15-kg-sdd-inverter-motor-white-black/p/100228053` → price absent (JS).

Cannot return 1290 vs 2599 programmatically. **What is certain [MEASURED]:** our LG record = **WHITE**, scraped **1290**, `original_price` NULL, observed **2026-07-22 (6 days stale)**, Unbxd `inStockFlag=false`; founder's live = **BLACK**, 2599, in-stock. Toshiba: our record Extra-first-party `isMarketPlaceItem=false` 1170 out-of-stock; founder's live = **متجر الغانم (3rd-party marketplace)**, 3079, "1 left". **[INFERRED]** Your "two different listings" hypothesis is **plausible and not refutable** — a first-party out-of-stock phantom listing vs a live marketplace-seller listing. **In BOTH interpretations the published comparison is invalid** (either the price is a phantom, or two non-equivalent listings were merged).

## 4. Seller field **[MEASURED]** — new, unaccounted-for fault

Unbxd exposes **only** `isMarketPlaceItem` (boolean); **no seller-name field.** For SKU 100228053 it reads `"false"` (claims Extra-fulfilled), yet the live offer is sold by **متجر الغانم** (3rd-party). So `isMarketPlaceItem` is **unreliable**, and we never captured seller at all. A different seller = different warranty/delivery/stock → a marketplace offer is not interchangeable with a first-party one in a comparison. **We currently ingest all Extra offers as first-party.**

## 5. Jood membership price **[MEASURED]** — rule currently HELD

Unbxd exposes a VIP tier (`vipPrimePrice`=1225, `productVIPPrimeDiscountPrice`, `simplePromoVipPrimePrice…`) = the membership (Jood) pricing. The parser reads the **basic** tier (`basicPriceValueDiscount`), not VIP → **membership price is NOT deducted** (rule respected). Moot here since the whole basic regime is phantom, but the membership rule itself is not violated.

## 6. Stock field **[MEASURED]** — fault

Stock IS exposed: `inStockFlag` ("false"), per-city `inStock[]` (all `_outOfStock`), `soldQuantity` (0). The adapter (`extra.ts:69`) reads **`item.available` ("true")** → marks `in_stock`, ignoring `inStockFlag`. Both audited SKUs are out-of-stock in Unbxd yet were ingested as in-stock. Founder's live Toshiba = "1 piece left" — also not a valid comparison offer. **We do not capture stock level.**

## 7. wasPrice / discount / endDateDiscount **[MEASURED]**

Unbxd DOES expose `wasPrice` (4299/3899) and `discount` (69.99). The adapter captures `original_price ← basicPrice ?? wasPrice ?? mrp` → since `basicPrice` is `undefined`, it falls to `wasPrice`=4299, so the NormalizedOffer's `original_price` should be 4299. **Yet `price_history.original_price` is NULL (measured 428/428).** → **[INFERRED]** the discount context is captured by the adapter but **dropped downstream** before `price_history` (a pipeline persistence gap), OR these rows were written by a different Extra path. `endDateDiscount` is **absent** in the AR index (the EN index had it) — so our earlier "flash-expiry" reasoning was EN-index-specific and does not apply to the ingested AR data.

---

## 8. Damage sizing **[MEASURED today]**

| set | total | involve Extra | % |
|---|---|---|---|
| 428 comparable families | 428 | **337** | 79% |
| "green" families | 185† | **121** | ~65% |

†green total is classifier-sensitive: **220** in PRICE_INTEGRITY (looser colour key), **185** under this run's stricter key. Extra-involvement proportion (~65%) is stable either way.

**428-with-Extra by category:** mobile 69 · tv 61 · tablet 52 · washing_machine 47 · air_conditioner 30 · smartwatch 26 · monitor 19 · laptop 19 · refrigerator 6 · dishwasher 5 · vacuum 3.
**green-with-Extra by category:** tv 26 · mobile 24 · washing_machine 17 · laptop 17 · monitor 12 · smartwatch 8 · tablet 8 · air_conditioner 5 · vacuum 2 · dishwasher 1 · refrigerator 1.

**Conclusion:** ~79% of all comparable families and ~65% of "green" involve an Extra offer whose price is a non-live Unbxd phantom. **Publishable comparisons today = 0** until Extra pricing is corrected and re-validated against the live PDP (not Unbxd).

## 9. Prior art I should have cited first **[MEASURED — Decision Register]**

- **ADR-051 (2026-07-22):** Extra = `aggressive_claims`, **100% inflated discounts**, but **cheapest 60%** — Extra being cheapest is often REAL; the defect is the **discount claim**, not necessarily the raw price. (I re-derived this independently — waste.)
- **ADR-091 (2026-07-25):** Discount Integrity wired into `/api/v1/agent/decide` **only**; **4,531 `inflated_reference` facts** in production; search/feed paths deliberately unguarded.
- **ADR-124:** deals are ~100% Amazon; 16 of 22 stores have zero products.

## 10. Recommended fixes (diagnosis only — NOT implemented)

1. **Gate every served savings claim** (deals `discountPct`, search `خصم%`/`is_deal`) through the existing `getCanonicalDiscountIntegrity` + merchant-trust — cost is low (the data + `computeStoreTrust` already exist; ADR-091 did it for `decide` with "no new query"): suppress the % when the "was" is unverified (`inflated_reference`) or the store is `aggressive_claims`. **Highest priority — it is live now.**
2. **Extra price source:** stop trusting the Unbxd search-index price; read the PDP JSON-LD `offers.price` (already implemented in `extra-scraper.ts:397`) as canonical, or at minimum drop any Unbxd record with `inStockFlag=false`.
3. **Seller:** capture `isMarketPlaceItem`; do not treat marketplace offers as first-party (and note the flag itself is unreliable — needs PDP seller confirmation).
4. **Stock:** read `inStockFlag`/`inStock[]`, not `available`; exclude out-of-stock and "few left" from comparison offers.
5. **Persist `original_price`** end-to-end so Discount Integrity has a "was" to evaluate.

> Diagnosis only. No parser modified, no deploy, no classification change.
