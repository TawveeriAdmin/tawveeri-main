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
| Raw rows still unprocessed | **473** | `processing_status='pending'`, `raw_url`/`name`/`price` NULL *(production)* |

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

**Noon's binding question is therefore reach, not overlap** — which is exactly what its
809 URLs suggest, and what its audit must measure first.

## 9. Immediate actionable defect found during this investigation

**473 Samsung raw rows sit `pending` with `raw_url`, `name` and `price` all NULL** — a URL
harvest that never processed. The same pattern predates today's run. Whatever writes
URL-only rows is filling `raw_observations` with entries the normalizer can never consume.
Not fixed here; recorded because it is a real, measured pipeline leak.
