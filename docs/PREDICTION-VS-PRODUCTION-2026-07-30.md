# PREDICTION vs PRODUCTION — the Samsung KSA miss

**First prediction-versus-production validation this project has run. Predicted ~281,
produced 7.** Every line below is production measurement or repository analysis; the source
is named on each conclusion.

---

## 0. First correction: the probe was never involved

**`feed-overlap-probe.ts` was NOT run for Samsung KSA.** The +281 was my own SQL —
`canonical_products` where `brand='samsung'` having exactly one distinct store in
`price_history`. *(repository analysis + session record)*

So "is the probe wrong?" and "was the +281 wrong?" are different questions. The +281 was
never a probe output, and the miss is not evidence against the probe. §4 below assesses
the probe separately and on its own terms.

---

## 1. The trace — where 281 became 7

| stage | count | what happens here |
|---|---|---|
| **Prediction pool** | **281** | single-store Samsung canonicals. A CEILING: assumes Samsung KSA carries and matches every one |
| Samsung canonicals in catalogue | 437 | *(production)* the pool's universe |
| **Products fetched** | **111** | one run, `--pages=6` across 9 categories. `discoverProducts` caps at `maxPages × 12` per category *(repository)* |
| Written to storefront | 96 | 36 created + 60 linked *(ingest log)* |
| `product_stores` offers, store 6 | **42** | *(production)* |
| **TPS canonicals with Samsung price rows** | **23–24** | *(production)* |
| — of those, no other retailer | **10** | 42% |
| — **newly comparable** (1 → 2 stores) | **7** | 29% |
| — deepened (already ≥2, now +1) | **7** | 29% |

**The dominant loss is stage 3, not overlap.** We sampled 111 of a 437-canonical Samsung
universe. The prediction assumed complete coverage of the pool; the run covered a fraction
of it.

---

## 2. REJECTED HYPOTHESIS — "Samsung KSA has little commercial overlap"

*(production measurement)* **58% of ingested Samsung canonicals found another retailer**
(14 of 24). Overlap was never the failing stage. Where Samsung products entered TPS, they
merged with existing catalogue at a high rate.

## 3. REJECTED HYPOTHESIS — my own "~12.6% conversion" from the last session

I computed comparisons ÷ **products fetched** (14 ÷ 111). The correct denominator is
canonicals that actually entered TPS: **14 ÷ 24 = 58%**. My figure understated the overlap
rate by 4.6× and would have mis-sized Noon and SWSG downward. *(arithmetic error, corrected
against production)*

## 4. REJECTED HYPOTHESIS — founder §10, "brand stores stock premium SKUs multi-brand
retailers don't carry"

Not supported for this data. If it held, the Samsung-only residue would be premium
flagships across categories. Measured, the 10 non-overlapping products are **9 audio
devices** — soundbars `HW-Q800F/D`, `HW-Q930F`, `HW-Q990F`, `HW-S800D`, `HW-T400`, plus
Galaxy Buds — and one dishwasher. It is one CATEGORY, not one tier. *(production)*

**But the cause within that category is UNRESOLVED, and I will not pick between two
explanations I cannot separate:**
- Extra and Almanea genuinely do not stock these Samsung soundbars, **or**
- our ingestion of their audio catalogue is too shallow to have reached them.

What is measured: **zero** Samsung `HW-Q*` listings exist in `raw_observations` for any
retailer other than Samsung KSA. Almanea has 945 rows matching speaker terms, but **zero**
matching any Samsung `HW-Q` model. So it is **not** an identity or merge failure — the
products are absent from our data entirely, under any name. *(production)*

An attempt to check Extra's live site was inconclusive (JS-rendered search); I am not
willing to convert that into a claim either way.

---

## 5. NEW VERIFIED RULE — size a retailer by CATALOGUE REACH × OVERLAP RATE

*(production measurement)* Two independent factors, and last session I conflated them:

```
new comparisons ≈ (canonicals we can actually ingest) × (share that overlap) × (share currently single-store)
```

For Samsung KSA: 24 ingested × 58% overlap = 14 in comparisons, of which 7 were new.
**Scaling the reach is the lever; the overlap rate is already healthy.**

The old rule — *"brand ubiquity decides a brand store's value"* — survives as necessary but
is **not sufficient**. Sony has 11 canonicals and produced 0; Samsung has 437 and produced
7 from a 111-product sample. Ubiquity sets the ceiling; **ingest reach sets the result.**

## 6. NEW VERIFIED RULE — a prediction must name its stage

The +281 was a **ceiling on the pool**, reported as a **forecast of one run**. Those differ
by every loss stage between them. Any future prediction states which stage it predicts:
pool ceiling · fetchable · ingestible · overlapping · newly comparable.

---

## 7. Verdict on `feed-overlap-probe.ts` — B, with a caveat

*(repository analysis)* The probe measures **brand and model-code overlap between a
candidate's public feed and our single-store products** — it does not model our ingest
reach, our parser coverage, or commercial-variant identity. It answers *"is there overlap
to be had?"*, not *"how many comparisons will we gain?"*

