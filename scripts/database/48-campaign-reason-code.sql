-- 48-campaign-reason-code.sql — Amazon Decision Layer V2.1 §10 (Differentiation Metrics).
--
-- Purely additive: one nullable text column on each of the two campaign measurement
-- tables, holding resolveAmazonDestination()'s reasonCode verbatim (e.g.
-- "exact_product_verified", "exact_product_blocked:offer_stale_or_unknown"). This is
-- what makes "fallback reasons" / "unsafe exact matches rejected" / "product-identity
-- failures" answerable from real data instead of only being inferable from the mode.
--
-- No backfill — historical rows before this migration have no reason to guess.
alter table public.campaign_exposures
  add column if not exists reason_code text;

alter table public.campaign_clicks
  add column if not exists reason_code text;
