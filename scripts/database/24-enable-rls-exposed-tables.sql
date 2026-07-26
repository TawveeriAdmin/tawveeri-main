-- 24-enable-rls-exposed-tables.sql (ADR-117) — security-audit finding.
-- product_links and tps_scheduler_heartbeat had NO row-level security while anon holds the
-- Supabase default table grants → anon (the browser key) could read AND WRITE them. Both are
-- accessed ONLY from server routes (createServerClient = service_role; and raw pg) which BYPASS
-- RLS, so enabling RLS with NO policy = default-DENY for anon/authenticated, service-role
-- unaffected. Idempotent. Constitution: every table enables RLS.
alter table if exists public.product_links          enable row level security;
alter table if exists public.tps_scheduler_heartbeat enable row level security;
