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

---

## RULE 1 — OCCURRENCE 2 GATE ASSESSMENT (`write_ac_batch`) · 2026-07-31
**VERDICT: DEFER. Do not change the RPC now. Zero immediate customer benefit, and it
introduces a failure mode that does not exist today.**

### §1 — Blast radius: 13 call paths, not one

**Direct RPC callers (5):** `progressive-engine.ts:325` (the main path) ·
`write-alias-canonicals.ts:251` · `write-model-canonicals.ts:111` ·
`tps-matcher/ac-matcher-v1-dry.ts:167` · `tps-matcher/audio-matcher-v1-dry.ts:168`

**Indirect via `corroboratePass` / `runSweepUnit` (8):** `/api/cron/dispatch` (the hourly
scheduler) · `/api/cron/tps-progressive` · `normalize-incremental` ·
`onboard-store-corroborate` · `bulk-backfill` · `run-progressive` · `write-resolved-single`

**Backward compatibility: SATISFIED.** The change reads `r->>'raw_observation_id'` from the
`p_prices` payload. Four of the five direct callers never supply that key, so it evaluates to
NULL — byte-identical to today's literal `null`. **No caller depends on the current behaviour
in a way that breaks.**

**BUT IT INTRODUCES A NEW FAILURE MODE.** `price_history` carries
`price_history_raw_observation_id_fkey REFERENCES raw_observations(id)`. Supplying an id that
no longer exists raises an FK violation, and because `write_ac_batch` is one transaction, **the
entire batch rolls back** — the normalization chain aborts. Today the RPC writes a literal
`null` and this is unreachable.

Measured exposure: **0 orphans across 298,075 staging rows.** The risk is real but currently
unexercised — a raw observation deleted between staging and the batch write would trigger it.

### §2 — DDL operational risk: LOW, measured empirically

`CREATE OR REPLACE FUNCTION` changes the **body only**; the signature is unchanged, so PostgREST
RPC routing is unaffected and **no schema reload is expected**.

**This is not a prediction — it was measured today.** The same function was replaced earlier
(Step 2, adding the match conflict clause). Since then: **37 successful runs in 6 hours and
2,373 normalized observations written through the RPC**, with no PostgREST incident and no
`PGRST002`.

| | |
|---|---|
| **Symptoms of failure** | normalization runs flipping to `partial`/`failed` with FK-violation errors; `normalized_product_observations` flat-lining; `PGRST002` on REST endpoints (schema cache wedged, per ADR-099) |
| **Rollback** | re-apply the previous `008_write_ac_batch.sql` from git — a single `CREATE OR REPLACE`, no data to undo |
| **Window** | none required on this evidence, but apply when the normalization lane is free and verify one full cycle immediately after |

### §3 — Can the existing 88,359 rows be reconstructed? **YES — and that is why we should not.**

Reconstruction is deterministic, measured at the customer-visible offer level (8,148 offers):

| population | offers | route | determinism |
|---|---|---|---|
| already linked | 269 | new discovery writes | n/a |
| **via chain** | **5,827** | `tps_observation_id` → `normalized_payload._raw_id` → `raw_observations.id` | **99.91%** (6,650 / 6,656 rows) |
| **via run match** | **1,025** | `canonical.name_ar = raw.raw_name` + `store_id` + `scraping_run_id` | **99.94%** (4,997 of 5,000 sampled resolve to exactly one; 0 unmatched, 3 ambiguous) |
| not recoverable | 1,027 | discovery rows with no run id | — |

**87.4% is deterministically recoverable.** And a backfill should still not be run, because
**it would change no customer-visible number**:

- the 5,827 are **already resolved at render time** by the display rule (`f9d7afe`);
- the 1,025 already display a value measured accurate to **1.90 minutes**.

The benefit of a backfill is provability, not truth. The customer sees the same number either
way. Combined with `price_history` being append-only, that is not a trade worth making.

### THE RECOMMENDATION

**Defer.** The immediate customer benefit is **zero** — the display layer already resolves the
chain, and the unresolved remainder is accurate to two minutes. Against that, the change adds a
batch-abort failure mode to the hourly chain that does not exist today.

The value of fixing Occurrence 2 is structural: a real foreign key instead of a JSON-embedded
`_raw_id`, and a display path that reads a column instead of parsing a payload. That is worth
doing — **when it is the most valuable thing available, which it is not today.**