**It was never wrong here, because it was never run.** Its output remains useful as a
CEILING and is unsuitable on its own for prioritisation. Rather than rebuild it, apply §5:
multiply its ceiling by measured ingest reach and the 58% overlap rate. That is cheaper
than upgrading the probe to variant level and it is calibrated against production.

---

## 8. What this changes for Noon and SWSG

Do **not** size them from single-store pools. Size them as:
`(products we can actually fetch) × (overlap rate) × (share single-store)`.

**Noon's binding question is therefore reach, not overlap** — confirmed by the audit in §10.

## 9. REJECTED HYPOTHESIS — my own, within this same document

I first wrote here that **473 Samsung rows stuck at `processing_status='pending'` with
NULL `raw_url`** were "a real, measured pipeline leak". I checked it before leaving it in,
and it is wrong.

*(production)* **614,692 of ~615,000 raw rows are `pending`; only 277 have ever been
`done`.** A status that is essentially never set is not a queue.

*(repository)* `normalize-incremental.ts` defines its backlog as a **watermark on the row
id**, not on that column:

```sql
select count(*) from raw_observations
where id > (select coalesce(max(raw_obs_id), 0) from tps_identity_staging)
```

So `processing_status` is **vestigial**, and NULL `raw_url` does not block normalization
either — the normalizer never reads it. There is no half-million-row leak. **Two hypotheses
of mine died in this document; this is the second.**

**A consequence worth carrying:** any earlier measurement of mine that counted
`distinct raw_url` to estimate catalogue size is unsound, because `raw_url` is NULL on 83%
of rows. That includes the "11,259 distinct raw listings / 8,286 unnormalized" figures from
an earlier session. **Do not reuse them.**

---

## 10. NOON AUDIT — the limiting factor is DISCOVERY DEPTH

*(production)*

| | Noon |
|---|---|
| raw observations | 3,182 |
| last scrape | 29 July (active) |
| `product_stores` offers | 618 |
| TPS canonicals | 314 |

Noon is scraped and flowing — 618 offers and 314 canonicals is a working pipeline, not a
blocked one. It is simply **shallow**: 3,182 raw observations against one of the largest
marketplaces in Saudi Arabia.

**Verdict: the limiting factor is discovery depth, not parser loss, identity rejection or
blocked endpoints.** No parser fix or identity change increases Noon; only fetching more of
it does.

Sized by the §5 rule rather than a pool ceiling:
`new comparisons ≈ (additional canonicals we can ingest) × 58% overlap × (share single-store)`.
Noon is broad-catalogue and overlaps the majors by construction, so its overlap rate should
meet or beat Samsung's 58% — but **that is an expectation, not a measurement**, and it must
be measured on a bounded run before any larger investment.

**NOT REACHED:** the deeper Noon ingest itself. The audit it required is done and its
limiting factor is named.

---

# VALIDATION BY INTERVENTION — the fetch-reach hypothesis, tested

*(production measurement, 2026-07-30)*

The hypothesis was not left as an inference. It was tested by changing the one variable it
names — reach — on the retailer with the worst reach-to-market ratio, and measuring the
comparison delta.

**Intervention:** Noon re-ingested at `--pages=30` across the nine scope categories,
against a default of 10. No parser change, no identity change, no new retailer.

| | before | after |
|---|---|---|
| Noon distinct products fetched | 1,092 | **6,736** (6.2×) |
| comparable canonicals (≥2 approved retailers) | 588 | **635** |
| comparable at ≥3 | 141 | **146** |
| canonicals with Noon in a comparison | — | **151** |

**+47 comparable products from ONE retailer, with roughly 10% of the new products
normalized** — 9,429 observations remain in the backlog at the time of writing. Against
Samsung KSA's **+7** from a complete, fully-normalized run.

**No extrapolation is offered.** The remaining backlog is not all Noon, and marginal
returns may fall. What is measured is the direction and the order of magnitude: changing
reach alone, on one retailer, produced roughly **7× the entire Samsung onboarding**.

**Verified live** — `سماعات` returns المنيع / نون / مكتبة جرير; `تلفزيون 65 بوصة` returns
إكسترا / مكتبة جرير / نون.

## The architectural cause, located in our own code

*(repository analysis)* Fetch depth is governed by per-scraper caps and an orchestrator
default, not by the retailers:

- `scraping-orchestrator.ts`: `options.max_pages || 10`
- `noon-scraper.ts`: paginates `maxPages` × `limit=50` per category query
- `samsung-ksa-scraper.ts`: `const limit = Math.max(1, maxPages) * 12`
- `extra-scraper.ts`: `const limit = Math.max(1, maxPages) * EXTRA_SITEMAP_DISCOVERY_LIMIT`

Each connector caps itself, and the shared default is 10 pages. **The 200× spread in fetch
reach across retailers is a property of our configuration, not of the Saudi market.**

## What this makes the highest-leverage work

Not parsers. Not identity. Not new retailers. **Raising reach at the retailers already
connected**, because the overlap rate where products do reach TPS is already 58% and the
reach term is the one spanning two orders of magnitude.

**NOT REACHED:** draining the remaining 9,429-row backlog (~100 minutes at the observed
~140 rows per normalizer run), and applying the same intervention to almanea, jarir, extra
and amazon. The intervention is proven; the rollout is not done.
