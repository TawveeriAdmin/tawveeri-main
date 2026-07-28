> **🗄️ ARCHIVED 2026-07-28 — REFERENCE ONLY, DO NOT EXECUTE.**
> **What it claimed:** the initial matching diagnosis (pre-GTIN-measurement).
> **What superseded it:** `PHASE2_REVISED.md` (added the GTIN=0 finding) — and both are now archived, because the matching-is-the-bottleneck thesis was **disproven by ADR-133** (2026-07-28): matching is marginal (~10–50).
> **What replaced them:** `EXECUTIVE_DIRECTIVE.md` + `MASTER_DIRECTIVE.md` + ADR-133.

# PHASE 2 — THE MATCHING PROBLEM
**Research-grounded directive · 2026-07-28 · Execution begins 2 August (post-launch)**

---

## 0. STATUS AND SCOPE

**Launch freeze holds until 1 August.** Nothing in this document is executed before
2 August. Until then: read-side fixes and content only. No schema changes, no
migrations, no System A connection, no Tier 2.

This document addresses the single fact that governs the business:

> **5,543 served products. 166 comparable. That is 3%.**

Everything else — acquisition, affiliate, agents, the app — is downstream of that
number. A store added to a catalog that cannot match is a store added to noise.

---

## 1. THE DIAGNOSIS

**This is a blocking problem, not a matching problem.**

Our pipeline uses a deterministic identity key (`brand | category | specs`) to do two
different jobs at once: **generate candidates** and **decide matches**. In the entity
resolution literature these are separate stages for a reason.

The consequence is structural: **any two offers the key does not group are never even
considered as a candidate pair.** They are not rejected by the matcher — they never
reach it. بيسوس and باسوس are never compared, because nothing ever proposes comparing them.

High precision (97%+) with unmeasured recall is exactly the signature of a system that
blocks too aggressively. We have optimised the half of the problem we can see.

### Our two known defects have formal names in the literature

The field calls the hard cases **corner cases**, and defines exactly two kinds:

| Literature term | Definition | Our instance |
|---|---|---|
| **Positive corner-case** | Same product, dissimilar surface forms — different vendor abbreviations, units, transliterations | **بيسوس / باسوس** (Baseus) |
| **Negative corner-case** | Different products, highly similar text — differing in a single feature | **white LG 1290 vs black LG 2599** |

This is not a Tawveeri bug. It is *the* known hard problem of the field, and we have
one clean example of each.

### Precedent worth internalising

Ceneo, the Polish price-comparison platform, has the same failure documented in a 2022
paper: offers of the same watch split into two groups because some sellers used
abbreviated titles and some full ones — and **the split group with the lower price
looked more attractive to shoppers.** A production comparison platform in a
non-English market, with the same defect, published in the literature.

We are not behind. We are at the frontier of a genuinely hard problem, in a language
the frontier has barely addressed.

---

## 2. WHAT THE RESEARCH SAYS — verify all of it yourself

These are my findings. **Verify each independently. Where the evidence contradicts me,
follow the evidence and say so.**

1. **Blocker + matcher is the standard architecture.** A cheap high-recall blocker
   proposes candidate pairs; an expensive high-precision matcher decides. Sparkly —
   a TF/IDF blocker — is described in the literature as "simple yet surprisingly
   strong." Blockers and matchers can also be co-trained, which matters for
   low-resource settings like ours.

2. **LLMs substantially outperform fine-tuned models on unseen entities.** Fine-tuned
   PLMs (Ditto, RoBERTa) reach ~85% F1 on a benchmark's own development set but drop
   36–56% F1 when transferred to unseen entities. LLMs lose far less; GPT-4 outperformed
   the best transferred PLM by 40–68% F1 in the reported experiments.
   **Our situation is the transfer setting** — new products arrive constantly and we
   have no labelled training data. This is the regime where LLMs win most.

3. **Multimodal (text + image) beats text alone.** A Turkish e-commerce deduplication
   system using domain-adapted BERT text embeddings plus masked-autoencoder image
   embeddings, reduced to 128 dimensions and served from a vector database, reported
   macro-F1 0.90 versus 0.83 for third-party solutions, across a catalog exceeding
   200 million items on roughly 100GB RAM.
   **Turkish is a closer analogue to Arabic than English is.** We have product images
   and are not using them for identity at all.

4. **Arabic is a documented low-resource gap.** Recent work explicitly names Arabic as
   a zero-shot generalisation gap in multilingual e-commerce matching and resorts to
   synthesising training data for it. Established Arabic normalisation techniques
   exist — Alef-variant normalisation, diacritic stripping, token-level Jaccard
   combined with edit distance — and are directly applicable to us.

5. **WDC Products is the reference benchmark.** ~11,700 offers over ~2,160 entities,
   built specifically with a controlled proportion of corner cases. It is the model
   for how a matching gold standard should be constructed.

---

## 3. MY PROPOSED ARCHITECTURE — challenge it

