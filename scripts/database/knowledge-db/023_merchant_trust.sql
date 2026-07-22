-- 023_merchant_trust.sql
-- Merchant Trust Intelligence: a deterministic, evidence-based trust profile per
-- store (discount honesty + real price competitiveness + coverage), derived only
-- from observed data. Consumer trust signal + B2B data product (Brief §5.8/§5.12).
-- Materialized by build-merchant-trust; refreshed periodically. Ranking-blind.
create table if not exists public.tps_merchant_trust (
  store_id                    integer primary key,
  store_name                  text,
  discount_behavior           text,      -- unobserved_reference | some_unobserved_reference | no_advertised_discounts | insufficient_data
  evaluable_claims            integer,
  unobserved_reference_pct    integer,   -- % of evaluable advertised discounts whose "was" we did NOT observe (NOT a fabrication claim)
  verified_deals              integer,
  price_competitiveness_pct   integer,   -- cheapest share on corroborated products
  distinct_products           integer,
  sample_size                 integer,   -- evidence: the sample the behavior is based on
  observation_window_days     integer,   -- evidence: longest tracking window
  data_age_days               integer,   -- evidence: freshness (days since newest observation)
  confidence                  text,      -- high | medium | low (by sample size)
  headline_ar                 text,
  headline_en                 text,
  updated_at                  timestamptz not null default now()
);
-- additive evolution (existing deployments): new evidence columns
alter table public.tps_merchant_trust add column if not exists unobserved_reference_pct integer;
alter table public.tps_merchant_trust add column if not exists sample_size integer;
alter table public.tps_merchant_trust add column if not exists observation_window_days integer;
alter table public.tps_merchant_trust add column if not exists data_age_days integer;
alter table public.tps_merchant_trust add column if not exists confidence text;
alter table public.tps_merchant_trust enable row level security;
alter table public.tps_merchant_trust force row level security;
revoke all on public.tps_merchant_trust from anon, authenticated;
grant all on public.tps_merchant_trust to service_role;
