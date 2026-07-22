# Catalog Completeness Gate

**Purpose:** a measurable, honest, by-store/by-category account of what Tawveeri's knowledge graph can and cannot compare — the objective basis for the E14 search-authority decision. Governed by the Constitution ("Unknown beats incorrect"; precision over recall) and the founder's completion directive ("Never claim 'all Saudi products are in the machine' without evidence").

**As of:** 2026-07-22 (post full-catalog saturation) · production `vyceqrzttspyycdpojtn` · read-only queries. Regenerate with the queries in `scripts/tps-test/`, `bulk-backfill`, and `build-tps-projection`.

---

## 1. Headline numbers (production, measured — FULL CATALOG PROCESSED)

Progressive batching (durable-cursor sweep + bulk backfill) has now processed **the entire catalog once** — 74→94 corroborated, and identity resolved for 812 distinct products. This is the **measured saturation**, not a first-slice estimate.

| Metric | Value |
|---|---|
| Raw observations scanned (all stores) | **133,447** (100%) |
| Valid identities staged (`tps_identity_staging`) | **22,583** |
| **Distinct products with resolved canonical identity** (6 sweep categories) | **812** |
| — of which **corroborated** (≥2-store, comparison-eligible) | **56** (sweep) |
| — of which **single-store** (resolved identity, one offer) | **756** |
| **Corroborated canonicals in projection** (incl. mobile) | **94** |
| Owned TPS index (`tawveeri_tps_products`) | **94** |
| Duplicate canonical keys | **0** |

**Truth statement:** the machine has **resolved identity for 812 products** and can **safely compare across stores 94** of them. The remaining ~718 (sweep) resolved products are genuinely **single-store** — a real, structural property of the Saudi 4-store market, not an unprocessed backlog. This is the evidence base for the E14 hybrid (Layer 1 = 94 comparable; Layer 2 = 812 resolved-single; Layer 3 = the rest as discovery).

---

## 2. By store (raw observations)

| Store | store_id | Observations | Adapter | Notes |
|---|---|---|---|---|
| Jarir | 1 | 50,856 (+4,111 under legacy label `jarir`) | ✅ enabled | data hygiene: two `store_name` labels (`جرير`/`jarir`); joins use `store_id` so counts are correct, but the text label should be unified |
| Extra | 4 | 40,740 | ✅ enabled | |
| Almanea | 5 | 34,580 | ✅ enabled | |
| Amazon | 2 | 2,029 | ✅ enabled | small but high-value (corroboration partner) |
| Noon / Samsung KSA / Shaker / SWSG | — | 0 | registered `enabled:false` | no ingestion yet (ADR-028) |

**4 data-bearing stores enabled; 4 registered-but-empty.** Corroboration is possible only where ≥2 of the four carry the same product.

---

## 3. By category — the five buckets

Every observation resolves to exactly one bucket. Counts are from `normalized_product_observations` (processed) + the category audits (full-catalog ceilings).

| Category | Live? | Corroborated canonicals | Identity contract | Evidence |
|---|---|---|---|---|
| **mobile** | ✅ | 38 | brand·family·gen·variant·storage | first category |
| **air_conditioner** | ✅ | 10 | brand·type·series·btu·tech·cool | ADR-022/023 |
| **tv** | ✅ | 8 | brand·size·res·panel·refresh | ADR-034 |
| **tablet** | ✅ | 8 | brand·line(+variant)·gen·storage·connectivity·size | ADR-035 |
| **audio** | ✅ | 7 | brand·model(+gen) | ADR-037 |
| **camera** | ✅ | 3 | brand·model(+variant)·config | ADR-038 |
| **laptop** | ⛔ built, 0 | 0 (correctly) | brand·model / brand·family·cpu·ram·storage·screen·gpu | ADR-032 — store-exclusive SKUs; 0 genuine cross-store matches |
| **appliance/refrigerator** | ⛔ deferred | 0 | — | structurally single-store (Extra-only) |
| **accessory** | excluded | n/a | — | never a main-product comparison |
| **unknown / not-yet-classified** | pending | n/a | — | 621 processed as unknown + 132,039 unprocessed |

**Classification of the whole catalog:**
1. **Safely comparable across ≥2 stores** — the **74** corroborated canonicals.
2. **Exists but single-store** — the large majority (laptop, appliances, and most long-tail SKUs). Genuinely present; not falsely comparable.
3. **Insufficient identity evidence** — parser-invalid / low-confidence observations (skipped, never guessed).
4. **Accessories / excluded** — 405+ classified accessories; excluded from main-product intent.
5. **Not yet processed** — 132,039 pending observations (see §4).

---

## 4. Progressive batching — SHIPPED & saturated

**Delivered** (migration 019 + `scripts/tps-core/{progressive-engine,category-registry}.ts` + `run-progressive.ts` + `bulk-backfill.ts`): NORMALIZATION (progressive, durable global per-store cursor, single id-indexed scan, ≤500/run for the scheduled sweep) is separated from CORROBORATION (global grouping by `identity_key` over the accumulated `tps_identity_staging`), so an early-slice product corroborates with a late-slice match. The initial saturation ran as a bulk pg-direct normalize (read+stage only, no canonical writes) then chunked corroboration through the verified `write_ac_batch`.

**Measured result:** 74 → **94 corroborated**; TV 8→16, tablet 8→16, AC 10→14; identity resolved for **812 products**. 0 duplicates. Every Milestone 7 invariant held (≤500 scheduled bound, category isolation, idempotency, rollback, ≥2-store + price-band).

**Saturation criterion (documented):** the full 133,447-observation catalog was scanned once; corroboration is now bounded by real cross-store overlap, not by unprocessed backlog. The durable cursor + `run-progressive.ts` handle **new** observations incrementally going forward (schedulable). Re-running is idempotent.

**Precision note:** the precise identity keys yield fewer corroborations than the loose proxy audits (e.g. TV 16 precise vs a ~39 loose-proxy estimate) — this is precision-over-recall working: the exact keys never over-merge sibling models. 94 is the honest, correct comparable-count.

---

## 5. E14 readiness verdict

**The owned index must NOT become the sole search authority** — that would collapse live search from a large discoverable catalog to 74 products. Evidence mandates a **hybrid / layered authority** (per the founder's E14 definition):

1. **TPS canonical + Smart Pick first** for the 74 (and growing) corroborated products.
2. **Discovery-only results** for single-store / not-yet-canonical products, **clearly labelled** "single-store · comparison unavailable" — no false comparison claim.
3. **Accessories** separated from main-product intent.
4. **Platform API v1** remains authoritative for identity, offers, exits, decisions.

**E14 is ready to design/implement on this basis** (hybrid), and is NOT blocked on reaching an impossible "every product multi-store" bar. Progressive batching (§4) grows bucket 1 over time without changing the architecture.

---

## 6. How this stays honest

- Numbers are direct production queries; regenerate before any E14/E15 verdict.
- "74 comparable" is stated as exactly that — not "all Saudi products."
- Single-store products are acknowledged as real and kept discoverable, never dropped or falsely compared.
- Every corroborated canonical is ≥2-store, price-band-guarded, and measured-exit-verified.
