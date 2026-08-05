# Tawveeri — Private Beta Funnel Dashboard

_Generated 2026-08-05T14:31:19.000Z from production (`vyceqrzttspyycdpojtn`). Re-run: `npm run tps:usage`._
REAL = live customers · TEST (`?test=1`/bots) excluded from every metric.

## Verdict
**EARLY SIGNAL — gathering (need ≥100 sessions & ≥30 exits before a launch verdict).**

## Funnel (REAL) — Search → Results → Product View → Comparison → Evidence → Outbound
| Step | Count | Conversion from prev |
|---|--:|--:|
| 1 Search | 489 | — |
| 2 Results | 217 | 44.4% |
| 3 Product View | 15 | 6.9% |
| 4 Comparison | 23 | 153.3% |
| 5 Evidence | 60 | 260.9% |
| 6 Outbound | 49 | 213.0% |

Off-funnel: no_answer=39, errors=9. Overall **Search→Outbound = 10.0%**.

## KPIs vs launch thresholds
| KPI | Actual | Threshold | Status |
|---|--:|--:|:--:|
| Answer rate | 44.4% | ≥ 80.0% | MISS |
| No-answer rate | 8.0% | ≤ 25.0% | PASS |
| Search→Product View | 3.1% | — | — |
| Product→Comparison | 153.3% | — | — |
| Comparison→Exit (CTR) | 213.0% | ≥ 8.0% | PASS |
| Search→Exit (overall) | 10.0% | ≥ 5.0% | PASS |
| Real sessions | 36 | ≥ 100 | MISS |
| Measured exits | 49 | ≥ 30 | PASS |

## By surface (REAL)
| Surface | Sessions | Search | Results | Outbound |
|---|--:|--:|--:|--:|
| landing | 31 | 0 | 0 | 0 |
| web | 18 | 314 | 161 | 0 |
| search | 6 | 147 | 33 | 1 |
| product_page | 3 | 0 | 0 | 31 |
| agent | 2 | 28 | 23 | 17 |

## Entry experiment — advisor-first vs search-first (REAL, session-level)
**INSUFFICIENT SAMPLE — need ≥50 sessions per arm to call a winner (min arm = 17).**

| Dimension | Advisor-first | Search-first |
|---|--:|--:|
| Sessions (n) | 17 | 19 |
| Search usage | 58.8% | 42.1% |
| Product views | 0.0% | 15.8% |
| Comparison usage | 5.9% | 5.3% |
| Evidence interaction | 11.8% | 15.8% |
| Outbound clicks | 0.0% | 15.8% |
| Session completion | 0.0% | 15.8% |
| Retention (≥2 days) | 11.8% | 10.5% |

_Champion is config-reversible via `NEXT_PUBLIC_BETA_ADVISOR_SPLIT` — flipping it needs no redesign._

## Top demand (REAL)
- (unparsed): 635
- air_conditioner: 39
- laptop: 7
- dishwasher: 6
- tv: 6
- mobile: 5
- vacuum: 2
- kitchen: 2
- washing_machine: 2
- microwave: 1
- air_fryer: 1

## Unmet demand — no-answer queries (REAL)
- 8× جوال ايفون ١٥ بروماكس
- 5× ايفون ١٦
- 5× جوال ايفون ١٦
- 2× جوال ايفون ١٦ برو ماكس
- 2× مكيف لغرفة 30 متر هادئ تحت 4000
- 2× ايفون ١٦ برو ماكس
- 2× ايفون ١٧
- 1× قطاعة بصل
- 1× لابتوب للألعاب تحت 5000
- 1× مكاوه

## Measured exits (outbound_clicks)
REAL: clicks=197, distinct_products=73, monetized=43.
(Storefront exits bypass /go and are counted via the `go_click` event in the funnel above, not here.)
