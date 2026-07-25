# E15.5 — Final Production Gate Report

**Verdict:** **PASS (technical gate) · PARTIAL (real-user proof)** — see criteria below.
**Evidence timestamp:** `2026-07-25T08:38:41Z` · **Environment:** production `vyceqrzttspyycdpojtn` (read-only).
**Reproduce (exact command):** `npm run tps:gate-audit` → `scripts/tps-analysis/e15-5-gate-audit.ts`. Every number below is the output of a named query in that script; re-running reproduces it against live production.
**Rule:** unknown stays unknown. Where a metric could not be computed, it is marked UNKNOWN with the reason.

---

## Headline evidence (each tied to its query)

| # | Metric | Value | Query (in `e15-5-gate-audit.ts`) |
|---|---|---|---|
| 1 | Total raw observations | **164,687** | `select count(*) from raw_observations` |
| 2 | Total canonical products | **5,305** (3,027 with `tps_identity_key`) | `select count(*) from canonical_products [where tps_identity_key is not null]` |
| 3 | Published / searchable products | **3,027** (2,802 with image; 3,027 with `compare_url`) | `select count(*) from tps_product_projection …` |
| 4 | Comparable (≥2 valid store offers) | **295** | `… where has_comparison` |
| 5 | Comparison depth | **1-store 2,732 · 2-store 251 · 3-store 40 · 4-store 4** | `group by store_count` |
| 6 | Coverage (store/category/brand/price) | see below | §6 of the script |
| 7 | Freshness (store/category) | 6/8 stores < 3h; noon 61.7h, swsg 59.4h | §7 |
| 8 | Identity accuracy / unresolved | conf 90–100: 213 · 75–89: 2,520 · 50–74: 271 · <50: 23 · **unresolved normalized (no canonical): 2,133** | §8 |
| 9 | Offer validity | **59,816 offers**, 57,680 with URL; **72,497** price-history rows (2,912 fresh <24h) | §9 |
| 10 | Full-chain reachability | 295 comparable → **295 have compare_url · 289 have image · 254 have ≥2 offers with a `/go` offer_id** · 73 outbound_clicks | §10 |

### 6 — Coverage detail (comparable per category)
mobile **74**, washing_machine **35**, tablet **34**, air_conditioner **27**, tv **27**, monitor **22**, smartwatch **22**, audio **13**, laptop **11**, dishwasher 8, refrigerator 7, printer 7, vacuum 4, xiaomi/camera 3, coffee_maker 1; kettle/microwave/blender/air_fryer/oven/toaster/air_purifier 0.
Comparable per brand (top): samsung **85**, apple **55**, midea 24, huawei 21, lg 20, tcl 9, hisense/hp 6, lenovo/asus 5.
Comparable by price band (SAR): <500 → 38 · 500–1,500 → 97 · 1,500–3,000 → 88 · 3,000–6,000 → 57 · 6,000+ → 15.

### 7 — Freshness detail (hours since newest observation)
jarir 0.8h · samsung_ksa 0.7h · shaker 0.7h · amazon 2.5h · extra 2.6h · almanea 2.7h · **noon 61.7h (stale)** · **swsg 59.4h (stale)**.

---

## Corrections to the Founder Review Package
The Founder Review Package (2026-07-25, earlier same day) cited **295 comparable / 5,305 canonicals / 162,567 raw obs / 3,027 projection**. The gate audit a few hours later shows **164,687 raw obs** and **59,816 offers** (ongoing ingestion; comparable still **295**, projection still **3,027**). No headline conclusion changes; the raw-observation figure is refreshed here to the audited value. All other Review-Package numbers reconcile.

## Two honest data-integrity notes (unknown stays unknown)
1. **`raw_observations.processing_status` is NOT the pipeline's completion signal.** It reads `pending 164,410 / done 277`, but normalization is **cursor-based** (`normalize-incremental.ts`), not status-driven — it does not stamp this legacy column per row. The real "unresolved identity" measure is **§8c: 2,133 normalized observations with no canonical link**. Do not read `processing_status=pending` as a 164K backlog; it is a stale field. *(Follow-up: either wire the status column or drop it to remove the misleading signal.)*
2. **Store distinct-product counts via `payload->>'product_url'`** read 0 for extra/almanea because those adapters store the listing URL under a different payload key; their coverage is real (44,586 / 38,780 observations, fresh < 3h) and flows to canonicals — the 0 is a measurement artifact of this one query, flagged not hidden.

---

## Gate criteria — assessment

**PASS (technical E15.5 gate — Stage-1 Decision Agent + coverage + honest identity):**
- ✅ Deterministic Stage-1 Decision Agent **live in production and publicly surfaced** (`/api/v1/agent/decide` + the `/advisor` page).
- ✅ **295 real ≥2-store comparisons**, 254 fully reachable to a measured `/go` exit; 0 fabricated comparisons (precision-over-recall enforced).
- ✅ Coverage across **6+ live comparison categories** (mobile, ac, tv, tablet, washing_machine, monitor, smartwatch, audio, laptop…).
- ✅ Freshness healthy for 6/8 stores (< 3h); honest single-store labelling for the rest of the catalog.
- ✅ Offer/price evidence real and append-only (72,497 price rows).

**PARTIAL (real-user proof — the subject of the current execution directive):**
- ⚠️ **0 real users; 73 outbound clicks are test traffic.** Real-vs-test instrumentation not yet in place → addressed in this directive (Part 6).
- ⚠️ **Measured `/go` exits are agent-only**; product cards / product-detail store links currently bypass `/go` → being unified in this directive (Part 5).
- ⚠️ **noon & swsg stale** (>48h); noon is anti-bot-blocked (deliberate), swsg low-yield.
- ⚠️ **2,133 unresolved normalized identities** in the queue (honest backlog; does not corrupt the 295 — corroboration gates every merge).

**Conclusion:** the E15.5 *technical* gate is **PASS** — the decision layer, comparison graph, and evidence pipeline are real, fresh, and production-verified. E15.5 is **not yet closed on real-user proof**, which is precisely what this execution directive delivers before formal E16. Per the mandated phase order, **E16 is not opened formally until the real-user loop + instrumentation below are production-verified.**
