# PRODUCTION GATE — normalize discovery observations + backfill
**2026-07-31 · Read-only. VERDICT: GATE DOES NOT OPEN. Nothing implemented.**

Three of five gates fail on measured evidence. The proposal's premise is wrong in a way that
would have made the fix ineffective, and the backfill is not idempotent.

---

## GATE 1 — ❌ FAILS AS STATED

**Claim to prove:** missing normalized discovery observations are the *direct* cause of the
2,321 canonicals being excluded from projection.

**They are not.** The direct cause is `tps_identity_key IS NULL`.

`scripts/build-tps-projection.ts` has **two** filters:
- line 160 — `where ph.tps_observation_id is not null` (inside the price aggregate)
- line 179 — `where c.tps_identity_key is not null`
- line 178 — `left join agg a on a.canonical_product_id = c.id`

Because the join is a **LEFT** join, a canonical carrying an identity key is projected **even
with no qualifying price rows**. So the obs-id filter cannot be what excludes a canonical; only
the identity-key filter can.

**Measured, exhaustive, no exceptions in either direction:**

| `tps_identity_key` | canonicals | in projection |
|---|---|---|
| NOT NULL | 5,052 | **5,052 (100%)** |
| NULL | 2,321 | **0 (0%)** |

And of the 2,321 unroutable canonicals: `identity_key_null = 2321`, `identity_key_set = 0`,
`no_canonical_row = 0`.

**Source:** `src/app/api/cron/discover-firecrawl/route.ts:61` `ensureCanonicalProduct` inserts
only `name_ar, name_en, brand, category` — **no `tps_identity_key`** — and matches existing rows
on **exact `name_ar`**.

**Consequence for the proposed fix:** having discovery write a normalized observation would
**not, by itself, admit these canonicals**. The two symptoms share a root (normalization is
skipped) but the projection blocker is the identity key. A fix aimed at the obs id would have
been deployed, measured, and found to move nothing.

---

## GATE 2 — ❌ CANNOT BE ANSWERED WITH MEASURED EVIDENCE (and one input is adverse)

| requested figure | status |
|---|---|
| canonicals currently excluded | **2,321** — measured |
| canonicals expected to enter projection | **NOT 2,321** — see below |
| expected increase in comparable products | **unmeasured** |
| expected increase in outbound exits | **unmeasured** |
| effect on identity resolution | **adverse signal found** |
| effect on refresh cost | **unmeasured** |

**Why "expected to enter projection" is not 2,321.** Normalization resolves identity
independently and attaches offers to canonicals keyed by `tps_identity_key` — reusing an
existing id when the key is already in the graph (`progressive-engine.ts:172–178`, ADR-096).
It would **not** adopt the keyless rows `ensureCanonicalProduct` minted. Those 2,321 would
remain orphaned duplicates requiring separate cleanup. They are bypassed, not admitted.

**Adverse identity signal:** of 3,000 sampled discovery `raw_url`s, **561 (18.7%) are already
present in `normalized_product_observations`** — the listing is already normalized under a
proper canonical. So a material share of the backfill re-attaches existing listings rather than
adding products, and the keyless canonicals are partly duplicates of rows we already hold.

**Why the rest is unmeasured:** it requires a bounded dry run, and
`scripts/tps-core/normalize-incremental.ts` has **no `--dry` flag** — despite CLAUDE.md's
"manual runs must be serialized, `--dry`-first" rule. A dry mode is a prerequisite for
answering Gate 2 honestly, not an optional nicety.

---

## ⟶ STEPS 1–3 EXECUTED 2026-07-31 — see the appendix at the end of this file.
## ⟶ GATE 3's finding below is CORRECTED there: I missed `write_ac_batch` line 42's DELETE.

## GATE 3 — ❌ FAILS. The backfill is NOT fully idempotent.

`write_ac_batch` (`scripts/database/knowledge-db/008_write_ac_batch.sql`), per write target:

