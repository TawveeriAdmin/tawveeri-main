# Coverage Matrix — Knowledge Graph (System A)

**Generated:** 2026-07-22 · read-only from production `vyceqrzttspyycdpojtn` · regenerate: `npx tsx scripts/tps-analysis/coverage-matrix.ts > docs/COVERAGE-MATRIX.md`

E15.5 · W1. Evidence-based completeness by store and category. Corroborated = ≥2-store comparable (Layer 1). Single-store = resolved identity, one offer (Layer 2). "Keys" = distinct resolved product identities observed at that store.

## Totals

| Metric | Value |
|---|---|
| Raw observations (all stores) | 136690 |
| Distinct resolved product identities | 1283 |
| Corroborated canonicals (Layer 1, comparable) | 98 |
| Resolved-single (Layer 2) | 1071 |
| Owned index (projection) | 1169 |

## By store — raw observation volume

| Store | Raw observations |
|---|---|
| Jarir | 57448 |
| Amazon | 2422 |
| Extra | 41340 |
| Almanea | 35480 |

## By category × store — resolved product identities (distinct keys)

| Category | Jarir | Extra | Amazon | Almanea | Corroborated | Single-store |
|---|---|---|---|---|---|---|
| **air_conditioner** | 0 | 196 | 6 | 59 | 14 | 215 |
| **air_fryer** | 0 | 5 | 0 | 0 | 0 | 5 |
| **audio** | 14 | 0 | 23 | 5 | 7 | 27 |
| **blender** | 0 | 2 | 1 | 0 | 0 | 3 |
| **camera** | 10 | 0 | 14 | 0 | 3 | 18 |
| **coffee_maker** | 0 | 4 | 12 | 0 | 1 | 14 |
| **dishwasher** | 0 | 37 | 0 | 0 | 0 | 37 |
| **kettle** | 0 | 4 | 7 | 0 | 0 | 11 |
| **laptop** | 31 | 21 | 23 | 13 | 0 | 80 |
| **microwave** | 0 | 2 | 0 | 0 | 0 | 2 |
| **oven** | 0 | 3 | 0 | 0 | 0 | 3 |
| **refrigerator** | 0 | 72 | 10 | 0 | 0 | 82 |
| **tablet** | 12 | 102 | 32 | 25 | 17 | 127 |
| **toaster** | 0 | 3 | 1 | 0 | 0 | 4 |
| **tv** | 50 | 212 | 28 | 1 | 16 | 138 |
| **vacuum** | 3 | 137 | 0 | 0 | 2 | 134 |
| **washing_machine** | 0 | 171 | 0 | 0 | 0 | 171 |

## Reading the matrix

- **Corroboration is store-diversity-bound, not volume-bound:** a category can have many resolved identities but few corroborated (the same product must appear in ≥2 stores). This is precision-over-recall, not a coverage gap.
- **Single-store dominance is structural** in the KSA 4-store market (evidence: laptop 0 corroboration despite thousands of units). Layer 2 keeps these discoverable without false comparison.
- **Growth path:** `/api/cron/tps-progressive` (scheduled) processes newly-ingested observations continuously, so corroboration rises as store overlap appears.

## Categories evaluated but NOT built (evidence-based, precision over recall)

These were requested/considered but have insufficient clean production evidence to build an honest decider — building one would fabricate capability:

| Category | Finding (production `raw_observations`) | Decision |
|---|---|---|
| cooker / gas range (بوتاجاز) | **n=0** with proper signals (gas range/بوتاجاز/burners) — the catalog has rice/pressure cookers only | Not built |
| water heater (سخان مياه) | **n=0** — the سخان keyword matched only cup-warmers/kettles | Not built |
| range hood (شفاط) | n=6, **1 distinct SKU** (Kumtel DT6-61, 5 duplicates), single store | Not built (too thin) |

Re-evaluate on new ingestion; each becomes a one-line appliance config the moment ≥1 clean multi-unit signal appears.

