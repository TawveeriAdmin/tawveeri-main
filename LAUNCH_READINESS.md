# LAUNCH_READINESS.md — measured scorecard

**Date:** 2026-07-28 · **Launch:** 2026-08-01 · **Method:** read-only production
queries (`q.ts` via pooler), the LIVE Algolia `products` index, and live calls to
`https://tawveeri.com/api/search`. No writes, no fixes — measurement only.
Every line is **[MEASURED today]** unless marked otherwise. ADRs checked: ADR-125
(layer that serves search), ADR-129 (SAVINGS_GATE / Tier-2 frozen), ADR-130.

---

## ⚠ HEADLINE FINDING — the North Star of "166" is not a real comparison

**Claimed:** 166 model-number-confirmed multi-store products on the served layer.
**Measured:** the 166 products that carry ≥2 **store-name** offers are **all Amazon
under two spellings** — `أمازون السعودية` **and** `أمازون`, both `store_id=2`, both
linking to `amazon.sa`, frequently the *same ASIN at the same price*
(e.g. `B0F9KPTKJ` @ 989 shown as "2 stores"). Grouping by **store_id** instead of
store-name gives **0** products with ≥2 stores.

> **The materialized served-layer cross-retailer comparison count is 0.**
> The "166" (150 on the live index) is a single retailer double-counted. Every one of
> those cards tells a customer "من متجرين / from 2 stores" when both are Amazon.
> This is a fabricated comparison and must be treated as a launch blocker, not a metric.

Real comparisons DO exist, but only via **runtime search grouping** (`groupSearchProducts`
merges different product_ids by fingerprint) — measured at **3 of 20** top consumer
queries (below), not from the materialized 166.

---

## 1. Stores with at least one live offer
**7 retailers** serve customers (approved stores with `current_price > 0`):

| Store | live offers | products | last_seen | freshness |
|---|--:|--:|---|---|
| Jarir (1) | 4,120 | 942 | 2026-07-28 | ✅ fresh |
| Amazon (2) | 2,011 | 1,827 | **2026-07-05** | ⚠ **23 days stale** |
| Almanea (5) | 1,298 | 1,298 | **null** | ⚠ **no last_seen recorded** |
| Extra (4) | 857 | 857 | 2026-07-28 | ✅ fresh |
| Noon (3) | 305 | 305 | 2026-07-27 | ✅ fresh |
| LuLu (23) | 186 | 186 | 2026-07-28 | ✅ fresh |
| Sharaf DG (24) | 139 | 139 | 2026-07-27 | ✅ fresh |

Samsung KSA, SWSG, BlackBox, and the mid-market Salla/Zid stores have **0** served
in-scope offers. Amazon's 23-day price staleness is a launch risk (prices may be wrong).

## 2. Total served products
- **Live Algolia `products` index (what customers search): 5,027.**
- DB: 5,825 active products carry ≥1 live approved offer (the gap is the index's
  in-scope filter + index-rebuild lag).
- Store-name facet on the live index: أمازون السعودية 1,583 · المنيع 1,230 ·
  مكتبة جرير 914 · إكسترا 671 · نون 305 · لولو 185 · **أمازون 150** · شرف دي جي 139
  (note the two Amazon buckets — the defect above).

## 3. Products visible as a 2+ store comparison (the North Star)
- **Materialized: 166 — but 100% are the Amazon two-name artifact → 0 real.** See headline.
- On the live served index: 150 with `store_count>=2` (same Amazon artifact).
- **Customer-experienced (runtime search): 3 of 20 top queries** returned a genuine
  ≥2-**retailer** card (جوال سامسونج=2, ايفون 15=3, مكيف 18000=3). A further 4/20
  showed a *false* 2-store card (Amazon dup). 13/20 were single-store.
- **Honest North Star for launch: ~3–a-few-hundred? No — it is small and mostly
  runtime-only. The safe statement is: real cross-retailer comparison is the exception,
  not the rule, and the "166" cannot be quoted.**

## 4. Verified drops rendering to users
- **926** `verified_drop` facts in `tps_listing_price_facts` (verdict distribution:
  insufficient_history 8,133 · inflated_reference 6,747 · stable 2,630 · verified_drop 926).
