-- ============================================================
-- 11-coupons-schema.sql
-- Coupon system: table, indexes, RLS policies
-- ============================================================

-- Create discount_type enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type') THEN
    CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount', 'free_shipping');
  END IF;
END$$;

-- ─── Table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  code          TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  discount_type  discount_type NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10,2),
  min_purchase   NUMERIC(10,2),
  max_discount   NUMERIC(10,2),
  starts_at      TIMESTAMPTZ DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  usage_count    INTEGER NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on coupon code
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_code_key;
ALTER TABLE coupons ADD CONSTRAINT coupons_code_key UNIQUE (code);

-- ─── Indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_coupons_store_id ON coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons(expires_at);
CREATE INDEX IF NOT EXISTS idx_coupons_created_by ON coupons(created_by);

-- ─── Updated-at trigger ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_coupons_updated_at ON coupons;
CREATE TRIGGER trigger_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_coupons_updated_at();

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Public: read active, non-expired coupons
DROP POLICY IF EXISTS "Public can read active coupons" ON coupons;
CREATE POLICY "Public can read active coupons" ON coupons
  FOR SELECT
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Admin: full access
DROP POLICY IF EXISTS "Admins have full access to coupons" ON coupons;
CREATE POLICY "Admins have full access to coupons" ON coupons
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Store owners: CRUD on their own store's coupons
DROP POLICY IF EXISTS "Store owners can manage their coupons" ON coupons;
CREATE POLICY "Store owners can manage their coupons" ON coupons
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = coupons.store_id
      AND stores.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = coupons.store_id
      AND stores.created_by = auth.uid()
    )
  );

-- Service role bypass (for API routes using service role key)
DROP POLICY IF EXISTS "Service role bypass for coupons" ON coupons;
CREATE POLICY "Service role bypass for coupons" ON coupons
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
