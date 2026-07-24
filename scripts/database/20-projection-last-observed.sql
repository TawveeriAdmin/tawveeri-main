-- Migration 20 (ADR-088): per-product freshness for the Trust Engine.
-- last_observed_at = the most recent priced observation across stores (build-tps-projection
-- computes max(observed_at)). Additive + idempotent. Unlike updated_at (the projection
-- build time), this is a real freshness signal the Trust Engine's freshness factor uses.
ALTER TABLE tps_product_projection ADD COLUMN IF NOT EXISTS last_observed_at timestamptz;
