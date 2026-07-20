-- 006b_backfill_gap.sql
-- Idempotent gap backfill. Safe to run any number of times.
--
-- WHY THIS EXISTS
--   006_store_identity.sql backfilled everything present at the moment it ran,
--   and its guard confirmed 100% coverage. But ingestion never stopped: rows
--   written between the migration and the application cutover carry store_name
--   only, because the deployed producers did not yet write store_id.
--
--   Run this until the deployment that writes store_id is live. After that it
--   becomes a no-op and can be retired.
--
-- SAFETY
--   Touches only rows where store_id IS NULL. Never overwrites an existing
--   identity, never modifies store_name, never touches an observation value.

BEGIN;

UPDATE raw_observations o
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE o.store_id IS NULL AND o.store_name = r.observed_label;

UPDATE price_history p
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE p.store_id IS NULL AND p.store_name = r.observed_label;

UPDATE product_stores ps
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE ps.store_id IS NULL AND ps.store_name = r.observed_label;

UPDATE store_sync_status s
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE s.store_id IS NULL AND s.store_name = r.observed_label;

UPDATE scraping_runs sr
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE sr.store_id IS NULL AND sr.store_name = r.observed_label;

COMMIT;

-- Coverage report — every row should show missing = 0.
SELECT 'raw_observations' AS table_name,
       count(*) AS total, count(*) FILTER (WHERE store_id IS NULL) AS missing
  FROM raw_observations
UNION ALL
SELECT 'price_history',     count(*), count(*) FILTER (WHERE store_id IS NULL) FROM price_history
UNION ALL
SELECT 'product_stores',    count(*), count(*) FILTER (WHERE store_id IS NULL) FROM product_stores
UNION ALL
SELECT 'store_sync_status', count(*), count(*) FILTER (WHERE store_id IS NULL) FROM store_sync_status
UNION ALL
SELECT 'scraping_runs',     count(*), count(*) FILTER (WHERE store_id IS NULL) FROM scraping_runs;
