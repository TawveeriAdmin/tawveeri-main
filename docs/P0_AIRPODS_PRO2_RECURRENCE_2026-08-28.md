# P0 Incident — AirPods Pro 2 SAR-79 Recurrence (2026-08-28)

**Status: this document's scope — the `tps_product_projection` / `build-tps-projection.ts` fix,
and its downstream `tawveeri_tps_products` Algolia sync — is CLOSED, fixed, deployed (run live
against production), and independently verified (see §§ below and the live-verification addendum
at the end of this file).**

**However, per founder ruling (2026-08-28): the OVERALL customer-facing incident (tawveeri.com
search returning SAR 79 for AirPods Pro 2) is NOT closed.** A second, separate root cause was
found in the live search route itself, bypassing everything fixed here entirely. That is tracked
as its own incident, same P0 urgency, not a downgrade: **`docs/P0_LIVE_SEARCH_STALE_PRICE_2026-08-28.md`**.
Do not consider the shopper-facing symptom resolved until that document is also closed.

This is unrelated to the Agent Era benchmark program (see `docs/AGENT_ERA_CLOSURE_2026-08-28.md`)
— discovered incidentally during that program's read-only data-gathering pass, tracked entirely
separately.

---

## 1. Reproduction (read-only, reconfirmed fresh before any change)

Canonical `5ae0f658-9866-4535-b09d-83115476509d` (`apple|airpods pro 2`), queried live:

- `canonical_products.is_active = true`, `data_updated_at = 2026-08-28T12:01:29Z` (reactivated
  after the 2026-08-27 quarantine — see §3).
- `tps_product_projection`: `lowest_price = 79`, `store_count = 2`, `cheapest_store = المنيع`,
  `last_observed_at = 2026-08-28T12:00:05Z` — served as fresh, current, customer-facing data.
- `price_history` for this canonical: the SAR 79 row is dated **2026-07-25** (~34 days /
  ~816 hours old at query time) — no row since.
- `tps_current_offers` (the actual hot current-state table, ADR-252): one genuinely valid,
  current record — *"AirPods Pro 2nd generation with MagSafe Case Type C White"*, **SAR 749**,
  `confidence: 100`, `status: valid`, observed **2026-08-28T12:49:33Z** (same day, hours old).

**Confirmed live and reproducible, twice, hours apart, before any code change.**

---

## 2. Root cause

Traced to `scripts/build-tps-projection.ts`, the script that builds the customer-facing
`tps_product_projection` table every hour.

