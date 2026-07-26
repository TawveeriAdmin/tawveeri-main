# Tawveeri — Private Beta Funnel Dashboard

_Generated 2026-07-26T13:39:07.000Z from production (`vyceqrzttspyycdpojtn`). Re-run: `npm run tps:usage`._
REAL = live customers · TEST (`?test=1`/bots) excluded from every metric.

## Verdict
**EARLY SIGNAL — gathering (need ≥100 sessions & ≥30 exits before a launch verdict).**

## Funnel (REAL) — Search → Results → Product View → Comparison → Evidence → Outbound
| Step | Count | Conversion from prev |
|---|--:|--:|
| 1 Search | 3 | — |
| 2 Results | 3 | 100.0% |
| 3 Product View | 0 | 0.0% |
| 4 Comparison | 0 | 0.0% |
| 5 Evidence | 3 | 0.0% |
| 6 Outbound | 4 | 0.0% |

Off-funnel: no_answer=0, errors=0. Overall **Search→Outbound = 133.3%**.

## KPIs vs launch thresholds
| KPI | Actual | Threshold | Status |
|---|--:|--:|:--:|
| Answer rate | 100.0% | ≥ 80.0% | PASS |
| No-answer rate | 0.0% | ≤ 25.0% | PASS |
| Search→Product View | 0.0% | — | — |
| Product→Comparison | 0.0% | — | — |
| Comparison→Exit (CTR) | 0.0% | ≥ 8.0% | MISS |
| Search→Exit (overall) | 133.3% | ≥ 5.0% | PASS |
| Real sessions | 1 | ≥ 100 | MISS |
| Measured exits | 4 | ≥ 30 | MISS |

## By surface (REAL)
| Surface | Sessions | Search | Results | Outbound |
|---|--:|--:|--:|--:|
| agent | 1 | 0 | 0 | 4 |
| web | 1 | 3 | 3 | 0 |

## Top demand (REAL)
- (unparsed): 3
- air_conditioner: 2
- dishwasher: 1

## Unmet demand — no-answer queries (REAL)
- (none yet)

## Measured exits (outbound_clicks)
REAL: clicks=15, distinct_products=5, monetized=2.
(Storefront exits bypass /go and are counted via the `go_click` event in the funnel above, not here.)
