# Coverage Matrix — Knowledge Graph (System A)

**Generated:** 2026-07-22 · read-only from production `vyceqrzttspyycdpojtn` · regenerate: `npx tsx scripts/tps-analysis/coverage-matrix.ts > docs/COVERAGE-MATRIX.md`

E15.5 · W1. Evidence-based completeness by store and category. Corroborated = ≥2-store comparable (Layer 1). Single-store = resolved identity, one offer (Layer 2). "Keys" = distinct resolved product identities observed at that store.

## Totals

| Metric | Value |
|---|---|
| Raw observations (all stores) | 135689 |
| Distinct resolved product identities | 812 |
| Corroborated canonicals (Layer 1, comparable) | 94 |
| Resolved-single (Layer 2) | 300 |
| Owned index (projection) | 394 |

## By store — raw observation volume

| Store | Raw observations |
|---|---|
| Jarir | 56747 |
| Amazon | 2422 |
| Extra | 41340 |
| Almanea | 35180 |

## By category × store — resolved product identities (distinct keys)

| Category | Jarir | Extra | Amazon | Almanea | Corroborated | Single-store |
|---|---|---|---|---|---|---|
| **air_conditioner** | 0 | 196 | 6 | 59 | 14 | 0 |
| **audio** | 14 | 0 | 23 | 5 | 7 | 3 |
| **camera** | 10 | 0 | 14 | 0 | 3 | 7 |
| **laptop** | 30 | 21 | 23 | 13 | 0 | 27 |
| **tablet** | 12 | 102 | 32 | 25 | 16 | 125 |
| **tv** | 50 | 212 | 28 | 1 | 16 | 138 |

## Reading the matrix

- **Corroboration is store-diversity-bound, not volume-bound:** a category can have many resolved identities but few corroborated (the same product must appear in ≥2 stores). This is precision-over-recall, not a coverage gap.
- **Single-store dominance is structural** in the KSA 4-store market (evidence: laptop 0 corroboration despite thousands of units). Layer 2 keeps these discoverable without false comparison.
- **Growth path:** `/api/cron/tps-progressive` (scheduled) processes newly-ingested observations continuously, so corroboration rises as store overlap appears.

