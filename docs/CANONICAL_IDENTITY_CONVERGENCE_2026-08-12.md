# Canonical Identity Convergence — Mission Record (2026-08-12)

**ADR:** ADR-242 · **Commit:** `436b9d3` · **Rule version:** `convergence-v1`
**Charter:** solve the `products.canonical_product_id` convergence gap correctly and
permanently, under "unknown beats incorrect" — a safe, evidence-grounded, repeatable,
auditable, ongoing mechanism, not another one-off backfill.

---

## 1. What existed before (Phase 0 reconstruction, production-verified)

The production identity path:

```
raw_observations (immutable, per-store cursor)
  → normalizeSweep: category plugins → deterministic identity key → tps_identity_staging
  → corroboratePass: ≥2-store Layer-1 / single-store Layer-2 canonicals
      → write_ac_batch (atomic): canonical_products + normalized_product_observations
                                 + product_matches + price_history
  → build-tps-projection → tps_product_projection → search/compare/decide
```

The storefront layer (`products` / `product_stores`) is fed by a separate scraping
path and was bridged to canonicals **exactly once**: migration `005_link_products`
(2026-06-26) matched by `name_ar + brand` text — the method `docs/TPS.md:101` records
as unvalidated debt. Measured on 2026-08-12:

- 1,461 of 10,385 products linked (14.1%); Almanea 97.1%, Extra 22.7%, **every other
  store 0%** (all onboarded after 2026-06-26).
- **All 1,461 targets are legacy canonicals**: 0 have `tps_identity_key`, 0 have a
  projection row — disjoint from the graph `decide()`/search read.
- A third writer (`discover-firecrawl`'s `ensureCanonicalProduct`, exact-`name_ar`
  match) keeps creating key-less legacy canonicals — the live invariant violation
  `TPS.md:102` already names. Untouched by this mission (recorded, not chased).
- TPS-written `price_history` rows carried **no `store_id`** (100% NULL over 7 days):
  migration 006 backfilled once on 2026-07-20 and `write_ac_batch` never stamped it,
  so TPS prices were invisible to the customer chart (which joins on
  `canonical_product_id, store_id` — ADR-241).

## 2. External research (Phase 1, primary sources)

GS1 GTIN management, Google Merchant Center identifier policy, incremental
entity-resolution literature (VLDB 2014 incremental record linkage; Senzing
continuous ER), MDM/MPI reversible-merge practice, and URL/SKU listing-equality
failure modes (content drift, in-place listing swaps, variant-in-one-URL pages,
identity-bearing query params). The governing conclusions adopted:

- **Listing-key equality is deterministic transport, not permanent product truth**
  — the identity claim must be revocable, evidence-cited, and re-validated on every
  visit; contradictions demote to unknown rather than letting key history vouch for
  new contents.
- Industry-wide, uncertain identity is **isolated, never force-merged** (Fellegi-
  Sunter three-band discipline; Google demotes on identifier conflict; CSE orphan
  pages).
- Variant families must never be silently flattened (GS1: each storage/size/bundle
  variant is its own trade item).

**Rejected architectures:** re-matching products to canonicals by attributes (the
June method — forbidden by the TPS evidence hierarchy); trusting the previously
identified ~602 corroborated `product_matches` as a backfill list (observation-level
rows say nothing about WHICH storefront row is the same listing — the founder's
"treat them as candidates, not truth" was correct: the listing-equality lane
re-derived candidates with provenance instead).

## 3. The chosen architecture — identity inheritance by listing equality

A storefront offer `(store_id, product_url)` and a TPS-identified observation
`(store_id, normalized_payload._url)` that name the **same retailer listing** are
the same real-world listing; the projection **inherits** the identity the TPS engine
already assigned to that listing. One identity brain: the projection re-decides
nothing, merges nothing (ADR-176 untouched), and never touches canonicals.

- URL lane: both sides normalized identically (strip scheme+www, query, hash,
  trailing slashes; path case preserved). ASIN lane for Amazon (its two pipelines
  see structurally different URL shapes for the same listing; `/dp/(B0\w{8})` and
  the `products.sku` ASIN are deterministic listing keys).
- Runs as hourly chain step `storefront-link` (after `resolved-single`), bounded
  ≤500 writes/run, idempotent, race-safe (`WHERE canonical_product_id IS NULL`
  guard), `--dry` default for manual runs.

### The projection contract (convergence-v1)

