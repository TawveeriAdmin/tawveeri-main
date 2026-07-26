# Tawveeri — Launch-Readiness Dashboard

**Overall: 76/100** · updated 2026-07-26 12:33 UTC · ▲ 1 vs last run · run `npm run tps:launch-audit`

| Area | Cur | Tgt | Gap | Trend | Prio | Cust | Biz | Evidence |
|---|---|---|---|---|---|---|---|---|
| Product Coverage | 90 | 90 | 0 | → | P2 | M | M | 4070 published products |
| Category Coverage | 77 | 90 | +13 | → | P1 | H | H | 20/26 categories have a comparison |
| Brand Coverage | 14 | 60 | +46 | → | P2 | M | M | 49/350 brands have a comparison |
| Comparison Coverage | 14 | 30 | +16 | → | P0 | H | H | 580/4070 products multi-store (21% of those are 3+ store) |
| Specification Coverage | 64 | 95 | +31 | → | P2 | M | L | 64% canonicals carry structured attributes |
| Image Coverage | 94 | 95 | +1 | → | P1 | H | M | 94% published products imaged (ADR-113) |
| Image Quality | 100 | 95 | -5 | · | P1 | H | M | 0 placeholder images, 0 products on a heavily-shared image (ADR-119) |
| Search Quality | 96 | 98 | +2 | → | P1 | H | H | tps:search-quality retrieval 93→~100% (ADR-112), ranking 100% |
| Comparison Quality | 90 | 95 | +5 | → | P0 | H | H | corroboration-first ranking; 490 cards surface real savings (Σ≈248,730 SAR) |
| Canonical Accuracy | 79 | 90 | +11 | → | P1 | H | M | 1 duplicate cards; comparable-product avg confidence 93; 0 sentinel leaks (gate) |
| Customer Trust | 85 | 90 | +5 | → | P1 | H | H | deterministic evidence-cited trust engine live; named corroboration + data age |
| Performance | 97 | 90 | -7 | → | P1 | H | M | decide 968ms · search 472ms (warm median, incl. client RTT) |
| Data Freshness | 90 | 95 | +5 | → | P1 | M | M | 19/21 stores fresh (<48h) |
| Crawler Stability | 90 | 95 | +5 | → | P1 | M | M | 2 known-broken scrapers (noon/swsg); feed adapters stable |
| Affiliate Readiness | 55 | 80 | +25 | → | P2 | L | H | framework config-only ready; /go measured; 0 ACTIVE programs (needs Founder enrollment) |
| Commercial Readiness | 55 | 80 | +25 | → | P2 | L | H | every exit click-tracked; monetization state = direct/click-only until programs land |
| Monitoring | 75 | 90 | +15 | → | P2 | L | M | Sentry live; tps:health/search-quality/sentinel-check/launch-audit gates |
| Observability | 70 | 85 | +15 | → | P2 | L | M | scraping_runs, usage_events, scheduler stdout capture; no central dashboard yet |
| Recovery | 80 | 90 | +10 | → | P2 | L | M | ADR-099 incident playbook; immutable raw_observations; append-only price_history |
| Scalability | 80 | 90 | +10 | → | P2 | L | H | set-based projection (~12s); pooler; config-only onboarding; hourly chain |
| Security | 92 | 95 | +3 | → | P1 | L | H | tps:security-audit 100/100 (RLS on all 48 tables, 0 anon-reachable; ADR-117); credentials env-only, no hardcoded keys; pen-test not yet run |
| Maintainability | 85 | 90 | +5 | → | P2 | L | M | 689 tests; 114 ADRs; reusable adapters/analyzers (assessed) |
| Technical Debt | 70 | 85 | +15 | → | P2 | L | M | TS/ESLint errors ignored in build; 2 dead scrapers; noon/swsg (assessed) |

**P0 gaps:** Comparison Coverage

**P1 gaps:** Category Coverage, Canonical Accuracy

_Overall trend: 69 → 71 → 71 → 74 → 75 → 76_
