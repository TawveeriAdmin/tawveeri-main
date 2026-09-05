-- 51-category-coverage-matrix.sql — Amazon × Noon Affiliate Commerce Engine, founder
-- correction #2 (2026-09-05): "Noon must not be architecturally limited to TV + laptop."
--
-- TV + laptop were ADR-294's evidence-based INITIAL COHORT, never a code-level boundary —
-- no table or query anywhere restricted Noon to two categories. But the commerce dashboard
-- only ever showed categories that already had a LIVE affiliate_campaigns row, so there was
-- no durable, at-a-glance view of comparability across the platform's full category set.
-- This read-only aggregate function closes that gap: one row per canonical_products
-- category, computed server-side (cheap — a single GROUP BY over indexed columns, not N
-- round-trips), read by src/lib/campaigns/category-coverage.ts via .rpc(). It informs
-- founder judgment; it activates nothing and gates nothing.
--
-- Price-competitiveness is computed at the PRODUCT level (MIN(current_price) per store per
-- canonical product), not the row level. A prior ad-hoc analysis (ADR-294's TV figure)
-- compared every product_stores ROW pairwise (multiple rows per store per product are
-- normal — repeat scrapes, marketplace variants), which inflated the "140 pairs" figure and
-- produced a wrong percentage; product-level MIN avoids that skew and is the correct unit
-- for "is this canonical product cheaper at Noon or Amazon."
create or replace function public.get_category_coverage_matrix()
returns table (
  category text,
  active_products bigint,
  noon_offer_products bigint,
  valid_noon_offers bigint,
  fresh_noon_offers bigint,
  valid_amazon_offers bigint,
  overlap_products bigint,
  noon_only_products bigint,
  amazon_only_products bigint,
  demand_30d bigint,
  explicit_interactions_30d bigint,
  noon_cheaper_products bigint,
  amazon_cheaper_products bigint,
  tied_products bigint
)
language sql
stable
security invoker
as $$
  with noon_offers as (
    select p.canonical_product_id as cp_id,
           bool_or(ps.availability = 'in_stock' and ps.current_price > 0) as has_valid,
           bool_or(
             ps.availability = 'in_stock' and ps.current_price > 0
             and coalesce(ps.last_checked_at, ps.last_scraped_at, ps.updated_at) > now() - interval '168 hours'
           ) as has_fresh,
           min(ps.current_price) filter (where ps.availability = 'in_stock' and ps.current_price > 0) as min_price
    from public.product_stores ps
    join public.products p on p.id = ps.product_id
    where ps.store_id = 3 -- Noon (verified against stores table, 2026-09-05)
    group by p.canonical_product_id
  ),
  amazon_offers as (
    select p.canonical_product_id as cp_id,
           bool_or(ps.availability = 'in_stock' and ps.current_price > 0) as has_valid,
           min(ps.current_price) filter (where ps.availability = 'in_stock' and ps.current_price > 0) as min_price
    from public.product_stores ps
    join public.products p on p.id = ps.product_id
    where ps.store_id = 2 -- Amazon (verified against stores table, 2026-09-05)
    group by p.canonical_product_id
  ),
  demand as (
    select category, count(*) as cnt
    from public.usage_events
    where is_test = false and created_at > now() - interval '30 days' and category is not null
    group by category
  ),
  interactions as (
    select cp.category, count(*) as cnt
    from public.first_party_interactions fpi
    join public.canonical_products cp on cp.id = fpi.canonical_product_id
    where fpi.is_test = false and fpi.created_at > now() - interval '30 days'
    group by cp.category
  )
  select
    cp.category,
    count(*) as active_products,
    count(*) filter (where no.cp_id is not null) as noon_offer_products,
    count(*) filter (where coalesce(no.has_valid, false)) as valid_noon_offers,
    count(*) filter (where coalesce(no.has_fresh, false)) as fresh_noon_offers,
    count(*) filter (where coalesce(ao.has_valid, false)) as valid_amazon_offers,
    count(*) filter (where coalesce(no.has_valid, false) and coalesce(ao.has_valid, false)) as overlap_products,
    count(*) filter (where coalesce(no.has_valid, false) and not coalesce(ao.has_valid, false)) as noon_only_products,
    count(*) filter (where coalesce(ao.has_valid, false) and not coalesce(no.has_valid, false)) as amazon_only_products,
    coalesce(max(d.cnt), 0) as demand_30d,
    coalesce(max(i.cnt), 0) as explicit_interactions_30d,
    count(*) filter (where coalesce(no.has_valid, false) and coalesce(ao.has_valid, false) and no.min_price < ao.min_price) as noon_cheaper_products,
    count(*) filter (where coalesce(no.has_valid, false) and coalesce(ao.has_valid, false) and no.min_price > ao.min_price) as amazon_cheaper_products,
    count(*) filter (where coalesce(no.has_valid, false) and coalesce(ao.has_valid, false) and no.min_price = ao.min_price) as tied_products
  from public.canonical_products cp
  left join noon_offers no on no.cp_id = cp.id
  left join amazon_offers ao on ao.cp_id = cp.id
  left join demand d on d.category = cp.category
  left join interactions i on i.category = cp.category
  where cp.is_active = true
  group by cp.category
  order by overlap_products desc, demand_30d desc;
$$;

-- Admin-only, service-role client (src/lib/campaigns/category-coverage.ts uses
-- untypedClient(), the same service-role client every other campaign query uses) — no
-- customer-facing surface reads this, matching the affiliate_campaigns grant precedent.
revoke all on function public.get_category_coverage_matrix() from public, anon, authenticated;
grant execute on function public.get_category_coverage_matrix() to service_role;