**If it is implemented later, it must carry an FK guard** (resolve the id against
`raw_observations` and write NULL when absent) so a stale id can never abort a batch. Without
that guard, the correct answer stays "defer" regardless of window.

---

# TECHNICAL DEBT REGISTER

## DEBT-1 — `write_ac_batch` does not propagate `raw_observation_id`
**Opened 2026-07-31 · Governed by Rule 1 · Status: DEFERRED BY DECISION, not by oversight**
**⟶ RECLASSIFIED 2026-07-31 under Appendix F6: DEFERRED CUSTOMER VALUE, not cleanup.**
Search-card freshness depends on this FK — rendering the stored timestamp instead would
reintroduce the falsely-fresh claim, and resolving provenance by chain-walk is too expensive at
list scale. The original no-material-impact assessment was accurate; the dependency changed it.
Still deferred. No longer filed as tidying.

Deferred on measured customer-visible impact, not on engineering preference: reconstruction is
87.4% deterministic, and a backfill would change **no** number a customer sees. Full assessment
above.

### DO NOT REOPEN unless one of these is true

1. **Customer-visible impact becomes material** — i.e. the render-time resolution stops covering
   the population, or displayed dates measurably diverge from provenance.
2. **The normalization pipeline is already being modified** — if `write_ac_batch`,
   `progressive-engine`'s price path, or `price_history` writes are open for another reason,
   fold this in rather than paying the risk twice.
3. **The provenance gap becomes a launch blocker** — a claim, an audit, or a partner requires
   per-row provenance we cannot demonstrate from a column.

Absent one of these, reopening spends risk on a change no customer can perceive.

---

### CONSTRAINT 1 — THE FK GUARD IS A MANDATORY PRECONDITION
**This is a correctness invariant, not an implementation preference.**

> Any future implementation MUST resolve the originating raw observation **deterministically**,
> and MUST write **NULL** whenever it cannot be resolved.
>
> **The implementation must NEVER abort a batch because provenance cannot be attached.**

Why this is an invariant and not a nicety: `price_history_raw_observation_id_fkey` references
`raw_observations(id)`, and `write_ac_batch` is a single transaction. An unresolvable id raises
an FK violation that rolls back **the entire batch**, stalling the normalization chain for every
store and category in that run. **Provenance is metadata about evidence; it must never be able
to destroy the evidence write itself.** A missing link is an acceptable outcome. A stalled
pipeline is not.

Concretely: resolve against `raw_observations` and coalesce to NULL — never pass an id through
unvalidated. Measured exposure today is 0 orphans in 298,075 staging rows, which is exactly why
this would pass review while remaining wrong: the guard protects against the state that has not
happened yet.

---

### CONSTRAINT 2 — RENDER-TIME PROVENANCE RESOLUTION IS AN ARCHITECTURAL DEPENDENCY
**Not an optimisation. Load-bearing for customer-visible correctness.**

**5,827 customer-visible offers currently display the correct observation date ONLY because the
render path resolves provenance dynamically** — `get-comparison.ts` walks
`tps_observation_id` → `normalized_payload._raw_id` → `raw_observations.scraped_at`, and
`src/lib/intelligence/observed-freshness.ts` takes the oldest verified signal.

The stored `price_history.observed_at` on those rows is **still wrong** — overstating freshness
by a median of 7.4 days and up to 48.1 days. Nothing has corrected the data. Only the display
is correct, and only while that resolution runs.

> **Any redesign, optimisation, caching layer or refactor touching the observation-date display
> path MUST preserve this resolution, and MUST be verified on real production products before
> deployment.**

Ways this breaks silently, all of which look like improvements:
- caching or denormalising `observed_at` into a faster read path
- dropping the `raw_observations` lookup from `get-comparison` as "an extra query"
- routing the compare page through the projection's `last_observed_at` (which is **not**
  corrected and derives from the stored column)
- porting the freshness line to a new surface without importing `displayedObservedAt`

**Verification is not optional and not unit-testable.** Fetch a real production compare page and
confirm the ages against the database. The reference case:
`/ar/compare/apple%7CiPhone%7C15%7CStandard%7C128` must render **5, 10, 25** days — not 5, 3, 7,
which is what the uncorrected stored column produces. If a change makes those numbers *smaller*,
it has reintroduced the falsely-fresh claim.

**DEBT-1 does not close this dependency — it removes it.** Populating the column is what would
eventually make the render-time resolution redundant. Until then, the dependency stands.

---

## MEASUREMENT RULE — an effect smaller than the sample variance validates nothing

