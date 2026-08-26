-- 38-demand-radar-weekly-stats.sql — Growth queue reset + redesign (founder
-- decision, 2026-08-26): the 24h founder-review expiry now hard-deletes
-- unreviewed demand_opportunities rows instead of soft-marking them
-- 'expired', and keeps no per-item detail. This is the only surviving
-- signal: how many were auto-cleared each ISO week, so over-flagging is
-- visible later without re-litigating individual posts.

CREATE TABLE IF NOT EXISTS demand_radar_weekly_stats (
  week_start date PRIMARY KEY,       -- Monday (UTC) of the ISO week
  expired_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE demand_radar_weekly_stats ENABLE ROW LEVEL SECURITY;
