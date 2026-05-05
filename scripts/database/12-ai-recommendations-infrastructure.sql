-- 12-ai-recommendations-infrastructure.sql
-- Captures all AI recommendation infrastructure into version control.
-- Idempotent: safe to run on an existing database where these objects already exist.
-- Extensions: pgvector, pgmq, pg_net, pg_cron

-- ============================================================
-- 1. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS hstore WITH SCHEMA extensions;

-- ============================================================
-- 2. product_views table (per-user view tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_views_user_id ON product_views(user_id);
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at ON product_views(viewed_at DESC);

-- RLS
ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_views' AND policyname = 'Users can insert their own views') THEN
    CREATE POLICY "Users can insert their own views" ON product_views FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_views' AND policyname = 'Users can read their own views') THEN
    CREATE POLICY "Users can read their own views" ON product_views FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_views' AND policyname = 'Admins can read all views') THEN
    CREATE POLICY "Admins can read all views" ON product_views FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );
  END IF;
END $$;

-- ============================================================
-- 3. products.embedding column
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE products ADD COLUMN embedding halfvec(1536);
  END IF;
END $$;

-- HNSW index for cosine similarity
CREATE INDEX IF NOT EXISTS idx_products_embedding_hnsw
  ON products USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 4. util schema + pgmq queue
-- ============================================================
CREATE SCHEMA IF NOT EXISTS util;

-- Create queue only if it doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.meta WHERE queue_name = 'embedding_jobs'
  ) THEN
    PERFORM pgmq.create('embedding_jobs');
  END IF;
END $$;

-- ============================================================
-- 5. product_embedding_input() — generates text for embedding
-- ============================================================
CREATE OR REPLACE FUNCTION product_embedding_input(p products)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN COALESCE(p.name_ar, '') || ' ' ||
         COALESCE(p.name_en, '') || ' ' ||
         COALESCE(p.brand, '') || ' ' ||
         COALESCE(p.model, '') || ' ' ||
         COALESCE(p.category::text, '') || ' ' ||
         COALESCE(p.description_ar, '') || ' ' ||
         COALESCE(p.description_en, '');
END;
$$;

-- ============================================================
-- 6. queue_product_embedding() trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION queue_product_embedding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pgmq.send(
    'embedding_jobs',
    jsonb_build_object(
      'product_id', NEW.id,
      'input', product_embedding_input(NEW)
    )
  );
  RETURN NEW;
END;
$$;

-- Triggers on products table
DROP TRIGGER IF EXISTS trg_queue_embedding_insert ON products;
CREATE TRIGGER trg_queue_embedding_insert
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION queue_product_embedding();

DROP TRIGGER IF EXISTS trg_queue_embedding_update ON products;
CREATE TRIGGER trg_queue_embedding_update
  AFTER UPDATE OF name_ar, name_en, brand, model, category, description_ar, description_en ON products
  FOR EACH ROW
  EXECUTE FUNCTION queue_product_embedding();

-- ============================================================
-- 7. util.process_embeddings() — pg_cron handler
-- ============================================================
CREATE OR REPLACE FUNCTION util.process_embeddings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_size int := 10;
  job record;
  jobs jsonb := '[]'::jsonb;
  job_count int := 0;
  edge_function_url text;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Read configuration
  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets WHERE name = 'supabase_url';

  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'Missing vault secrets (supabase_url, service_role_key). Skipping.';
    RETURN;
  END IF;

  edge_function_url := supabase_url || '/functions/v1/embed';

  -- Read up to batch_size jobs from the queue
  FOR job IN SELECT * FROM pgmq.read('embedding_jobs', 30, batch_size)
  LOOP
    jobs := jobs || jsonb_build_array(job.message);
    PERFORM pgmq.delete('embedding_jobs', job.msg_id);
    job_count := job_count + 1;
  END LOOP;

  IF job_count = 0 THEN
    RETURN;
  END IF;

  -- Call the Edge Function via pg_net
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('jobs', jobs)
  );
END;
$$;

-- Schedule pg_cron job (every 10 seconds)
SELECT cron.schedule(
  'process-embedding-jobs',
  '10 seconds',
  $$SELECT util.process_embeddings()$$
);

-- ============================================================
-- 8. Recommendation functions
-- ============================================================

-- 8a. match_similar_products — pgvector cosine similarity
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
  target_embedding halfvec(1536);
BEGIN
  SELECT p.embedding INTO target_embedding
  FROM products p WHERE p.id = target_product_id;

  IF target_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name_ar,
    p.name_en,
    p.slug,
    p.category::text,
    p.brand,
    p.model,
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

-- 8b. get_collaborative_recommendations — wishlist co-occurrence
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
    p.name_ar,
    p.name_en,
    p.slug,
    p.category::text,
    p.brand,
    p.model,
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

-- 8c. get_personalized_recommendations — user profile embedding
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
  user_embedding halfvec(1536);
  interacted_ids uuid[];
BEGIN
  -- Collect IDs user already interacted with
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

  -- Average user's interacted product embeddings
  SELECT avg(p.embedding)::halfvec(1536) INTO user_embedding
  FROM products p
  WHERE p.id = ANY(interacted_ids)
    AND p.embedding IS NOT NULL;

  IF user_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name_ar,
    p.name_en,
    p.slug,
    p.category::text,
    p.brand,
    p.model,
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

-- 8d. get_recommendations — unified orchestrator with fallback chain
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
  -- Direct type requests
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

  -- Auto mode: product page fallback chain
  IF p_product_id IS NOT NULL THEN
    -- Try embedding similarity first
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
        p.id, p.name_ar, p.name_en, p.slug, p.category::text,
        p.brand, p.model, p.image_urls,
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

  -- Auto mode: dashboard (no product_id)
  IF p_user_id IS NOT NULL THEN
    RETURN QUERY
    WITH personalized_results AS (
      SELECT * FROM get_personalized_recommendations(p_user_id, p_limit)
    ),
    global_fallback AS (
      SELECT
        p.id, p.name_ar, p.name_en, p.slug, p.category::text,
        p.brand, p.model, p.image_urls,
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

  -- Guest: global popularity
  RETURN QUERY
  SELECT
    p.id, p.name_ar, p.name_en, p.slug, p.category::text,
    p.brand, p.model, p.image_urls,
    p.view_count::float AS score,
    'popularity'::text AS source
  FROM products p
  WHERE p.is_active = true
  ORDER BY p.view_count DESC NULLS LAST
  LIMIT p_limit;
END;
$$;
