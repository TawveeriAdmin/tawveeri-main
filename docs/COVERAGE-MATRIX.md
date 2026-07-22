# Coverage Matrix — Knowledge Graph (System A)

**Generated:** 2026-07-22 · read-only from production `vyceqrzttspyycdpojtn` · regenerate: `npx tsx scripts/tps-analysis/coverage-matrix.ts > docs/COVERAGE-MATRIX.md`

E15.5 · W1. Evidence-based completeness by store and category. Corroborated = ≥2-store comparable (Layer 1). Single-store = resolved identity, one offer (Layer 2). "Keys" = distinct resolved product identities observed at that store.

## Totals

| Metric | Value |
|---|---|
| Raw observations (all stores) | 135989 |
| Distinct resolved product identities | 1066 |
| Corroborated canonicals (Layer 1, comparable) | 94 |
| Resolved-single (Layer 2) | 818 |
| Owned index (projection) | 912 |

## By store — raw observation volume

| Store | Raw observations |
|---|---|
| Jarir | 56747 |
| Amazon | 2422 |
| Extra | 41340 |
| Almanea | 35480 |

## By category × store — resolved product identities (distinct keys)

| Category | Jarir | Extra | Amazon | Almanea | Corroborated | Single-store |
|---|---|---|---|---|---|---|
| **air_conditioner** | 0 | 196 | 6 | 59 | 14 | 215 |
| **audio** | 14 | 0 | 23 | 5 | 7 | 27 |
| **camera** | 10 | 0 | 14 | 0 | 3 | 18 |
| **laptop** | 31 | 21 | 23 | 13 | 0 | 42 |
| **refrigerator** | 0 | 72 | 10 | 0 | 0 | 82 |
| **tablet** | 12 | 102 | 32 | 25 | 16 | 125 |
| **tv** | 50 | 212 | 28 | 1 | 16 | 138 |
| **washing_machine** | 0 | 171 | 0 | 0 | 0 | 171 |

## Reading the matrix

- **Corroboration is store-diversity-bound, not volume-bound:** a category can have many resolved identities but few corroborated (the same product must appear in ≥2 stores). This is precision-over-recall, not a coverage gap.
- **Single-store dominance is structural** in the KSA 4-store market (evidence: laptop 0 corroboration despite thousands of units). Layer 2 keeps these discoverable without false comparison.
- **Growth path:** `/api/cron/tps-progressive` (scheduled) processes newly-ingested observations continuously, so corroboration rises as store overlap appears.

