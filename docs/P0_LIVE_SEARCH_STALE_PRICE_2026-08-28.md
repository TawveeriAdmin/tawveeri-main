# P0 Incident (separately scoped, same urgency) — Live Search Route Serves Stale TPS Prices,
Bypassing the Projection Fix (2026-08-28)

**Status: CLOSED. Fixed, deployed to production, and independently verified live (§6).**

**Relationship to the sibling incident**: `docs/P0_AIRPODS_PRO2_RECURRENCE_2026-08-28.md` (the
`tps_product_projection` / `build-tps-projection.ts` fix) is CLOSED, fixed, and independently
verified — that work unit stands on its own. **This document is a separate root cause.** The
overall customer-facing symptom (`tawveeri.com` search returning SAR 79 for AirPods Pro 2) is
**NOT closed** while this second cause remains live. Same P0 urgency; not downgraded.

---

## 1. Exact production surface confirmed

The live `POST /api/search` endpoint (what `tawveeri.com`'s search box actually calls) does **not**
serve TPS-linked results from either `tps_product_projection` or the `tawveeri_tps_products` Algolia
index (both of which I fixed and confirmed correct in the sibling incident). Confirmed live,
2026-08-28, well after both of those fixes were deployed:

```
POST https://tawveeri.com/api/search  {"query":"airpods pro 2"}
→ current_price: 79, observed_at: 2026-08-28T18:00:06Z, store: المنيع
```

Direct query of the Algolia `tawveeri_tps_products` index for the same identity key at the same
time correctly showed `lowest_price: 1049`. The live site and the corrected index disagree —
proving the live route reads from somewhere else entirely.

## 2. The actual writer: no sync pipeline, no index — a live, per-request query

Traced to `searchTPSCanonical()`, a function defined directly in
`src/app/api/search/route.ts` (lines ~1699–1917), called inline on every search request
(line 2208: `const tpsProducts = await searchTPSCanonical(mw.length ? mw : aw, supabase,
tpsCategories);`) whenever the query matches a TPS-registered category. Its results are prepended
to whatever Algolia/DB search separately found (`products = [...tpsProducts, ...products]`), so a
TPS-canonical match wins.

**There is no "index" to resync here** — this is not a caching or staleness problem in the
conventional sense. `searchTPSCanonical` is a **second, independently-maintained reimplementation**
of the exact same price-freshness aggregation logic `build-tps-projection.ts` has, recomputed live
from Postgres on every single API call:

- **Source data read directly, per request**: `canonical_products`, `price_history`,
  `normalized_product_observations`, `tps_offer_delist_signals`,
  `tps_price_implausibility_signals`.
- **Never reads**: `tps_product_projection` (the table I already fixed) or `tps_current_offers`
  (the actual hot current-state table, ADR-252) — the same omission `build-tps-projection.ts` had
  before today's fix, independently duplicated here.
- **Freshness logic, byte-for-byte the same pattern**: builds `trueObserved` (the newest
  `normalized_product_observations` row per (canonical, store) — the ADR-194 "true observation"
  signal), falls back to `price_history`'s own `observed_at` if absent, and gates the winning price
  via `isFreshObservation()` against the same `PICK_FRESHNESS_MAX_HOURS` (168h) threshold imported
  from `@/lib/intelligence/evidence-engine` — the identical shared constant
  `build-tps-projection.ts` uses.
- **Same exact vulnerability**: for `apple|airpods pro 2`, `normalized_product_observations` keeps
  recording ongoing re-scrapes of the underlying contaminated listing at store 5 (المنيع) even
  though the accessory-contamination guard (`progressive-engine.ts`, commit `824ca8f`) correctly
  stops it from writing new evidence into `price_history` or `tps_current_offers` — so
  `trueObserved` marks the OLD, stale `price_history` row (SAR 79/69, dated 2026-07-25) as "fresh,"
  and it wins as `bestPrice` on this specific live surface, regardless of what
  `tps_product_projection`/`tps_current_offers` now correctly say.

## 3. Blast radius

This function is the ONLY thing that injects TPS-canonical results into the live search response —
it runs for every query `detectCanonicalCategories()` recognizes (system-wide, all TPS categories,
not just audio). It shares the exact same underlying tables (`price_history`,
`normalized_product_observations`) as the sibling incident's scan, which found **629 (canonical,
store) pairs across 626 distinct canonicals** with a stale-price-vs-fresh-current-offer divergence
of >20%. Every one of those remains equally exposed on the live search surface specifically, through
this code path, independent of the already-applied `tps_product_projection` fix. This is not a
narrower blast radius than the sibling incident — it is the **customer-facing manifestation** of
the same underlying class, on the surface that matters most.

## 4. Proposed bounded fix (NOT YET WRITTEN — awaiting approval)

Mirror the same principle already applied and verified in `build-tps-projection.ts`: fold
`tps_current_offers` (`status = 'valid'`) in as a competing, independently-fresh candidate per
(canonical, store) inside `searchTPSCanonical`, after the existing `price_history`-derived `latest`
map is built (around line 1795–1816) — for any (canonical, store) pair where a `tps_current_offers`
row exists and its own `observed_at` is more recent than the `price_history`-derived entry's
effective timestamp, use the `tps_current_offers` price/timestamp instead.