| Rule | Meaning |
|---|---|
| R1 unanimity | every evidence row of a product must name ONE canonical; disagreement → unlinked |
| R2 uniqueness | a URL/ASIN whose active-canonical history is plural → excluded (variant-in-one-URL / reuse trap) |
| R3 no reassign | existing links (incl. the 1,461 legacy ones) are never modified |
| R5 tier gate | only `identity_key_status='valid'` evidence projects in v1; low-confidence (417) reserved |
| R6 provenance | every write recorded in `storefront_identity_links` (evidence class, matched value, npo id, key, tier, rule version); `--rollback` restores exactly what this job wrote |
| R8 drift | evidence re-derived every run; a changed target flags `status='drift'`, never silently rewrites |
| R11 | storage-token contradiction veto (1TB titled listing never links to a \|512 key) |
| R12 | identity-bearing query params must agree (Jarir `childSku` — ADR-058's near-miss, now a guard) |
| R13 | suffixed-numeral contradiction (14T≠14, 13C≠13, 14i≠14) |
| R14 | device-class contradiction via `classifyFromTitle` (an air fryer never links to a mobile canonical) |
| R15 | shared-word numeral contradiction (nova 14 ≠ nova 13; Haier 55" ≠ 65" canonical) |
| R16 | brand contradiction, both-known gate (`brand-map.ts` is the authority; unmapped spellings claim nothing — without the gate this fired 114 times on same-brand Arabic-spelling pairs) |

Guards only veto; nothing ever links on similarity. UNKNOWN remains the default and
majority state.

## 4. Shadow evidence (Phase 4, read-only, before any write)

Of 8,926 unlinked products (8,924 with any offer URL): 253 URLs + 28 ASINs excluded
as plural-history ambiguous (R2); 2,580 clean single-canonical candidates (R1
conflicts: 10); 98 vetoed (R11=17, R12=1, R13=30, R14=5, R15=41, R16=4); **2,065
valid-tier eligible**, 417 low-confidence reserved. Every veto class is pinned by a
real production pair in `tests/identity/storefront-projection-guards.test.ts`
(25 tests). A 50-candidate cross-store audit sample was hand-verified clean.
Category cross-tab confirmed the storefront's own `category` labels are the noisy
side (e.g. misfiled `accessories`); the canonical side (plugin-detected) is finer
and consistent.

## 5. Pilot and expansion (Phases 6–7)

- Migrations applied with rollback evidence: 025 (`storefront_identity_links`,
  RLS-enabled, service-role only) and 026 (`write_ac_batch` stamps
  `price_history.store_id`; `store_name_resolution` learned post-006 labels;
  backfill 12,307 NULL → 14 → 0 after mapping numeric-string labels). Pre-026
  function snapshot: `docs/evidence/write_ac_batch-pre-026-snapshot.sql`.
- **Pilot:** Extra, `--go --limit 60`. Hand-audit of all 60: 60/60 correct
  (brand + form factor + capacity verified, incl. cu.ft↔liter conversions);
  ledger 60/60 consistent; 60/60 chart-visible.
- Live production verification: a pilot product (Hisense 7 cu.ft refrigerator)
  rendered a real price-history chart (+6.7% trend, dated observations) on a page
  that could not show one before; search (Waffar-protected phrase → 48 genuine
  laptops), a compare page, and an unlinked product page all verified unaffected.
- **Expansion:** bounded 500-link batches to drain (one interrupted batch proved the
  race guard: 100 already-written rows skipped, zero double-writes). Drift = 0 on
  every re-derivation throughout.

## 6. Measured result

| | before | after |
|---|---|---|
| linked products | 1,461 / 10,385 (14.1%) | **3,526 / 10,387 (33.9%)** |
| noon | 0% | 26.3% |
| amazon | 0% | 11.9% |
| jarir | 0% | 20.8% |
| extra | 22.7% | 49.7% |
| shaker / lulu / sharafdg / samsung_ksa | 0% | 20.8% / 22.5% / 45.8% / 73.8% |
| links with provenance | 0 | 2,065 (100% of new links, all valid-tier) |
| TPS price rows with store_id | 0% (7d window) | 100% (stamped at write + backfilled) |

Remaining unknown: 6,861 products — honestly unlinked (no TPS evidence for that
listing yet: 6,344 with no clean evidence; 10 R1 conflicts; 281 ambiguous keys; 98
vetoes; 417 low-confidence reserved). New products converge on the next hourly tick.

## 7. Disclosed limitations and residual findings

1. **The 1,461 legacy links still point at legacy canonicals** (R3 protected). ~1,700
   of them also have clean TPS listing-equality evidence — a future, separately
   audited re-pointing mission (dual-key transition: the legacy price rows and the
   firecrawl writer must move together).
2. **Junk-keyed canonicals exist in the TPS graph** and faithful links inherit them
   (e.g. `apple|MODEL:1.07BILLION` from a CHIQ TV's "1.07 billion colors";
   `acer|MODEL:PROCESSOR/192GB`; sharafdg keys carrying store-internal numbers —
   NEW evidence for the ADR-058 defect class arriving via later-onboarded stores).
   R16 catches the cross-brand worst; the graph cleanup is TPS-layer work, not
   projection work.
3. **Renewed/refurbished listings** link to the same canonical as new-condition
   stock when TPS itself keys them there (storage-mismatched ones are R11-vetoed).
   Condition is a commercial variant in the current TPS contract; if condition ever
   becomes identity-relevant, that is a TPS contract change, not a projection one.
4. `ensureCanonicalProduct` (firecrawl) still creates key-less canonicals hourly —
   pre-existing invariant violation, out of scope, still open.
5. `tps:health` carries a pre-existing swsg ingestion staleness FAIL (124.8h),
   untouched by this mission.
6. Amazon coverage (11.9%) is bounded by TPS having few Amazon observations with
   `/dp/` URLs — an ingestion-coverage ceiling, not a matching one.

## 8. Rollback

- Links: `npm run tps:storefront-link -- --rollback --go` (restores NULL for exactly
  the ledger's active rows whose column value is still ours; externally-changed rows
  are left alone and reported).
- `write_ac_batch`: re-apply `docs/evidence/write_ac_batch-pre-026-snapshot.sql`.
- Chain step: revert `refresh-intelligence.ts` (the script itself is dry-by-default).
- `store_id` stamps/backfill: additive column values; `store_name` provenance
  retained on every row (ADR-004).
