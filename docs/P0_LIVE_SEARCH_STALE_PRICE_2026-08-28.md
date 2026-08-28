# P0 Incident (separately scoped, same urgency) — Live Search Route Serves Stale TPS Prices,
Bypassing the Projection Fix (2026-08-28)

**Status: ROOT-CAUSED, READ-ONLY so far. NO code or production write has been made under this
incident. A bounded fix is proposed below and requires explicit founder approval before any
change is written or deployed.**

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

## 5. What is explicitly NOT done yet

- No code in `src/app/api/search/route.ts` has been modified.
- No production write or resync has occurred under this incident.
- No deploy has happened.

**Awaiting founder approval on the proposed fix in §4 before writing any code.**