- **Scope discipline**: same as before — this does not touch `price_history` (still append-only,
  immutable), does not change the delist/implausibility exclusion logic, and does not change
  behavior for any (canonical, store) pair with no `tps_current_offers` row (measured ~60% coverage
  in the sibling incident — unaffected either way).
- **Higher scrutiny warranted than the batch-job fix**: this function runs inline on a live,
  user-facing, `maxDuration = 30`-second-budgeted API route on every search request, not a
  scheduled background job. Any added query must be cheap (a single indexed `IN` lookup keyed on
  the same chunked `ids` array the function already uses for `price_history`/
  `normalized_product_observations`, matching the existing chunking pattern) and must not introduce
  a new failure mode that could take down live search if `tps_current_offers` is briefly
  unavailable (the existing `try { ... } catch (e) { console.error(...); return []; }` wrapper
  around the whole function already provides a safe fallback — a failure in the new lookup should
  degrade to today's behavior, not throw).
- **Verification plan before any deploy**: dry-run comparison (log the before/after `bestPrice` for
  a fixed set of known-affected canonicals, including `apple|airpods pro 2`, without changing the
  route's response), full test suite, `tsc` baseline check — same discipline as the sibling
  incident — followed by a live, read-verified check of `tawveeri.com`'s actual search response
  for "airpods pro 2" and at least 2–3 of the other affected canonicals, before considering this
  incident closed.

## 5. What was done (superseded — kept for the record)

The §4 fix was implemented, tested (141/141 suites, 2,363/2,363 tests; `tsc` baseline unchanged
at 551), committed (`54b8990`), and deployed. It closed the omission (`tps_current_offers` was
never consulted at all) but introduced a second, distinct defect — see §6.

## 6. Second defect found in live verification, and its fix (2026-08-28)

Founder approved "run it live and verify." Deployment `54b8990` went live (confirmed via Railway
deployment record `ee891544`, matching the push timestamp to the second, and via live deploy logs
showing this exact deployment processing verification requests in real time). CDN/Next.js caching
were ruled out (`cf-cache-status: DYNAMIC`, `export const dynamic = 'force-dynamic'`).

Yet `tawveeri.com` kept serving the stale price for AirPods Pro 2 and, on a targeted check, for
other blast-radius canonicals (a Daewoo washer canonical, SAR 549 stale vs SAR 949 current — an
838-hour-old tie-free case). Read-only DB tracing found the root cause: the merge's freshness
comparison (`co.observed_at > existingEffective`) used a **strict `>`**. `tps_current_offers` and
the ADR-194 `trueObserved` borrowing (from `normalized_product_observations`) are usually written
by the *same* ingest event, so their timestamps are frequently identical to the millisecond —
exactly the ongoing-rescrape-of-a-filtered-listing scenario this merge exists to fix. The tie
always went to the stale `price_history` entry, silently no-op'ing the fix for the cases it
targeted. Confirmed live for both AirPods Pro 2 and the washer canonical: both tied exactly
(`2026-08-28T18:00:06.75835+00:00` and `2026-08-28T19:30:50.493+00:00` respectively, matching to
the millisecond), and the served `product_url` in both cases carried the OLD `price_history`
observation's exit-link id — proof the stale branch, not the new one, won.

**Fix**: `>=` in place of `>` (commit `c8e44da`), so `tps_current_offers` wins ties — matching the
design intent stated in §3 of the sibling incident doc ("ties favor `tps_current_offers` as the
single-row-per-key, actively-maintained source").

- Tests: 141/141 suites, 2,363/2,363 tests pass, unchanged. `tsc` baseline unchanged at 551.
- Logic replay against both known tied cases (real production timestamps) confirmed the fix
  resolves both before deploying.
- Deployed (Railway deployment `297f4a24`, confirmed SUCCESS and live via `railway deployment
  list`).
- **Live-verified after deploy**: AirPods Pro 2 → SAR 1,049 (was 79). Daewoo washer 8kg → SAR 949
  (was 549). Daewoo fridge 340L → SAR 3,499 (matches its known current-offer price, was
  previously stale at SAR 2,099 per the blast-radius scan). All three now return the fresh
  `tps_current_offers` price with the exit link correctly omitted (no ID exists in that space) per
  the fix's own honest-omission rule.
- **Latency check**: pre-deploy noisy range 1.3–4.8s across 4 representative queries (12 samples);
  post-deploy 1.4–2.9s (12 samples) — well within the same noisy range, no material regression.
  This was not a controlled A/B (a pre-existing local `next dev` instance not started this session
  blocked a clean local comparison — not disturbed, per standing policy); both measurements are
  noisy production round-trips including network/Cloudflare/Railway routing, disclosed rather than
  presented as clean.

## 7. What is explicitly NOT done

- Canonicals with no `tps_current_offers` coverage (~40% of the active catalog, per the sibling
  incident's measurement) are unaffected either way — same boundary as the projection-builder fix,
  not addressed here, out of scope.
- The underlying `progressive-engine.ts` `is_active: true` unconditional-reactivation behavior
  (sibling incident §6) remains unchanged — this incident makes reactivation harmless with respect
  to stale-price resurfacing, not undone as a behavior.

**Awaiting founder approval on the proposed fix in §4 before writing any code.**
