# CONSOLIDATED CHECKPOINT — Master Book Phase, Day 1
**2026-08-03 · Governed by `docs/TAWVEERI_MASTER_BOOK.md` v1.2 · All figures dated, all queries named · Re-measure before quoting (Book §0.1)**

---

## 1 · The five evidence answers

| Question | Figure | Method / query |
|---|---|---|
| Products actually visible (knowledge layer) | **5,426** | `select count(*) from tps_product_projection` |
| Products actually visible (storefront layer) | **9,754** (9,557 with an in-stock offer) | `products` / `product_stores.availability='in_stock'` |
| ≥2 approved retailers | **922** · displayable **912** | `scripts/tps-analysis/comparable-count.sql` (the named instrument for this figure) |
| ≥3 approved retailers | **236** · displayable **229** | same |
| True comparison rate | **16.8%** of projection (912/5,426) · 12.2% of canonicals-with-offer (912/7,572) | both denominators stated; the projection's own `has_comparison` flag reads 949 — different method, do not mix |

**`tps:comparison-value` is a different instrument** (per-category return-on-engineering; run
once deliberately: smartwatch 76.4% identified where comparison is possible, ~131 missing
listings across multi-merchant smartwatch brands). Neither figure may be presented as the other.

## 2 · Journeys — AR and EN separately, mobile first

Full `tps:ui-journey` runs against `https://tawveeri.com`, 2026-08-03. Logs:
`docs/ui-journey-adr193-mobile-2026-08-03.log` (390×844) · `docs/ui-journey-adr193-2026-08-03.log` (1366px).

| Viewport | Arabic | English | Overall | Comparison gate |
|---|---|---|---|---|
| **Mobile 390×844** | **33/38 (86.8%)** | **32/38 (84.2%)** | 65/76 = **85.5%** | 51/56 = **91.1%** |
| Desktop 1366px | 33/38 (86.8%) | 32/38 (84.2%) | 65/76 = 85.5% | 51/56 = 91.1% |

Mobile and desktop are **identical** — the harness checks server-rendered data claims, which do
not vary by viewport. Do not read 91.1% against July's 93.8% as a trend: the comparison journey
set grew 48 → 56 and the homepage leg entered the denominator.

**The 11 failures, enumerated (every one pre-dates this phase's changes):**
1. `ps5` (ar+en): a Z-EDGE monitor card claims 2 stores with no compare link, and its outbound
   link is DEAD (the run's only 2 dead links out of 76).
2. `washing machine` (ar+en, English wording): top pick is a **coffee machine** — "machine"
   token relevance defect.
3. `ميكروويف` (ar+en): two Royal microwave cards claim 2 stores with no compare link.
4. `lg tv` (en): no store name on the card.
Unhonoured store-count claims overall: 6 cards on 4 of 58 pages. Cross-language picks: the 19
"mismatches" are the same products under ADR-185 localized names — instrument string-comparison
limit, not a defect. Live search-intent gate: **54/54 PASS** (`unified-search-verify.js`), both locales.

## 3 · The stale-cheapest rate — and its correction (ADR-194)

**Price-change basis (what the platform's surfaces were reading):** 688/915 = **75.2%** of
displayable comparables' cheapest offers "older than 7 days". Query (production, frozen
2026-08-03T13:43:31Z): latest `price_history` row per (canonical, approved slug) via the
`comparable-count.sql` store map → cheapest per canonical → `observed_at < now() - interval '168 hours'`.

**Observation basis (the truth, ADR-194):** `price_history` is append-only on **changed** prices,
so its `observed_at` is price-change time. Re-measured from `normalized_product_observations`
(a row per observation): comparables' median true freshness **19.3h** · 488/917 within 24h ·
only **81 products / 158 cheapest-offer pairs** truly unobserved >7d — concentrated in
**amazon (111 pairs — not in the re-observation loop)** and **jarir (42 — same)**. Of the 688
"stale" pairs, **212 (31%) had been observed within 24h**: false staleness. Fixed this session:
projection `last_observed_at` and the search Smart Pick now read observation time (ADR-194);
the compare page's per-offer line is the owed follow-up.

## 4 · U4 — the exact unblocking event

The 55 refused duplicate pairs (ADR-184) merge **when and only when a second identity evidence
source exists with measured precision**: concretely, the unblocking event is *either*
(a) an image-hash equality signal (perceptual hash of both sides' images) hand-audited at
**100% precision on a 50-pair sample** before any merge, *or* (b) a structured-feed identifier
(SKU/GTIN from a provider feed) matching on both sides. The ADR-176 gate (same model literally
in raw evidence on both sides) is **not** weakened to clear the queue; GTIN via Icecat is
already measured dead (12% hit, brand-restricted) and does not qualify.

## 5 · Shipped this session
- **ADR-193** (`007fc32`): observation time at the point of claim; pick label withheld >168h.
  Verified in production **at the exact boundary** (card present at 167.98h, withheld minutes later).
- **ADR-194** (this commit): freshness surfaces read observations, not price changes.
- Master Book v1.2 committed + Appendix E (external evidence: no incumbent shows per-offer
  freshness; Kanbkam qualifies Saudi uniqueness claims; "discover in AI, buy on site" won).
- Instrument rules earned: PowerShell mangles Arabic bodies (`????`); harness viewport flag added.

## 6 · U2 — baseline frozen, thresholds stated in advance
**Baseline (2026-08-03T13:43:31Z):** comparable 915 · price-change-basis median 104.4h ·
cheapest >7d 688. **Observation-basis (13:49:26Z):** median 19.3h · true-stale 81 products.

**Acceptance thresholds, set before landing:**
1. **U2a (signal fix, this commit):** after the next hourly chain tick, the projection-based
   median freshness for displayable comparables reads **≤24h** (predicted 19.3h); the advisor
   gate stops withholding picks that were observed within 168h; the search card's «آخر رصد»
   shows observation time (spot-check: the «مكيف» Gree pick, 219h on price-change basis).
2. **U2b (true cadence tail, next):** the 158 truly-unobserved cheapest pairs fall below **50**
   within a week of the cadence change; lever order by measured concentration — jarir (42) into
   the price-update loop first (config), then the amazon decision (111) on cost per observation
   vs seeded discovery at its measured 7.1%.