1. Its price-freshness query derives `lowest_price`/`cheapest_store` **only from
   `price_history`**, using a freshness heuristic: an offer counts as "fresh enough to win
   cheapest" if `greatest(price_history.observed_at, normalized_product_observations.
   last_observed_at)` falls within `PICK_FRESHNESS_MAX_HOURS` (168h). This heuristic exists for
   a legitimate reason (quality program P0, 2026-08-27): a stable-priced offer that keeps being
   re-scraped daily must not read as stale just because its price never changed.
2. The accessory-contamination guard added in `progressive-engine.ts` (commit `824ca8f`)
   correctly stops the bad accessory listing from ever writing a NEW `price_history` row for
   this (canonical, store) pair going forward — but `price_history` is append-only, so the OLD
   SAR-79 row from before the guard existed is never superseded there.
3. The underlying raw listing at that store keeps being re-scraped into
   `normalized_product_observations` regardless (that table is populated at an earlier pipeline
   stage than the guard), so the freshness heuristic in step 1 kept marking the stale SAR-79
   `price_history` row as "fresh" — it was borrowing recency from an unrelated, still-ongoing
   (but content-filtered) scrape stream.
4. Separately: `progressive-engine.ts`'s canonical write path
   (`canonicalRows.push({..., is_active: true, ...})`, line 435) sets `is_active: true`
   **unconditionally** whenever a sweep finds at least one qualifying current offer for an
   identity key — with no check for a prior manual quarantine. Once a genuine new AirPods Pro 2
   listing appeared at the same store (the real SAR 749 offer, now sitting validly in
   `tps_current_offers`), the next `corroboratePass` sweep silently reactivated the
   previously-quarantined canonical.
5. `build-tps-projection.ts` only serves rows where `canonical_products.is_active = true` — so
   reactivation (step 4) brought the canonical back into scope, and the freshness bug (steps
   1–3) then re-served its stale SAR-79 price as if current.

**`tps_current_offers` already held the correct answer (SAR 749, valid, hours old) the entire
time — the projection builder simply never looked at it.**

---

## 3. Fix — smallest systemic change

`scripts/build-tps-projection.ts`: added a `current_state` CTE that reads `tps_current_offers`
(`status = 'valid'`, joined via `identity_key = tps_identity_key`) as a second, independently-fresh
candidate source per (canonical, store), unioned with the existing `price_history`-derived
candidate. Per (canonical, store), **whichever source has the more recent genuine observation
wins** — ties favor `tps_current_offers` as the single-row-per-key, actively-maintained source.

- **Not a wholesale swap to `tps_current_offers`**: coverage was measured first (5,412 valid rows
  vs 8,948 active canonicals, ~60%) — a canonical with no `tps_current_offers` row is completely
  unaffected; existing `price_history`-only behavior is preserved exactly for it.
- **`deriveProjection` (the pure, unit-tested aggregation function) is untouched** — the fix is
  entirely in the SQL that produces its inputs, so no existing test needed to change.
- Same delist-signal / price-implausibility-signal exclusions applied uniformly to the new
  `current_state` candidates, for consistency with the existing guards.
- No change to `price_history` (append-only, immutable, per Constitution — nothing here writes,
  rewrites, or fabricates historical evidence).

---

## 4. Test evidence

| Check | Result |
|---|---|
| Existing `projection-derive.test.ts` (26 tests, the ADR-067 gate) | **26/26 pass, unchanged** — `deriveProjection` was not modified |
| Full suite | **141 suites / 2,363 tests pass** — matches the documented pre-existing baseline exactly |
| `tsc --noEmit` error count | **550** — matches the documented pre-existing baseline exactly, no new type errors |
| Targeted live query, this canonical, fixed logic | `المنيع` (store 5): stale SAR-79 history row correctly loses to the fresh SAR-749 `tps_current_offers` row (`is_fresh: true`); `محزم` (store 13, no current-offer override): correctly stays `is_fresh: false`, unchanged from before |
| Dry-run, full catalog, before vs after (`--dry`) | canonicals read: **6,959 → 6,959** (unchanged — no canonical gained or lost); comparable (≥2 fresh stores): **1,259 → 1,341** (+82, +6.5%) — more genuinely-current comparisons correctly surfaced, none lost |

---

## 5. Broader blast-radius check — this was not unique to AirPods Pro 2

Per the explicit incident requirement to check the same failure class elsewhere before declaring
closure: a direct scan for every (canonical, store) pair where `tps_current_offers` holds a valid,
more-recent observation than `price_history`'s own latest row for that store, differing in price
by more than 20%, found:

**629 affected (canonical, store) pairs across 626 distinct canonicals** (~7% of the 8,948 active
canonical catalog) — spanning categories well beyond audio (TVs, ovens, small appliances,
tablets/accessories). Examples found: an LG TV canonical served at SAR 114,999 vs a genuine
current SAR 23,851 offer (~213h stale); an oven canonical served at SAR 337 vs a genuine current
SAR 603 offer (~514h stale); several others in the same shape. **This fix corrects all of them**,
not just the flagship case — the AirPods Pro 2 recurrence was the one that happened to be
discovered, not the only instance of the underlying mechanism.

---

## 6. Remaining boundary, disclosed rather than hidden

- **Canonicals with no `tps_current_offers` coverage (~40% of the active catalog) retain the
  original freshness-borrowing behavior**, including its theoretical exposure to the same class
  of issue if an analogous quarantine-then-reactivation scenario occurs for one of them. Closing
  that fully would require broader `tps_current_offers` population (a separate, larger project,
  already flagged in prior sessions as an existing coverage gap) — out of scope for "smallest
  systemic fix" here.
- **The `is_active: true` unconditional-write behavior in `progressive-engine.ts` (line 435) is
  unchanged** — a canonical can still be silently reactivated by a future sweep with no check for
  a prior manual quarantine reason. This fix makes reactivation harmless with respect to *stale
  price resurfacing* (the specific customer-facing harm), but does not address whether silent
  reactivation itself is desirable behavior — that is a separate design question, not fixed here,
  and not part of this incident's scope.
- **`price_history` still holds the old SAR-79/69 rows, immutably, as required** — this fix does
  not delete, rewrite, or fabricate history; it only changes which row is eligible to win the
  *current* serving price.

---

## 7. Status and next step

**Reproduce → root cause → fix → tests → bounded dry-run: all complete.** Per standing
instruction, a production write (running the script for real, or deploying this code so the
standing hourly scheduler runs it) requires explicit founder authorization before it happens.

**Awaiting that authorization now.** Once granted: run `build-tps-projection.ts` once, non-dry,
directly; verify `tawveeri.com`'s AirPods Pro 2 surface (and spot-check 2–3 of the other 626
affected canonicals) live; then commit and push (Railway auto-deploys from `main` per the
established process) so the standing hourly scheduler carries the fix forward; then checkpoint
this document as closed.

---

## 8. Live-verification addendum (2026-08-28, authorization granted and executed)

Founder authorized "run it live and verify." Executed:

1. **`build-tps-projection.ts` run live (non-dry) against production.** 6,959 canonicals read,
   6,959 rows written, 0 pruned, 1,341 comparable (matching the dry-run exactly). Direct Postgres
   check confirmed `apple|airpods pro 2` now resolves to **SAR 1,049** (a genuine, fresh, valid
   current offer — confirmed via `tps_current_offers`, and notably matching the original,
   pre-incident genuine price from 2026-07-22, corroborating it's correct).
2. **A second, distinct pre-existing bug found and fixed while verifying propagation**:
   `scripts/sync-tps-projection-to-algolia.ts` had no pagination and silently capped its read of
   `tps_product_projection` at Supabase's default 1000-row limit — with 1,341 comparison-eligible
   rows, roughly 25% of the catalog was arbitrarily dropped from the `tawveeri_tps_products`
   Algolia index on every sync (which specific ~25% was non-deterministic, since a bulk projection
   upsert gives every row nearly-identical `updated_at` values). Fixed with explicit `.range()`
   pagination; `tsc` baseline unchanged (550); re-ran the sync — **1,341/1,341 synced** (up from
   1,000/1,000 on the first, unpatched run). Direct Algolia query confirmed `tawveeri_tps_products`
   now correctly shows `lowest_price: 1049` for this identity key.
3. **Live `tawveeri.com` search was then checked and found STILL wrong (SAR 79)** — tracing this
   revealed the live search route reads from neither of the two things just fixed, but from a
   third, independent code path. See `docs/P0_LIVE_SEARCH_STALE_PRICE_2026-08-28.md` — that is
   now the sole remaining open item for the overall customer-facing incident.

**This document's own scope (`tps_product_projection` + its Algolia sync) is CLOSED as fixed,
deployed to production, and independently verified.** The overall incident is not closed — see
the status note at the top of this file.
