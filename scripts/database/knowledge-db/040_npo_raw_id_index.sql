-- 040_npo_raw_id_index.sql — the missing index behind the compare page's slowest query (2026-10-06).
-- MEASURED (pg_stat_statements, stats since 2026-08-15, production): the PostgREST statement
--     SELECT id, canonical_product_id, … FROM normalized_product_observations WHERE normalized_payload->>'_raw_id' = ANY($2) LIMIT …
-- (src/lib/compare/get-comparison.ts → `.in('normalized_payload->>_raw_id', …)`) ran 188,925 times at a mean of 411 ms = 77.7 M ms
-- (21.6 hours) of database time and 1.04 BILLION block reads. No index serves `payload->>'_raw_id'` (idx_npo_payload is a GIN that only
-- answers `@>`), so every call scanned the 661 MB table (pg_stat_user_tables.seq_scan = 64,796). The exact expression below is what that
-- predicate compiles to; the planner uses it for `= ANY(text[])` and `= text`.
-- Run with CONCURRENTLY (no write lock on a table the pipeline writes continuously), OUTSIDE a transaction, statement_timeout = 0.
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_npo_raw_id_text;
create index concurrently if not exists idx_npo_raw_id_text
  on public.normalized_product_observations ((normalized_payload ->> '_raw_id'));
