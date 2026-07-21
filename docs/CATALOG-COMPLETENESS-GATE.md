# Catalog Completeness Gate

**Purpose:** a measurable, honest, by-store/by-category account of what Tawveeri's knowledge graph can and cannot compare — the objective basis for the E14 search-authority decision. Governed by the Constitution ("Unknown beats incorrect"; precision over recall) and the founder's completion directive ("Never claim 'all Saudi products are in the machine' without evidence").

**As of:** 2026-07-22 · production `vyceqrzttspyycdpojtn` · read-only queries. Regenerate with the queries in `scripts/tps-test/` and `build-tps-projection`.

---

## 1. Headline numbers (production, measured)

| Metric | Value |
|---|---|
| Raw observations (all stores) | **132,316** |
| Observations processed into TPS (`processing_status='done'`) | **277** (0.2%) |
| Observations pending | **132,039** |
| Canonical products (all, incl. legacy pre-TPS) | 2,203 |
| **Corroborated canonicals in projection** (`has_comparison=true`) | **74** |
| Owned TPS index (`tawveeri_tps_products`) | **74** |
| TPS-linked price rows | 162 |

**Truth statement:** the machine can *safely compare across stores* **74 products** today. This is the corroboration ceiling **of the processed slice**, not of the catalog — see §4 (progressive batching) for the gap.

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

## 4. The coverage gap — progressive batching (top E14 enabler)

Each category ran **one** bounded ≤500 batch. The full-catalog corroboration audits show more corroboration exists than the first slice captured — e.g. **TV ≈39 corroboration pairs** exist vs **8** captured; **tablet ≈13** vs 8. The remainder sits in **later observation slices**.

**Current limitation:** the matchers fetch `order by id limit perStore` — always the **same first slice** — so re-running is idempotent, not progressive. Marking written observations `done` is not enough (the non-matching majority in the slice stay `pending` and are re-fetched).

**Next action (highest-leverage for coverage):** add a **cursor / `processing_status`-aware fetch** so repeated bounded batches advance through the catalog. Expected effect: grow the corroborated set from 74 toward the true multi-store ceiling (low hundreds, not thousands — most products remain single-store). This is the mechanism the founder's directive calls for ("bounded repeatable batches, not only one initial 500").

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
