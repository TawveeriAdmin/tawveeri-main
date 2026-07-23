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

- `scripts/tps-core/activate-store.ts` — reachability-gated store activation (discover → `ingestBatch`). Noon activated (ADR-…); SWSG reachable next. See the Store Integration Readiness Audit (session report). Amazon scaling needs a proxy budget (escalated).

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
