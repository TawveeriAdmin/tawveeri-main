# THE FRESHNESS PROVENANCE GAP — measured, profiled, root-caused
**2026-07-31 · Read-only investigation. Nothing implemented.**

Follows the display-time correction (`f9d7afe`).

---

## §2 — THE ERROR WE CORRECTED, quantified

5,821 offers whose provenance resolves. Drift = how much **too fresh** the old display was.

| statistic | value |
|---|---|
| **median drift** | **0.15 days (3.6 hours)** |
| average drift | 6.77 days |
| maximum drift | 48.1 days |

| off by more than | offers | share |
|---|---|---|
| 1 day | 2,539 | 43.6% |
| 3 days | 1,848 | 31.7% |
| 7 days | 1,689 | 29.0% |
| 14 days | 1,394 | 23.9% |
| 30 days | 316 | 5.4% |

**The distribution is bimodal and the average alone is misleading.** The typical offer was
off by ~3.6 hours — effectively correct. A long tail was not: **1,689 offers (29%) were
overstated by more than a week, 316 by more than a month.** The correction mattered
enormously for a minority and barely at all for the majority. Quote the median and the tail
together; quoting 6.77 days alone overstates the typical customer's exposure.

---

## §3 — PROFILE OF THE REMAINING GAP

### Exact missing-provenance reason — it is ONE cause, not many

| reason | offers |
|---|---|
| **no `tps_observation_id` — discovery path** | **2,321** |
| obs id set but normalized row missing (orphan) | 6 |
| normalized row without `_raw_id` | 0 |
| `_raw_id` pointing at a missing row | 0 |
| resolves (corrected) | 5,821 |

The 2,321 is the **same population** as the keyless canonicals from CHECKPOINT #21. One
defect, surfacing in three places.

### By retailer, path and age

| retailer | offers | avg age | ingestion path |
|---|---|---|---|
| المنيع Almanea | 1,295 | **37.1 d** | discovery (`algolia`) |
| اكسترا Extra | 839 | 4.0 d | discovery (`unbxd_extra`) |
| أمازون Amazon | 187 | 2.7 d | discovery (`amazon-search`) |

Identity state: all have `tps_identity_key IS NULL`. Normalization state: never normalized —
they sit behind their store cursors. Discovery vs scraper: **100% discovery**; the 23-store
scraper path has zero unprovenanced offers.

### Is it growing? — **YES, definitively**

| day | no provenance | with provenance |
|---|---|---|
| Jul 31 | 654 | 30 |
| Jul 30 | 1,115 | 1,223 |
| Jul 29 | 1,733 | 140 |
| Jul 28 | 1,099 | 41 |

**New unprovenanced rows are still being written today.** Confirmed.

---

## §1 — WHAT TO SHOW FOR UNVERIFIED OFFERS

### The measurement that decides it

The discovery path writes `raw_observations` (line 55) and `price_history` (line 77) **in the
same request**, and `price_history.observed_at` defaults to `now()`. So the stamp is written
*at* observation time. Verified against the 13,078 discovery rows carrying a `scraping_run_id`,
joined to that run's raw observations:

| | |
|---|---|
| average delta stamp ↔ actual observation | **1.90 minutes** |
| maximum delta | **4.2 minutes** |
| rows off by more than an hour | **0** |

**These offers are UNVERIFIED, not WRONG. Their displayed freshness is accurate to within
minutes.** That is the opposite of the corrected population, where the stamp was wrong by up
to 48 days.

### Options against the Constitution

| | A — suppress | B — keep showing | C — "unavailable" | **D — establish provenance** |
|---|---|---|---|---|
| **Truth** | removes a value measured true to 1.9 min | shows a true value | implies a defect that does not exist | shows a true value **and proves it** |
| **Customer trust** | loses information for no gain | ✅ | invites "why?" with no useful answer | ✅ strongest |
| **Information consistency** | two visual classes for equally accurate data | ✅ uniform | same inconsistency as A | ✅ uniform |
| **Decision quality** | degrades — age helps judge an offer | ✅ | degrades | ✅ |
| **Comprehension** | silence reads as "we don't track this" | ✅ | reads as a fault | ✅ |
| **Production complexity** | branching + a second empty state | none | branching + copy + translation | one field on an existing insert |

### RECOMMENDATION — **D, with B as the interim behaviour. Do not suppress.**

Suppression (A) and an explicit unavailable state (C) both **remove accurate information from
28.6% of offers to satisfy a formalism.** The Constitution requires that a price have
provenance — not that we hide a correct number while provenance is being wired. Truth is the
test, and the number passes it at 1.9-minute accuracy.

C is the worst of the three: it tells a customer something is missing when the value is right,
which spends trust to buy nothing.

**D closes the gap properly** — see §4. Until D ships, B (current behaviour, unchanged) is
correct, because it is accurate.

**One caveat, stated honestly:** accuracy here is a property of the *write path*, not of the
row. It holds because discovery stamps at observation time, and it would silently stop holding
if that path ever deferred its price write. That fragility is the real argument for D — not the
current numbers.

---

## §4 — ROOT CAUSE, AND THE SMALLEST SAFE CHANGE

### What prevents the gap from closing

**Not** an engineering dependency, a gated migration, a backlog or a production risk. It is an
**architectural omission in one function**:

`src/app/api/cron/discover-firecrawl/route.ts:55`

```js
const { error } = await sb.from('raw_observations').insert(rows);   // ids DISCARDED
```