```
L0  NORMALISE
    Arabic: Alef variants, diacritics, tatweel, digit forms
    Brand transliteration map (بيسوس → Baseus), curated + LLM-proposed
    Unit normalisation (كجم/kg, BTU, بوصة/inch, لتر/L)

L1  BLOCK — high recall, cheap        ← MISSING TODAY. THE REAL GAP.
    a) GTIN exact match  → free, exact, zero inference (Icecat is live)
    b) Multilingual embedding ANN → top-k candidates per offer
    c) TF/IDF fallback for coverage
    Target: recall ≥ 95% of true pairs appear as candidates

L2  MATCH — high precision
    Current deterministic key stays. It is good at what it does.
    Agreement between L1 and L2 → auto-accept.

L3  RESOLVE CORNER CASES — LLM with evidence   ← MISSING
    Only for pairs where L1 and L2 disagree.
    Input: both normalised offers, all structured fields, both images if available.
    Output: same / different / uncertain, PLUS the specific field evidence.
    Never a bare verdict. The evidence is the artifact.

L4  HUMAN REVIEW QUEUE                          ← MISSING
    Everything uncertain. Every review becomes a labelled example.
    This is how the gold standard grows without a labelling project.
```

**The critical property:** L2 keeps its precision. L1 supplies the recall it never had.
L3 handles only the corner cases. L4 catches what nothing else can.

---

## 4. WHAT TO DO — IN THIS ORDER

### 4.1 MEASURE RECALL FIRST — nothing else matters until this exists

We know our precision (97%+). **We have never measured recall.** We do not know whether
166 represents 90% of the matchable pairs or 5% of them. Every decision below depends
on which it is, and we are currently guessing.

Build a Saudi gold standard, modelled on WDC Products:

- 300–500 human-labelled offer pairs, drawn from our own data.
- Deliberately include both corner-case types: transliteration variants, and
  near-identical-text different products (colour, capacity, cooling mode, generation).
- Cover the categories we actually serve, not a convenient subset.
- Label: match / no-match / genuinely ambiguous.

Then report, against that gold standard:
- **Precision** of the current pipeline
- **Recall** of the current pipeline ← the number we have never had
- **F1**
- Failure breakdown by corner-case type

State the precision floor you would require before any automated merge reaches
production, and justify it. My view: nothing below 98% precision should merge
automatically. Argue if you disagree.

### 4.2 Quantify the headroom
Given the measured recall, estimate: if blocking were perfect, how many comparable
families would exist in the current catalog?

**This single number decides the next six months.** If the answer is ~250, the
bottleneck is acquisition and matching is a distraction. If the answer is 2,000+, then
matching is the entire business and no store should be onboarded until it is fixed.

### 4.3 Build L0 and L1, measure, then stop
Normalisation and blocking only. Do not touch the matcher.
Report the recall delta against the gold standard.
A blocker that raises recall without touching precision is pure gain.

### 4.4 L3 — the LLM matcher, offline only
Run it over the disagreement set. Measure precision and recall against the gold
standard. Report cost per 1,000 pairs.
**Do not connect it to production.** Report the numbers and stop.

### 4.5 Images — assess, do not build
We hold product images and use them for nothing but display. The Turkish result
suggests image embeddings materially help exactly where Arabic titles are chaotic —
appliances, ACs, TVs.
Assess: what fraction of our offers have a usable image? What would an image-embedding
blocking signal cost to compute and store? Is a vector database justified at our scale,
or is that premature for 5,543 products?
**Honest answer expected. At our size the answer may well be "not yet."**

---

## 5. YOUR MANDATE — override me if you are right

**Do your own advanced research before accepting anything above.**

Search the current literature and production practice on entity resolution, product
matching, blocking, and multilingual and Arabic-specific matching. My summary in §2 is
from a limited search on 2026-07-28. It may be incomplete, out of date, or wrong.

**If you find a better, simpler, cheaper, or more accurate approach than the
architecture in §3 — adopt it and tell me why mine was worse.** I would rather be
corrected than followed. State explicitly which of my claims you verified, which you
could not confirm, and which you are overriding.

Specifically pressure-test these, which are the weakest points in my reasoning:

- **Is blocking really our bottleneck?** I inferred it from high precision plus
  unmeasured recall. That inference could be wrong. If the deterministic key already
  proposes wide candidate sets and the matcher rejects them, my whole diagnosis
  collapses. Check the code before accepting the diagnosis.
- **Is an LLM matcher justified at 5,543 products,** or is it engineering for a scale
  we do not have? A curated brand map plus GTIN may capture most of the gain at a
  fraction of the cost and risk.
- **Is a gold standard of 300–500 pairs the right size** for a catalog this small?
- **Does GTIN coverage make most of this moot?** If a large share of our offers carry a
  GTIN, exact matching may solve the problem outright and everything above is
  over-engineering. **Measure GTIN coverage before building anything.**

---

## 6. CONSTRAINTS

- Nothing executes before 2 August.
- No automated merge without the gold standard and a measured precision floor.
- Unknown beats incorrect. A missed match costs us a comparison; a false match costs us
  the only thing we actually own.
- Every claim labelled measured / inferred / assumption.
- Full task ledger, including omissions.
- Cite the ADRs you checked, and cite external sources for any research claim.

---

## 7. THE POINT

We are not trying to build the largest Saudi catalog. Rakhys has that and it is worth
nothing — 70,600 listings, almost no real comparison.

We are trying to be the one place where **two listings are correctly known to be the
same product, and the price difference between them is true.**

That is one hard technical problem. Everything else in this business is a consequence
of solving it.

**Begin with 4.1. Measure recall. Then tell me what it is.**
