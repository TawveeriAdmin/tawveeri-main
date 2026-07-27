-- 27-fix-almanea-urls.sql
-- Almanea outbound repair (Founder directive). ROOT CAUSE: Almanea's Algolia index stores DEV URLs
-- (m.dev-almanea.com/{rewrite}-p-{sku}); ingestion origin-swapped them to www.almanea.sa/{rewrite}-p-{sku},
-- which 404s. The CORRECT, live production URL is www.almanea.sa/en/product/p-{sku} (verified: renders
-- the exact product across 10 categories). The sku is the trailing 15-digit -p-<sku> already in the URL.
--
-- Deterministic, reversible transform. Only touches Almanea (store_id=5) rows still on the broken form.

update public.product_stores
   set product_url = 'https://www.almanea.sa/en/product/p-' || substring(product_url from '-p-(\d{15})'),
       updated_at  = now()
 where store_id = 5
   and product_url ~ '-p-\d{15}(\?.*)?$'
   and product_url not like '%/en/product/p-%';
