-- Migration 17: Production hardening for scraping
-- - Track per-product failures so we can back off on chronically broken items
-- - Add schedule-level coverage-mode config (auto-batch so all products are refreshed within target window)
-- - Add a partial unique index so only one run per schedule can be 'running' at a time

-- ============================================================================
-- product_stores: per-product failure tracking
-- ============================================================================

ALTER TABLE product_stores
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Oldest-checked products, excluding chronically broken ones, should be cheap
-- to find — this is the hot query for price_update batch selection.
CREATE INDEX IF NOT EXISTS idx_product_stores_coverage
  ON product_stores (store_id, last_checked_at NULLS FIRST)
  WHERE consecutive_failures < 5;

-- ============================================================================
-- scraping_schedules: coverage-mode + chunk tuning
-- ============================================================================

ALTER TABLE scraping_schedules
  ADD COLUMN IF NOT EXISTS coverage_mode BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS target_refresh_hours INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS chunk_size INTEGER;

-- When coverage_mode = TRUE the dispatcher computes max_products at run-time
-- based on total catalog size and cron cadence, so every product is refreshed
-- inside target_refresh_hours regardless of how large the catalog grows.
-- chunk_size is an optional cap the admin can impose on the computed batch
-- (e.g., to keep a single run under N seconds for a slow Puppeteer site).

-- ============================================================================
-- scraping_runs: block concurrent runs per schedule
-- ============================================================================

-- Only one 'running' or 'pending' run is allowed per (schedule_id, job_type).
-- Dispatcher should skip a schedule whose previous run hasn't landed yet.
CREATE UNIQUE INDEX IF NOT EXISTS uq_scraping_runs_one_active_per_schedule
  ON scraping_runs (schedule_id, job_type)
  WHERE status IN ('pending', 'running') AND schedule_id IS NOT NULL;

-- ============================================================================
-- Helper view: per-store coverage health
-- ============================================================================

CREATE OR REPLACE VIEW v_scraping_coverage AS
SELECT
  s.id                                AS store_id,
  s.slug                              AS store_slug,
  s.name_en                           AS store_name_en,
  COUNT(ps.id)                        AS total_products,
  COUNT(*) FILTER (
    WHERE ps.last_checked_at IS NOT NULL
      AND ps.last_checked_at >= NOW() - INTERVAL '24 hours'
  )                                   AS refreshed_last_24h,
  COUNT(*) FILTER (
    WHERE ps.last_checked_at IS NULL
      OR ps.last_checked_at < NOW() - INTERVAL '48 hours'
  )                                   AS stale_over_48h,
  COUNT(*) FILTER (
    WHERE ps.consecutive_failures >= 5
  )                                   AS chronic_failures,
  MIN(ps.last_checked_at)             AS oldest_check,
  MAX(ps.last_checked_at)             AS newest_check
FROM stores s
LEFT JOIN product_stores ps ON ps.store_id = s.id
GROUP BY s.id, s.slug, s.name_en;

COMMENT ON VIEW v_scraping_coverage IS
  'Per-store coverage snapshot: how many products, how many refreshed recently, how many stale or chronically failing. Used by /admin/scraping/health.';
