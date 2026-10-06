-- 040_npo_raw_id_index.sql — the missing index behind every `normalized_payload->>'_raw_id'` lookup (2026-10-06).
-- No index served `payload->>'_raw_id'` (idx_npo_payload is a GIN that only answers `@>`), so `->>'_raw_id' = ANY(text[])` scanned the whole
-- 661 MB table. MEASURED with EXPLAIN ANALYZE on production, 40 ids: Seq Scan 9,098 ms  ->  Index Scan 0.127 ms (after this index).
-- Callers of that predicate: src/lib/compare/get-comparison.ts (`.in('normalized_payload->>_raw_id', …)`, when a store's newest observation falls
-- outside the 1000-row window) and, since this session, the search route's exit-id resolution (src/app/api/search/route.ts).
-- CORRECTION (same day): an earlier version of this note attributed the 188,925-call / 21.6-hour pg_stat_statements entry to this predicate. The
-- statement text is parameter-normalized and cannot tell `_raw_id` from `_url`; EXPLAIN shows the `_url` form (home-verified-deals.ts, check-product.ts)
-- already uses idx_npo_payload_url (1000 rows × a 444-byte payload per call), and that statement's call count has not moved since. It is NOT addressed by
-- this index and is a separate, still-open optimisation (select fewer columns / newest row per URL).
-- Run with CONCURRENTLY (no write lock on a table the pipeline writes continuously), OUTSIDE a transaction, statement_timeout = 0.
-- Built in production 2026-10-06 06:42Z: 9.9 s, 19 MB, indisvalid = true. Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_npo_raw_id_text;
create index concurrently if not exists idx_npo_raw_id_text
  on public.normalized_product_observations ((normalized_payload ->> '_raw_id'));
