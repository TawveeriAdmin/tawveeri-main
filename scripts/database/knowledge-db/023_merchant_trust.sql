-- 023_merchant_trust.sql
-- Merchant Trust Intelligence: a deterministic, evidence-based trust profile per
-- store (discount honesty + real price competitiveness + coverage), derived only
-- from observed data. Consumer trust signal + B2B data product (Brief §5.8/§5.12).
-- Materialized by build-merchant-trust; refreshed periodically. Ranking-blind.
create table if not exists public.tps_merchant_trust (
  store_id                    integer primary key,
  store_name                  text,
  discount_behavior           text,      -- aggressive_claims | some_claims | no_advertised_discounts
  evaluable_claims            integer,
  discount_inflation_pct      integer,   -- % of evaluable advertised discounts that reference an unobserved price
  verified_deals              integer,
  price_competitiveness_pct   integer,   -- cheapest share on corroborated products
  distinct_products           integer,
  headline_ar                 text,
  headline_en                 text,
  updated_at                  timestamptz not null default now()
);
alter table public.tps_merchant_trust enable row level security;
alter table public.tps_merchant_trust force row level security;
revoke all on public.tps_merchant_trust from anon, authenticated;
grant all on public.tps_merchant_trust to service_role;
