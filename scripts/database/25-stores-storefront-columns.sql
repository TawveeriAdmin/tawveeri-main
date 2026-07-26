-- 25-stores-storefront-columns.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Founder-approved storefront repair (Private Beta audit). Production System A `stores`
-- was a minimal TPS table (id, name, slug, offer, coupon_code, link, category), but the
-- legacy storefront queries name_ar/name_en/logo_url/ratings/website_url/policy columns.
-- Every such join errored (42703) → product-detail, compare, deals, store-detail broke.
--
-- SAFE by construction: ADDITIVE, all-NULLABLE columns + a bounded 22-row backfill. No data
-- destroyed, no type changes, fully reversible (drop columns). Backfilled from the app's own
-- static store config (name_ar from the existing Arabic name; name_en + logo from the known
-- 8-store map; website from the existing `link`). Info/policy/description columns stay NULL
-- (they render optionally). Ratings default 0.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.stores add column if not exists name_ar          text;
alter table public.stores add column if not exists name_en          text;
alter table public.stores add column if not exists logo_url         text;
alter table public.stores add column if not exists website_url      text;
alter table public.stores add column if not exists average_rating   numeric default 0;
alter table public.stores add column if not exists total_reviews    integer default 0;
alter table public.stores add column if not exists description_ar   text;
alter table public.stores add column if not exists description_en   text;
alter table public.stores add column if not exists delivery_info_ar text;
alter table public.stores add column if not exists delivery_info_en text;
alter table public.stores add column if not exists return_policy_ar text;
alter table public.stores add column if not exists return_policy_en text;
alter table public.stores add column if not exists warranty_info_ar text;
alter table public.stores add column if not exists warranty_info_en text;

update public.stores set
  name_ar = coalesce(name_ar, name),
  name_en = coalesce(name_en, case slug
              when 'amazon' then 'Amazon SA'  when 'noon' then 'Noon'   when 'jarir' then 'Jarir'
              when 'extra' then 'Extra'        when 'almanea' then 'Almanea'
              when 'samsung_ksa' then 'Samsung KSA' when 'shaker' then 'Shaker'
              when 'swsg' then 'Winter & Summer'
              else name end),
  logo_url = coalesce(logo_url, case when slug in
              ('amazon','noon','jarir','extra','almanea','samsung_ksa','shaker','swsg')
              then '/logos/' || slug || '.png' else null end),
  website_url    = coalesce(website_url, link),
  average_rating = coalesce(average_rating, 0),
  total_reviews  = coalesce(total_reviews, 0);

-- Refresh PostgREST's schema cache so the REST-backed customer queries see the new columns.
notify pgrst, 'reload schema';
