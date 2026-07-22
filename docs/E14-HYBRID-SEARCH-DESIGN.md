# E14 — Hybrid Search Authority (design)

**Status:** design (implementation follows progressive-batching coverage measurement). **Authorized by:** founder completion directive (E14 "design the objectively best architecture supported by production evidence"). **Governed by:** Constitution (Canonical / Commercial Variant / Offer separation; precision over recall; no false comparison), ADR-001/002.

## 1. Problem & evidence

E14 was originally framed as "owned search index authority cutover." Production evidence (Catalog Completeness Gate) proves a **sole-index cutover is wrong**: cross-store corroboration is structurally small (tens–low-hundreds of products), while the discoverable catalog is ~132k observations. Making the owned index the *sole* authority would collapse live search to the corroborated set and hide most real products — a catastrophic recall regression and a violation of "no disappearance of the searchable catalog."

**Therefore E14 is a layered/hybrid authority**, not a replacement.

## 2. Architecture — three authorities, one contract

Search resolves through ordered layers; each item is explicitly typed and auditable:

| Layer | Source | Authority for | Item type |
|---|---|---|---|
| **1. Canonical (Smart Pick)** | owned TPS index `tawveeri_tps_products` (has_comparison) | **comparison** (multi-store price, savings, decision) | `canonical` · `comparison_available: true` |
| **2. Resolved-single** | canonical_products with `tps_identity_key` but `store_count < 2` | **identity** (known product, one offer) — future-ready | `canonical` · `comparison_available: false` |
| **3. Discovery** | existing catalog / live store search | **discoverability** only | `discovery` · `comparison_available: false`, labelled "single-store" |

- **Canonical Product / Commercial Variant / Offer stay separate** (ADR-001). A product may hold canonical identity **before** it has ≥2 offers (Layer 2) — identity confidence and comparison-eligibility are **explicit fields**, never conflated.
- **A second store attaches a new Offer to the existing identity** (via the identity_key → canonical upsert in `write_ac_batch`), never a duplicate product. Progressive batching already enforces this (deterministic `canonical:<cat>:<key>` id).
- **No false comparison:** only Layer 1 may render a multi-store comparison / "cheapest across N stores". Layers 2–3 render a single offer with an honest "comparison unavailable" state.
- **Accessories** are separated from main-product intent (existing detector logic) and never mixed into comparison.

## 3. API contract (v1, additive — no breaking change)

`GET /api/v1/tps/search?q=…` gains a layered response while preserving current fields:

```jsonc
{
  "version": "v1",
  "query": "…",
  "results": [ /* Layer 1 canonical, unchanged shape (comparison_available:true, offers[], decision) */ ],
  "discovery": [ /* Layers 2–3: {canonical_id?|null, title, brand, category, image, price?, store, comparison_available:false, kind:'resolved_single'|'discovery', go_url?} */ ],
  "meta": { "canonical_count": N, "discovery_count": M, "authority": "hybrid" }
}
```

Existing clients that read `results` keep working (Layer 1 only). Clients that render discovery opt in by reading `discovery`. Mobile/web render Layer 1 as Smart Pick and Layer 2–3 as labelled results.

## 4. Cutover plan (staged, rollback-tested)

1. **Shadow mode:** compute hybrid results alongside current search; log relevance/coverage deltas (AR/EN, brands, model numbers, typos, facets, empty states, latency, zero-result rate). **Gate: no material catalog disappearance** vs current.
2. **Canary:** enable hybrid on the platform API for a fraction of traffic; monitor `outbound_clicks`, zero-result rate, latency.
3. **Promote:** hybrid becomes the default platform search authority. Web/mobile consume it.
4. **Rollback:** feature flag reverts to the prior search path instantly; no data migration involved (read-side only).

## 5. Invariants (must hold)

- TPS precision unchanged — Layer 1 still ≥2-store, price-band-guarded, identity-keyed.
- No product merged on uncertain identity (Layers 2–3 never merge).
- The full discoverable catalog remains reachable (Layer 3).
- Every merchant exit stays measured via `/go` with absolute URLs (ADR-036).
- Constitution unchanged; this ADR records the architecture, trade-offs, rollback, compatibility.

## 6. Why this is the best architecture (evidence + global practice)

Mirrors how mature product-search/catalog platforms operate: an **authoritative canonical/offer graph for the resolved head**, plus **broad discovery for the long tail**, with explicit comparison-eligibility. It maximizes both **trust** (never a false comparison) and **recall** (nothing disappears), and it lets the corroborated head grow (progressive batching) without re-architecting. A sole-index cutover would optimize precision at a fatal recall cost; a discovery-only search would forfeit the comparison moat. Hybrid is the evidence-supported optimum.
