# STEP 4 GATE — stratified replay, match invariant, price_history policy
**2026-07-31 · Investigation only. NO backfill run. STEP 4 REMAINS CLOSED.**

Supersedes nothing; extends `GATE-normalize-discovery-backfill.md`.

---

## 0. HEADLINE — two findings that close Step 4 on their own

1. **The match invariant I shipped in Step 2 is the WRONG ONE**, and the correct one **cannot be
   enforced today** because production already violates it.
2. **100% of replayable price observations are temporally out-of-order** (97,215 of 97,215), and
   the obvious safe policy (A — skip price writes) **defeats the purpose of the backfill**.

---

## 1. THE MATCH INVARIANT — corrected

### What the data model and TPS rules require

The Constitution states *one canonical identity (`tps_identity_key`); one authority per
question*. A `raw_observation` is a single retailer listing captured at a point in time. It can
therefore describe **exactly one** product identity. The correct invariant is:

> **UNIQUE (raw_observation_id)** — one raw observation belongs to at most one canonical.

### What I shipped in Step 2 is weaker

`product_matches_raw_canonical_uidx (raw_observation_id, canonical_product_id)` permits one raw
observation to hold **many** canonicals — it only prevents the *same pair* twice. It was chosen
because it was the safe, obvious key. **It is not the constitutional invariant.**

### The correct invariant cannot be enforced today — production already violates it

| measure | value |
|---|---|
| product_matches rows | 5,962 |
| distinct raw_observation_id | 5,927 |
| **raw observations mapped to ≥2 canonicals** | **35** |

The 35 are not benign. Three patterns, all real defects:

| pattern | example |
|---|---|
| same product, two identity schemes | `samsung\|75\|8k\|neo_qled\|165` vs `samsung\|MODEL:QA75QN900FUXSA` |
| key drift across normalizer versions | `samsung\|Galaxy A\|A56\|Standard\|256` vs `…\|256\|ram=8`; `asus\|vivobook 15\|…` vs `asus\|vivobook\|…` |
| **parser error** | `asus\|dell g-series\|ryzen9-9\|…` vs `asus\|rog\|ryzen9-9\|…` — brand `asus` carrying a **Dell** series |

**Consequence:** a replay re-derives identity keys with the *current* normalizer. Where a key
has drifted since the row was first matched, the replay mints or selects a different canonical
and the old match survives — **manufacturing more of exactly these 35**. Reassignment must be an
explicit, auditable operation, not an insert conflict.

### Required before Step 4

1. Resolve the 35 (merge duplicate canonicals; fix the `dell g-series` parser defect).
2. Replace the pair index with `UNIQUE (raw_observation_id)`.
3. Make reassignment explicit — an audited update that records the previous canonical, not a
   silent second insert. `product_matches` has an `identity_resolution_event_id` column that
   appears designed for exactly this and is currently unused by this path.

---

## 2. PRICE_HISTORY — measured cohorts

Population: discovery observations carrying a price (`algolia`, `unbxd_extra`, `amazon-search`).

| cohort | measured |
|---|---|
| observations with a usable price | **97,215** |
| **older than their store's newest `price_history` row** | **97,215 (100.0%)** |
| older than *all* existing history for their store | 120 |
| null price | **0** |
| non-positive / non-publishable price | **0** |

**Every replayable observation is temporally out-of-order.** There is no "recent, in-order"
cohort to start with — the safe-looking slice measured in Step 3 (0 price rows appended) was
safe only because those prices happened to equal the current value, not because they were
current.

### What historical inserts would and would NOT corrupt — measured, not assumed

| surface | affected? | why |
|---|---|---|
| projection prices / `lowest_price` / `saving` | **NO** | `build-tps-projection.ts:157` takes `distinct on (canonical, store) … order by observed_at desc` — latest per store wins, so an older row cannot become current |
| trust surface: `verified_drop`, `inflated_reference`, the 70% figure | **NO** | `tps_listing_price_facts` is built from `raw_observations` (`build-listing-facts.ts:63`), not `price_history` |
| `price_history` itself | **YES** | append-only immutable evidence; every inserted row is permanent |

So the danger is **not** a false current price. It is **duplicate price events**: the same
observed price already exists in `price_history` (written by the discovery path with `store_id`),
and normalization would record it a second time under a different canonical.

---

## 3. POLICY OPTIONS — compared with evidence

**A — skip all historical price writes.** ❌ **Rejected: it defeats the backfill.**
The projection's price aggregate requires `ph.tps_observation_id is not null`
(`build-tps-projection.ts:160`). A canonical with an identity key but no such row is projected
with **no prices, no stores, no offers** — therefore **no exits**. Identity without a price
restores nothing a customer can use. This is the option that looks safest and delivers zero.

