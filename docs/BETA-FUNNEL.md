# Tawveeri — Private Beta Funnel Dashboard

_Generated 2026-08-03T10:00:32.000Z from production (`vyceqrzttspyycdpojtn`). Re-run: `npm run tps:usage`._
REAL = live customers · TEST (`?test=1`/bots) excluded from every metric.

## Verdict
**EARLY SIGNAL — gathering (need ≥100 sessions & ≥30 exits before a launch verdict).**

## Funnel (REAL) — Search → Results → Product View → Comparison → Evidence → Outbound
| Step | Count | Conversion from prev |
|---|--:|--:|
| 1 Search | 152 | — |
| 2 Results | 113 | 74.3% |
| 3 Product View | 3 | 2.7% |
| 4 Comparison | 23 | 766.7% |
| 5 Evidence | 29 | 126.1% |
| 6 Outbound | 42 | 182.6% |

Off-funnel: no_answer=36, errors=3. Overall **Search→Outbound = 27.6%**.

## KPIs vs launch thresholds
| KPI | Actual | Threshold | Status |
|---|--:|--:|:--:|
| Answer rate | 74.3% | ≥ 80.0% | MISS |
| No-answer rate | 23.7% | ≤ 25.0% | PASS |
| Search→Product View | 2.0% | — | — |
| Product→Comparison | 766.7% | — | — |
| Comparison→Exit (CTR) | 182.6% | ≥ 8.0% | PASS |
| Search→Exit (overall) | 27.6% | ≥ 5.0% | PASS |
| Real sessions | 12 | ≥ 100 | MISS |
| Measured exits | 42 | ≥ 30 | PASS |

## By surface (REAL)
| Surface | Sessions | Search | Results | Outbound |
|---|--:|--:|--:|--:|
| landing | 12 | 0 | 0 | 0 |
| web | 4 | 121 | 87 | 0 |
| agent | 2 | 28 | 23 | 17 |
| product_page | 1 | 0 | 0 | 25 |
| search | 1 | 3 | 3 | 0 |

## Entry experiment — advisor-first vs search-first (REAL, session-level)
**INSUFFICIENT SAMPLE — need ≥50 sessions per arm to call a winner (min arm = 5).**

| Dimension | Advisor-first | Search-first |
|---|--:|--:|
| Sessions (n) | 5 | 7 |
| Search usage | 40.0% | 28.6% |
| Product views | 0.0% | 14.3% |
| Comparison usage | 20.0% | 14.3% |
| Evidence interaction | 20.0% | 14.3% |
| Outbound clicks | 0.0% | 14.3% |
| Session completion | 0.0% | 14.3% |
| Retention (≥2 days) | 20.0% | 14.3% |

_Champion is config-reversible via `NEXT_PUBLIC_BETA_ADVISOR_SPLIT` — flipping it needs no redesign._

## Top demand (REAL)
- (unparsed): 224
- air_conditioner: 15
- tv: 6
- laptop: 5
- mobile: 4
- dishwasher: 4
- vacuum: 2
- kitchen: 2
- microwave: 1
- air_fryer: 1
- washing_machine: 1

## Unmet demand — no-answer queries (REAL)
- 8× جوال ايفون ١٥ بروماكس
- 5× جوال ايفون ١٦
- 5× ايفون ١٦
- 2× جوال ايفون ١٦ برو ماكس
- 2× ايفون ١٧
- 2× ايفون ١٦ برو ماكس
- 1× غساله lg
- 1× قطاعة بصل
- 1× مكاوه
- 1× مكروويف

## Measured exits (outbound_clicks)
REAL: clicks=133, distinct_products=49, monetized=30.
(Storefront exits bypass /go and are counted via the `go_click` event in the funnel above, not here.)
