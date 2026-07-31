-- 022 — product_matches idempotency (production gate, Step 2, 2026-07-31)
--
-- WHY. `write_ac_batch` inserts product_matches with NO conflict clause, and the table's only
-- unique index is its surrogate primary key. Re-processing the same raw observation therefore
-- appends a duplicate match row. Today the table is clean (5,963 rows / 5,963 distinct pairs),
-- but ONLY because the durable per-store cursor prevents reprocessing — and a backfill
-- necessarily rewinds that cursor, removing the sole protection.
--
-- SAFETY PROVEN BEFORE CREATING THE INDEX (production, 2026-07-31):
--   total = 5963 · distinct (raw_observation_id, canonical_product_id) = 5963
--   raw_observation_id NULL = 0 · canonical_product_id NULL = 0 · conflicting groups = 0
-- No existing row violates the constraint, and there are no NULLs to make uniqueness
-- ambiguous (Postgres treats NULLs as distinct, which would have silently weakened it).
--
-- CONCURRENTLY: builds without an ACCESS EXCLUSIVE lock, so live normalization is not blocked.
-- It cannot run inside a transaction block — the runner executes this file statement-by-
-- statement outside one.
create unique index concurrently if not exists product_matches_raw_canonical_uidx
  on product_matches (raw_observation_id, canonical_product_id);
