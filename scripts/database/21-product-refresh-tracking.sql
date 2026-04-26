-- Migration 21: Product refresh tracking and safe discovery aging
-- Adds store-offer metadata required for refresh/upsert runs:
-- - external_id: stable retailer identifier (SKU/ASIN/URL-derived fallback)
-- - last_scraped_at: latest time this offer was processed by a refresh job
-- - last_seen_at: latest time this offer appeared in discovery results
-- - consecutive_misses: discovery runs where this offer was not seen
-- - scrape_status: active/missed/stale/failed/manual_review

ALTER TABLE product_stores
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(500),
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS consecutive_misses INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrape_status VARCHAR(30) NOT NULL DEFAULT 'active';

UPDATE product_stores
SET
  last_scraped_at = COALESCE(last_scraped_at, last_checked_at, updated_at, NOW()),
  last_seen_at = COALESCE(last_seen_at, last_checked_at, updated_at, NOW()),
  scrape_status = COALESCE(scrape_status, 'active'),
  consecutive_misses = COALESCE(consecutive_misses, 0);

CREATE INDEX IF NOT EXISTS idx_product_stores_seen
  ON product_stores(store_id, last_seen_at);

CREATE INDEX IF NOT EXISTS idx_product_stores_scrape_status
  ON product_stores(scrape_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_stores_external_id
  ON product_stores(store_id, external_id)
  WHERE external_id IS NOT NULL;
