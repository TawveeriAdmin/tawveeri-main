# Tawveeri Intelligence Layers — living reference

**Purpose.** The permanent map of Tawveeri's deterministic intelligence stack: what each layer computes, from what evidence, its guarantees, its API/surface, and how to refresh it. Every layer obeys the Constitution: **deterministic engines decide, LLMs only phrase; precision over recall; fail loud; no fabricated data; ranking-blind (commission never enters ranking or any trust signal).**

Governed by `TAWVEERI_CONSTITUTION.md`; decisions in `docs/DECISIONS.md`; strategy in `docs/POST-E15-STRATEGY-2026-2040.md`.

---

## Substrate (append-only evidence)

| Table | Role | Notes |
|---|---|---|
| `raw_observations` | immutable per-scrape rows (payload = full scraped product) | 5 active stores; written by `IngestionService.ingestBatch` |
| `tps_identity_staging` | normalized identities (per category plugin) | blocking + keys for corroboration |
| `canonical_products` | corroborated/resolved product identities | `tps_identity_key`; `identity_tier` primary/fallback |
| `price_history` | append-only observed prices per canonical | resets on identity migration → see per-listing facts |
| `tps_product_projection` | serving view (lowest_price, store_count, has_comparison) | rebuilt by `build-tps-projection` |
| `tps_listing_price_facts` | **per-listing** (store+URL) price facts — STABLE across identity rebuilds | migration 021 · `build-listing-facts` |

---

## Layer 1 — Identity & Corroboration (the moat)

- **Category-plugin matchers** (`scripts/tps-plugins/*`, `tps-matcher/*`): deterministic `brand|type|capacity|…` identity keys per category; corroborate only ≥2 distinct stores (precision over recall).
- **Model-Number Corroboration** (`src/lib/intelligence/model-corroboration.ts`, ADR-049/050): same manufacturer model in ≥2 independent stores ⇒ definitively one product — higher recall than title heuristics. Gates: ≥6-char alphanumeric model, exactly one known brand, price spread ≤3×. Folded into canonicals **clean-create only** (zero duplicates). API `/api/v1/tps/model-corroboration`.
- **Entity Resolution** (`src/lib/entity-resolution/*`, ADR-056/057): validated **hybrid** — multilingual-embedding candidate generation (recall; local `multilingual-e5-small`, no credential/cost; 93% cross-lingual recall) + deterministic `verifySameProduct` (precision: brand + spec + variant + model-designation + CPU-tier/RAM). Leakage-protected benchmark harness in `scripts/tps-er/*` (masked identifiers, store-disjoint, category-stratified). Production candidate generator `find-corroborations.ts` runs the full pipeline over real observations and emits a **confidence-tiered review queue** (~130 ≥2-store candidates, ~90 new). **ADR-057: ships review-gated — never auto-merged into `canonical_products`.** Measured on production: the general verifier over-merges the long tail (laptop configs, tablet generations, bilingual variants), so auto-materialization is gated behind **per-category structured resolvers** that earn auto-status by measured precision. Recall is real (e.g. Sony *"Mark 5"* ↔ *WH-1000XM5* linked across disjoint descriptions).

## Layer 0 — Key Integrity (the substrate every other layer rests on)

