-- 29-price-truth-quarantine.sql
-- P0 incident 2026-08-05 (see docs/DECISIONS.md ADR pending / HANDOVER):
-- Amazon offer B0F8JHSMMD (LG OLED65C56LA) showed SAR 259 on Best Deals against a real
-- Amazon.sa price of SAR 8,699 — a misparsed price (same bug class as ADR-200/ADR-204,
-- fixed in the Amazon PDP scraper 2026-08-03/04, but this row predates the fix and no
-- storefront write-time or read-time price-sanity gate existed to catch it).
--
-- Adds a reversible quarantine mechanism to product_stores:
--   price_quarantined_at / price_quarantine_reason — set when a price fails the sanity
--     gate (src/lib/intelligence/price-truth-gate.ts); current_price is left UNTOUCHED
--     (evidence preserved, never silently overwritten).
--   price_pending_value / price_pending_since — the anomalous value, held for one-time
--     re-confirmation. If a SECOND consecutive observation agrees, the price is treated
--     as a genuine (if surprising) market move and promoted; a lone misparse never is.
--
-- The public RLS SELECT policy on product_stores is updated to exclude quarantined rows,
-- which closes every anon/browser-key read path (product page, search filters, store
-- pages) in one place. Service-role read paths (getDeals.ts, search API route) are NOT
-- covered by RLS and get an explicit `.is('price_quarantined_at', null)` filter in code.
--
-- Rollback: `ALTER TABLE product_stores DROP COLUMN price_quarantined_at, DROP COLUMN
-- price_quarantine_reason, DROP COLUMN price_pending_value, DROP COLUMN price_pending_since;`
-- then restore the previous policy with `USING (true)`.

ALTER TABLE product_stores
  ADD COLUMN IF NOT EXISTS price_quarantined_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_quarantine_reason text,
  ADD COLUMN IF NOT EXISTS price_pending_value numeric,
  ADD COLUMN IF NOT EXISTS price_pending_since timestamptz;

CREATE INDEX IF NOT EXISTS idx_product_stores_price_quarantined
  ON product_stores (price_quarantined_at)
  WHERE price_quarantined_at IS NOT NULL;

DROP POLICY IF EXISTS "public read product_stores" ON product_stores;
CREATE POLICY "public read product_stores" ON product_stores
  FOR SELECT
  USING (price_quarantined_at IS NULL);
