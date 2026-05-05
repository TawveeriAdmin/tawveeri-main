-- 13-migrate-embeddings-to-gemini.sql
-- One-time migration: OpenAI text-embedding-3-small (1536 dims) → Google Gemini gemini-embedding-001 (768 dims)
-- Run via Supabase SQL editor after deploying the updated Edge Function.

-- 1. Drop the HNSW index (cannot alter column type with index present)
DROP INDEX IF EXISTS idx_products_embedding_hnsw;

-- 2. NULL all existing embeddings (1536-dim vectors are incompatible with 768-dim)
UPDATE products SET embedding = NULL WHERE embedding IS NOT NULL;

-- 3. Change column type from halfvec(1536) to halfvec(768)
ALTER TABLE products ALTER COLUMN embedding TYPE halfvec(768);

-- 4. Recreate HNSW index for 768 dimensions
CREATE INDEX idx_products_embedding_hnsw
  ON products USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. Drop and recreate recommendation functions that reference halfvec(1536)
--    (DROP required because return type row definition differs)

DROP FUNCTION IF EXISTS get_recommendations(uuid, uuid, text, int);
DROP FUNCTION IF EXISTS match_similar_products(uuid, int, float);
DROP FUNCTION IF EXISTS match_similar_products(uuid, int, double precision);
DROP FUNCTION IF EXISTS get_collaborative_recommendations(uuid, int);
DROP FUNCTION IF EXISTS get_personalized_recommendations(uuid, int, float);
DROP FUNCTION IF EXISTS get_personalized_recommendations(uuid, int, double precision);

