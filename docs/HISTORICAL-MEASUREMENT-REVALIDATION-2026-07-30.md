# Historical measurement revalidation — 2026-07-30

Mandated by the founder's §11 after two measurement-layer defects were found in one day
(a single-JSON-key reach query, and a prediction reported at the wrong pipeline stage).

Each item is **VERIFIED**, **UNCERTAIN**, or **RETIRED**. Nothing is preserved because it
is already written down.

---

## alnakheelk: 68 — **UNCERTAIN**

- **Measurement path changed?** No, but its denominator is now known: alnakheelk has **600
  distinct products** ever fetched.
- **Conclusion still stands?** Directionally. It says 68 families overlapped *within a
  600-product fetch*, which is a real observation about real data.
- **Decision made from it valid?** Yes — alnakheelk was admitted (ADR-139) and is live in
  comparisons today (`غسالة صحون` returns متجر النخيل). The decision is validated by
  outcome, independently of the estimate.
- **Re-measure?** Only if used to rank it against another retailer.
- **Safe to reference?** **Only with "at 600 products fetched" attached.**

## najm: 48 — **UNCERTAIN**

Same reasoning; denominator **606 distinct products**. Admitted, live, producing
comparisons. Safe only with its reach stated.

## sonyworld: 0 — **RETIRED**

- **Measurement path changed?** Yes in interpretation: the figure was computed over a
  **236-product fetch**.
- **Conclusion still stands?** **No.** "Sony World has no overlap" is not supported by a
  236-product sample.
- **Decision made from it valid?** **No.** It became the reference case for the rule
  *"single-brand retailers produce nothing"*, which ADR-145 rejected — Samsung KSA, also
  single-brand, reached a 58% overlap rate on what it ingested.
- **Re-measure?** Yes, before any statement about Sony World.
- **Safe to reference?** **No. Do not cite it in ADRs, planning or launch material.**

## 127 shared UCP families — **UNCERTAIN**

Computed across stores whose fetches range from 236 to 797 products. It is a lower bound
on overlap within those fetches, not a measure of the merchants. Re-measure before using
to prioritise. Reference only with reach stated.

## 88 "new" families — **UNCERTAIN**

Same provenance and same caveat. The *split* (88 new vs 39 re-count) is likely more robust
than the absolute count, since both halves share the same fetch bias.

## 836 → 10–50 trigram finding (ADR-133) — **UNCERTAIN, and narrower than it reads**

- **Path changed?** No, but its scope is now clear: a trigram blocker can only propose
  pairs **among products we hold**.
- **Conclusion still stands?** **As a statement about our ingested catalogue, yes.** As a
  market claim — *"matching is marginal"* — **no**. Fetch has since grown materially
  (Noon 1,092 → 6,736 in one run), and the candidate pool is not the pool it measured.
- **Decision valid?** The consequent decision — deprioritise matching, prioritise
  acquisition — **survives, and is strengthened**: ADR-146 shows the lever is aimed
  discovery, still not matching.
- **Re-measure?** Yes, after overlap-seeded discovery lands.
- **Safe to reference?** Only as *"marginal within the catalogue as ingested at the time."*

## Samsung KSA: +7 — **VERIFIED**

- **Path changed?** No. Measured before and after against the same query.
- **Stands?** Yes. 581 → 588 comparable, 135 → 141 at ≥3, 14 canonicals involving Samsung.
- **Decision valid?** Yes — ingest-then-gate worked exactly as designed; the data is
  permanent and visibility reversible.
- **Safe to reference?** **Yes**, with its context: 111 products fetched, not a full
  catalogue, and it is a *run* result, not a retailer ceiling.

## Noon: +47 — **VERIFIED, with one figure corrected**

- **Path changed?** No for the delta; **yes** for the surrounding overlap-rate claim.
- **Stands?** Yes. 588 → 635 comparable from a 6.2× reach increase.
- **What is corrected:** I attributed it to a general **58% overlap rate**. Noon's actual
  rate is **20%** (151 comparable of 743 canonicals), with **592 Noon-alone**. The 58% came
  from n=24 and is **RETIRED as a constant** (see ADR-146).
- **Safe to reference?** **Yes for the +47.** **No for "58% overlap rate."**

---

## Figures that remain VERIFIED and safe for launch material

These describe what we hold and serve, and no measurement-layer defect touches them:

| figure | value | source |
|---|---|---|
| comparable canonicals (≥2 approved retailers) | **637** | production SQL |
| comparable at ≥3 | **146** | production SQL |
| verified price drops | **363** | `/api/v1/tps/discount-integrity` |
| advertised discounts referencing an unobserved price | **71%** | 9,655 ÷ 13,655 |
| products corroborated by model number (devices only) | **78** | `/api/v1/tps/model-corroboration` |
| journey gate | **112/112**, comparison **82/82** | `docs/ui-journey-2026-07-30-final.log` |

## Newly established, and safe to use

| figure | value |
|---|---|
| distinct products fetched — almanea / noon / amazon / extra / jarir | 8,147 / 6,736 / 6,693 / **5,248** / 3,266 |
| single-store canonicals | 5,854 |
| Noon-alone canonicals | 592 |
| single-store canonicals whose brand Noon also carries (target pool) | **2,674** |
| blind-fetch cost per new comparison | ~120 products |
| backlog-drain cost per new comparison | ~4,865 rows |

---

## Operating rule going forward

**No retailer-value figure may be quoted without the fetch reach it was computed over.**
A number without its denominator describes our crawler and will be mistaken for the market
— which is exactly how sonyworld = 0 became a strategic rule.
