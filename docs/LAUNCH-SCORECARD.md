# Tawveeri — Launch-Readiness Dashboard

**Overall: 78/100** · updated 2026-08-02 19:52 UTC · ▲ 5 vs last run · run `npm run tps:launch-audit`

| Area | Cur | Tgt | Gap | Trend | Prio | Cust | Biz | Evidence |
|---|---|---|---|---|---|---|---|---|
| Product Coverage | 100 | 90 | -10 | → | P2 | M | M | 5398 published products |
| Category Coverage | 78 | 90 | +12 | → | P1 | H | H | 21/27 categories have a comparison |
| Brand Coverage | 15 | 60 | +45 | → | P2 | M | M | 72/467 brands have a comparison |
| Comparison Coverage | 16 | 30 | +14 | → | P0 | H | H | 883/5398 products multi-store (25% of those are 3+ store) |
| Specification Coverage | 70 | 95 | +25 | → | P2 | M | L | 70% canonicals carry structured attributes |
| Image Coverage | 86 | 95 | +9 | → | P1 | H | M | 86% published products imaged (ADR-113) |
| Image Quality | 100 | 95 | -5 | → | P1 | H | M | 0 placeholder images, 0 products on a heavily-shared image (ADR-119) |
| Search Quality | 96 | 98 | +2 | → | P1 | H | H | tps:search-quality retrieval 93→~100% (ADR-112), ranking 100% |
| Comparison Quality | 90 | 95 | +5 | → | P0 | H | H | corroboration-first ranking; 770 cards surface real savings (Σ≈501,512 SAR) |
| Canonical Accuracy | 79 | 90 | +11 | → | P1 | H | M | 1 duplicate cards; comparable-product avg confidence 93; 0 sentinel leaks (gate) |
| Customer Trust | 85 | 90 | +5 | → | P1 | H | H | deterministic evidence-cited trust engine live; named corroboration + data age |
| Performance | 98 | 90 | -8 | ↑3 | P1 | H | M | decide 916ms · search 474ms (warm median, incl. client RTT) |
| Data Freshness | 100 | 95 | -5 | ↑52 | P1 | M | M | 10/10 DISPLAYABLE retailers fresh (<48h); retired retailers excluded by design |
| Crawler Stability | 96 | 95 | -1 | ↑48 | P1 | M | M | 430/446 runs succeeded in 48h; 3 store(s) with a failed run |
| Affiliate Readiness | 80 | 80 | 0 | ↑25 | P2 | L | H | 2 programs verified AGAINST THE PROGRAM (ADR-181): amazon tag=tawveeri-21, noon utm_source=C1000094L |
| Commercial Readiness | 55 | 80 | +25 | → | P2 | L | H | every exit click-tracked; monetization state = direct/click-only until programs land |
| Monitoring | 75 | 90 | +15 | → | P2 | L | M | Sentry live; tps:health/search-quality/sentinel-check/launch-audit gates |
| Observability | 70 | 85 | +15 | → | P2 | L | M | scraping_runs, usage_events, scheduler stdout capture; no central dashboard yet |
| Recovery | 80 | 90 | +10 | → | P2 | L | M | ADR-099 incident playbook; immutable raw_observations; append-only price_history |
| Scalability | 80 | 90 | +10 | → | P2 | L | H | set-based projection (~12s); pooler; config-only onboarding; hourly chain |
| Security | 92 | 95 | +3 | → | P1 | L | H | tps:security-audit 100/100 (RLS on all 48 tables, 0 anon-reachable; ADR-117); credentials env-only, no hardcoded keys; pen-test not yet run |
| Maintainability | 85 | 90 | +5 | → | P2 | L | M | 689 tests; 114 ADRs; reusable adapters/analyzers (assessed) |
| Technical Debt | 75 | 85 | +10 | ↑5 | P2 | L | M | TS/ESLint errors ignored in build; noon/swsg repaired 2026-08-02 (ADR-179/180) (assessed) |

**P0 gaps:** Comparison Coverage

**P1 gaps:** Category Coverage, Image Coverage, Canonical Accuracy

_Overall trend: 69 → 71 → 71 → 74 → 75 → 76 → 76 → 73 → 78_
