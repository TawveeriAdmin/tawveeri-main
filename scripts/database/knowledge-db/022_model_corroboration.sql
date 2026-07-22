-- 022_model_corroboration.sql
-- Cross-store MODEL-NUMBER corroborations: products proven identical because the
-- same manufacturer model number appears in ≥2 independent stores. A high-precision
-- identity signal (stronger + higher-recall than title heuristics). Materialized as
-- an intelligence asset here (not merged into canonical_products yet — that folds in
-- as a dedup-by-construction follow-up). Deterministic, provenance-complete.
create table if not exists public.tps_model_corroboration (
  identity_key   text primary key,            -- '{brand}|MODEL:{model}'
  model          text not null,
  brand          text not null,
  category       text,
  store_ids      integer[] not null,
  store_count    integer not null,
  observations   integer not null,
  min_price      numeric,
  max_price      numeric,
  sample_name    text,
  first_built_at timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_model_corrob_brand on public.tps_model_corroboration (brand);
create index if not exists idx_model_corrob_category on public.tps_model_corroboration (category);
create index if not exists idx_model_corrob_stores on public.tps_model_corroboration (store_count desc);

alter table public.tps_model_corroboration enable row level security;
alter table public.tps_model_corroboration force row level security;
revoke all on public.tps_model_corroboration from anon, authenticated;
grant all on public.tps_model_corroboration to service_role;
