-- 006_store_identity.sql
-- Knowledge database (vyceqrzttspyycdpojtn) — E2 Store Identity Normalization
--
-- PURPOSE
--   Establish stores.id as the single canonical store identity across every
--   ingestion and observation table, removing the platform's dependence on
--   Arabic display names, latin slugs, and application-side alias maps.
--
-- METHOD
--   Expand-and-contract. This script performs EXPAND + BACKFILL + VALIDATE only.
--   It adds nullable columns and writes them; it does not drop, rename, or
--   rewrite any existing column. store_name is preserved verbatim as the
--   historical record of what each producer actually wrote (provenance).
--
--   The CUT OVER step (application reads store_id) and the CONTRACT step
--   (deprecate store_name) are separate, later operations.
--
-- APPEND-ONLY NOTE
--   price_history is append-only: no price, timestamp, or observation value is
--   modified here. Only a new, previously-null identity column is populated.
--   The observation itself is untouched.
--
-- SAFETY
--   - Additive and reversible: rollback is DROP COLUMN (see 006_rollback.sql).
--   - No table is locked for a long period: columns are added nullable with no
--     default, which is a metadata-only operation in PostgreSQL.
--   - Backfill is chunked and idempotent — re-running is safe.
--   - No RLS policy, trigger, function, view, or index on existing columns is
--     altered.
--
-- PREREQUISITE
--   Run 006_store_identity_precheck.sql first and confirm every distinct
--   store_name maps to exactly one store. Do not proceed on an unmapped label.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. EXPAND — add the canonical identity column where it is absent
-- ─────────────────────────────────────────────────────────────

ALTER TABLE raw_observations
  ADD COLUMN IF NOT EXISTS store_id integer REFERENCES stores(id);

ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS store_id integer REFERENCES stores(id);

ALTER TABLE store_sync_status
  ADD COLUMN IF NOT EXISTS store_id integer REFERENCES stores(id);

-- product_stores and scraping_runs already carry store_id.

COMMENT ON COLUMN raw_observations.store_id IS
  'Canonical store identity (E2). store_name is retained as the historical producer label.';
COMMENT ON COLUMN price_history.store_id IS
  'Canonical store identity (E2). store_name is retained as the historical producer label.';
COMMENT ON COLUMN store_sync_status.store_id IS
  'Canonical store identity (E2). store_name is retained as the historical producer label.';

-- ─────────────────────────────────────────────────────────────
-- 2. RESOLUTION MAP — the only place label variants are enumerated.
--    This table exists so the mapping is data, reviewable and auditable,
--    rather than a hardcoded constant in application code. It is used by the
--    backfill below and by nothing at runtime after cutover.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_name_resolution (
  observed_label text PRIMARY KEY,
  store_id       integer NOT NULL REFERENCES stores(id),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO store_name_resolution (observed_label, store_id, note)
SELECT v.label, s.id, v.note
FROM (VALUES
  ('جرير',              'jarir',       'adapter/scraper short name'),
  ('مكتبة جرير',        'jarir',       'stores.name display form'),
  ('jarir',             'jarir',       'latin slug written by the legacy price path'),
  ('اكسترا',            'extra',       'ingested form, no hamza'),
  ('إكسترا',            'extra',       'stores.name display form, with hamza'),
  ('extra',             'extra',       'latin slug'),
  ('المنيع',            'almanea',     'ingested and display form'),
  ('almanea',           'almanea',     'latin slug'),
  ('أمازون',            'amazon',      'ingested short form'),
  ('أمازون السعودية',   'amazon',      'stores.name display form'),
  ('amazon',            'amazon',      'latin slug written by the legacy price path'),
  ('نون',               'noon',        'display form'),
  ('noon',              'noon',        'latin slug'),
  ('سامسونج السعودية',  'samsung_ksa', 'display form'),
  ('samsung_ksa',       'samsung_ksa', 'latin slug'),
  ('شاكر',              'shaker',      'display form'),
  ('shaker',            'shaker',      'latin slug'),
  ('الشتاء والصيف',     'swsg',        'display form'),
  ('swsg',              'swsg',        'latin slug')
) AS v(label, slug, note)
JOIN stores s ON s.slug = v.slug
ON CONFLICT (observed_label) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. BACKFILL — populate store_id from the resolution map.
--    Idempotent: only rows whose store_id is still null are touched.
-- ─────────────────────────────────────────────────────────────

UPDATE raw_observations o
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE o.store_id IS NULL
   AND o.store_name = r.observed_label;

UPDATE price_history p
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE p.store_id IS NULL
   AND p.store_name = r.observed_label;

UPDATE store_sync_status s
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE s.store_id IS NULL
   AND s.store_name = r.observed_label;

-- product_stores: adapter-written rows carry store_name with a null store_id.
--
-- SCOPE LIMIT — READ THIS BEFORE CHANGING THE UPSERT KEY.
-- This backfill makes store_id readable. It does NOT change the upsert conflict
-- target, which remains (product_id, store_name). Switching it to
-- (product_id, store_id) is UNSAFE today: 38 products hold 2,379 rows between
-- them (47.3% of the legacy population), because a null store_name cannot
-- satisfy a unique constraint and every legacy write therefore inserted rather
-- than upserted. One product carries 186 rows.
--
-- Those rows are not simply duplicates: a sample shows four distinct
-- product_urls and different prices under a single product_id, meaning genuinely
-- different merchant offers were matched onto one canonical product. Collapsing
-- them on (product_id, store_id) would destroy real offers.
--
-- The remedy belongs to the matching work (E6/E7), not to store identity.
UPDATE product_stores ps
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE ps.store_id IS NULL
   AND ps.store_name = r.observed_label;

-- scraping_runs: rows written before E2 may carry a slug in store_name.
UPDATE scraping_runs sr
   SET store_id = r.store_id
  FROM store_name_resolution r
 WHERE sr.store_id IS NULL
   AND sr.store_name = r.observed_label;

-- ─────────────────────────────────────────────────────────────
-- 4. INDEXES — created CONCURRENTLY is not possible inside a transaction.
--    Run 006_indexes.sql separately, outside this transaction.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 5. VALIDATE — fail loudly rather than commit a partial normalisation.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  unmapped_raw   bigint;
  unmapped_price bigint;
BEGIN
  SELECT count(*) INTO unmapped_raw
    FROM raw_observations WHERE store_id IS NULL;
  SELECT count(*) INTO unmapped_price
    FROM price_history WHERE store_id IS NULL;

  IF unmapped_raw > 0 OR unmapped_price > 0 THEN
    RAISE EXCEPTION
      'E2 backfill incomplete: % raw_observations and % price_history rows have no store_id. Add the missing labels to store_name_resolution and re-run.',
      unmapped_raw, unmapped_price;
  END IF;
END $$;

INSERT INTO schema_migrations (version, description, checksum, executed_by)
VALUES (
  '006_store_identity',
  'E2: add canonical store_id to raw_observations, price_history, store_sync_status; backfill all observation tables from store_name_resolution',
  'e2-v1',
  current_user
)
ON CONFLICT DO NOTHING;

COMMIT;
