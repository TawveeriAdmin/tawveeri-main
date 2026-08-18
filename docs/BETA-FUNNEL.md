# Tawveeri — Private Beta Funnel Dashboard

_Generated 2026-08-18T07:39:54.000Z from production (`vyceqrzttspyycdpojtn`). Re-run: `npm run tps:usage`._
REAL = live customers · TEST (`?test=1`/bots) excluded from every metric.

## Verdict
**IMPROVE BEFORE PUBLIC LAUNCH — failing: Search→Exit ≥ 5.0%**

## Funnel (REAL) — Search → Results → Product View → Comparison → Evidence → Outbound
| Step | Count | Conversion from prev |
|---|--:|--:|
| 1 Search | 803 | — |
| 2 Results | 746 | 92.9% |
| 3 Product View | 30 | 4.0% |
| 4 Comparison | 28 | 93.3% |
| 5 Evidence | 183 | 653.6% |
| 6 Outbound | 561 | 2003.6% |

Off-funnel: no_answer=63, errors=29. Overall **Search→Outbound = 3.5%**.

## KPIs vs launch thresholds
| KPI | Actual | Threshold | Status |
|---|--:|--:|:--:|
| Answer rate | 92.9% | ≥ 80.0% | PASS |
| No-answer rate | 7.8% | ≤ 25.0% | PASS |
| Search→Product View | 4.7% | — | — |
| Product→Comparison | 50.0% | — | — |
| Comparison→Exit (CTR) | 40.0% | ≥ 8.0% | PASS |
| Search→Exit (overall) | 3.5% | ≥ 5.0% | MISS |
| Real sessions | 321 | ≥ 100 | PASS |
| Measured exits | 561 | ≥ 30 | PASS |

## By surface (REAL)
| Surface | Sessions | Search | Results | Outbound |
|---|--:|--:|--:|--:|
| landing | 287 | 0 | 0 | 0 |
| web | 182 | 1297 | 574 | 0 |
| search | 27 | 415 | 225 | 1 |
| product_page | 8 | 2 | 2 | 33 |
| home_mission_retaile | 5 | 0 | 0 | 5 |
| agent | 2 | 28 | 23 | 17 |
| search_card | 1 | 0 | 0 | 1 |
| home_mission | 1 | 0 | 0 | 1 |

## Entry experiment — advisor-first vs search-first (REAL, session-level)
**NO CLEAR WINNER YET — arms within 2pts on Search→Exit; keep gathering.**

| Dimension | Advisor-first | Search-first |
|---|--:|--:|
| Sessions (n) | 168 | 153 |
| Search usage | 56.5% | 49.7% |
| Product views | 1.8% | 3.3% |
| Comparison usage | 2.4% | 0.7% |
| Evidence interaction | 6.0% | 6.5% |
| Outbound clicks | 4.2% | 3.3% |
| Session completion | 4.2% | 3.3% |
| Retention (≥2 days) | 5.4% | 5.9% |

_Champion is config-reversible via `NEXT_PUBLIC_BETA_ADVISOR_SPLIT` — flipping it needs no redesign._

## Top demand (REAL)
- air_conditioner: 1047 (recorded 101, derived 946)
- laptop: 370 (recorded 63, derived 307)
- mobile: 280 (recorded 15, derived 265)
- refrigerator: 231 (recorded 7, derived 224)
- tv: 82 (recorded 9, derived 73)
- washing_machine: 66 (recorded 7, derived 59)
- tablet: 47 (recorded 8, derived 39)
- dishwasher: 28 (recorded 9, derived 19)
- audio: 8 (recorded 0, derived 8)
- microwave: 6 (recorded 1, derived 5)
- vacuum: 4 (recorded 2, derived 2)
- camera: 2 (recorded 0, derived 2)

## Unmet demand — no-answer queries (REAL)
- 19× مكيف لغرفة 30 متر هادئ تحت 4000
- 8× جوال ايفون ١٥ بروماكس
- 5× ايفون ١٦
- 5× أبي لابتوب للجامعة والبرمجة تحت 4000
- 5× جوال ايفون ١٦
- 4× ابي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000 ريال وما 
- 4× laptop with 8gb ram under 2000
- 4× ابي لابتوب للألعاب أداءه قوي وشاشته حلوة وميزانيتي 5000 ريال
- 3× أبي لابتوب للألعاب أداءه قوي وشاشته حلوة وميزانيتي 5000 ريا
- 3× ابي مكيف بسعر رخيص وجودته عاليه

## Measured exits (outbound_clicks)
REAL: clicks=561, distinct_products=167, monetized=155.
(Storefront exits bypass /go and are counted via the `go_click` event in the funnel above, not here.)
