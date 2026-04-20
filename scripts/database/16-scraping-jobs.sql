-- Migration 16: Admin-controlled scraping schedules + run history
-- Adds scraping_schedules (per-store job config) and scraping_runs (execution history).
-- The products.search_vector trigger already exists (01-schema.sql:454), so we rely on it for DB-backed search.

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE scraping_job_type AS ENUM ('discovery', 'price_update');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scraping_run_status AS ENUM ('pending', 'running', 'success', 'failed', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scraping_trigger_source AS ENUM ('schedule', 'manual', 'api');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- scraping_schedules
-- One row per (store_id, job_type). The dispatcher reads this table every minute.
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraping_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  job_type scraping_job_type NOT NULL,

  cron_expression TEXT NOT NULL DEFAULT '0 */6 * * *',
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  max_pages INTEGER DEFAULT 10,
  max_products INTEGER DEFAULT 100,
  older_than_hours INTEGER DEFAULT 24,
  categories TEXT[],

  is_live_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  last_run_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE (store_id, job_type)
);

CREATE INDEX IF NOT EXISTS idx_scraping_schedules_store ON scraping_schedules(store_id);
CREATE INDEX IF NOT EXISTS idx_scraping_schedules_enabled_next ON scraping_schedules(is_enabled, next_run_at)
  WHERE is_enabled = TRUE;

-- ============================================================================
-- scraping_runs
-- One row per execution (whether scheduled or manual).
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraping_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES scraping_schedules(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  job_type scraping_job_type NOT NULL,

  status scraping_run_status NOT NULL DEFAULT 'pending',

  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  products_discovered INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  price_changes_detected INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_summary JSONB,

  triggered_by scraping_trigger_source NOT NULL DEFAULT 'schedule',
  triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraping_runs_schedule ON scraping_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_scraping_runs_store ON scraping_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_scraping_runs_status ON scraping_runs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_runs_created_at ON scraping_runs(created_at DESC);

-- ============================================================================
-- updated_at trigger for scraping_schedules
-- ============================================================================

CREATE OR REPLACE FUNCTION touch_scraping_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scraping_schedules_updated_at ON scraping_schedules;
CREATE TRIGGER trg_scraping_schedules_updated_at
BEFORE UPDATE ON scraping_schedules
FOR EACH ROW EXECUTE FUNCTION touch_scraping_schedules_updated_at();

-- ============================================================================
-- RLS — admin-only
-- Server-side code uses service role, which bypasses RLS, so these policies
-- only matter for any direct anon/authenticated client access.
-- ============================================================================

ALTER TABLE scraping_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage scraping schedules" ON scraping_schedules;
CREATE POLICY "Admins can manage scraping schedules"
ON scraping_schedules FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view scraping runs" ON scraping_runs;
CREATE POLICY "Admins can view scraping runs"
ON scraping_runs FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert scraping runs" ON scraping_runs;
CREATE POLICY "Admins can insert scraping runs"
ON scraping_runs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update scraping runs" ON scraping_runs;
CREATE POLICY "Admins can update scraping runs"
ON scraping_runs FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- Seed default schedules (disabled) for every known scraper store.
-- Admin flips is_enabled=true from the UI when ready.
-- ============================================================================

INSERT INTO scraping_schedules (store_id, job_type, cron_expression, is_enabled, max_pages, max_products, older_than_hours)
SELECT s.id, 'discovery'::scraping_job_type, '0 2 * * *', FALSE, 200, 100, 24
FROM stores s
WHERE s.slug IN (
  'amazon','noon','jarir','extra','almanea',
  'shaker','samsung_ksa','swsg'
)
ON CONFLICT (store_id, job_type) DO NOTHING;

INSERT INTO scraping_schedules (store_id, job_type, cron_expression, is_enabled, max_pages, max_products, older_than_hours)
SELECT s.id, 'price_update'::scraping_job_type, '0 */6 * * *', FALSE, 10, 500, 24
FROM stores s
WHERE s.slug IN (
  'amazon','noon','jarir','extra','almanea',
  'shaker','samsung_ksa','swsg'
)
ON CONFLICT (store_id, job_type) DO NOTHING;
