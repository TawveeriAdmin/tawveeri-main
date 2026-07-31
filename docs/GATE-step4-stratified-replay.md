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

---

# FINAL VERDICT — 2026-07-31 · **STEP 4 IS NOT SAFE. STOPPED.**

`--emit-plan` was **not built**. The production decision was disproved without it, and building
inspection for a closed decision is the "optimise for future flexibility" this brief rules out.

## THE DISQUALIFYING FINDING — the write path stamps `observed_at = now()`

`progressive-engine.ts:282`:

```js
priceRows.push({ canonical_product_id: canonicalId, store_name: …, price: r.price,
                 tps_observation_id: normById.get(r.raw_obs_id), observed_at: now });
```

`now` (line 229) is **the run time**, not the observation's `scraped_at`. Replaying a historical
observation therefore does **not** insert an out-of-order row, as §2 of this document assumed.
It inserts a row claiming we observed that price **at the moment of the backfill**.

**Correcting my own §2:** the "100% out-of-order" cohort finding measured the wrong hazard. The
observations are old, but the rows written from them would be stamped new. The danger is not
chronology — it is a **false freshness claim**, which is worse.

## MEASURED BLAST RADIUS

| measure | value |
|---|---|
| discovery observations | 103,106 |
| **average age** | **21.5 days** |
| maximum age | 49.8 days |
| **older than 7 days** | **82,007 (79.5%)** |
| older than 30 days | 25,680 |

## WHY THIS IS A CLAIM-INTEGRITY FAILURE, NOT DATA HYGIENE

The stamped column is the one the customer reads:

| surface | source | effect of the backfill |
|---|---|---|
| compare page «رصدناه قبل X يومًا» | `price_history.observed_at` (`get-comparison.ts:131,151`) | a 50-day-old price renders as **«رصدناه اليوم»** |
| Trust Engine freshness | projection `last_observed_at` = `max(observed_at)` (`build-tps-projection.ts:167`) | stale offers reset to **fresh** |
| current price per canonical/store | `distinct on … order by observed_at desc` | the replayed row **becomes the current price** |

`docs/LAUNCH_VOCABULARY.md` §2 CAN SAY includes *«نعرض لك… ومتى رصدناه»* — "we show when we
observed it". A backfill through this path makes that sentence **false for up to 82,007
offers**. HANDOVER #16's launch condition — no cadence or freshness claim we cannot support —
would be broken by our own pipeline rather than by copy.

**Every earlier option is void.** A, B, C and D in §3 were all reasoned on the assumption that
the row would carry the observation's real timestamp. None of them survive `observed_at = now()`.

## ANSWER TO THE SINGLE QUESTION

> **Is Step 4 safe? — NO.**

Not "unproven". **Disproved**, on the write path as it exists today.

## WHAT WOULD HAVE TO CHANGE FIRST (not authorised, not started)

1. **The price write must carry the observation's real `scraped_at`**, not run time. This is a
   change to a live path shared with the healthy 23-store scraper flow, so it needs its own
   gate — it alters what every future normalize run records, not just the backfill.
2. Only once timestamps are truthful do §3's options A–D become answerable again; D
   (latest-only) remains the most defensible.
3. The match invariant work from §1 is unchanged and still required: 35 observations hold two
   canonicals, and `product_matches.raw_observation_id` in fact stores the **normalized**
   observation id (`progressive-engine.ts:281`) — deterministic from the raw id, so the 1:1
   invariant still holds, but the column name is misleading and any future index must be
   written against what it actually contains.

## NOT RUN

No canary. No backfill. No source fix. Nothing was written to production in this step; the only
production changes remain Step 2's index and function guard from `794d1e8`, both still safe.

---

# FRESHNESS RE-MEASURED WITH HONEST TIMESTAMPS — 2026-07-31

Method: walk the provenance chain `price_history.tps_observation_id` →
`normalized_product_observations.normalized_payload._raw_id` → `raw_observations.scraped_at`.
99.9% of rows carrying an observation id resolve (6,649 of 6,655). Query kept as
`scripts/tps-analysis/offer-freshness-true.sql`.

**Measured overstatement on linkable rows: average 177 hours (7.4 days), max 48.1 days;
3,179 (47.8%) overstated by >24h, 2,131 (32.0%) by >7 days.**

## Per retailer — median offer age, published vs true

| retailer | offers | median age PUBLISHED | median age **TRUE** | stale >7d published | stale >7d **true** |
|---|---|---|---|---|---|
| extra | 2,493 | 7.5 d | **11.1 d** | 1,486 | **1,767** |
| almanea | 2,444 | 6.6 d | **30.1 d** | 1,198 | **1,330** |
| noon | 1,264 | 1.1 d | 1.1 d | 118 | 200 |
| amazon | 663 | 6.8 d | **8.1 d** | 307 | 352 |
| jarir | 328 | 7.1 d | **24.5 d** | 207 | **312** |
| najm | 223 | 5.9 d | 5.9 d | 0 | 0 |
| shaker | 210 | 6.5 d | 6.5 d | 0 | 0 |
| alnakheelk | 182 | 5.0 d | 5.0 d | 0 | 0 |
| swsg | 59 | 7.5 d | 8.5 d | 47 | 59 |
| samsung_ksa | 26 | 1.2 d | 1.2 d | 0 | 0 |

| | published | **true** |
|---|---|---|
| offers older than 7 days | 3,363 of 7,892 = **42.6%** | 4,020 of 7,892 = **50.9%** |

**Understated by 8.3 percentage points overall — and far more per retailer:
Almanea 6.6 → 30.1 days (4.6×), Jarir 7.1 → 24.5 days (3.4×).**

HANDOVER #15/#16 recorded **34%** older than 7 days as a launch-condition input. The honest
figure is **50.9%**. Noon (1.1 d), Najm, Shaker, Alnakheelk and Samsung KSA are unchanged —
they were already accurate.

## THIS IS A LOWER BOUND

Rows with no provenance link keep their stamped value in the "true" column, so unlinkable rows
can only make the real figure worse, never better. **50.9% is a floor, not an estimate.**

## CUSTOMER-FACING CONSEQUENCE — not yet resolved

The compare page renders «رصدناه قبل X يومًا» from `price_history.observed_at`. For existing
rows that number is **too small** — it has been telling customers offers are fresher than they
are, by a median of 7.4 days on the affected path, and by ~23 days for Almanea.

`461955a` fixes this for rows written from now on. It does **not** correct existing rows, and
`price_history` is append-only by constitutional rule.

**Two options, neither taken — this needs a decision:**
- **Display-time correction:** where a provenance link exists, render the true `scraped_at`
  instead of the stored `observed_at`. No history rewritten; the customer sees the truth
  immediately. Touches `get-comparison.ts` and the projection's `last_observed_at`.
- **Accept and wait:** existing rows age out as offers are re-observed. Simpler, but every
  affected offer keeps showing a false age until it is re-normalized — and Almanea's median
  says that can take a month.

The first is honest sooner. Both are founder decisions, because they change a number the
customer reads.
