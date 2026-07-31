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
