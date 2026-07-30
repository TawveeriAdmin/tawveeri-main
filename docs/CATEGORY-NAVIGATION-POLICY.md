# CATEGORY NAVIGATION POLICY
**2026-07-30 · ADR-150 · The rule is constant; the list is derived.**

Answers the founder's question: *should a category become navigable based on product count,
comparable count, or another evidence-based threshold?*

---

## THE RULE

> **A category may appear in navigation if and only if it holds at least 30 COMPARABLE
> products** — canonical products carrying live offers from **two or more distinct approved
> retailers** — measured **live** from `tps_product_projection` at render time.

Implemented in `src/lib/intelligence/navigable-categories.ts`
(`MIN_COMPARABLE_FOR_NAVIGATION`). **No category list is hardcoded anywhere.** The threshold
is the only constant; membership is recomputed on every render (homepage, header menu) or
hourly revalidation (`/categories`).

Categories below the threshold are **not hidden** — they remain fully reachable by search.
They are demoted from *promotion*, not removed from the product.

---

## WHY COMPARABLE COUNT — the two alternatives were tested and rejected

### Rejected: product count

It is the failure mode we exist to oppose. Measured on production 2026-07-30:

| category | products | comparable | share |
|---|---|---|---|
| accessories (storefront) | 1,838 | **0** | 0% |
| vacuum | 214 | 10 | 4.7% |
| air_fryer | 169 | 10 | 5.9% |

A competitor with 70,600 listings shows «من 1 متجر» on nearly every card. Breadth without
overlap is not a category — it is a dead end with a large number on it. A product-count rule
would have promoted `accessories`, which cannot produce a single comparison.

### Rejected: comparable RATIO — and it changes the answer for the worse

A ratio floor sounds more principled and is not. At a 10% floor:

| category | comparable | products | ratio | 10% floor |
|---|---|---|---|---|
| laptop | **70** | 742 | 9.4% | ✗ excluded |
| smartwatch | 31 | 73 | 42.5% | ✓ kept |

A shopper comparing laptops can compare **70 products** — more than twice what smartwatch
offers — yet the ratio rule drops laptop and keeps smartwatch. Ratio measures *catalogue
composition*, not what the user can do. Penalising a category for **also** having deep
single-store coverage is incoherent. Rejected on the evidence.

### Rejected: freshness as a gate component

0.1% of projection rows were last observed more than 30 days ago, and **every offer already
discloses its observation age at the point of comparison**. Putting freshness in the
navigation gate would double-count a disclosure we already make, against *one authority per
question*. Freshness is disclosed per offer; it does not decide navigation.

---

## WHY 30 — anchored in the distribution, not chosen for roundness

Comparable counts, production 2026-07-30, sorted:

```
118  106  85  78  70  56  54  41  40  31  ‖  17  16  10  10  8  4  4  3  3  3  1  0
                                          ↑
                        largest relative gap in the tail (~1.8×)
```

The break between **31** (smartwatch) and **17** (dishwasher) is the widest relative gap in
the tail. 30 sits inside it, and corresponds to roughly one full browse screen of comparable
cards — below that, tapping a category feels like a dead end.

**The threshold is a judgement; the membership is not.** If the distribution shifts, the list
shifts on its own. Revisit the number only if the gap moves materially.

### Derived list at time of writing (10 categories)

| category | comparable |
|---|---|
| air_conditioner | 118 |
| mobile | 106 |
| washing_machine | 85 |
| tv | 78 |
| laptop | 70 |
| tablet | 56 |
| monitor | 54 |
| refrigerator | 41 |
| audio | 40 |
| smartwatch | 31 |

This table is a **snapshot for the record, not a configuration**. Nothing reads it.

---

## THE DESTINATION MATTERS AS MUCH AS THE GATE

A gate on comparable count is decorative if the category link cannot serve comparable
products. Measured on production with correctly-encoded request bodies:

| path | result |
|---|---|
| `POST /api/search {category:"laptop"}` | 830 products, **0 comparable**, top result a laptop **table** |
| `POST /api/search {category:"camera"}` | 277 products, 0 comparable, top result a security camera |
| `POST /api/search {category:"gaming"}` | 195 products, 0 comparable |
| `POST /api/search {query:"مكيف"}` | **9 comparable**, 6 retailers, top result "Lg Split AC 30000 BTU" |

`?category=<slug>` is an exact-equality filter against the **storefront layer**, whose category
vocabulary and identity are not the TPS layer's — the storefront says `smartphone`, TPS says
`mobile`, so the two do not even agree on names. **All category navigation therefore links to
the query path.** The header previously used `?category=`; it no longer does.

---

## WHAT THIS REMOVED

The header carried a hardcoded list of 17 categories. **Eight matched no category production
holds at all** — `gaming`, `wearable`, `networking`, `smart_home`, `appliance`, `kitchen`,
`personal_care`, `accessories` — and `camera` holds 3 comparable products. Every one was a
promoted dead end. The `/categories` page separately promoted `cameras` and `gaming`.

This is the same class of defect as the retired homepage figures: a hardcoded assertion that
production stopped supporting, with nothing to force it to notice.

---

## OPERATIONAL NOTE

Labels, emoji and the search term per category are **authored** in `PRESENTATION` — an Arabic
label cannot be generated. That dictionary decides nothing about visibility. A category that
clears the rule but has no authored label is reported by
`getUnlabelledQualifyingCategories()` rather than shown with a raw database key as its name.
It returned `[]` at time of writing. Check it when a new category gains depth.
