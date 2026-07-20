-- 006_store_identity_precheck.sql
-- Read-only. Run BEFORE 006_store_identity.sql and review the output.
-- Nothing is created, modified, or dropped by this script.
--
-- SELF-CONTAINED BY DESIGN.
-- This script must not reference store_name_resolution: that table is created
-- by 006_store_identity.sql (step 2), which runs afterwards. The mapping is
-- therefore repeated here as an inline CTE.
--
-- KEEP IN SYNC: the `resolution` CTE below must match the VALUES list in
-- 006_store_identity.sql step 2. Query 5 exists to catch drift — if it returns
-- any row, one of the two lists is incomplete and the migration must not be run.

-- ─────────────────────────────────────────────────────────────
-- 1. Every distinct store label currently in the data, with volumes.
-- ─────────────────────────────────────────────────────────────
SELECT 'raw_observations'  AS source, store_name, count(*) AS row_count
  FROM raw_observations  GROUP BY store_name
UNION ALL
SELECT 'price_history',     store_name, count(*) FROM price_history     GROUP BY store_name
UNION ALL
SELECT 'product_stores',    store_name, count(*) FROM product_stores    GROUP BY store_name
UNION ALL
SELECT 'store_sync_status', store_name, count(*) FROM store_sync_status GROUP BY store_name
UNION ALL
SELECT 'scraping_runs',     store_name, count(*) FROM scraping_runs     GROUP BY store_name
ORDER BY source, row_count DESC;

-- ─────────────────────────────────────────────────────────────
-- 2. The store registry the labels must resolve to.
-- ─────────────────────────────────────────────────────────────
SELECT id, slug, name FROM stores ORDER BY id;

-- ─────────────────────────────────────────────────────────────
-- 3. product_stores identity split. Adapter rows carry store_name with a null
--    store_id; legacy rows carry store_id with a null store_name.
-- ─────────────────────────────────────────────────────────────
SELECT
  store_id   IS NULL AS store_id_missing,
  store_name IS NULL AS store_name_missing,
  count(*)           AS row_count
FROM product_stores
GROUP BY 1, 2
ORDER BY row_count DESC;

-- ─────────────────────────────────────────────────────────────
-- 4. Collision report: how many rows would share a (product_id, store_id) key.
--    INFORMATIONAL ONLY. The migration does NOT change the product_stores
--    upsert key — see the scope-limit note in 006_store_identity.sql. This
--    query quantifies why it cannot be changed yet.
-- ─────────────────────────────────────────────────────────────
WITH resolution (observed_label, slug) AS (
  VALUES
    ('جرير','jarir'), ('مكتبة جرير','jarir'), ('jarir','jarir'),
    ('اكسترا','extra'), ('إكسترا','extra'), ('extra','extra'),
    ('المنيع','almanea'), ('almanea','almanea'),
    ('أمازون','amazon'), ('أمازون السعودية','amazon'), ('amazon','amazon'),
    ('نون','noon'), ('noon','noon'),
    ('سامسونج السعودية','samsung_ksa'), ('samsung_ksa','samsung_ksa'),
    ('شاكر','shaker'), ('shaker','shaker'),
    ('الشتاء والصيف','swsg'), ('swsg','swsg')
),
resolved AS (
  SELECT
    ps.product_id,
    COALESCE(ps.store_id, s.id) AS canonical_store_id
  FROM product_stores ps
  LEFT JOIN resolution r ON r.observed_label = ps.store_name
  LEFT JOIN stores     s ON s.slug           = r.slug
)
SELECT
  product_id,
  canonical_store_id,
  count(*) AS colliding_rows
FROM resolved
GROUP BY product_id, canonical_store_id
HAVING count(*) > 1
ORDER BY colliding_rows DESC
LIMIT 50;

-- ─────────────────────────────────────────────────────────────
-- 5. SAFETY GATE — unmapped labels.
--    Every distinct store_name in every table must resolve to a store.
--    If this returns ANY row, do NOT run the migration: add the missing label
--    to BOTH this script's CTE and the migration's VALUES list first.
--    (The migration has its own fail-loud guard, but catching it here avoids
--    a rolled-back transaction.)
-- ─────────────────────────────────────────────────────────────
WITH resolution (observed_label, slug) AS (
  VALUES
    ('جرير','jarir'), ('مكتبة جرير','jarir'), ('jarir','jarir'),
    ('اكسترا','extra'), ('إكسترا','extra'), ('extra','extra'),
    ('المنيع','almanea'), ('almanea','almanea'),
    ('أمازون','amazon'), ('أمازون السعودية','amazon'), ('amazon','amazon'),
    ('نون','noon'), ('noon','noon'),
    ('سامسونج السعودية','samsung_ksa'), ('samsung_ksa','samsung_ksa'),
    ('شاكر','shaker'), ('shaker','shaker'),
    ('الشتاء والصيف','swsg'), ('swsg','swsg')
),
observed AS (
  SELECT 'raw_observations'  AS source, store_name FROM raw_observations  WHERE store_name IS NOT NULL
  UNION
  SELECT 'price_history',     store_name FROM price_history     WHERE store_name IS NOT NULL
  UNION
  SELECT 'product_stores',    store_name FROM product_stores    WHERE store_name IS NOT NULL
  UNION
  SELECT 'store_sync_status', store_name FROM store_sync_status WHERE store_name IS NOT NULL
  UNION
  SELECT 'scraping_runs',     store_name FROM scraping_runs     WHERE store_name IS NOT NULL
)
SELECT o.source, o.store_name AS unmapped_label
FROM observed o
LEFT JOIN resolution r ON r.observed_label = o.store_name
LEFT JOIN stores     s ON s.slug           = r.slug
WHERE s.id IS NULL
ORDER BY o.source, o.store_name;

-- ─────────────────────────────────────────────────────────────
-- 6. Slug sanity: every slug the mapping targets must exist in stores.
--    If this returns any row, the stores registry and the mapping disagree.
-- ─────────────────────────────────────────────────────────────
WITH resolution (observed_label, slug) AS (
  VALUES
    ('جرير','jarir'), ('مكتبة جرير','jarir'), ('jarir','jarir'),
    ('اكسترا','extra'), ('إكسترا','extra'), ('extra','extra'),
    ('المنيع','almanea'), ('almanea','almanea'),
    ('أمازون','amazon'), ('أمازون السعودية','amazon'), ('amazon','amazon'),
    ('نون','noon'), ('noon','noon'),
    ('سامسونج السعودية','samsung_ksa'), ('samsung_ksa','samsung_ksa'),
    ('شاكر','shaker'), ('shaker','shaker'),
    ('الشتاء والصيف','swsg'), ('swsg','swsg')
)
SELECT DISTINCT r.slug AS missing_slug_in_stores
FROM resolution r
LEFT JOIN stores s ON s.slug = r.slug
WHERE s.id IS NULL;
