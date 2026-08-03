-- 21-delist-signals.sql · ADR-196 phase 2
-- A (canonical, store) offer whose page is measured GONE (HTTP 404/410 on a direct probe
-- after the store's own scraper returned no product) must stop winning best-price on
-- comparison surfaces. This table is that verdict's persistence: written by
-- scripts/tps-core/reobserve-comparables.ts on a confirmed gone, HEALED (deleted) by the
-- same script the moment a later re-observation of the pair succeeds. Read by the
-- projection builder and the price_history direct readers as an exclusion, never as a
-- public claim — "we could not observe it" is not "it is not sold" (Standing Directive §6),
-- so nothing here ever renders as a statement about the retailer.
create table if not exists tps_offer_delist_signals (
  canonical_product_id uuid not null references canonical_products(id) on delete cascade,
  store_slug         text not null,
  -- The display name as price_history/projection know the store (TPS_STORES), written at
  -- signal time from the one authoritative map so SQL readers never re-derive it.
  store_display_name text not null,
  url                text not null,
  status_code        int  not null,
  observed_gone_at   timestamptz not null default now(),
  source             text not null default 'reobserve-comparables',
  primary key (canonical_product_id, store_slug)
);

alter table tps_offer_delist_signals enable row level security;
-- Service-role only (bypasses RLS). Customer-facing roles are never granted this table.
revoke all on tps_offer_delist_signals from anon, authenticated;