- **The invariant (ADR-058):** *an identity or continuity key must derive only from evidence that is stable over time and independent of the observing store's internals.* Violating it is silent and catastrophic — a store-internal SKU used as identity guarantees the product can never corroborate.
- `src/lib/identity/store-identifiers.ts` — the SINGLE authority for manufacturer-model extraction. **`sku` is never a model number** (verified store-internal at every merchant); only `mpn`/`modelNumber`/`model` are candidates, each structurally validated (mixed letters+digits, no whitespace, not a spec fragment like `128GB`). Replaced three divergent `isRetailerSku` copies that let Noon's `N70382194V` become 163/163 of its identity keys.
- `src/lib/identity/merchant-listing-identity.ts` (ADR-059) — **merchant-specific** listing identity contracts, not a universal URL rule. Each merchant declares its durable product id, its identity-bearing params, and its market: jarir `jpm####` + `childSku` (a **variant**, preserved); amazon ASIN (all params are session state); extra `/p/<code>` (path drifts — 5,040 codes vs 5,108 paths); almanea `-p-<code>` (**host-independent**: 100% of rows come from `m.dev-almanea.com`); noon `N…V`; swsg terminal slug (encodes capacity+colour). Unknown merchants keep every non-volatile param — we cannot know what carries identity. Fixed Amazon's permanently-empty price history (listings with ≥2 days 0 → 298) and **deepened** evidence via dedup (jarir avg distinct_days 6.12 → 9.86).
- **Market scoping.** `isSaudiMarket` — 5,480 Jarir observations are Qatar/Kuwait/UAE/Bahrain listings that were informing Jarir's Discount Integrity and Merchant Trust. They stay as evidence, never as Saudi facts. Unknown market = in-scope, so no merchant is silently deleted.
- **Catalog truth (anti-inflation invariant).** Catalog size is *only* distinct Saudi listings under merchant contracts — **11,237**, versus 13,525 raw URLs and 141,322 observations. Re-scrapes remain price/availability evidence and never count as catalog. Reproduce: `npm run tps:state`.
- `src/lib/identity/alias-graph.ts` — **identity aliasing** bridges the `MODEL:`/spec key-space schism using co-occurrence evidence only: one observation carrying BOTH keys proves they denote the same product. Deterministic, no thresholds. `isBridgeableSpecKey` refuses placeholder-laden hubs (measured: `matepad|NO_GEN|256|wifi|NO_SIZE` fused 8 distinct models). Measured +16 corroborations (35 → 51) on laptop+tablet+tv. **Not yet wired into the matcher** — gated pending the corroboration-path change.
- **Tooling (read-only, permanent):** `scripts/tps-analysis/state-snapshot.ts` (reconstruct production truth), `q.ts` (SELECT-only runner, refuses non-production), `identity-impact.ts` (**replay any parser/identity change over production and diff the corroboration surface before applying** — it caught a −14 regression that would otherwise have shipped).

## Layer 1b — Knowledge-Graph Relationship Edges

- `src/lib/intelligence/product-edges.ts` (ADR-053): deterministic typed edges over corroborated DNA — `storage_variant` (same model, different storage) + `successor` (same config, consecutive generation), with price deltas. Migration 024 `tps_product_edges` · `build-product-edges`. Turns the flat catalog into a product graph; `getProductAlternatives` feeds **budget-aware** agent guidance ("256GB is −800", "last year's model is −700"). Precision-first: exact agreement on every identity field except the relationship-defining one.

## Layer 2 — Product DNA

- Per-category deterministic attribute genome (specs + derived suitability: AC BTU-for-room, inverter-for-KSA-climate). `src/lib/intelligence/dna-enrich.ts` enriches identity-only canonicals from titles (precision-first: only confident fields; unknown stays absent).

## Layer 3 — Price Intelligence (buy-timing)

- `src/lib/intelligence/price-intelligence.ts` — `computePriceVerdict`: daily-cheapest series (de-biased from scrape frequency), evidence-gated verdicts `great_price | good_price | typical | elevated | building_history` (≥3 distinct days for any verdict, ≥5 for `great_price`). Bilingual. `getPriceIntelligence` delegates (backward-compatible).

## Layer 4 — Discount Integrity (trust)

- Same module — `computeDiscountIntegrity` / `discountVerdictFromFacts`: compares a store's advertised "was" to the **highest price we actually observed**. Verdicts `verified_drop | inflated_reference | stable | insufficient_history`. **Non-accusatory** ("inflated" = never observed that high, not fraud); silent on thin history. API `/api/v1/tps/discount-integrity`; surfaced on the Advisor (`discount_intel`) and `/price-truth`. Finding: **~88% of Extra's advertised discounts are inflated_reference.**

## Layer 5 — Merchant Trust Intelligence

- `src/lib/intelligence/merchant-trust.ts` (ADR-051): per-store **discount honesty** (share of *evaluable* claims that are inflated) + **real price competitiveness** (cheapest-share on corroborated) + coverage → nuanced honest headline. Distinguishes `insufficient_data` from `no_advertised_discounts` from `aggressive_claims`. Migration 023; API `/api/v1/intelligence/merchant-trust`; surfaced on `/price-truth`. E.g. Jarir honest (0% inflated); Extra 100% inflated but cheapest 60%.

## Layer 6 — Decision Agent (the surface)

- `src/lib/agent/*` + `/api/v1/agent/decide` + `/[locale]/advisor`: deterministic, ranking-blind, 17 categories; total-cost (Saudi context); `chosen_over` reasoned comparison (§5.5); attaches `price_intel` + `discount_intel` per recommendation; measured exits via `/go`. Quality locked by the **Saudi Agent Benchmark** (`tests/agent/saudi-agent-benchmark.test.ts`, §5.11) — graded rubrics fail CI on regression.

## Coverage / Merchant onboarding

