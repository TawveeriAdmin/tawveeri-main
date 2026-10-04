# Product identity — commercial closure (2026-10-04)

*Audience: the founder, as a business decision document. Technical detail lives in ADR-405, `PRODUCT-IDENTITY-WAVE1-VACUUM-CLOSURE-2026-10-04.md` and `TV-SHORT-MODEL-IDENTITY-PROPOSAL-2026-10-04.md`.*

## The position in one paragraph

Tawveeri's edge is **fewer but trustworthy cross-store comparisons**, not the largest number of cards. The identity project proved the principle works (the verifier removes real false comparisons and false "lowest price" claims) and also proved, with independent reviewers, that a gate is only as good as the evidence it is fed: of the 32 Vacuum comparisons that survive on spec-family evidence alone, the founder's own review found 24 exactly the same device, 6 not provable, 1 undecided and 1 different device; in TV, 16 of the 182 multi-store groups (8.8 %) presented two different models as one. **Coverage and Integrity are tracked as two separate numbers and neither is allowed to buy the other.**

## What improved

* **Fewer false comparisons.** TV: 16 live comparisons that merged different models (8 with an Amazon listing) are identified and removed in replay, 3 legitimate ones recovered. Vacuum gate (while it ran): 2 comparisons and **4 lowest-price claims** withdrawn because they rested on listings the verifier had flagged.
* **Fairer Amazon participation.** Amazon was cheapest in 12/12 of its verified Vacuum appearances (median advantage ≈ 10 %, no outlier); it was *held back* only where evidence conflicted (2 Vacuum listings; 8 TV false merges that included an Amazon listing were removed), never favoured. No Amazon-specific rule exists.
* **More honest uncertainty.** A listing the evidence cannot place is shown as unconfirmed or left out of the price claim instead of silently standing as "the same product".
* **A controlled release mechanism.** Category-by-category gate, isolated runner (no reopening of the fenced refresh chain), persistent monitoring that survives a closed session, a rollback that is a single variable, and rollback triggers that fired when they should (TV 10:15Z, Vacuum 14:16Z).

## What intentionally remains limited

| Area | Position |
|---|---|
| **Family-only comparisons** | 32 of 56 verified Vacuum comparisons rest on spec-family evidence; the founder's review: 24 exactly the same device (75 %), 6 not enough evidence, 1 unsure, 1 different device (V14). Until evidence extraction improves they are reference-grade, not "exact" |
| **TV** | HOLD. Proposal ready (GO WITH CONDITIONS): shared evidence function, production shadow and a fresh audit are still required |
| **Vacuum** | ROLLED BACK on one founder-confirmed false merge (V14, Panasonic — decisive evidence is Extra's page mpn, absent from our payload) that the gate cannot see; the founder's review lowers the severity and shortens the path back: Extra mpn ingestion first, then re-gate (his decision) |
| **Appliances** | Mixed evidence pipeline, not "merchant data only": a model is on every listing of 50.7 % of washer, 72.5 % of refrigerator, 56.5 % of dishwasher groups. Closed to this mission |
| **Laptops** | Model evidence on every side of only 44.7 % of groups; Noon states 11 % of laptop models |
| **AC exact identity** | HOLD (54.5 % of listings carried a verdict; comparisons 6 → 0 in the shadow) — no exact-model claim without model evidence |
| **Price freshness** | A separate debt: 24 % of Vacuum comparisons older than 168 h have no price claim; Jarir TV 0 % fresh, Noon TV 10.7 %, Jarir mobile 20.8 %, Noon mobile 14.3 % (`reobserve` failing since 2026-10-01) |

## Strategic consequence

Compete on **trustworthy exact comparisons**. Every extra comparison must come from *better evidence extraction* (read what the merchant already states, safely) before any correctness rule is relaxed; abstain or disclose when the evidence is incomplete or conflicting. GTIN is globally the strongest identifier but **is absent from merchant data in practice** (0 % almost everywhere; 34.9 % of Jarir phones, 3.5–3.9 % overall in mobile/audio), so it is a partnership lever, not an engineering one.

## Merchant integration opportunity (internal sourcing-quality metric — never a shopper-facing or ranking input)

Highest-leverage asks, from the measured trust matrix and data-quality cells:

| Merchant | Ask | Why it pays |
|---|---|---|
| **Extra** | `modelNumber` on **every** listing (today 70 % of Vacuum and 81 % of TV offers carry it; it is the most reliable field in the catalogue: 0.8 % traps, 80.5 % independently confirmed) | unlocks exact variant evidence across TV, Vacuum, appliances, laptops where Extra is the dominant store |
| **Noon** | expose `model_number` as a structured field (today only inside `specifications` for 361 offers) and refresh prices (TV 10.7 % fresh) | 206 offers across merchants (101 in multi-store groups) carry a model only in a spec field nobody reads — Noon's and Amazon's; Noon is also the largest freshness gap |
| **Jarir** | a real model field instead of the whole title in `model`; refresh cadence (TV 0 % fresh) and its GTIN (34.9 % of phones) | Jarir is the only merchant with GTINs: a phone-identity lever |
| **Amazon** | no usable generic `model` (44 % traps); manufacturer evidence must come from titles or a future eligible API | stop depending on the generic field; Amazon is the main beneficiary of correct exact-variant matching |
| **Najm / Alnakheel / Blackbox** | the whole-title `model` (Alnakheel 100 % trap) → a manufacturer model | smaller stores, cheap wins |
| **All** | GTIN / EAN / UPC where they hold it; condition stated explicitly (silence is not "new"); variant attributes (capacity, storage, size) as structured fields | closes the family-only gap at the source |

## Decisions the founder owns next

1. Review the 32 Vacuum and 22 TV groups (both artifacts are live; your answers prevail over the blind AI reviewers).
2. Whether the next engineering step is the **shared evidence function** (TV first, category-general interface) — the single change that serves TV, Vacuum, and the spec-only model gap.
3. Whether to re-gate Vacuum after the extraction fixes and a repeat review.
4. Merchant conversations (Extra, Noon, Jarir) using the table above.
