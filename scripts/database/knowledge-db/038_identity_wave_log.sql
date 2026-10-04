-- 038_identity_wave_log.sql · ADR-405 persistent Wave monitoring (2026-10-04)
-- Append-only measurements of the identity gate's wave cutover, written by scripts/tps-analysis/identity-wave-monitor.ts
-- (run as the optional `identity-monitor` step of the isolated identity runner, or by hand). It exists so the 48 h soak's
-- evidence — and a ROLLBACK_REQUIRED alert — survive a closed Claude session, a closed laptop and a worker redeploy.
--   source = 'baseline'  the pre-wave reference the collapse trigger compares against (one row per wave start)
--   source = 'runner'    one row per runner cycle (hourly)
--   source = 'manual'    a human-run measurement
-- Nothing reads this table in a customer path. Service-role only.
create table if not exists tps_identity_wave_log (
  id         bigserial primary key,
  taken_at   timestamptz not null default now(),
  source     text not null check (source in ('baseline', 'runner', 'manual')),
  categories text[] not null,
  verdict    text not null check (verdict in ('HEALTHY', 'ROLLBACK_REQUIRED', 'BASELINE')),
  triggers   text[] not null default '{}',
  metrics    jsonb not null
);

create index if not exists tps_identity_wave_log_taken_idx on tps_identity_wave_log (taken_at desc);
create index if not exists tps_identity_wave_log_source_idx on tps_identity_wave_log (source, taken_at desc);

alter table tps_identity_wave_log enable row level security;
revoke all on tps_identity_wave_log from anon, authenticated;
