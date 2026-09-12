-- 031_tps_store_product_counts_rpc.sql
-- Samsung KSA global closure mission (2026-09-12). Replaces the client-side, per-request
-- paginated price_history scan in stores-listing-client.tsx (ADR-343's SKIP_TPS_CHECK
-- workaround) with one server-side aggregate. ADR-343 explicitly deliberately excluded
-- extra/almanea because their price_history row counts (35,107 / 101,359) exceeded the
-- existing client-side pagination cap and would have silently truncated (the ADR-172
-- class of bug) — the fix flagged there ("needs a server-side COUNT(DISTINCT
-- canonical_product_id) GROUP BY store_id ... RPC") is this function.
--
-- Returns ALL stores in one call/one scan — no per-request candidate filtering needed,
-- so every store (including jarir/amazon/noon, previously skipped only because legacy
-- already wins for them) can be safely checked uniformly.
--
-- Preserves the EXACT semantics already established for this metric (not a silent
-- definition change): distinct canonical_product_id per store_id, counting only
-- is_active canonical_products, sourced from price_history (append-on-change history,
-- the same table this metric has always read). store_id is used directly (not
-- store_name — ADR-241 proved store_id is the reliable join key; ~90% of rows carry it).
--
-- Read-only aggregate over public data already exposed row-by-row via the existing
-- paginated client query — granting anon execute discloses nothing new.
create or replace function public.get_tps_active_store_counts()
returns table(store_id int, product_count bigint)
language sql stable security definer
set search_path = public
as $$
  select ph.store_id, count(distinct ph.canonical_product_id) as product_count
  from price_history ph
  join canonical_products cp on cp.id = ph.canonical_product_id and cp.is_active = true
  where ph.store_id is not null
  group by ph.store_id
$$;

revoke all on function public.get_tps_active_store_counts() from public;
grant execute on function public.get_tps_active_store_counts() to anon, authenticated, service_role;