| target | conflict handling | idempotent? |
|---|---|---|
| `canonical_products` | `on conflict (id) do update` (line 26), id deterministic via `stableUuid(canonSeed(key))`, existing id reused by identity key | ✅ |
| `normalized_product_observations` | `on conflict (id) do update` (line 38), id deterministic via `stableUuid(normSeed(raw_obs_id))` | ✅ |
| **`product_matches`** | **plain INSERT, no conflict clause** (line 43). Only index is `product_matches_pkey` (surrogate) — **no natural unique key** on `(raw_observation_id, canonical_product_id)` | ❌ **duplicates** |
| **`price_history`** | **plain INSERT, no conflict clause** (line 49) | ⚠️ soft only |

`price_history` is protected *only* by an application-level filter — `changedPrices`
(`progressive-engine.ts:243`) drops rows whose price equals the last recorded value. That is a
code-level guard, not a database constraint, and it does not survive a change to that code path.

**Why today's zero duplicates prove nothing.** `product_matches` currently has
`total_matches = 5963`, `distinct_pairs = 5963`, `duplicate_rows = 0`. That is because the
**durable per-store cursor** (`tps_progress_cursors`) prevents reprocessing — not because the
write is protected. **A backfill necessarily rewinds that cursor, which removes the only thing
currently preventing duplicates.**

**To pass:** add a unique index on `product_matches (raw_observation_id, canonical_product_id)`
with `on conflict do nothing`, and a natural-key guard on the `price_history` insert. Until
then, running the backfill twice corrupts match evidence.

---

## GATE 4 — ⛔ NOT REACHED

Not assessed, because gates 1–3 already close the decision. Would require proving the discovery
change cannot alter behaviour for the 23-store scraper path that currently writes correctly.

## GATE 5 — ROLLBACK (definable, but moot until 1–3 pass)

- **Source fix** — ordinary revert; it is one route file, additive.
- **Backfill** — *not* cleanly revertible today. `canonical_products` and
  `normalized_product_observations` upserts are replayable, but duplicated `product_matches`
  rows have no natural key to dedupe on, and appended `price_history` rows are immutable
  evidence by constitutional rule (`price_history` append-only). **A backfill that goes wrong
  cannot be fully undone.** That alone justifies holding until Gate 3 passes.

---

## RECOMMENDED ORDER (not started, no authority claimed)

1. **Add `--dry` to `normalize-incremental.ts`** — prerequisite for Gate 2.
2. **Add the unique index + conflict clauses** — prerequisite for Gate 3.
3. **Re-run Gate 2 as a dry run** and report measured expected deltas.
4. Only then: source fix, then bounded backfill, then re-measure.

The source fix must assign `tps_identity_key`, not merely write a normalized observation —
that is Gate 1's correction, and it is the difference between a fix that works and one that
measures as a no-op.

---

# APPENDIX — STEPS 1–3 EXECUTED (2026-07-31)

Authorised scope: Steps 1–3 only. **No source fix. No backfill.**

## CORRECTION TO GATE 3 — I misread the function

Gate 3 above states `product_matches` is a "plain INSERT, no conflict clause". That is true of
the INSERT statement and **incomplete**: `write_ac_batch` line 42 does
`delete from product_matches where canonical_product_id = any(p_canonical_ids)` first. Matches
**are** idempotent *within a batch* — the same canonical ids are cleared and rewritten.

The residual hazard is narrower than I reported: if a raw observation is re-matched to a
**different** canonical, the old row survives under its old canonical id and the pair can
collide. That is a real cross-batch case, and it is what the new index addresses.

## STEP 1 — `--dry-run`, PROVEN NON-MUTATING

`scripts/tps-core/normalize-incremental.ts --dry-run [--replay-from <rawId>]`. Full read,
detect, classify, identity-key and corroboration logic; no cursor advance, no staging, no
`write_ac_batch`. Does not take the lane lock, so a diagnostic run cannot block the hourly chain.

Proven by snapshot around a full replay — **byte-identical**:

| | before | after |
|---|---|---|
| canonical_products · normalized_obs · product_matches | 7,373 · 120,612 · 5,963 | same |
| price_history · staging · `_all_` cursors | 88,262 · 294,957 · 7,810,265 | same |

