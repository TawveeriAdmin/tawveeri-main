-- 37-client-role-privilege-sweep.sql — adjacent authorization defects (ADR-259, 2026-08-18)
--
-- ROOT CAUSE (found by the migration-36 regression test, which flagged it immediately)
-- `scripts/database/02-rls-policies.sql` ends with:
--     GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
--     GRANT ALL    ON ALL TABLES IN SCHEMA public TO authenticated;
--     GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
-- Every table and function created since inherited a privilege set nobody chose. The
-- users.role escalation (migration 36) was one symptom. This migration removes the rest.
--
-- ── FINDING 1 (P0) — anonymous writes into the knowledge layer ────────────────────────
-- `write_mobile_batch(jsonb,jsonb,jsonb,jsonb,uuid[])` is a PIPELINE WRITER: it upserts
-- canonical_products, normalized_product_observations, product_matches and price rows.
-- It is SECURITY INVOKER (so it runs with the caller's privileges — and the caller has
-- ALL on every table), and its ACL reads:
--     =X/postgres | postgres=X | anon=X | authenticated=X | service_role=X
-- The leading `=X` is EXECUTE granted to PUBLIC. PostgREST publishes public functions as
-- RPC, so `POST /rest/v1/rpc/write_mobile_batch` with the anon key — which ships in the
-- web bundle and the mobile binary — could write arbitrary canonical products and price
-- observations into production. Tawveeri would then serve fabricated products and prices
-- as observed truth. That is the price-truth moat, corrupted by an unauthenticated caller.
--
-- Its sibling `write_ac_batch` has exactly the right ACL (`postgres`, `service_role` only),
-- which is how we know this is an oversight rather than an intended capability. This
-- migration makes the two match. Verified NOT exploited: a full sweep found this is the
-- ONLY writer function reachable by a client role (1 of 159 public functions).
--
-- ── FINDING 2 (P1) — TRUNCATE on 47 tables ───────────────────────────────────────────
-- `GRANT ALL` includes TRUNCATE, and PostgreSQL is explicit that RLS does not save you:
--   "Operations that apply to the whole table, such as TRUNCATE and REFERENCES, are not
--    subject to row security." — postgresql.org/docs/current/ddl-rowsecurity.html
-- anon and authenticated held TRUNCATE on 46 and 47 tables respectively, including
-- raw_observations (1.7M rows — the irreplaceable observation history), price_history,
-- products and canonical_products. There is no PostgREST verb that emits TRUNCATE, so we
-- classify this P1 rather than P0: catastrophic blast radius, no currently reachable path.
-- But "no reachable path" was also true of write_mobile_batch until someone wrote it, and
-- these privileges have no legitimate use. TRIGGER and REFERENCES go with them.
--
-- ── FINDING 3 (P1) — anon holds INSERT/UPDATE/DELETE everywhere ───────────────────────
-- Every write policy in this database keys on auth.uid() (or is_admin(), or service_role),
-- and auth.uid() is NULL for anon — so RLS already denies every anonymous write. Removing
-- the grants is therefore functionally a no-op and removes the accident surface. This is
-- defence in depth against exactly the pattern above: a future SECURITY INVOKER function
-- that assumes "anon can't write anyway".
--
-- ROLLBACK / RECOVERY
--   Reverses cleanly and touches no data — zero rows are read or written.
--     GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;  -- (do not: see above)
--     GRANT EXECUTE ON FUNCTION public.write_mobile_batch(jsonb,jsonb,jsonb,jsonb,uuid[]) TO service_role;
--   The pipeline is unaffected: every writer runs as service_role, which keeps ALL.
--   Consumer reads are unaffected: SELECT grants are untouched.
--   If a legitimate anonymous write is ever needed, grant that ONE table that ONE verb.

-- ── Finding 1: lock the pipeline writer to the service role ─────────────────────────
REVOKE EXECUTE ON FUNCTION public.write_mobile_batch(jsonb, jsonb, jsonb, jsonb, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.write_mobile_batch(jsonb, jsonb, jsonb, jsonb, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.write_mobile_batch(jsonb, jsonb, jsonb, jsonb, uuid[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.write_mobile_batch(jsonb, jsonb, jsonb, jsonb, uuid[]) TO service_role;

-- ── Finding 2: no client role may ever act on a whole table ─────────────────────────
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ── Finding 3: anon reads, anon does not write ──────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- ── Stop the bleeding at the source ─────────────────────────────────────────────────
-- Future tables and functions inherit DEFAULT PRIVILEGES, not the 02-era blanket grants.
-- Without this, the next `CREATE TABLE` re-creates the whole problem for one more table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;