- `scripts/tps-core/activate-store.ts` — reachability-gated store activation (discover → `ingestBatch`).
- **Verified activation status (production, 2026-07-23 — supersedes earlier "activated" claims).** 8 stores configured, **5 ingesting, 4 consumer-visible**. "Ingesting" is not "active": the full chain is discovery → ingestion → normalization → identity → canonical → projection → consumer.

  | store | observations | distinct listings | staged | canonicals | in projection |
  |---|---|---|---|---|---|
  | 1 jarir | 58,842 | 2,973 | yes | yes | **yes** |
  | 2 amazon | 3,022 | ~824 ASINs | yes | yes | **yes** |
  | 3 noon | 562 | 562 | 207 (163 SKU-poisoned) | 0 | **no** |
  | 4 extra | 42,240 | 5,108 | yes | yes | **yes** |
  | 5 almanea | 36,380 | 1,584 | yes | yes | **yes** |
  | 6 samsung_ksa / 7 shaker | 0 | — | — | — | no |
  | 8 swsg | 276 | 276 | **0** | 0 | **no** |

- **Noon and SWSG are NOT operational.** Two blocking causes, both structural: (1) `TPS_STORES` in `scripts/tps-core/category-registry.ts` lists only stores 1, 4, 2, 5 — Noon and SWSG are excluded from the normalization sweep entirely; (2) neither has a `STORE_ADAPTERS` entry in `scripts/tps-core/store-adapters.ts`. Additionally **SWSG's `price` is NULL on all 276 observations**, so it cannot produce offers even once normalized — though its titles do carry genuine Apple MPNs (`MG1G4AH/A`), making it valuable once price capture is fixed.

### The operational standard, and what onboarding is measurably worth

A merchant is **ingesting** when raw observations arrive. It is **operational** only when the whole chain is evidenced: discovery → stable listing identity → idempotent ingestion → normalization → matching/corroboration → canonical/variant/offer separation → Product DNA → price & offer intelligence → Knowledge Graph → consumer projection → recurring execution → freshness/failure/recovery observability. One-time ingestion is never onboarding.

`npm run tps:identity-impact -- --simulate --stores <ids>` proves the chain **read-only, before any write** — it normalizes raw observations from scratch, deduplicates by merchant listing identity, applies alias reconciliation, and reports which stores actually participate in a corroborated identity. Measured 2026-07-23:

| store set | exact-key | with aliasing | Saudi listings | identity coverage |
|---|---|---|---|---|
| 1,2,4,5 | 54 | **95** | 10,541 | 19.9% |
| + noon, swsg | 86 | **125** | 11,237 | 20.5% |

The two levers are **distinct and additive** (~2 identities of overlap): aliasing **+41**, new merchants **+30**; combined 54 → 125, **+131%**.

**Noon and SWSG were onboarded through the chain (ADR-060), not by configuration.** Consumer-visible proof: Noon moved from `cheapest=—%` (in no comparison at all) to **`cheapest=22%`**; SWSG from `insufficient_data` to **134 listings at high confidence**. Projection corroboration **144 → 151**; laptop earned its first cross-store corroborations. Zero duplicate cards.

### Layer 0b — The normalization gap (the largest remaining lever)

`npm run tps:normalization-gap` attributes every unidentified listing to a cause — it is **not one generic parser problem**. Of 11,238 Saudi listings: 2,301 (20.5%) identified, **8,937 (79.5%) not**, of which 1,771 are accessories ⇒ **product-grade gap 7,166**.

| cause | listings | share of gap |
|---|---|---|
| **no category plugin claims the listing** | 6,913 | **77.4%** |
| plugin detected, then rejected | 2,024 | 22.6% |

So the dominant lever is **category coverage**, not parser quality. Merchant-published categories show the missing mass: **smartphone/mobile ~1,609 across 4 stores** (a mature mobile matcher exists but is excluded from `CATEGORY_DEFS`), **wearable/smartwatch ~973**, **monitor 535**, personal_care 220, gaming 196, smart_home 169, printer 167, networking 110. Top parser rejections: `audio: model missing` 359, `air_conditioner: null in critical: technology` 212, `refrigerator: type missing` 161.

---

## Refresh order (operational)

1. ingest (cron / `activate-store`) → `raw_observations`
2. `bulk-backfill` (normalize + corroborate) → staging + `canonical_products`
3. `write-model-canonicals` (clean-create) → model corroborations
4. `enrich-model-dna` → DNA on model canonicals
5. `build-tps-projection` → serving view
6. `build-listing-facts` → per-listing price/discount facts (all stores)
7. `build-merchant-trust` → per-store trust profiles
8. coverage ledger snapshot + `COVERAGE-MATRIX.md`

All steps are deterministic, idempotent, read-only on evidence, and reversible. Refresh cadence: facts/trust after each ingestion cycle; projection after any canonical write.