The route **creates the raw observation and the price row in the same request**, and throws
away the link between them. `writeRawObservations` bulk-inserts without `.select()`, so the
generated ids never reach `writePriceSnapshot` a few lines later. `price_history.raw_observation_id`
exists, is nullable, and is left NULL on every discovery row.

### The smallest safe change that removes the largest portion

1. `writeRawObservations`: `.insert(rows).select('id, raw_url')` and return a `raw_url → id` map.
2. `writePriceSnapshot`: set `raw_observation_id` from that map.

**Effect:** per-row provenance for **100% of future discovery rows** (~654/day at current rate),
which makes the display rule prove them instead of trusting the write path.

**Why it is safe:** it adds one column value to an insert the code already performs. No
migration, no backfill, no schema change, no change to existing rows, no change to any
customer-visible number. Rollback is a revert.

**What it does NOT fix:** identity and exits. Those still require normalization, which remains
gated. This closes the *provenance* gap prospectively; it does not admit these canonicals to
the projection.

### Optimising the system, not the percentage

The 28.6% will not fall by suppressing lines or by a one-off backfill — it falls when the
producing path stops emitting unprovenanced rows. Fix the writer and the number decays on its
own as offers are re-observed. Fix the number and the writer keeps refilling it at 654/day.

---

# §1–§4 EXECUTED — 2026-07-31 · verified on a real production run

## §1 — THE WRITER IS FIXED (`94a3756`)

`writeRawObservations` now returns a `raw_url → id` map; `writePriceSnapshot` sets
`raw_observation_id`. A row with no URL yields no link — NULL, exactly as before, never a guess.
Each run also reports `provenanceLinked`, so a future run that stops linking is visible in the
run record rather than as a NULL count months later.

| measure | before | after |
|---|---|---|
| 100-row insert (median, rolled-back tx) | 266.4 ms | 276.8 ms |
| delta | — | **+10.4 ms (+3.9%)**, ~31 ms on the real 300-row batch |
| database impact | — | RETURNING on the **same statement**; no extra query, round trip, index or lock |
| batch throughput | — | unchanged, still one statement per batch |
| regression | — | none: suite 770/770, build 39/39, no new type errors |

## §4 — PRODUCTION VERIFICATION (real run, Almanea, runId 1558)

Triggered `POST /api/cron/discover-firecrawl` against production on build `94a3756`.
300 raw observations, 269 price rows written.

| check | result |
|---|---|
| `price_history.raw_observation_id` populated, before | **0 of 88,359** |
| new rows carrying provenance | **269 of 269 (100%)** |
| linkage — store id matches | 269/269 |
| linkage — price matches | 269/269 |
| linkage — `scraping_run_id` matches | 269/269 |
| linkage — observation within 5 min | 269/269 (max delta **3.5 min**) |
| customer surface regression | none — compare page ages unchanged (5, 10, 25), prices render, `/ar`, `/ar/categories`, `/ar/about` all 200 |

Linkage is verified **correct**, not merely non-null.

## §2 — DECAY OF THE EXISTING GAP, from real re-observation rates

| retailer | remaining | distinct listings | runs/day | full catalogue cycle | decay |
|---|---|---|---|---|---|
| المنيع Almanea | 1,026 (was 1,295) | 1,369 | 4.0 | ~5 pages ≈ **1.2 days** | **~1–2 days** |
| اكسترا Extra | 839 | 5,374 | 5.0 | ~18 pages ≈ **3.6 days** | **~4 days** |
| أمازون Amazon | 187 | 5,891 | — | last run fetched 0, `next_page=0`, `completed` | **UNCERTAIN** |

**~91% of the gap (1,865 of 2,052) clears within roughly a week, without any backfill.** One
Almanea run cleared 269 immediately.

**Amazon is the honest exception.** Its 5,891 listings have been observed exactly once each
(5,891 observations / 5,891 listings), its last run fetched 0 and reset to page 0. Whether it
re-cycles depends on adapter behaviour I have **not** verified, so I will not claim its 187
offers decay. If it does not re-cycle, they persist.

### Is temporary suppression justified? — **NO**

Three independent reasons: the bulk of the gap disappears in days without intervention; the
values are accurate to **1.90 minutes** (measured, §1 above) so suppression would remove correct
information; and the fix is already deployed, so the gap is now strictly shrinking rather than
growing. Suppressing a self-clearing, accurate signal would spend customer trust to buy nothing.

## §3 — THE PATTERN ACROSS THE CODEBASE

Recorded permanently as **`docs/ENGINEERING-RULES.md` Rule 1 — "Evidence generated but not
propagated"**, with the signature, detection query and review question.

**Two occurrences, both in the price-evidence chain:**

1. `discover-firecrawl` `writeRawObservations` — **FIXED** (`94a3756`).
2. `write_ac_batch` (`008_write_ac_batch.sql:59`) — writes a **literal `null`** into
   `price_history.raw_observation_id`, though the caller holds `o.raw_obs_id` and uses it to
   build the deterministic normalized id. **OPEN, not fixed** — it changes the shared RPC used
   by the whole normalization chain and belongs in its own unit. One line each side:
   add `raw_observation_id` to `priceRows` in `progressive-engine.ts`, select it instead of
   `null` in the RPC.

**Checked and explicitly NOT instances:** `outbound_clicks` (carries `offer_id` +
`canonical_product_id` + `sub_id`), `usage_events` (terminal telemetry), merchant-portal
`price_history` in `bulk-update` and `store/sync` (carries `product_store_id`; no raw
observation exists in that flow), and `notifications` / `admin_logs` / `phone_otps` /
`login_sessions` (fire-and-forget by design).
