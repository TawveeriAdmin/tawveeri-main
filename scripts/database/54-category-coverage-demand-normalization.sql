-- 54-category-coverage-demand-normalization.sql — founder-directed truth check
-- (2026-09-05, post-ADR-295): the demand CTE in get_category_coverage_matrix() (migration
-- 51/53) grouped raw usage_events.category and exact-string-joined it to
-- canonical_products.category, silently missing the SAME two proven mismatches this
-- codebase's own canonical analytics-category normalization contract already exists to
-- fix (src/lib/admin/command-center-queries.ts's canonicalAnalyticsCategory(),
-- RECORDED_CATEGORY_TO_CANONICAL — 'smartphone' -> 'mobile' proven via a live production
-- join; 'appliance' proven too coarse to trust, excluded rather than guessed). SQL cannot
-- literally import that TS function, so its exact two rules are mirrored here — this is
-- NOT a new taxonomy decision, it is applying the SAME already-proven mapping to a query
-- that had bypassed it. Return type unchanged (still 14 columns), so CREATE OR REPLACE
-- is valid here (unlike migration 53's column-adding change).
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
  tied_products bigint,
  shopper_equivalent_products bigint
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
    -- Mirrors canonicalAnalyticsCategory() exactly: smartphone -> mobile (proven alias);
    -- appliance -> excluded entirely (too coarse to attribute to one specific category,
    -- same as the TS function returning null for it); every other recorded value passes
    -- through unchanged, identical to canonical_products.category 1:1 (proven elsewhere,
    -- not re-verified here — same "map only proven equivalents" discipline).
    select category, count(*) as cnt
    from (
      select case
        when category = 'smartphone' then 'mobile'
        when category = 'appliance' then null
        else category
      end as category
      from public.usage_events
      where is_test = false and created_at > now() - interval '30 days' and category is not null
    ) normalized
    where category is not null
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
    count(*) filter (where coalesce(no.has_valid, false) and coalesce(ao.has_valid, false) and no.min_price = ao.min_price) as tied_products,
    count(*) filter (
      where coalesce(no.has_valid, false) and coalesce(ao.has_valid, false)
        and abs(no.min_price - ao.min_price) <= greatest(10, least(no.min_price, ao.min_price) * 0.01)
    ) as shopper_equivalent_products
  from public.canonical_products cp
  left join noon_offers no on no.cp_id = cp.id
  left join amazon_offers ao on ao.cp_id = cp.id
  left join demand d on d.category = cp.category
  left join interactions i on i.category = cp.category
  where cp.is_active = true
  group by cp.category
  order by overlap_products desc, demand_30d desc;
$$;

revoke all on function public.get_category_coverage_matrix() from public, anon, authenticated;
grant execute on function public.get_category_coverage_matrix() to service_role;
