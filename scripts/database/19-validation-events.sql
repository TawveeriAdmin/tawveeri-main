-- 19-validation-events.sql — F7 durable validation logging (ADR-160).
--
-- WHY A NON-EXPOSED SCHEMA, AND NOT `public`.
-- PostgREST introspects only the schemas it is configured to expose (`public`, `graphql_public`).
-- A table in `observability` is therefore INVISIBLE to the REST layer: it adds nothing to the
-- schema cache, cannot be reached by `anon` through the API under any misconfiguration, and does
-- not enlarge the catalog introspection that the PGRST002 incident turned into an outage. The
-- writer reaches it by direct `pg` connection, the same path `api/debug/scheduler` already uses.
--
-- RESIDUAL RISK, STATED HONESTLY. Supabase installs the `pgrst_ddl_watch` event trigger, which
-- fires `NOTIFY pgrst, 'reload schema'` on ANY `ddl_command_end` — schema placement does not
-- change that. So this migration DOES trigger one PostgREST schema reload, exactly as every
-- Supabase migration does. That is routine in a healthy system; it became an outage once
-- (CHECKPOINT/CLAUDE.md, PGRST002) only when a reload coincided with heavy concurrent pipeline
-- writes AND an authenticator `statement_timeout` too low for cold catalog introspection. Both
-- conditions are addressed: role timeouts are relaxed (authenticator 30s, anon/authenticated/
-- service_role 20s), and this must be run when no heavy pipeline writer is active — the
-- scheduler OWNS realization, and manual heavy jobs must never run concurrently (ADR-099).
--
-- ROLLBACK: `19-validation-events-rollback.sql`. It carries the identical (small) reload risk,
-- because a DROP is also DDL. Both were dry-run inside a single rolled-back transaction before
-- this was executed — a rolled-back transaction delivers no NOTIFY, so the rehearsal costs
-- nothing.
--
-- LOGGING IS OBSERVABILITY, NEVER A DEPENDENCY OF THE GUARD. Nothing in the validator reads this
-- table. If it is missing, unreachable, or slow, the guard still suppresses.

create schema if not exists observability;

create table if not exists observability.validation_events (
  id                  bigserial primary key,

  -- When the answer was validated, as supplied by the caller (not the DB clock) so an event is
  -- reproducible and can be replayed from a log line without shifting.
  occurred_at         timestamptz not null,

  -- THE THREE OUTCOMES, kept distinct at the storage layer too. Folding `unavailable` into
  -- `rejected` would let a broken guard hide inside a healthy-looking rejection rate — the
  -- question this table exists to answer is "was the guard running?", and only three states can
  -- answer it.
  outcome             text        not null check (outcome in ('passed', 'rejected', 'unavailable')),

  surface             text        not null,
  query               text,
  generated           text,
  generated_truncated boolean     not null default false,
  violated_rules      text[]      not null default '{}',
  findings            jsonb       not null default '[]'::jsonb,
  unavailable_reason  text,
  decision            text        not null,

  -- The vocabulary this verdict was judged under. An answer approved under one version is never
  -- assumed approved under the next, and this is what makes that auditable after the fact.
  vocabulary_version  text        not null,
  fingerprint         text        not null,

  recorded_at         timestamptz not null default now()
);

-- "Was the guard running, and what did it do?" — the only two queries this table exists for.
create index if not exists validation_events_occurred_at_idx
  on observability.validation_events (occurred_at desc);
create index if not exists validation_events_outcome_idx
  on observability.validation_events (outcome, occurred_at desc);

-- RLS even here. The schema is not exposed and no API role can reach it, but the house rule is
-- that every table enables RLS in its own definition — a table that relies on its schema staying
-- unexposed is one config change from being public.
alter table observability.validation_events enable row level security;
alter table observability.validation_events force row level security;

-- No policies, and no grants to the API roles: this table is written by the direct-connection
-- writer only, and read by an operator.
revoke all on schema observability from anon, authenticated;
revoke all on all tables in schema observability from anon, authenticated;

comment on table observability.validation_events is
  'F7 post-generation validation events. Observability only — never read by the validator. ADR-160.';
