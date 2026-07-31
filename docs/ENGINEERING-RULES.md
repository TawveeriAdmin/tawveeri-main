# PERMANENT ENGINEERING RULES
**Failure classes this project has paid for. Each entry is a rule, its evidence, and how to detect it.**

---

## RULE 1 — EVIDENCE GENERATED BUT NOT PROPAGATED
**Established 2026-07-31 · Constitution Principle 7 (Every Price Has Provenance)**

> **If a write creates evidence, the identifier that proves it must travel to every writer in
> the same flow that records a consequence of that evidence. A layer that generates evidence
> and discards its identifier has destroyed provenance as surely as if it had never written
> the evidence at all.**

### Why this is its own failure class

It does not look like a bug. Nothing errors, nothing is lost, every row is written, every
count is correct, and every test passes. The evidence exists and is complete. What is missing
is the *link* — and nothing in the system complains, because no constraint was violated and
no exception was raised. It is discovered only when someone asks a question that requires
following the chain, which can be months later.

It is distinct from data loss (nothing is lost), from a null-handling bug (the null is
written deliberately), and from a schema gap (the column already exists).

### The signature

1. A function writes evidence — an observation, a measurement, a fact.
2. It returns a **count, a boolean, or nothing**, discarding the generated identifiers.
3. A sibling writer in the same request records a consequence of that evidence.
4. The FK linking them **already exists in the schema and is nullable**.
5. It is therefore silently written as NULL, forever.

**The nullable FK is the tell.** A column that exists, is never populated, and never errors is
almost always this failure.

### Occurrence 1 — discovery observations (FIXED, `discover-firecrawl`)

`writeRawObservations` did `.insert(rows)` and returned a count. `writePriceSnapshot` ran a few
lines later in the same request and had no id to reference, so
`price_history.raw_observation_id` was NULL on every discovery row ever written.

**Measured cost:** 2,321 customer-visible offers whose displayed freshness could not be proven,
growing ~654 rows/day. It also forced the display layer to reconstruct provenance from a JSON
field (`normalized_payload._raw_id`) instead of reading the FK.

**Fix:** `.insert(rows).select('id, raw_url')` — a RETURNING clause on the same statement — and
carry the map to the price writer. **Measured cost of the fix: +10.4 ms per 100 rows (+3.9%),
~31 ms on a 300-row batch. No extra query, no extra round trip.**

### Occurrence 2 — the TPS normalization write (OPEN, not fixed)

`scripts/database/knowledge-db/008_write_ac_batch.sql:59` writes a **literal `null`** into
`price_history.raw_observation_id`, although the caller holds `o.raw_obs_id` — it uses that
very value to build the deterministic normalized id and to populate
`normalized_payload._raw_id`.

**Measured:** `raw_observation_id` is NULL on **all 88,359** `price_history` rows, including
all 6,656 written by the TPS path.

**Fix (one line each side):** add `raw_observation_id` to the `priceRows` object in
`progressive-engine.ts`, and select it instead of `null` in the RPC. Not done — it changes the
shared RPC used by the whole normalization chain and belongs in its own unit.

### Checked and NOT instances

| site | why it is fine |
|---|---|
| `outbound_clicks` (`/go`) | carries `offer_id`, `canonical_product_id` and `sub_id` — full provenance |
| `usage_events` | terminal telemetry; nothing downstream references it |
| `price_history` from merchant portal (`bulk-update`, `store/sync`) | carries `product_store_id`; no raw observation exists in that flow |
| `notifications`, `admin_logs`, `phone_otps`, `login_sessions` | fire-and-forget by design; no downstream consumer of the id |

### How to detect it — run this when adding any evidence writer

```sql
-- any nullable FK on an evidence table that is NEVER populated is a candidate
select count(*) total, count(<fk_column>) populated from <evidence_table>;
```

`populated = 0` on a column that exists means either the link is dead or it was never wired.
Both are this failure.

### The review question

> *"Which downstream writer needs to reference what I just created — and can it?"*

If the answer is "something does, but it can't", the identifier must be returned. Returning it
is nearly always a RETURNING clause on a statement already being executed, not a new query.
