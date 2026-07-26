-- 26-backfill-product-images.sql
-- Founder-approved image backfill (Private Beta polish). Every active product had image_url = NULL,
-- so deal cards, product cards, and search results rendered placeholders — even though ~2,752 products
-- already carry a real scraped image in image_urls[0]. Fill image_url from that first image.
--
-- SAFE: fill-only (image_url IS NULL), validated (real http, not a lazy-load data/base64 placeholder),
-- a single bounded UPDATE — no data destroyed, reversible. Same CDN hosts already render via image_urls,
-- so no new image domains are introduced.

update public.products
   set image_url = image_urls->>0
 where is_active
   and image_url is null
   and jsonb_typeof(image_urls) = 'array'
   and jsonb_array_length(image_urls) > 0
   and (image_urls->>0) ~ '^https?://'
   and (image_urls->>0) !~ 'data:image|;base64,';