- **161** of them join to a live served offer (could render).
- **Rendered on `/price-truth` ONLY.** The other four surfaces are gated off
  (SAVINGS_GATE on, ADR-129; Tier 2 frozen pre-launch). So a customer sees verified
  savings only if they visit `/price-truth` — not on search/deals/comparison/product.

## 5. Outbound link validity (sample of 50 served product URLs)
- **43 / 50 → HTTP 200** (valid).
- **1 / 50 → 404 dead:** `almanea.sa/samsung-galaxy-a07-...-p-170100501025154`.
- **6 / 50 → inconclusive (000):** 5 jarir.com + 1 noon.com — bot-walled majors that
  block automated GET; the links are almost certainly valid in a browser.
- **Effective: ~86% confirmed-valid, 1 confirmed dead (2%), ~12% unverifiable-by-bot.**
- Separately observed on a live iPhone search: an Almanea result rendered a
  **`/go/null`** exit (missing `product_url`) — a broken outbound link path to fix.

## 6. The 20 most likely Saudi consumer searches — correct product?
Live `POST /api/search`, top result judged for correct-product + live-price + active-link:

**20 / 20 returned a correct, priced, linked product.** ✅
Of those, 7 showed a ≥2-store card but **only 3 were real cross-retailer comparisons**;
4 were the false Amazon-dup card.

| Query | Top result | stores | real retailers |
|---|---|--:|--:|
| ايفون 16 برو ماكس | ايفون 16 برو ماكس 256 | 1 | 1 |
| جوال سامسونج | Galaxy A17 5G | 2 | **2** ✅ |
| سامسونج جالكسي S24 | Galaxy S24 Plus | 1 | 1 |
| ايفون 15 | iPhone 15 128GB | 3 | **3** ✅ |
| ايباد | iPad A16 2025 11" | 1 | 1 |
| لابتوب | Dell Chromebook 3100 | 2 | 1 (false) |
| ماك بوك | MacBook | 1 | 1 |
| تلفزيون سامسونج | Samsung 43" FHD | 2 | 1 (false) |
| شاشة 55 بوصة | Samsung 55" QLED | 2 | 1 (false) |
| سماعات | Soundcore Q11i | 2 | 1 (false) |
| ايربودز | AirPods 4 | 1 | 1 |
| مكيف سبليت | Samsung Split 18000 | 1 | 1 |
| مكيف 18000 | LG Split 18000 | 3 | **3** ✅ |
| ثلاجة | ClassPro Refrigerator | 1 | 1 |
| غسالة | Denx mini portable 2-in-1 | 1 | 1 (weak) |
| غسالة صحون | Classpro Dishwasher | 1 | 1 |
| مايكروويف | Microwave Potato Cooker | 1 | 1 (weak) |
| قلاية هوائية | YelaJoy Air Fryer Silicone | 1 | 1 (weak) |
| بلايستيشن 5 | Sony PlayStation 5 | 1 | 1 |
| ابل واتش | Apple Watch Ultra | 1 | 1 |

**Weak tops to note (relevant but low-quality):** غسالة → a mini portable washer;
مايكروويف → a "potato cooker"; قلاية → a silicone liner. These pass relevance but are
not the flagship product a buyer expects.

---

## Launch verdict (measurement only — no recommendation to act)
| Item | Reading |
|---|---|
| Search answers a real query | **Strong** — 20/20 correct product + price + link |
| Outbound links | **Good** — ~86% confirmed, 1 dead, rest bot-walled majors |
| Catalog breadth | **Solid** — 5,027 served products, 7 live retailers |
| **Real price comparison (the core promise)** | **Weak/absent** — materialized 166 is Amazon-double-counted (0 real); runtime shows real comparison on ~3/20 queries |
| Verified savings (our moat) | **Hidden** — 926 facts, 161 renderable, shown on `/price-truth` only |
| Amazon freshness | **Risk** — prices 23 days stale |

**Three defects surfaced incidentally (recorded, not fixed):** (a) Amazon ingested
under two store names → false 2-store cards; (b) one dead Almanea outbound (404);
(c) a `/go/null` exit on a null-URL Almanea result.
