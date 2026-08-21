-- 029_price_implausibility_signals.sql · P7 (2026-08-21)
-- A (canonical, store) price that is a statistical outlier for what a product of
-- its own kind actually costs — measured via price-per-capacity (or, for
-- capacity-less appliances, price within its own TYPE cohort) against the
-- category's own data, never a hardcoded SAR figure. This is DIFFERENT from
-- price-truth-gate.ts's assessPriceTransition (a write-time delta check against
-- a PRIOR price for the SAME listing): a price can be wrong from its very FIRST
-- observation, with no prior value to compare against — exactly the measured case
-- (8+ Extra vacuum listings, all single-store, all captured in the same scrape
-- batch, each far cheaper than any real product of its stated brand/wattage).
--
-- Written by scripts/tps-analysis/price-plausibility-scan.ts (--apply). Healed
-- (deleted) by the same script the moment a later observation of the pair falls
-- back within the plausible band — self-correcting, never a permanent ban.
-- Read by the projection builder as an exclusion (mirrors tps_offer_delist_signals
-- exactly), never as a public claim about the retailer.
create table if not exists tps_price_implausibility_signals (
  canonical_product_id uuid not null references canonical_products(id) on delete cascade,
  store_display_name   text not null,
  observed_price        numeric not null,
  plausible_floor        numeric not null,
  reason                text not null,
  detected_at            timestamptz not null default now(),
  source                 text not null default 'price-plausibility-scan',
  primary key (canonical_product_id, store_display_name)
);

alter table tps_price_implausibility_signals enable row level security;
-- Service-role only (bypasses RLS). Customer-facing roles are never granted this table.
revoke all on tps_price_implausibility_signals from anon, authenticated;
