-- Migration 19: Merchant-provided rating/review signal + detail-page enrichment marker
--
-- Adds three columns to `products` so we can store data fetched from a retailer's
-- product detail page (vs. the search card) without clobbering internal review
-- aggregates:
--
--   merchant_rating        — star rating reported by the retailer (e.g. Amazon's
--                             "4.3 out of 5"). Kept separate from
--                             `average_rating` (which aggregates Tawveeri users'
--                             own reviews via product_reviews).
--   merchant_review_count  — number of ratings/reviews reported by the retailer.
--   enriched_at            — marker set by the detail-page enrichment pass so
--                             resumable jobs can skip already-enriched rows
--                             cheaply via the partial index below.
--
-- Paired with scripts/enrich-amazon-products.ts.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS merchant_rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS merchant_review_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Partial index biased toward NOT-yet-enriched rows so the enrichment script's
-- `WHERE enriched_at IS NULL` scan stays fast as the catalog fills up.
CREATE INDEX IF NOT EXISTS idx_products_enriched_at
  ON products (enriched_at NULLS FIRST);

-- Helpful for sorting by merchant-reported popularity without clobbering
-- existing average_rating indexes.
CREATE INDEX IF NOT EXISTS idx_products_merchant_rating
  ON products (merchant_rating DESC NULLS LAST);
