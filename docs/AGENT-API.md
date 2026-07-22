# Tawveeri Agent & Intelligence API (E15.5)

**Status:** production (System A). All endpoints are deterministic, ranking-blind, evidence-grounded. Deterministic engines decide; LLMs (later) only phrase (ADR-002). Governed by the Constitution + ADR-043/044.

**Neutrality guarantee:** ranking uses ONLY suitability + trust (corroboration) + total cost + identity confidence — never commission/affiliate/revenue (proven: `docs/REVENUE-NEUTRALITY-AUDIT.md`, static-guard test). Every merchant exit is measured via `/go`.

---

## 1. Stage-1 Decision Agent — `POST /api/v1/agent/decide`

Takes a **shopping task** (structured or free text) and returns a neutral, explainable, total-cost-aware ranked recommendation over the TPS canonical graph + Product DNA.

**Body (either form):**
```jsonc
// structured
{ "category":"air_conditioner", "room_size_m2":30, "city":"Riyadh",
  "priorities":["quiet","low_electricity"], "budget_total":4000 }
// or free text (deterministically parsed; explicit fields override)
{ "text":"مكيف لغرفة 30 متر في الرياض هادئ وموفر للكهرباء تحت 4000" }
// tablet/mobile also accept: connectivity_needed, storage_min, use[]; laptop: ram_min, storage_min
```

**Supported categories (bespoke deciders):** `air_conditioner` (KSA-hot BTU sizing + total cost incl. installation + est. electricity), `tv` (gaming→refresh, movies→panel quality), `tablet` (connectivity, storage, use-fit), `mobile` (variant tier for camera/battery, generation recency, storage), `laptop` (gaming→discrete GPU+RAM, productivity→RAM+CPU, portability→screen), `refrigerator` (24/7 electricity in TCO, inverter efficiency, capacity-for-household), `washing_machine` (front-load + inverter efficiency, washer/dryer combo intent). Appliances and laptops are structurally single-store in KSA (Extra/store-dominant) — surfaced honestly with `comparison_available:false`, never fabricated corroboration. Other categories → **neutral trust+price fallback** (`supported:false`) — no fabricated suitability.

**Response (shape):**
```jsonc
{ "version":"v1", "task":{…}, "parsed":{…,"unresolved":["…"]}, "supported":true,
  "engine":"deterministic", "neutrality":"ranking-blind (…; no commission)",
  "count":6, "smart_pick":{…},
  "recommendations":[ { "canonical_id","title_ar","brand","unit_price",
    "total_cost_estimate","cost_breakdown":{"unit","installation","annual_electricity"},
    "store_count","comparison_available","suitability_score","confidence",
    "is_smart_pick","reasons_ar":["…"],"dna":{…},"go_url":"/go/{offer}" } ] }
```

**Guarantees:** no fabrication (e.g. an undersized AC is *flagged*, not hidden); `confidence` reflects corroboration, never fabricated; `reasons_ar` explain each score; single-store items labelled honestly. Free-text `parsed.unresolved[]` reports fields it could not extract (fail-loud).

---

## 2. Protocol export (UCP-compatible) — `GET /api/v1/protocol/ucp/feed`

Exposes the canonical graph in a **UCP-compatible v0 shape** for external agents. Protocol-neutral: `src/lib/protocol/adapter.ts` isolates UCP/ACP/AP2 so Tawveeri is *UCP-compatible, not UCP-dependent*.

**Params:** `category?`, `limit` (≤100), `offset`.
**Per product:** id, title{ar,en}, brand, category, attributes (Product DNA), comparison{available,confidence}, `offers[{ merchant_of_record, price{amount,currency:SAR}, availability, exit_url:/go/… }]`.

**Guarantees:** `merchant_of_record` = the retailer (Merchant Independence); exits measured via `/go`; ranking-blind (a feed, not a ranking; no affiliate fields). **No checkout/payment** — Stage-2, SAMA-gated. v0 shape pending UCP wire-spec validation (`docs/POST-E15-GLOBAL-RESEARCH-AUDIT.md`).

---

## 3. Merchant Digital Twin — `GET /api/v1/intelligence/merchant/{storeId}`

Deterministic behavioral intelligence per merchant from data Tawveeri already observes (no merchant participation required — Merchant Independence). `storeId ∈ {1 Jarir, 2 Amazon, 4 Extra, 5 Almanea}`.

**Signals:** observation_count, distinct_products, category_coverage (per-category), corroboration{corroborated_products, corroborated_share}, price_competitiveness{cheapest_count, cheapest_share — over corroborated only}, availability{in_stock_share, latest_observed_at}, data_completeness (0–1), `ranking_blind:true`.

**Honesty:** shares return `null` (never a fabricated 0-of-0) when there is no denominator; emits no commission/affiliate/revenue fields. This powers merchant intelligence subscriptions — a merchant can buy insight about itself/the market, but **cannot buy ranking**.

---

## 4. Related (existing)

- `POST /api/v1/tps/search` — hybrid search (Layer 1 comparison + Layer 2 discovery).
- `GET /api/v1/tps/recommendations` — deterministic canonical recommender.
- `GET /go/{offer_id}?source=` — the single measured merchant exit (attribution + affiliate injection live only here).
- `POST /api/cron/tps-progressive` / dispatch tick — continuous canonical linkage (E7).
