# RETAILER TIERS — definition and measurement
**2026-07-31 · REDESIGN_BRIEF §2.1 · Measured against production**

> §2.1: *"Only production-deep retailers appear in consumer-facing counts. Publish the tier
> definition alongside the number."* This file is that definition.

---

## THE DEFINITION

A retailer's tier is computed, never assigned. Three measured inputs, all from
customer-visible offers — the latest price row per (active canonical, retailer):

| input | meaning |
|---|---|
| **depth** | how many offers a customer can actually be shown |
| **routability** | share of those offers with a working exit (`tps_observation_id` present) |
| **freshness** | median observation age of those offers |

| tier | rule |
|---|---|
| **production-deep** | depth ≥ 150 · routability ≥ 60% · median age ≤ 14 d |
| **production-limited** | real customer-visible offers, but fails one or more thresholds |
| **connected, not consumer-ready** | ingesting, but no customer-visible comparison offers |
| **inactive or broken** | registered with no data |

**Why 150** — anchored in the distribution, not chosen for roundness. Sorted depth:
`2493 · 2444 · 1262 · 663 · 329 · 223 · 210 · 182 ‖ 59 · 43 · 38 · 35 · 34 · 30 · 26 · 21 · 17 · 11 · 8 · 3 · 3`.
The widest relative gap in the tail is **182 → 59 (3.1×)**; 150 sits inside it. Same method as
ADR-150's category threshold: the rule is the constant, membership is recomputed.

---

## MEASUREMENT — 2026-07-31

| retailer | offers | routable | median age | tier |
|---|---|---|---|---|
| اكسترا Extra | 2,493 | 66.3% | 7.8 d | **production-deep** |
| المنيع Almanea | 2,444 | **47.0%** | 6.9 d | production-limited *(routability)* |
| نون Noon | 1,262 | 100% | **1.4 d** | **production-deep** |
| أمازون Amazon | 663 | 71.8% | 7.1 d | **production-deep** |
| جرير Jarir | 329 | 100% | 7.4 d | **production-deep** |
| نجم الأجهزة Najm | 223 | 100% | 6.2 d | **production-deep** |
| شاكر Shaker | 210 | 100% | 6.8 d | **production-deep** |
| متجر النخيل Alnakheelk | 182 | 100% | 5.3 d | **production-deep** |
| الشتاء والصيف SWSG | 59 | 100% | 7.8 d | production-limited *(depth)* |
| محزم · امن كوم · إيزي وورلد · السفير زون · الضوء البارق | 30–43 each | 100% | ~5–6 d | production-limited |
| سامسونج السعودية Samsung KSA | 26 | 100% | 1.5 d | production-limited *(depth)* |
| سوني وورلد · بي سي بالاس · التاوية · جولدن ستور · الهويش · اتش دي اف | 3–21 each | 100% | ~5–6 d | production-limited |
| **لولو LuLu · شرف دي جي Sharaf DG** | **0** | — | — | **connected, not consumer-ready** |
| 16 further registered stores | 0 | — | — | inactive |

**production-deep: 7** — Extra, Noon, Amazon, Jarir, Najm, Shaker, Alnakheelk.

---

## THE CONSUMER-FACING COUNT — the finding

The live claim is `search.searchSubtitle`: **«ابحث في منتجات 8 متاجر سعودية»** / *"Search products
from 8 Saudi retailers."*

**The published 8 and the measured 8 are not the same 8.** The claim's set is
`SUPPORTED_SEARCH_STORES` — amazon, noon, jarir, extra, almanea, samsung_ksa, shaker, swsg — which
**includes two retailers that are not production-deep** (Samsung KSA at 26 offers, SWSG at 59) and
**omits two that are** (Najm 223, Alnakheelk 182).

Measured separately: search actually returns **11 distinct retailers** once duplicate name
spellings are collapsed (Amazon alone appears as `amazon`, `أمازون` and `أمازون السعودية`).

So the number is not simply wrong — it is **assembled from a list that no longer describes what
search does.** Under §2.1 the consumer-facing count should be **7 production-deep**, and under
§1.4 it should not be a hardcoded literal in a translation string at all.

**Recommended, not yet applied** (it edits an approved CAN SAY entry, so F1 requires the
vocabulary be amended first, with this measurement as the evidence): retire the hardcoded count
and state the capability without a number, exactly as the About page was resolved —
«ابحث وقارن الأسعار المتاحة بين متاجر سعودية.» / *"Search and compare available prices across
Saudi retailers."* A count that must be re-verified on every ingestion change is a claim we have
to keep earning; the capability statement is true permanently.

---

## RESOLVED WHILE MEASURING

**LuLu was being named to customers as a comparison source** — 3 of 384 cards — while holding
**zero** comparison-layer offers. `isApprovedStore` (may we ingest?) was standing in for a gate
that did not exist (may we show?). Fixed in `5df38a1` with `isDisplayableRetailer`; verified 0 of
384 after deploy. LuLu and Sharaf DG are **connected, not consumer-ready** — precisely the tier
§2.1 defines and the vocabulary already forbade naming.

---

## RE-MEASURE

```bash
npx tsx scripts/tps-analysis/q.ts "with latest as (select distinct on (ph.canonical_product_id, ph.store_name) ph.canonical_product_id, ph.store_name, ph.tps_observation_id, ph.observed_at from price_history ph join canonical_products cp on cp.id=ph.canonical_product_id and cp.is_active where ph.canonical_product_id is not null order by ph.canonical_product_id, ph.store_name, ph.observed_at desc) select store_name, count(*) offers, round(100.0*count(tps_observation_id)/nullif(count(*),0),1) pct_routable, round(extract(epoch from (now() - percentile_disc(0.5) within group (order by observed_at)))/86400.0,1) median_age_days from latest group by 1 order by offers desc"
```

Tiers move as data moves. **Re-measure before quoting any figure here.**
