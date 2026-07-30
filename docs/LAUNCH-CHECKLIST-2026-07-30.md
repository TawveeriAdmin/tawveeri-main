# LAUNCH CHECKLIST — 2026-07-30

**Recommendation: B — OFFICIAL LAUNCH WITH A NARROWER PRICE-TRUTH PROMISE.**
Public launch status unchanged; the announcement remains founder-gated.

Every figure below is reproduced from production with its query and definition. No public
number is hardcoded in JSX (scan below).

---

## 1. The measured state

### Journey quality — `docs/ui-journey-2026-07-30-launch-baseline.log`
Corrected instrument (exact-model set added, per-script reporting, both surfaces judged).

| dimension | measured |
|---|---|
| overall | **108 / 112 = 96.4%** |
| comparison journeys | **82 / 82 = 100%** |
| Arabic queries | **72 / 72 = 100%** |
| English queries | **36 / 40 = 90%** |
| exact-model: correct product | **32 / 32** |
| exact-model: correct variant | **28 / 32** |
| retailer name visible | **112 / 112** |
| card ↔ compare price agreement | **112 / 112** |
| outbound resolves to a product page | **112 / 112** |
| cards claiming a store count with no compare link | **0** |

**The headline fell from 100% to 96.4%, and that was predicted before the run.** The old
100% was measured by an instrument that contained no model query at all. All 4 failures
were one query — `Galaxy S24 Ultra 512` returning a Galaxy A07 — fixed in `bbfd34c`.

**CLOSED — post-fix rate MEASURED** (`docs/ui-journey-2026-07-30-post-adr142.log`):
**overall 112/112 = 100% · comparison 82/82 = 100% · Arabic 72/72 · English 40/40 ·
exact-model correct product 32/32 · correct variant 32/32 · zero failures.**
No figure in this document is inferred. The pre-announcement condition in §9 is met.

### Catalogue
| figure | value | definition |
|---|---|---|
| canonicals with any approved-retailer offer | 6,092 | `price_history` joined to active `canonical_products`, store resolved via `resolveApprovedSlug` |
| **comparable (≥2 distinct approved retailers)** | **581** | same, `having count(distinct slug) >= 2` |
| comparable (≥3) | 135 | same, `>= 3` |
| comparable share | 9.5% | 581 / 6,092 |

### Price truth — `GET /api/v1/tps/discount-integrity`
| figure | value | definition |
|---|---|---|
| verified drops | **358** | `verdict='verified_drop'`, ADR-134 currency gate applied, superseded duplicates suppressed (636) |
| advertised discounts referencing a price we never observed | **71%** | 9,652 `inflated_reference` ÷ 13,625 checkable (verified + inflated + stable; `insufficient_history` abstains) |
| checkable listings | 13,625 | as above |

### Model-number corroboration — `GET /api/v1/tps/model-corroboration`
| figure | value | definition |
|---|---|---|
| **products verified across ≥2 stores by model number** | **78** | distinct `identity_keys` in `tps_model_corroboration`, `category <> 'accessories'`, counted exactly |
| accessories corroborated (separated, not hidden) | 88 | same view, accessories only |
| total | 166 | 78 + 88 |

Corrected today: this was published as **166** under a label reading "products", when 88 of
them were accessories, and `total` was `rows.length` against a `.limit(300)` — a page-size
artifact, not a total.

### Price freshness — the weakest number we hold
| age of latest observation | share of served offers |
|---|---|
| < 2 days | 14.6% |
| 2–7 days | 55.7% |
| 7–14 days | 14.9% |
| 14–30 days | 1.3% |
| **> 30 days** | **13.6%** |

Now **disclosed on every compare offer** (`رصدناه قبل N يومًا`) rather than presented as
current. That is the honest handling, not a fix for the staleness itself.

### Ten-product launch set (§6) — 12/12 full-journey pass, 11/12 multi-retailer
Phones (EN, AR, Arabic-Indic digits), tablets, laptops, TV, monitor, AC, refrigerator,
washer, qualified accessory. Correct product ✓ · variant preserved ✓ · no accessory leading
a core-device query ✓ · retailer and price visible ✓ · compare agrees ✓.
Outbound excluded from this probe by design (`/go` writes `outbound_clicks`); outbound is
covered by the harness's read-only resolution at 112/112.

---

## 2. What works end to end

- Search → correct product → correct variant → compare page agreeing on price → working
  outbound link, in Arabic and English, across all five approved scopes.
- Multi-retailer comparison where the catalogue holds it: AC 5 retailers, washer 5, TV 4,
  monitor 4, phones 3.
- The first screen: one search field, one وفّر entry, verified drops carrying the evidence
  line, trust stated after the products rather than before them.
- Price-truth surface: verified drops only, accessories excluded, savings ≥ 50 SAR.
- Every merchant exit measured through `/go`.

## 3. What remains broken or unproven

- ~~Post-fix journey rate unmeasured~~ — **CLOSED**, measured 112/112.
- ~~English lags Arabic~~ — **CLOSED**, English 40/40 = 100% after `bbfd34c`.
- **Three bilingual-asymmetry defects in three days** (ة/ى folding, برو/pro, جالكسي/galaxy).
  The class is not exhausted; there is no systematic test that every Arabic token has its
  Latin twin and vice versa.
