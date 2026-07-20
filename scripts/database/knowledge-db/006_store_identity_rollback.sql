-- 006_store_identity_rollback.sql
-- Full rollback of E2 EXPAND + BACKFILL.
--
-- Safe at any point BEFORE application cutover, because nothing reads store_id
-- on these tables until cutover. After cutover, revert the application first.
--
-- No original data is at risk: store_name was never modified, so dropping the
-- added columns returns each table to its pre-E2 state exactly.

BEGIN;

ALTER TABLE raw_observations  DROP COLUMN IF EXISTS store_id;
ALTER TABLE price_history     DROP COLUMN IF EXISTS store_id;
ALTER TABLE store_sync_status DROP COLUMN IF EXISTS store_id;

-- product_stores.store_id and scraping_runs.store_id pre-date E2 and are NOT
-- dropped. Only the values E2 backfilled are cleared, and only where the row
-- also carries a store_name that E2 resolved from.
UPDATE product_stores ps
   SET store_id = NULL
  FROM store_name_resolution r
 WHERE ps.store_name = r.observed_label
   AND ps.store_id = r.store_id;

UPDATE scraping_runs sr
   SET store_id = NULL
  FROM store_name_resolution r
 WHERE sr.store_name = r.observed_label
   AND sr.store_id = r.store_id;

DROP TABLE IF EXISTS store_name_resolution;

DELETE FROM schema_migrations WHERE version = '006_store_identity';

COMMIT;
