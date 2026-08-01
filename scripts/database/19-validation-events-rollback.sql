-- 19-validation-events-rollback.sql — reverses 19-validation-events.sql (ADR-160).
--
-- VERIFIED BEFORE THE FORWARD MIGRATION WAS EXECUTED, not after: both files were run inside a
-- single transaction that was then ROLLED BACK, which proves they parse and execute in order and
-- leave nothing behind. A rolled-back transaction delivers no `NOTIFY`, so the rehearsal cost
-- nothing — see `scripts/database/run-19-dryrun.js`.
--
-- SAME RESIDUAL RISK AS THE FORWARD MIGRATION: a DROP is DDL, so Supabase's `pgrst_ddl_watch`
-- fires one PostgREST schema reload. Run it when no heavy pipeline writer is active (ADR-099).
--
-- DESTRUCTIVE: this deletes every recorded validation event. Export first if the history matters:
--   \copy (select * from observability.validation_events) to 'validation_events.csv' csv header

drop table if exists observability.validation_events;

-- Only drops the schema if nothing else was added to it in the meantime — `restrict` (the
-- default) refuses rather than cascading into someone else's work.
drop schema if exists observability restrict;
