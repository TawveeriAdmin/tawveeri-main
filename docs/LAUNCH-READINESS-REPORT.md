# Tawveeri — Launch-Readiness Report

**Status:** pre-launch assessment · **Overall readiness: 76/100** (trend 69→71→74→75→76) · generated from measured production evidence. This is a **readiness assessment, not a launch-go** — the launch recommendation is at the end.

Live scorecard: `docs/LAUNCH-SCORECARD.md` (`npm run tps:launch-audit`). Every claim below is re-measurable via a named `tps:*` command.

---

## 1. Executive summary
Tawveeri has evolved from a scraper collection into a **measurable Saudi electronics product-intelligence platform**: 22 config-only-onboarded retailers, a canonical knowledge graph with deterministic evidence-cited trust, and a clean, fast, secure customer surface. **The engineering is in strong, largely production-ready shape.** The gating weakness is **comparison coverage (14%)**, which is **merchant-data-access-bound, not engineering-bound** — ~89% of Saudi electronics products are carried by a single accessible merchant, so more code or more small retailers cannot manufacture comparisons that don't exist in the data.

## 2. Scorecard (measured)
| Green (≥ target) | Score |
|---|---|
| Performance (warm decide 1.1s) · Search Quality (100% ranking) · Image Coverage 94% · **Image Quality 100%** · Comparison Quality · Customer Trust · Data Freshness · Crawler Stability · Maintainability · **Security 100/100** · Product Coverage | — |
| **Gaps** | |
| Comparison Coverage | 14% (P0) |
| Category Coverage | 77% (P1) |
| Canonical Accuracy | 79 (P1, near target) |
| Affiliate / Commercial Readiness | 55 (P2, **Founder-gated**) |
| Observability | 70 (P2) |

## 3. Strengths (with evidence)
- **Trustworthy comparisons.** Corroboration-first ranking; 0 sentinel leaks (`tps:sentinel-check`); a live 6-store AC comparison renders clean names + real SAR prices + images. ~488 comparison cards surface **≈248,000 SAR** of customer savings.
- **Fast + consistent.** decide 5.2s→**1.1s** warm (parallelized reads + per-category cache); search ~0.5s.
- **Secure.** `tps:security-audit` **100/100** — RLS on all 48 tables, 0 anon-reachable, credentials env-only (2 exposed tables found + fixed, ADR-117).
- **Clean imagery.** 94% coverage; 117 fake lazy-load placeholders purged, 0 remaining (ADR-119).
- **Reusable acquisition machine.** Config-only onboarding across Salla (storefront API) · Zid · WooCommerce · Shopify · Algolia; `tps:acquire`/`category-coverage`/`store-impact` make every onboarding measured.
- **Self-improving + documented.** 119 ADRs, 689 tests, a permanent trend-tracking dashboard, and standing quality gates.

## 4. Weaknesses & gaps (with impact)
| Gap | Status | Customer | Business | Root cause |
|---|---|---|---|---|
| **Comparison Coverage 14%** | 536 comparable / 6,368 canonicals | HIGH | HIGH | **Merchant-data-access-bound** — ~89% single-store; the accessible free merchants don't overlap enough. Recent onboarding delivered 61 net-new but the tail is genuinely single-store. |
| **Category Coverage 77%** | vacuum/audio shallow | MED-HIGH | MED | Same — specialists' products often don't corroborate (single-store or model-naming mismatch). |
| **Commercial Readiness 55** | 0 active affiliate programs | LOW | HIGH | **Founder enrollment required** — framework is config-only ready; exits already click-tracked. |
| Canonical Accuracy 79 | comparable confidence 93 | HIGH | MED | Near target; marginal identity gains left. |
| Observability 70 | no central metrics dashboard | LOW | MED | Tooling exists (health/audit gates) but no unified live dashboard. |

## 5. Remaining risks
- **R1 — Comparison depth plateau (MED/known).** Free data has a ceiling; growth beyond needs paid data access or overlapping-SKU merchant credentials. *Mitigation:* accept the ceiling for launch (the comparisons we DO have are high-quality), and expand post-launch as merchant relationships open.
- **R2 — 2 broken scrapers (LOW).** noon + swsg stale (>3.5d, API-change); small stores, deliberately deferred. *Mitigation:* their data is labelled by freshness; low ROE to fix now.
- **R3 — Cold-start latency (LOW).** First request per category ~3s (warm 1.1s). *Mitigation:* two-stage retrieval post-launch; warm path dominates under traffic.
- **R4 — No real-user validation (EXPECTED).** All instrumented (`tps:usage`) but 0 real sessions pre-launch. *Mitigation:* validate the funnel the moment traffic arrives.

## 6. Prioritized recommendations
1. **P0 — Accept the comparison-coverage ceiling for launch OR authorize paid discovery.** The 536 comparisons are trustworthy and cover the core categories; this is a Founder pace decision, not an engineering fix.
2. **P1 — Founder: enroll in affiliate programs** (Amazon Creators + KSA networks) → the platform activates monetization with **no architectural change** (framework ready).
3. **P2 — Post-launch polish:** two-stage retrieval (cold-path), a central observability dashboard, revive noon/swsg if ROE justifies.
4. **Ongoing:** continue free config-only gap-fill as new overlapping-SKU merchants surface; the engine makes it near-zero-cost.

## 7. Genuine Founder Approval Boundaries
- **Commercial activation** — only the Founder can enroll in affiliate programs. Everything else is built.
- **Comparison-coverage pace** — free gap-fill has reached its data ceiling; further depth is a paid-data / merchant-relationship decision.

## 8. Launch recommendation
**Not yet a full launch-go, but engineering-ready.** The platform can confidently launch as a **trustworthy, fast, secure Saudi electronics comparison experience** on its current 536 high-quality comparisons — the honest constraint is breadth of comparisons, which is a data-access reality, not a quality or stability defect. **Recommended:** a **soft/beta launch now** to begin real-user funnel validation (`tps:usage`), while comparison breadth grows post-launch through merchant relationships and (optionally) paid data. No critical production defects remain: security clean, customer surface clean, performance green, images clean, 0 sentinel leaks.
