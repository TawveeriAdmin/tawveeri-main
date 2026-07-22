-- 021_listing_price_facts.sql
-- Per-LISTING price facts (store + product URL), materialized from raw_observations.
-- WHY: price intelligence keyed to canonical_product_id is reset whenever the
-- identity graph is rebuilt; a listing (store+url) is STABLE across those rebuilds,
-- so it preserves the full observed history. This substrate powers Discount
-- Integrity (verify a store's claimed "was" vs what Tawveeri actually observed) and
-- honest deals — deterministic, evidence-based, no fabrication.
-- Refreshed by a bounded builder (build-listing-facts) + the dispatcher tick.
create table if not exists public.tps_listing_price_facts (
  listing_key    text primary key,            -- hash(store_id | product url)
  store_id       integer,
  store_name     text,
  url            text,
  name           text,
  brand          text,
  category       text,
  current_price  numeric,                      -- price at the latest observation
  observed_min   numeric,
  observed_max   numeric,                      -- highest price WE observed
  claimed_was    numeric,                      -- store's advertised "was"/original
  distinct_days  integer,
  first_seen     timestamptz,
  last_seen      timestamptz,
  verdict        text,                         -- verified_drop | inflated_reference | stable | insufficient_history
  advertised_saving_pct integer,
  real_saving_pct       integer,
  text_ar        text,
  text_en        text,
  updated_at     timestamptz not null default now()
);
create index if not exists idx_lpf_verdict on public.tps_listing_price_facts (verdict);
create index if not exists idx_lpf_realsaving on public.tps_listing_price_facts (real_saving_pct desc);
create index if not exists idx_lpf_category on public.tps_listing_price_facts (category);

alter table public.tps_listing_price_facts enable row level security;
alter table public.tps_listing_price_facts force row level security;
revoke all on public.tps_listing_price_facts from anon, authenticated;
grant all on public.tps_listing_price_facts to service_role;
