-- 028 — HOT current-state model + persisted job state (ADR-252, SEV-1 remediation).
--
-- WHY THIS TABLE EXISTS. The 2026-08-15 SEV-1 proved the structural flaw: answering
-- "what is the current offer per (product, store)?" required re-reading a key's ENTIRE
-- append-only staging history (719k rows, growing ~30k/day) — read amplification that
-- exhausted the Supabase Disk IO Budget and took the consumer surface down.
-- `tps_current_offers` is the small HOT current-state: exactly one row per
-- (category, identity_key, store_id) holding the latest known offer. The corroborate
-- pass reads/writes ONLY this table going forward; `tps_identity_staging` becomes a
-- COLD append-only audit trail that the hot path never touches.
--
-- Size bound: |keys| × |stores that ever listed the key| ≈ tens of thousands of rows,
-- independent of observation history depth. 10× more observations → SAME table size.

create table if not exists tps_current_offers (
  category     text        not null,
  identity_key text        not null,
  store_id     integer     not null,
  raw_obs_id   bigint      not null,
  status       text        not null,
  price        numeric,
  url          text,
  name         text,
  confidence   integer,
  payload      jsonb       not null default '{}'::jsonb,
  observed_at  timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (category, identity_key, store_id)
)
-- fillfactor 90: leave page room so updates stay HOT (no index write) — the table is
-- update-heavy by design and has no index on mutable columns (CYBERTEC HOT guidance).
with (fillfactor = 90);

-- Read-back pattern is "all current offers for these touched keys".
create index if not exists tps_current_offers_key_idx
  on tps_current_offers (category, identity_key);

-- Constitution: every table enables RLS in its schema definition; no anon grant —
-- this is pipeline state, service-role only.
alter table tps_current_offers enable row level security;
revoke all on tps_current_offers from anon, authenticated;

-- ── Persisted background-job state (deploy/restart safety) ──────────────────────
-- The scheduler's boot-time "kick" timers re-ran every loop ~21 minutes after EVERY
-- deploy. On multi-deploy days that multiplied feed passes 2–3× (measured in the
-- ADR-251 forensics: 9–12 passes/day vs the designed 4) and meant a restart could
-- always trigger a work burst. Boot kicks now consult this table and SKIP when the
-- last success is fresher than the loop interval — a deploy can no longer create work.
create table if not exists tps_job_state (
  job             text        primary key,
  last_success_at timestamptz,
  last_note       text,
  updated_at      timestamptz not null default now()
);

alter table tps_job_state enable row level security;
revoke all on tps_job_state from anon, authenticated;
