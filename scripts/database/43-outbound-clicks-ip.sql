-- 43-outbound-clicks-ip.sql — Additive, non-destructive. IP capture on outbound_clicks (ADR-282).
--
-- Context: investigating a live redirect anomaly (docs/report/AUGUST-2026-FOUNDER-REVIEW.md
-- §12, and a materially LARGER live instance found 2026-09-01 — 617 rows in ~10 hours, 100%
-- with no session_id, cycling through only 11 real-browser user agents, referrer spoofed as
-- tawveeri.com) found outbound_clicks has no IP column at all — there is currently no way to
-- even IDENTIFY, let alone rate-limit or block, whatever is generating this traffic pattern.
--
-- Deliberately the SMALLEST safe step: capture IP on future redirects only (historical rows
-- are never rewritten). Does NOT add rate limiting, blocking, or any change to redirect
-- BEHAVIOR — /go is the revenue-critical exit path and a rate-limit mistake there risks
-- blocking real customers, so that decision is left to the founder with this data in hand,
-- not made unilaterally here. RLS/access pattern matches every other raw-migration table in
-- this schema (usage_events, outbound_clicks itself): service-role only, no anon/authenticated
-- policies — this column carries no more sensitivity than user_agent/referrer already do.

alter table outbound_clicks add column if not exists ip_address text;

create index if not exists outbound_clicks_ip_idx on outbound_clicks (ip_address) where ip_address is not null;