- **13.6% of offers are over 30 days old.** Disclosed, not solved.
- **Samsung KSA (§4), Noon depth (§3), SWSG (§5) — NOT STARTED.** Predicted +281 / broad /
  AC-1,006-pool respectively.

## 4. What is thin because the catalogue is absent

- **The headline query returns 3 of 5 retailers, correctly.** For
  `apple|iPhone|16|Pro Max|256`: Jarir 3,599 (observed 3 Jul), Extra 3,704 (1 Jul),
  Almanea 4,749 (25 Jul). **Amazon and Noon are NOT INGESTED for this product — zero raw
  listings.** Not a search or join failure; an ingestion gap.
- Comparable share is **9.5%**. 90.5% of our catalogue is single-retailer.
- `MacBook Air M2 256` resolves correctly but to one retailer.
- Noon holds ~809 URLs against mobile/audio/laptop single-store pools of 481 / 529 / 423.

## 5. What Tawveeri MAY claim

- "We verified **358** genuine price drops by tracking prices ourselves."
- "**71%** of advertised discounts we can check reference a price we never observed."
  (9,652 / 13,625 — state the denominator.)
- "**581** products comparable across two or more approved retailers; **135** across three
  or more."
- "**78** products proven identical across stores by manufacturer model number."
- "We show the highest price we observed and how many days we tracked it."
- "We show when we last observed each price."
- The Hisense 85″ U7Q proof card, re-verified: Extra advertises a 9,400 SAR saving; we
  publish **8,800**, because 14,399 is the highest price we actually observed.

## 6. What Tawveeri MUST NOT claim

- ❌ Any figure resembling **85,000 products / 8 trusted stores / 62,000 savings**. Confirmed
  **gone** from the rendered homepage in both locales (§9); the strings survive only in the
  i18n bundle with no component rendering them.
- ❌ **"166 products verified across stores"** — 88 were accessories. The honest figure is 78.
- ❌ **"Compare prices across all major Saudi retailers."** Amazon and Noon are absent from
  the flagship phone; comparable share is 9.5%.
- ❌ **925 verified drops · 65% inflated · 166 comparable · 342 or 340 drops · 87.7%** — all
  superseded. Current: 358 · 71% · 581 · 78.
- ❌ Any claim that prices are live or real-time. 13.6% are over 30 days old.
- ❌ A comparison count that includes accessories.

## 7. No hardcoded public numbers

`grep -rnE '>[0-9]{3,}[+٬,]?<|"[0-9]{4,}"' src/components/public/` returns nothing after
excluding CSS. Every public figure is fetched at request time:
`/api/v1/tps/discount-integrity`, `/api/v1/tps/model-corroboration`,
`/api/v1/intelligence/merchant-trust`, and `getHomeVerifiedDeals()` (server-side).

## 8. Deployment

| commit | change |
|---|---|
| `bfaa6ee` | exact-model harness set · price-age disclosure · accessories off homepage deals |
| `bbbe9d8` | price-truth: exact counts, accessories excluded from the trust headline |
| `bbfd34c` | `galaxy` product-type token (ADR-142) |

URLs verified live: `/ar`, `/en`, `/ar/price-truth`, `/ar/compare/{key}`, `/api/search`,
`/api/compare`, `/api/v1/tps/discount-integrity`, `/api/v1/tps/model-corroboration`,
`/ar/categories/{slug}`.

Rollback: `git revert bbfd34c` · `git revert bbbe9d8` · `git revert bfaa6ee`
(independent; revert any subset).

---

## 9. Recommendation — B, with the measured reason

**B — OFFICIAL LAUNCH WITH A NARROWER PRICE-TRUTH PROMISE.**

**Why not A (full launch).** A full comparison promise is not supported: **9.5%** of the
catalogue is comparable, the flagship query reaches 3 of 5 retailers because two are not
ingested, and **13.6%** of offers are over 30 days old. Claiming broad live comparison
would be the exact marketing-number failure `بالأدلة، لا أرقام مسوّقة` exists to prevent.

**Why not C (do not launch).** The product does what the narrower promise says, measured:
96.4% overall journeys, 100% of comparison journeys, 100% Arabic, 12/12 on the launch set,
zero unhonoured store claims, every price agreeing between card and compare page, every
outbound link landing on a real product. Price truth is genuinely unique and provable —
358 verified drops and a 71% inflated-reference rate no competitor publishes.

**Therefore B:** launch as the **price-truth layer for Saudi retail**. Lead with verified
drops, the 71% statistic, the evidence line and disclosed price age. State comparison
coverage honestly — 581 products across 2+ retailers — and do not imply breadth we lack.

**The pre-announcement condition is MET.** The post-`bbfd34c` harness re-run measured
112/112 overall and 82/82 comparison, with English rising 90% → 100%. Every figure in this
document is now reproduced from production.

**A note on that run, kept deliberately:** the first attempt returned `0/58` with
`ERR_INTERNET_DISCONNECTED` on every request — a local connectivity drop, not an outage
(production returned 200 throughout). That log was DELETED rather than filed, because a
dead instrument reading is not a measurement, and a `0%` in the record would be read as
one later.
