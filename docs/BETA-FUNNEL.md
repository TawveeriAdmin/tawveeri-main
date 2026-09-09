# Tawveeri — Private Beta Funnel Dashboard

_Generated 2026-09-09T02:59:16.000Z from production (`vyceqrzttspyycdpojtn`). Re-run: `npm run tps:usage`._
REAL = live customers · TEST (`?test=1`/bots) excluded from every metric.

## Verdict
**PUBLIC-LAUNCH SIGNAL: GREEN — all KPIs pass on a sufficient real sample.**

## Funnel (REAL) — Search → Results → Product View → Comparison → Evidence → Outbound
| Step | Count | Conversion from prev |
|---|--:|--:|
| 1 Search | 1339 | — |
| 2 Results | 1208 | 90.2% |
| 3 Product View | 52 | 4.3% |
| 4 Comparison | 30 | 57.7% |
| 5 Evidence | 224 | 746.7% |
| 6 Outbound | 4822 | 16073.3% |

Off-funnel: no_answer=108, errors=45. Overall **Search→Outbound = 9.1%**.

## KPIs vs launch thresholds
| KPI | Actual | Threshold | Status |
|---|--:|--:|:--:|
| Answer rate | 90.2% | ≥ 80.0% | PASS |
| No-answer rate | 8.1% | ≤ 25.0% | PASS |
| Search→Product View | 4.5% | — | — |
| Product→Comparison | 18.5% | — | — |
| Comparison→Exit (CTR) | 33.3% | ≥ 8.0% | PASS |
| Search→Exit (overall) | 9.1% | ≥ 5.0% | PASS |
| Real sessions | 525 | ≥ 100 | PASS |
| Measured exits | 4822 | ≥ 30 | PASS |

## By surface (REAL)
| Surface | Sessions | Search | Results | Outbound |
|---|--:|--:|--:|--:|
| landing | 403 | 0 | 0 | 0 |
| web | 314 | 1985 | 953 | 0 |
| search | 51 | 534 | 342 | 9 |
| product_page | 27 | 2 | 2 | 35 |
| search_card | 11 | 0 | 0 | 21 |
| category_page | 9 | 0 | 0 | 0 |
| post_search | 7 | 0 | 0 | 0 |
| home_mission_retaile | 5 | 0 | 0 | 5 |
| compare_featured | 5 | 0 | 0 | 5 |
| compare_all_offers | 4 | 0 | 0 | 6 |
| home_mission | 2 | 0 | 0 | 2 |
| agent | 2 | 28 | 23 | 17 |

## Entry experiment — advisor-first vs search-first (REAL, session-level)
**NO CLEAR WINNER YET — arms within 2pts on Search→Exit; keep gathering.**

| Dimension | Advisor-first | Search-first |
|---|--:|--:|
| Sessions (n) | 283 | 243 |
| Search usage | 53.7% | 46.9% |
| Product views | 5.3% | 4.9% |
| Comparison usage | 1.8% | 0.4% |
| Evidence interaction | 4.6% | 4.9% |
| Outbound clicks | 6.4% | 5.8% |
| Session completion | 6.4% | 5.8% |
| Retention (≥2 days) | 4.9% | 7.0% |

_Champion is config-reversible via `NEXT_PUBLIC_BETA_ADVISOR_SPLIT` — flipping it needs no redesign._

## Top demand (REAL)
- air_conditioner: 1312 (recorded 165, derived 1147)
- laptop: 564 (recorded 75, derived 489)
- mobile: 331 (recorded 22, derived 309)
- tablet: 326 (recorded 27, derived 299)
- refrigerator: 302 (recorded 21, derived 281)
- tv: 177 (recorded 29, derived 148)
- oven: 78 (recorded 4, derived 74)
- washing_machine: 77 (recorded 8, derived 69)
- cooker: 42 (recorded 1, derived 41)
- dishwasher: 32 (recorded 10, derived 22)
- appliance: 21 (recorded 21, derived 0)
- audio: 12 (recorded 3, derived 9)

## Unmet demand — no-answer queries (REAL)
- 8× تابلت هورنر
- 8× جوال ايفون ١٥ بروماكس
- 5× ايفون ١٦
- 5× جوال ايفون ١٦
- 3× laptop with 8gb ram under 2000
- 3× Ipad Honer
- 2× HONOR Pad X8a ايباد
- 2× Honer تابلت
- 2× Ipad Horno
- 2× Honor 600 تابلت

## Measured exits (outbound_clicks)
REAL: clicks=4822, distinct_products=863, monetized=1418.
(Storefront exits bypass /go and are counted via the `go_click` event in the funnel above, not here.)
