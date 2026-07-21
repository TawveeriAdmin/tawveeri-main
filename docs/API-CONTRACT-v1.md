# Tawveeri Platform API Contract v1 (E11)

Stable, versioned, platform-owned contract for all clients (mobile + web). Clients **consume canonical TPS results and platform-owned `go_url`s** — they do **not** read raw catalog tables directly or construct `/go` URLs from ambiguous records. Backed by Milestone 7 (canonical identity), never a parallel identity system.

## Endpoints
### `GET /api/v1/tps/search?q=<query>&limit=<1..50>`
Canonical TPS search. Returns corroborated canonical products (from `tps_product_projection`) with per-offer authoritative `go_url`.

**Response**
```json
{
  "version": "v1",
  "query": "ايفون 15",
  "count": 1,
  "results": [{
    "canonical_id": "uuid",
    "tps_identity_key": "apple|iPhone|15|Standard|128",
    "title_ar": "…", "title_en": "…",
    "brand": "apple", "category": "mobile", "image_url": "…",
    "lowest_price": 2599, "highest_price": 2749, "saving": 150,
    "price_spread_pct": 5.77, "store_count": 2, "has_comparison": true,
    "confidence": 95, "canonical_url": "/ar/compare/<key>", "cheapest_store": "أمازون",
    "decision": { "is_smart_pick": true, "reason_ar": "متوفر في 2 متاجر" },
    "tps_version": "tps-v1", "updated_at": "…",
    "offers": [
      { "offer_id": "uuid", "store_id": "أمازون", "store_slug": "amazon",
        "price": 2599, "availability": "in_stock", "go_url": "/go/<offer_id>" }
    ]
  }]
}
```

## Field semantics
| Field | Meaning |
|---|---|
| `canonical_id` | `canonical_products.id` — the canonical product identity |
| `tps_identity_key` | canonical identity key (Milestone 7) |
| `offer_id` | `normalized_product_observations.id` — one authoritative offer per store |
| `go_url` | **the only sanctioned exit** — `/go/{offer_id}`; produces an `outbound_clicks` row + affiliate injection. Append `?source=<channel>` (e.g. `mobile`). |
| `store_slug` | stable English slug (`extra`,`almanea`,`jarir`,`amazon`,…) |
| `decision` | platform Smart-Pick verdict (deterministic; LLMs only phrase) |
| `confidence` | identity confidence (precision-over-recall) |
| `tps_version` | contract/identity version for cache-busting |

## Rules
- **Measured exits only:** clients open `${API_BASE}${go_url}?source=<channel>`. Never `Linking.openURL(raw_product_url)`.
- **Compatibility:** additive; the legacy `/api/search/scrape` remains for older installs (unattributed cohort) until they decay.
- **Canonical-only identity:** `canonical_id`/`offer_id`/`tps_identity_key` are the identifiers; no `products.slug` in v1.
- Offers require `normalized_payload._url` (mobile + AC now populate it; the `/go` route reads it).

## Consumers
- **Mobile:** `mobile/src/lib/exit/measured-exit.ts` (`openMeasuredExit`) already routes via `go_url` when `offer_id` is present. Remaining E11 work: replace mobile's direct catalog reads with this endpoint so items carry `offer_id`.
- **Web:** the search route's `searchTPSCanonical` already emits `/go/{obsId}`; v1 formalizes the shape for cross-client parity.

## Versioning
`/api/v1/*`. Breaking changes → `/api/v2/*`; `tps_version` signals data-shape revisions within v1.