-- 5a. match_similar_products
CREATE OR REPLACE FUNCTION match_similar_products(
  target_product_id uuid,
  match_count int DEFAULT 8,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  slug text,
  category text,
  brand text,
  model text,
  image_urls text[],
  score float,
  source text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  target_embedding halfvec(768);
BEGIN
  SELECT p.embedding INTO target_embedding
  FROM products p WHERE p.id = target_product_id;

  IF target_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name_ar::text,
    p.name_en::text,
    p.slug::text,
    p.category::text,
    p.brand::text,
    p.model::text,
    p.image_urls,
    (1 - (p.embedding <=> target_embedding))::float AS score,
    'embedding'::text AS source
  FROM products p
  WHERE p.id != target_product_id
    AND p.embedding IS NOT NULL
    AND p.is_active = true
    AND (1 - (p.embedding <=> target_embedding)) > match_threshold
  ORDER BY p.embedding <=> target_embedding
  LIMIT match_count;
END;
$$;

-- 5b. get_personalized_recommendations
CREATE OR REPLACE FUNCTION get_personalized_recommendations(
  target_user_id uuid,
  match_count int DEFAULT 8,
  match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  slug text,
  category text,
  brand text,
  model text,
  image_urls text[],
  score float,
  source text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_embedding halfvec(768);
  interacted_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT pid) INTO interacted_ids
  FROM (
    SELECT product_id AS pid FROM user_wishlists WHERE user_id = target_user_id
    UNION
    SELECT product_id AS pid FROM product_views WHERE user_id = target_user_id
    UNION
    SELECT product_id AS pid FROM price_alerts WHERE user_id = target_user_id
  ) interactions;

  IF interacted_ids IS NULL OR array_length(interacted_ids, 1) = 0 THEN
    RETURN;
  END IF;

  SELECT avg(p.embedding)::halfvec(768) INTO user_embedding
  FROM products p
  WHERE p.id = ANY(interacted_ids)
    AND p.embedding IS NOT NULL;

  IF user_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name_ar::text,
    p.name_en::text,
    p.slug::text,
    p.category::text,
    p.brand::text,
    p.model::text,
    p.image_urls,
    (1 - (p.embedding <=> user_embedding))::float AS score,
    'personalized'::text AS source
  FROM products p
  WHERE p.embedding IS NOT NULL
    AND p.is_active = true
    AND NOT (p.id = ANY(interacted_ids))
    AND (1 - (p.embedding <=> user_embedding)) > match_threshold
  ORDER BY p.embedding <=> user_embedding
  LIMIT match_count;
END;
$$;

-- 5c. get_collaborative_recommendations (recreate after drop)
CREATE OR REPLACE FUNCTION get_collaborative_recommendations(
  target_product_id uuid,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  slug text,
  category text,
  brand text,
  model text,
  image_urls text[],
  score float,
  source text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name_ar::text,
    p.name_en::text,
    p.slug::text,
    p.category::text,
    p.brand::text,
    p.model::text,
    p.image_urls,
    co.co_count::float AS score,
    'collaborative'::text AS source
  FROM (
    SELECT uw2.product_id, COUNT(DISTINCT uw2.user_id) AS co_count
    FROM user_wishlists uw1
    JOIN user_wishlists uw2
      ON uw1.user_id = uw2.user_id
      AND uw2.product_id != target_product_id
    WHERE uw1.product_id = target_product_id
    GROUP BY uw2.product_id
    HAVING COUNT(DISTINCT uw2.user_id) >= 2
    ORDER BY co_count DESC
    LIMIT match_count
  ) co
  JOIN products p ON p.id = co.product_id
  WHERE p.is_active = true;
END;
$$;

-- 5d. get_recommendations (orchestrator, recreate after drop)
CREATE OR REPLACE FUNCTION get_recommendations(
  p_user_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_type text DEFAULT 'auto',
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  slug text,
  category text,
  brand text,
  model text,
  image_urls text[],
  score float,
  source text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  target_category text;
BEGIN
  IF p_type = 'similar' AND p_product_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM match_similar_products(p_product_id, p_limit);
    RETURN;
  END IF;

  IF p_type = 'collaborative' AND p_product_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM get_collaborative_recommendations(p_product_id, p_limit);
    RETURN;
  END IF;

  IF p_type = 'personalized' AND p_user_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM get_personalized_recommendations(p_user_id, p_limit);
    RETURN;
  END IF;

  IF p_product_id IS NOT NULL THEN
    RETURN QUERY
    WITH embedding_results AS (
      SELECT * FROM match_similar_products(p_product_id, p_limit)
    ),
    collab_results AS (
      SELECT * FROM get_collaborative_recommendations(p_product_id, p_limit)
      WHERE NOT EXISTS (SELECT 1 FROM embedding_results LIMIT 1)
    ),
    category_fallback AS (
      SELECT
        p.id, p.name_ar::text, p.name_en::text, p.slug::text, p.category::text,
        p.brand::text, p.model::text, p.image_urls,
        p.view_count::float AS score,
        'popularity'::text AS source
      FROM products p
      WHERE p.id != p_product_id
        AND p.is_active = true
        AND p.category = (SELECT pr.category FROM products pr WHERE pr.id = p_product_id)
        AND NOT EXISTS (SELECT 1 FROM embedding_results LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM collab_results LIMIT 1)
      ORDER BY p.view_count DESC NULLS LAST
      LIMIT p_limit
    )
    SELECT * FROM embedding_results
    UNION ALL
    SELECT * FROM collab_results
    UNION ALL
    SELECT * FROM category_fallback
    LIMIT p_limit;
    RETURN;
  END IF;

  IF p_user_id IS NOT NULL THEN
    RETURN QUERY
    WITH personalized_results AS (
      SELECT * FROM get_personalized_recommendations(p_user_id, p_limit)
    ),
    global_fallback AS (
      SELECT
        p.id, p.name_ar::text, p.name_en::text, p.slug::text, p.category::text,
        p.brand::text, p.model::text, p.image_urls,
        p.view_count::float AS score,
        'popularity'::text AS source
      FROM products p
      WHERE p.is_active = true
        AND NOT EXISTS (SELECT 1 FROM personalized_results LIMIT 1)
      ORDER BY p.view_count DESC NULLS LAST
      LIMIT p_limit
    )
    SELECT * FROM personalized_results
    UNION ALL
    SELECT * FROM global_fallback
    LIMIT p_limit;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name_ar::text, p.name_en::text, p.slug::text, p.category::text,
    p.brand::text, p.model::text, p.image_urls,
    p.view_count::float AS score,
    'popularity'::text AS source
  FROM products p
  WHERE p.is_active = true
  ORDER BY p.view_count DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- 6. Queue all active products for re-embedding with Gemini
SELECT pgmq.send(
  'embedding_jobs',
  jsonb_build_object(
    'product_id', p.id,
    'input', product_embedding_input(p)
  )
)
FROM products p
WHERE p.is_active = true;
