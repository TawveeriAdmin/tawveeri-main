-- 006_store_identity_precheck.sql
-- Read-only. Run BEFORE 006_store_identity.sql and review the output.
-- Nothing is modified by this script.

-- 1. Every distinct store label currently in the data, with volumes.
--    Any label not present in the resolution map of 006_store_identity.sql
--    must be added there before the migration is run.
SELECT 'raw_observations' AS source, store_name, count(*) AS rows
  FROM raw_observations GROUP BY store_name
UNION ALL
SELECT 'price_history', store_name, count(*)
  FROM price_history GROUP BY store_name
UNION ALL
SELECT 'product_stores', store_name, count(*)
  FROM product_stores GROUP BY store_name
UNION ALL
SELECT 'store_sync_status', store_name, count(*)
  FROM store_sync_status GROUP BY store_name
UNION ALL
SELECT 'scraping_runs', store_name, count(*)
  FROM scraping_runs GROUP BY store_name
ORDER BY source, rows DESC;

-- 2. The store registry the labels must resolve to.
SELECT id, slug, name FROM stores ORDER BY id;

-- 3. product_stores identity split: adapter rows carry store_name with a null
--    store_id; legacy rows carry store_id with a null store_name. Both must end
--    up with store_id populated.
SELECT
  store_id IS NULL AS store_id_missing,
  store_name IS NULL AS store_name_missing,
  count(*) AS rows
FROM product_stores
GROUP BY 1, 2
ORDER BY rows DESC;

-- 4. Does any product_stores row already violate one-offer-per-store?
--    The upsert conflict target is (product_id, store_name); after cutover it
--    should become (product_id, store_id). This reports rows that would
--    collide under the new key.
SELECT ps.product_id, r.store_id, count(*) AS colliding_rows
FROM product_stores ps
LEFT JOIN store_name_resolution r ON r.observed_label = ps.store_name
GROUP BY ps.product_id, COALESCE(r.store_id, ps.store_id)
HAVING count(*) > 1
LIMIT 50;