*Instrument note:* the first snapshot summed **all** cursor categories and appeared to move by
913. That was `_sweep_tick`, a scheduler heartbeat row, not a normalization cursor. The correct
metric is `category='_all_'` only. Caught before it became a false "dry run mutates data" claim.

**`--replay-from` was required and is dry-only.** All 103,106 discovery observations sit
**behind** their store cursors (store 4: 51,535 · store 5: 45,680 · store 2: 5,891 — exactly
103,106), every cursor is caught up, so a cursor-relative dry run reads 0 and can say nothing
about them. They were scanned, undetected, and skipped. **The incremental normalizer will never
pick them up**; only a deliberate bounded replay can.

## STEP 2 — idempotency protection, applied

Pre-flight proof against live data, immediately before creating the index:
`total 5963 · nulls 0 · conflicting groups 0`.

- `scripts/database/knowledge-db/022_product_matches_idempotency.sql` —
  `create unique index concurrently product_matches_raw_canonical_uidx (raw_observation_id, canonical_product_id)`.
  Verified live: `indisunique=true, indisvalid=true` (a CONCURRENTLY build can leave an INVALID
  index; it did not).
- `008_write_ac_batch.sql` — added
  `on conflict (raw_observation_id, canonical_product_id) do nothing`.
  **This was mandatory once the index existed**, not optional: without it the index converts a
  benign duplicate into a hard error that rolls back the whole batch — trading silent
  duplication for loud data loss.
- Smoke-tested live with empty arrays: returns `{canonical:0,normalized:0,matches:0,prices:0}`,
  all table counts unchanged.

## STEP 3 — GATE 2, MEASURED (dry replay, 498 observations, stores 4/5/2, raw id > 700,000)

| measure | value |
|---|---|
| eligible observations read | **498** |
| would be STAGED (detected by a plugin) | **303** |
| **would receive `tps_identity_key`** (valid tier) | **239** |
| distinct identity keys touched | 289 |
| would be NORMALIZED | 2,312 — **see caveat** |
| canonicals that would be written | **19** |
| — of which corroborated (≥2 stores, comparable) | **19** |
| — single-store (Layer 2) | 237 |
| product_matches that would be written | **44** |
| price_history rows appended | **0** |
| skipped: not detected by any plugin | 128 |
| skipped: low confidence | 64 |
| skipped: invalid identity tier | 67 |

**Caveat on "normalized 2,312".** It is not 2,312 new rows. `corroboratePass` rewrites the
normalized rows for *all* staging under every touched key, most of which already exist and are
upserted in place by deterministic id. Read it as write volume, not as new products.

**Caveat on extrapolation.** 498 of 103,106 is a **0.48% slice, and not a random one** — it is
the highest-id (most recent) rows. Linear scaling would suggest ~3,900 canonicals across the
full population, but that number is an estimate from a biased slice and **must not be quoted as
a measurement**. A larger stratified replay is cheap and should precede any Step 4 decision.

**Answer to "canonicals expected to enter projection".** The 19 canonicals here carry identity
keys and would enter. **They are not the 2,321 keyless rows** — those remain excluded and
orphaned, exactly as Gate 1's correction predicted. Any Step 4 plan must state what happens to
them; normalising discovery does not clean them up.

**Price impact is zero in this slice** (0 rows appended), because `changedPrices` compares to
the last recorded price and these prices are unchanged. That is reassuring but slice-specific:
replaying *older* observations whose price differs from today's last value **would** append
rows carrying historical `observed_at` values. That is a Step 4 gate, unresolved.

## STILL NOT PROVEN — Step 4 remains closed

- source fix assigns `tps_identity_key` (not written yet)
- bounded backfill idempotent end-to-end (price_history append hazard above is open)
- batch can be stopped safely between chunks (untested)
- measured impact justifies the risk (needs a stratified replay, not this slice)
- rollback: `price_history` is append-only by constitutional rule, so a backfill that appends
  wrong rows **cannot be cleanly undone**. Unchanged from the original gate.
