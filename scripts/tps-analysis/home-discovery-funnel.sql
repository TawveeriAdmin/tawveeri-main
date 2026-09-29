-- Parameters: replace dates. Session counts are anonymous browsers, not people.
-- Only the new contract; excludes historical events without mode and QA traffic.
-- Ordered milestones within the reporting window; retail clicks are not sales.
WITH events AS (
  SELECT session_id, created_at, event_type,
    CASE WHEN event_type = 'go_click' THEN meta->>'entry_source' ELSE source END AS source,
    CASE WHEN event_type = 'go_click' THEN 'retailer_exit'
         WHEN event_type = 'home_share' THEN 'share_' || (meta->>'step')
         ELSE meta->>'step' END AS step,
    meta->>'mode' AS mode, meta->>'state' AS state
  FROM usage_events
  WHERE created_at >= '2026-09-27T00:00:00Z' AND created_at < '2026-10-28T00:00:00Z'
    AND is_test = false AND session_id IS NOT NULL
    AND event_type IN ('home_mission', 'home_share', 'go_click')
    AND meta->>'mode' IN ('personal', 'example', 'shared')
), starts AS (
  SELECT session_id, source, min(created_at) AS started_at
  FROM events WHERE mode = 'personal' AND step = 'started' GROUP BY 1, 2
), reviews AS (
  SELECT s.*, min(e.created_at) AS reviewed_at FROM starts s
  LEFT JOIN events e ON e.session_id = s.session_id AND e.source = s.source
    AND e.mode = 'personal' AND e.step = 'reviewed' AND e.created_at >= s.started_at
  GROUP BY s.session_id, s.source, s.started_at
), plans AS (
  SELECT r.*, min(e.created_at) AS planned_at FROM reviews r
  LEFT JOIN events e ON e.session_id = r.session_id AND e.source = r.source
    AND e.mode = 'personal' AND e.step = 'plan' AND e.state IN ('ok','partial')
    AND e.created_at >= r.reviewed_at
  GROUP BY r.session_id, r.source, r.started_at, r.reviewed_at
), journey AS (
  SELECT p.*, min(e.created_at) AS exited_at FROM plans p
  LEFT JOIN events e ON e.session_id = p.session_id AND e.source = p.source
    AND e.mode = 'personal' AND e.step = 'retailer_exit' AND e.created_at >= p.planned_at
  GROUP BY p.session_id, p.source, p.started_at, p.reviewed_at, p.planned_at
), counts AS (
  SELECT source,
    count(DISTINCT session_id) FILTER (WHERE step = 'entry_view') AS viewed,
    count(DISTINCT session_id) FILTER (WHERE step = 'entry_click') AS clicked,
    count(DISTINCT session_id) FILTER (WHERE step = 'example_view') AS example_viewed,
    count(*) FILTER (WHERE step = 'plan_failed') AS failed_requests,
    count(*) FILTER (WHERE step = 'plan' AND state IN ('insufficient','need_categories')) AS no_usable_plan,
    count(*) FILTER (WHERE step = 'share_click') AS share_clicks,
    count(*) FILTER (WHERE step = 'share_created') AS links_created,
    count(*) FILTER (WHERE step = 'share_copied') AS links_copied,
    count(*) FILTER (WHERE step = 'share_opened') AS shared_opens
  FROM events GROUP BY source
), funnel AS (
  SELECT source, count(*) AS started, count(reviewed_at) AS reviewed,
    count(planned_at) AS planned, count(exited_at) AS exited
  FROM journey GROUP BY source
)
SELECT c.*, f.started, f.reviewed, f.planned, f.exited,
  round(100.0 * c.clicked / nullif(c.viewed, 0), 1) AS click_per_view_pct,
  round(100.0 * f.reviewed / nullif(f.started, 0), 1) AS review_per_start_pct,
  round(100.0 * f.planned / nullif(f.reviewed, 0), 1) AS plan_per_review_pct,
  round(100.0 * f.exited / nullif(f.planned, 0), 1) AS exit_per_plan_pct
FROM counts c LEFT JOIN funnel f USING (source) ORDER BY c.source;
-- click_per_view is an aggregate ratio, not an ordered/cohort attribution claim.
-- Shared opens do not prove a second person. Example visits are a separate mode.
