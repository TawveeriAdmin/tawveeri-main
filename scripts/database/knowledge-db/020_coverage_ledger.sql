-- 020_coverage_ledger.sql
-- E15.5 — append-only Coverage Ledger: periodic snapshots of the knowledge graph's
-- growth (raw / resolved / corroborated / single-store), by category and overall.
-- Append-only (history never mutated). RLS forced; internal (service-role only).
create table if not exists public.tps_coverage_ledger (
  id            bigserial primary key,
  snapshot_at   timestamptz not null default now(),
  category      text not null,              -- '_total_' for the overall row
  raw           bigint,
  resolved      integer,                    -- distinct identity keys
  corroborated  integer,                    -- ≥2-store (Layer 1)
  single_store  integer                     -- Layer 2
);
create index if not exists idx_coverage_ledger_at on public.tps_coverage_ledger (snapshot_at desc);
create index if not exists idx_coverage_ledger_cat on public.tps_coverage_ledger (category, snapshot_at desc);

alter table public.tps_coverage_ledger enable row level security;
alter table public.tps_coverage_ledger force row level security;
revoke all on public.tps_coverage_ledger from anon, authenticated;
grant all on public.tps_coverage_ledger to service_role;
grant usage, select on sequence public.tps_coverage_ledger_id_seq to service_role;
