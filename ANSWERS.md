**⚠ UNGUARDED SAVINGS ARE LIVE TO USERS NOW.** All four served surfaces — search results (`خصم X%`), deals page (`-{discountPct}٪`), comparison card ("save X" + PiggyBank), and product detail page (`original_price` / was-price) — display a discount %, "was" price, or savings figure, and **none is gated by Discount Integrity**. `getCanonicalDiscountIntegrity` (ADR-091) is wired only into `/api/v1/agent/decide` (+ `dashboard`/`price-truth`), never into any customer-facing rendered surface (grep of served components/pages = zero references).

---

# ANSWERS — #1 decisive URL test & #2 live exposure

> Written to a file (not terminal only) per instruction. Labels: **[MEASURED today 2026-07-28]** / **[INFERRED]** / **[ASSUMPTION]**.

## #1 — Decisive URL test **[MEASURED via headless Chrome / Puppeteer — the repo's verified Extra path]**

WebFetch cannot read Extra (JS-gated), so I rendered each **exact stored `product_url`** with the production `ExtraScraper.updateProductPrice` → `scrapeProductPage`, which reads the PDP's JSON-LD `offers.price` (Extra's own canonical structured price).

| Product | Exact stored URL | PDP live price (JSON-LD `offers.price`) | PDP `original` | Our scraped |
|---|---|---|---|---|
| LG 9kg (white, SKU 100138655) | `https://www.extra.com/en-sa/large-appliances-/washing-machines/front-load/lg-9kg-front-load-fully-automatic-washer-with-ai-dd-white/p/100138655` | **1290** | 4299 | 1290 |
| Toshiba 15kg (SKU 100228053) | `https://www.extra.com/en-sa/large-appliances-/washing-machines/topload/toshiba-topload-automatic-washer-with-pump-15-kg-sdd-inverter-motor-white-black/p/100228053` | **1170** | 3899 | 1170 |

**Result: PDP = 1290 / 1170 = our scraped prices, exactly.** By your stated rule ("1,290 / 1,170 → our prices are right, fault is identity merging"):

### → THE PARSER IS NOT WRONG. THE FAULT IS IDENTITY MERGING (+ STOCK). **[MEASURED + INFERRED]**

**[MEASURED]** Extra's own PDP for these exact SKUs genuinely serves 1290 / 1170 (with was 4299/3899, ~70% off). The parser read the right number for the right URL.
**[INFERRED]** The 2,599 / 3,079 you saw are **different listings**: (a) LG — you viewed the **black** variant (2599, was 4599, 43.48%); our stored SKU is the **white** variant, and Unbxd flags it `inStockFlag=false` (out of stock) → a distinct, likely clearance/dead white listing. (b) Toshiba — you viewed the **متجر الغانم marketplace** offer (3079, "1 left"); our stored SKU is the **Extra-first-party** listing (`isMarketPlaceItem=false`), also out-of-stock in Unbxd. In both cases we compared / merged **non-equivalent listings** (different colour variant, or first-party vs 3rd-party seller) **and ingested out-of-stock offers**.

### Correction to EXTRA_PARSER_FIX.md (honesty) **[MEASURED]**
EXTRA_PARSER_FIX §3 leaned toward "the Unbxd search price is a phantom decoupled from the PDP." **That was over-concluded and is now corrected:** the PDP JSON-LD independently returns the same 1290/1170, so the price is **real for the exact URL** — the defect is **identity/variant/seller merging + ingesting out-of-stock listings**, exactly your hypothesis, not a parser field error. (Two Extra surfaces — Unbxd search and PDP JSON-LD — agree on 1290; Unbxd additionally flags out-of-stock.)

### Honesty caveat **[ASSUMPTION]**
I read the PDP's JSON-LD `offers.price` (the canonical structured price), not the pixel-rendered price element. Two independent Extra surfaces agree on 1290, so confidence is high; but I did not separately confirm the *visible* rendered price equals the JSON-LD. If Extra's visible price ever diverged from its own JSON-LD, that would be a further Extra inconsistency to check — but it does not change the verdict that our stored SKU is a different, out-of-stock listing from the one you viewed.

## #2 — Live exposure (plain, one paragraph) **[MEASURED]**

Right now, on the served surfaces, **every one displays a savings/discount figure and all are unguarded**: search results return `خصم X%` in the decision card (`buildReasonAr`, `route.ts:370-372`) plus `is_deal`; the deals page renders `-{discountPct}٪` (`deals/page.tsx:125-126`); the comparison card renders a "save X" savings pill (`comparison-card.tsx:42,94-96`); and the product detail page feeds `original_price`/"was" to its price component (`product-detail-client.tsx:897`). None of these calls `getCanonicalDiscountIntegrity` — Discount Integrity (ADR-091) gates only the advisor `/api/v1/agent/decide` route (and `dashboard`/`price-truth`), and a grep of every served component and page returns **zero** Discount-Integrity references. So a "was"/discount figure from any `aggressive_claims` store (Extra = 100% inflated per ADR-051; 4,531 `inflated_reference` facts exist per ADR-091) can be published to users with no evidence check. Current *magnitude* is bounded because the deals page is ~100% Amazon (ADR-124) and Amazon is a no-claims/honest store (ADR-051), and the cross-store "وفّر" from the 428/220 is not served (TPS knowledge layer isolated, ADR-125) — but the **mechanism is ungated on all four surfaces**, which is a standing risk the moment an Extra/aggressive-claims "was" price reaches any of them.

---

**Next per your instruction:** a gating PLAN (not code) — see `GATING_PLAN.md` (scope, per-request cost, rollback, acceptance, draft ADR-129). No gating code will be written until you approve the plan.
