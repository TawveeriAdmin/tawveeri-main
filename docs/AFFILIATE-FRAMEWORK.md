# Affiliate & Official Feed Framework (E15.5 → production direction)

**Status:** Reference implementation (Amazon) shipped. Provider adapters pluggable. See ADR-085.

Tawveeri's long-term merchant-data direction is **official/affiliate feeds**, because the
high-overlap Saudi retailers block scraping (ADR-082 close: Noon/Lulu/Carrefour/HNAK/Axiom
all 403 / SPA / Cloudflare-hang). This framework makes *how a retailer's offers are sourced*
and *how a customer exits to buy* pluggable per-retailer, without touching the TPS core or the
`Canonical Product → Commercial Variant → Offer` model.

## Two orthogonal concerns

A **RetailerProvider** binds a retailer to two independent adapters:

1. **Sourcing** — how offers enter the graph. One of:
   `scraper` (today) · `official_feed` · `affiliate_feed` · `api` · `csv_xml`.
   All produce the same `ScrapedProduct[]` shape, so `raw_observations` and everything
   downstream is unchanged. Fallback order is explicit and evidence-first: prefer an
   official/affiliate feed when one exists; fall back to a clean scraper otherwise.

2. **Monetization / exit** — how the measured `/go` exit is turned into an affiliate link.
   A pluggable **AffiliateNetwork** adapter (`amazon`, `param`, `direct`, …future networks)
   builds the outbound URL, applies deep-linking, and embeds a **sub-id** that ties the click
   to a future conversion.

These are orthogonal: a retailer can be *sourced* by a scraper but *monetized* by an affiliate
network (Amazon today), or sourced by an official feed and monetized by the same feed's network.

## TPS invariants (never violated by a provider)

- **Precision over recall / Unknown beats incorrect:** a provider with no affiliate program
  emits a plain `direct` link — we never fabricate a tracking parameter.
- **Never a false comparison:** providers produce *offers* (real observations of a variant at a
  retailer); they never merge or invent identities. Identity stays in TPS.
- **Evidence before assumptions:** feed/scrape data is the evidence; a provider adds no verdict.
- **One measured exit:** every outbound click still flows through `/go/<offer_id>` and is
  recorded in `outbound_clicks`. Commercial interest never enters ranking (Constitution Art. VII).

## Modules (`src/lib/providers/`)

| File | Role |
|---|---|
| `types.ts` | `RetailerProvider`, `AffiliateConfig`, `AffiliateNetwork`, `SourcingMode`, `LinkContext`, `AffiliateLinkResult` |
| `networks/amazon.ts` | **Reference** Amazon Associates adapter (`tawveeri-21`): clean to `/dp/ASIN`, `tag`, `ascsubtag=<clickId>` |
| `networks/param.ts` | Generic single/multi query-param network (Noon-style `aff_code`, UTM) |
| `networks/direct.ts` | No affiliate program — pass-through |
| `link.ts` | `buildOfferExitLink(provider, rawUrl, ctx)` — normalize → dispatch to network → attribution |
| `registry.ts` | `PROVIDERS` registry + **feature flags** (`getProvider`, env overrides) |
| `sourcing/types.ts` | `SourcingAdapter` interface |
| `sourcing/scraper-adapter.ts` | Wraps the existing per-store scrapers (today's default) |
| `sourcing/feed-adapter.ts` | Official/CSV/XML feed adapter (interface + parser scaffold) |

## Feature flags

Providers are toggled without code changes via env:
`PROVIDER_<SLUG>_ENABLED=0|1`, `PROVIDER_<SLUG>_SOURCING=scraper|official_feed|…`,
`PROVIDER_<SLUG>_AFFILIATE=<network>`. The registry resolves the effective config at runtime,
so switching Amazon from `scraper` sourcing to an `official_feed` (PA-API) later is a flag flip.

## Click attribution & conversion hooks

`/go` inserts the `outbound_clicks` row **first** to obtain a stable `click id`, then builds the
link with that id as the network sub-id (`ascsubtag` for Amazon, `subId`/`utm_content` for
param networks). A future conversion webhook (`/api/transactions/conversion`) matches the
network's reported sub-id back to the click → full funnel attribution. Sub-id is opaque and
carries no PII.

## Future: approval-based AI shopping actions

The Decision Agent (E15.5) may later *execute* a purchase-intent action (add-to-cart / checkout
hand-off). Those actions route through the same provider (deep-link / API adapter) and are
**always approval-gated** — the agent proposes, the human approves, the provider executes. No
autonomous spending. This framework is the seam where that lands without re-architecture.

## Adding a retailer

1. Add a `RetailerProvider` to `registry.ts` (slug, storeId, sourcing mode, affiliate config).
2. If it needs a new affiliate network, add an adapter under `networks/`.
3. If sourced by a feed, implement/point the `feed-adapter` at its feed URL + column map.
4. No change to `/go`, the projection, or TPS identity.
