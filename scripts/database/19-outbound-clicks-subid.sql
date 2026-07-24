-- Migration 19 (ADR-085): per-click sub-id for affiliate conversion attribution.
-- Additive + idempotent. The provider framework writes an opaque sub_id per outbound
-- click (Amazon ascsubtag, param-network subIdParam); a future conversion webhook
-- matches the network-reported sub-id back to this row for full-funnel attribution.
ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS sub_id text;
