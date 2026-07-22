-- 024_product_edges.sql
-- KNOWLEDGE-GRAPH relationship edges (Strategic Brief §5.4). Deterministic edges
-- derived from corroborated Product DNA: storage_variant (same product, different
-- storage) and successor (same config, consecutive generation). Turns the flat
-- catalog into a real product knowledge graph; powers budget-aware agent guidance.
-- Rebuilt by build-product-edges after DNA/projection changes. Ranking-blind.
create table if not exists public.tps_product_edges (
  id          bigserial primary key,
  from_id     uuid not null,
  to_id       uuid not null,
  type        text not null,        -- storage_variant | successor
  price_delta integer,              -- price(to) − price(from)
  detail      text,
  category    text,
  updated_at  timestamptz not null default now(),
  unique (from_id, to_id, type)
);
create index if not exists idx_edges_from on public.tps_product_edges (from_id);
create index if not exists idx_edges_to on public.tps_product_edges (to_id);

alter table public.tps_product_edges enable row level security;
alter table public.tps_product_edges force row level security;
revoke all on public.tps_product_edges from anon, authenticated;
grant all on public.tps_product_edges to service_role;
grant usage, select on sequence public.tps_product_edges_id_seq to service_role;