**B — insert only missing events by (observation, observed_at).** ⚠️ Possible but heavy: up to
97,215 permanent appends, 100% out-of-order, duplicating price events that already exist under
the keyless canonicals. Blast radius is the whole table and it cannot be undone.

**C — rebuild affected canonical histories deterministically.** ❌ **Rejected:** rebuilding
implies deleting and rewriting `price_history`, which violates the append-only rule outright.

**D — LATEST-ONLY materialisation. ✅ Recommended, not yet proven.**
For each (new canonical, store), insert **one** row from the **most recent** discovery
observation, carrying its real `observed_at` and its `tps_observation_id`.

| requirement | how D satisfies it |
|---|---|
| observation provenance | row carries `tps_observation_id` → normalized obs → `raw_obs_id` |
| chronological correctness | the canonical is new and has no prior history, so one row cannot be out of order *relative to that canonical* |
| append-only semantics | pure append; nothing updated or deleted |
| rerun idempotency | normalized id is `stableUuid(normSeed(raw_obs_id))`; the existing `changedPrices` filter drops a re-inserted identical price |
| no duplicate events | one row per (canonical, store), not per observation |
| no false current price | it *is* the latest observation for that pair |
| bounded blast radius | ~one row per canonical-store pair instead of 97,215 |
| honest recovery | still append-only, so **not** deletable — bounded, not reversible |

**D's unproven part:** the volume of (canonical, store) pairs is not yet measured, and D needs a
code path that does not exist — the current writer appends whatever `changedPrices` yields.

---

## 4. THE NO-MUTATION ALLOWLIST — whole-DB counters are not acceptable

**Tables owned by `normalize-incremental`:** `tps_progress_cursors` (rows where
`category='_all_'` only), `tps_identity_staging`, `canonical_products`,
`normalized_product_observations`, `product_matches`, `price_history`.

**Known background writers — measured active during this session:**

| writer | touches | evidence |
|---|---|---|
| hourly normalize chain | `product_matches`, and all of the above | `product_matches` moved 5,963 → 5,962 mid-session |
| scheduler heartbeat | `tps_progress_cursors` where `category='_sweep_tick'` | advanced while `_all_` did not — this is what contaminated my first snapshot |
| discovery cron | `raw_observations`, `price_history`, `canonical_products` | writes continuously; 654 NULL-obs rows today |

**Therefore:** a dry-run proof must compare **only** the owned tables, must scope
`tps_progress_cursors` to `category='_all_'`, and must be run with the concurrent writers
recorded. A whole-database counter comparison is not evidence, as my own first attempt showed.

---

## 5. WHAT IS STILL NOT MEASURED — stated plainly

The per-cohort matrix (proposed canonical target, same-canonical vs cross-canonical rematch,
duplicate price events, exits restored, per-cohort skip reasons) **has not been produced.** It
requires the dry run to emit a **per-observation record** — proposed canonical, prior canonical,
price decision — which the current `--dry-run` does not do; it emits aggregates only.

Cohorts 5, 6 and 7 (already-matched, would-resolve-differently, repeated same-retailer) are
**exactly** the cohorts that would quantify the 35-row reassignment hazard, and they are the
ones I cannot report. **That gap alone should keep Step 4 closed.**

Building it is the next unit: a `--emit-plan <file>` on the dry run producing one JSON line per
observation, which makes every cohort a query over the plan rather than a new engine feature.

---

## 6. GATE VERDICT

| gate | status |
|---|---|
| 1 · stratified replay results | ❌ aggregate only; per-cohort matrix not produced |
| 2 · exact match invariant | ✅ determined — and **production violates it (35 rows)**; shipped index is weaker than required |
| 3 · price policy | ⚠️ A and C rejected with evidence, D recommended, D unproven |
| 4 · idempotency across two runs | ❌ not demonstrated for the write path (only the dry path) |
| 5 · smallest safe first batch | ❌ cannot size it without the per-cohort plan |
| 6 · stop conditions | ❌ not defined |
| 7 · recovery limits | ✅ stated: `price_history` is append-only; **no append is reversible** |
| 8 · expected customer impact | ❌ not quantified |

**STEP 4 REMAINS CLOSED.** Prerequisites, in order: (a) `--emit-plan` per-observation output,
(b) resolve the 35 and fix the `dell g-series` parser defect, (c) replace the index with the
real invariant plus an audited reassignment path, (d) prove D on a plan, (e) then a canary.