**Added 2026-08-01 (ADR-169), from the assistant rollout.**

> **A measured effect smaller than the sample's own variance cannot validate an engineering
> change. It cannot refute one either. It is not evidence in either direction.**

**How it was learned.** Three prompt-assembly changes moved the natural rejection rate
50% → 46% → 42%. Each looked like progress. But two natural samples taken **with no code change
between them** measured **31% (n=16)** and **50% (n=24)** — a 19-point spread from sampling and
model non-determinism alone. Every one of those "improvements" is smaller than the noise floor.

**The rule in practice:**

1. **Establish the noise floor before claiming a delta.** Run the identical sample twice with no
   change. The spread between those runs is the minimum effect size you can detect. Anything
   under it is unmeasurable, however plausible the mechanism.
2. **Prefer the decomposed signal to the headline.** `saving-or-price-without-provenance`
   10 → 3 is a 70% fall in a single cause and survives the noise floor; the 8-point headline
   move does not. **Report the rule, not the rate.**
3. **Non-deterministic systems need far larger n than deterministic ones.** For a deterministic
   harness, 20 cases can be conclusive. For anything with a model in the loop, tens of samples
   distinguish almost nothing.
4. **"Unvalidated" is the honest verdict, not "validated" or "failed".** A change with a sound
   mechanism and an unmeasurable effect stays in the codebase and stays unproven. Say so.
5. **More data beats more changes.** When successive changes each move less than the variance,
   the next unit is measurement, not another edit.

**This is the same failure class as the sampling-bias entries already in this file** —
top-N sampling over-weighting quality, and the balanced sample over-weighting edge cases. All
three are one mistake: *reading a number produced by the method as a property of the system.*

---

## MEASUREMENT RULE — an HTTP header is not a locale

**Added 2026-08-02 (Unit C §0).**

> **`Accept-Language` alone does not simulate a shopper's locale.** A browser also exposes
> `navigator.language` and `navigator.languages`, and many sites branch on the JS value, not the
> header. A check that sets only the header can produce an English landing page for a site that
> would have served Arabic — reporting a product defect that does not exist.

To simulate a Saudi Arabic shopper properly, set **all three**:

```js
await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar-SA,ar;q=0.9' });
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'language',  { get: () => 'ar-SA' });
  Object.defineProperty(navigator, 'languages', { get: () => ['ar-SA', 'ar', 'en'] });
});
// plus launch arg --lang=ar-SA
```

**Then compare the two runs and report them separately.** If they differ, the earlier finding was
the instrument. In Unit C they did NOT differ — the retailers genuinely serve English — which is
what allowed the hypothesis to be tested rather than assumed.

Same family as the `curl -d` argv corruption, the stale dev server on the wrong port, and the
JSX-blind regex scanner: **rule out the instrument before investigating the system.**

---

## PRODUCT RULE — a working link outranks a perfect language

**Added 2026-08-02 (Unit C).**

> **Never rewrite a merchant URL without resolving the rewritten URL first.** A
> language-mismatched page that works is minor friction. A rewritten URL that 404s is a dead end,
> and those are not the same severity.

Measured: swapping Jarir `/sa-en/` → `/sa-ar/` and Extra `/en-sa/` → `/ar-sa/` on the same slug
returned **404 on every case tested** — Jarir redirecting to `/page-not-found`. Those retailers use
**different slugs per locale**, so the Arabic page exists at an address the transform cannot
derive. The obvious fix would have converted a working English exit into a dead end.

---

## INSTRUMENT RULE — PowerShell mangles Arabic request bodies

**Added 2026-08-03 (ADR-193 verification).**

> **Never probe an Arabic-query API from PowerShell with an inline string body.**
> `Invoke-RestMethod -Body '{"query":"مكيف"}'` and `curl.exe -d` both delivered the literal
> bytes `????` to the server. The mangled query then category-defaulted to `mobile`, matched
> nothing, and Algolia's fuzzy fallback returned junk hits — which read exactly like TWO real
> production defects ("TPS injection dead" and "results polluted across queries"). Both were
> the probe.

Correct instruments: bash `curl --data-binary @file.json` with a UTF-8 file (Git Bash), or
PowerShell with `[System.Text.Encoding]::UTF8.GetBytes($json)` as the body. Diagnostic that
caught it: the server logged `words=["????"]` — **log what the server RECEIVED, not what the
client believes it sent.** Same family as the header-only locale simulation (#42): rule out
the instrument before investigating the system.
