# Engineering Transition Plan

**Governs:** implementation of the Tawveeri Unified Platform.
**Bridges:** current two-system production → `UNIFIED-PLATFORM-BLUEPRINT-V1.md`.
**Basis:** Architecture Reconciliation (complete 2026-07-20) + Production Execution Topology (complete).
**Durations** are engineering estimates in working days, not commitments. **Complexity** is S / M / L / XL.

---

## Phase register

### E0 — Decisions & Access
**Objective** Unblock everything requiring owner input or credentials the repository does not hold.
**Outcome** Destination confirmed; System B service-role key available; RLS remediation authorised; public domain chosen.
**Prerequisites** None.
**Steps** Confirm System A as destination · obtain System B service-role key · authorise E3 · choose canonical domain · confirm mobile release capability.
**Verification** Written record in `ENVIRONMENT-AUTHORITY.md`; successful authenticated read of System B `users`.
**Rollback** N/A.
**Op risk** None · **Deploy risk** None · **Prod impact** None · **Complexity** S · **Duration** 1 · **Success** Every downstream phase has its inputs.

### E1 — Observability & Run Logging *(fixes D2)*
**Objective** Make every ingestion run observable before anything is changed.
**Outcome** Both scrapers write `scraping_runs`; freshness, coverage and failure SLIs exist.
**Prerequisites** E0.
**Steps** Wire `startRun`/`finishRun`/`failRun` into `discover-products` and `discover-firecrawl` · populate `scraping_run_id` on `raw_observations` and `price_history` · expose per-store freshness and save-rate in the admin health view · alert on zero-rows-for-a-store.
**Verification** A live 6-hour cycle produces one run row per store with non-zero counts; `scraping_run_id` non-null on new rows; D5 (Amazon silence) becomes visible.
**Rollback** Revert instrumentation; ingestion unaffected (logging is additive).
**Op risk** Low · **Deploy risk** Low · **Prod impact** None (additive writes) · **Complexity** M · **Duration** 3–5 · **Success** No ingestion run can fail silently.

### E2 — Store Identity Normalisation *(fixes D1)*
**Objective** One store key across all tables.
**Outcome** `store_name` resolved to a single canonical slug everywhere; historical rows reconciled.
**Prerequisites** E1 (so the change is observable).
**Steps** Adopt `stores.slug` as the key · map `جرير`↔`jarir`, `أمازون`↔`amazon`, `اكسترا`/`إكسترا`, `المنيع` · add a resolution helper used by both ingestion paths · backfill historical rows with an append-only correction record, never an in-place rewrite of `price_history` semantics.
**Verification** Zero rows whose `store_name` is not a known slug; per-store counts across `raw_observations` and `price_history` reconcile (Jarir currently 50,288 vs 11,734 under different keys).
**Rollback** Mapping layer is additive; disable the resolver and legacy keys still read.
**Op risk** **Medium — silent correctness defect being corrected on live data** · **Deploy risk** Low · **Prod impact** Improves join correctness; no user-visible change · **Complexity** M · **Duration** 3–5 · **Success** Joins on store identity return complete results.

### E3 — RLS Remediation on System B
**Objective** Close the live PII exposure.
**Outcome** `phone_otps` (94), `login_sessions` (12) and the three analytics views no longer readable with the public anon key.
**Prerequisites** E0 authorisation.
**Steps** Apply restrictive RLS policies · re-verify with the anon key · confirm the application's own paths still function.
**Verification** Anon read returns zero rows for all five objects; authenticated own-row access unaffected.
**Rollback** Revert policies (restores exposure — only if the app breaks).
**Op risk** Low · **Deploy risk** Low · **Prod impact** Security improvement · **Complexity** S · **Duration** 1 · **Success** No PII readable without authentication.
**Note** Independent of consolidation. Do not defer behind it.

### E4 — Scheduler Consolidation & Infrastructure-as-Code
**Objective** One scheduler, defined in version control.
**Outcome** pg_cron job definitions live in the repository; the GitHub Action is retired; all triggers route through `/api/cron/dispatch` with claim-locking.
**Prerequisites** E1.
**Steps** Export current pg_cron jobs into a versioned migration · move Jarir onto the same scheduler · retire `tps-heartbeat.yml` · populate `scraping_schedules` so dispatch owns cadence · retain pg_cron as the tick source.
**Verification** Schedule reproducible from the repository on a fresh database; exactly one run per store per window; no double-runs.
**Rollback** Re-enable the GitHub Action; restore prior pg_cron entries from the versioned copy.
**Op risk** **Medium — a scheduling gap stops all ingestion** · **Deploy risk** Medium · **Prod impact** None if cadence is preserved · **Complexity** M · **Duration** 3–5 · **Success** Schedule is code; no trigger exists outside version control.

### E5 — Algolia Sync Restoration
**Objective** Restore the index producer lost at commit `d386ede`.
**Outcome** A scheduled sync populates the canonical projection index.
**Prerequisites** E4 (scheduler), E6 for canonical content to be meaningful.
**Steps** Recover the sync from `11fb4b9`/`7cc92ad` · retarget it at `tps_product_projection` → `tawveeri_tps_products` · rename the misleading `algolia-sync.ts` (it contains identity-resolution logic) and correct the npm script · schedule it · stamp `algolia_synced_at`.
**Verification** Index record count tracks projection count; `algolia_synced_at` advances; a full rebuild from projection reproduces the index.
**Rollback** Stop the sync; search continues on the legacy `products` index.
**Op risk** Low · **Deploy risk** Low · **Prod impact** None until E14 · **Complexity** S · **Duration** 2–3 · **Success** The index is reproducible from the database.

### E6 — TPS Pipeline Automation *(the backlog)*
**Objective** Convert knowledge construction from manual to event-driven.
**Outcome** The 124,637 pending observations drain; new observations normalise, resolve and canonicalise continuously.
**Prerequisites** E1, E2, E4.
**Steps** Wrap each L1→L5 transition with an idempotency key and event emission · run in **shadow** against a copy of live input, comparing against manual output · stand up the human review queue for conflicts and low confidence · cut over to authority with the manual path retained one cycle · drain the backlog through the **live** path, not a separate backfill route.
**Verification** Shadow output matches manual identity decisions within an agreed tolerance · replay produces no duplicates · `processing_status='pending'` count falls monotonically · a rebuild-from-raw drill completes.
**Rollback** Disable the schedule; manual path resumes. Canonical rows created by automation are reversible by **supersession, never deletion**.
**Op risk** **High — an over-merge corrupts canonical identity** · **Deploy risk** Medium · **Prod impact** Deal verdicts improve as coverage rises · **Complexity** **XL** · **Duration** 15–25 · **Success** Canonicalisation lag continuously below the manual baseline; conflict backlog stable.

### E7 — Canonical Linkage on Ingestion *(fixes D3)*
**Objective** New price rows reach the canonical graph.
**Outcome** `price_history.canonical_product_id` populated at write time or shortly after, via the resolution pipeline.
**Prerequisites** E6.
**Steps** Link on ingestion where identity is already known; otherwise enqueue for resolution and link on completion · measure the unlinked ratio as an SLI.
**Verification** Unlinked share of new rows trends to near zero; the current 80.4 % overall linkage rises for recent data specifically.
**Rollback** Disable linking; rows remain unlinked as today.
**Op risk** Medium · **Deploy risk** Low · **Prod impact** Intelligence accuracy improves · **Complexity** M · **Duration** 3–5 · **Success** Fresh prices are canonically addressable.

### E8 — Decision Layer Surfacing
**Objective** Render the judgement already being computed and discarded.
**Outcome** Search results carry the decision card, ranked matches and per-result reasons on Web.
**Prerequisites** None technically; best after E6 so verdicts rest on fresh data.
**Steps** Consume `decisionCard`/`topMatches` in the search page · render verdict + reason + evidence window + freshness per the experience contract · add the confidence/freshness/degraded token families.
**Verification** Every result set renders judgement or an explicit `insufficient` state; no verdict appears without its reason.
**Rollback** Hide the component; API unchanged.
**Op risk** None · **Deploy risk** Low · **Prod impact** User-visible improvement · **Complexity** M · **Duration** 5–8 · **Success** Search is a decision surface, not a listing surface.

### E9 — Application Schema Creation in System A
**Objective** Give System A the user, auth and commerce schema it lacks.
**Outcome** All 14 missing tables plus analytics views and recommendation RPCs exist in System A, empty.
**Prerequisites** E0 (destination confirmed).
**Steps** Derive DDL from `scripts/database/` 01–21, adapted to System A's existing `products`/`product_stores`/`stores` shapes · apply RLS from the outset (do not inherit System B's gaps) · add the indexes whose absence causes System B's statement timeouts · record in System A's `schema_migrations`.
**Verification** Schema diff against the specification is clean; RLS verified with an anon key **before** any data lands; no table is anon-readable that should not be.
**Rollback** Drop the new (empty) tables.
**Op risk** Low · **Deploy risk** Low · **Prod impact** None (additive, unused) · **Complexity** L · **Duration** 8–12 · **Success** System A can host the application.

### E10 — User Data Inventory & Migration
**Objective** Move customer identity and owned records B → A.
**Outcome** All accounts and user-owned data present in System A with referential integrity.
**Prerequisites** E0 (B service-role key), E9.
**Steps** Full counted inventory of B (activity shows 2 users; the registered total is unverified) · map B product references to A canonical identity via `product_matches` · migrate auth users, then owned records · dual-read during the window · reconcile counts.
**Verification** Row counts match per table; every foreign key resolves; a sample of accounts authenticates against A; zero orphaned references.
**Rollback** B remains readable and authoritative until cutover; revert client configuration.
**Op risk** **High — customer identity data** · **Deploy risk** Medium · **Prod impact** Auth cutover requires a window · **Complexity** L · **Duration** 8–12 (scales with the unverified user count) · **Success** No customer loses an account, wishlist or alert.

### E11 — Mobile Convergence
**Objective** Mobile becomes a client of the unified platform, with attribution.
**Outcome** Mobile targets System A, exits via `/go`, renders platform verdicts, holds no catalog queries.
**Prerequisites** E9, E10, E8.
**Steps** Replace 45 direct catalog reads with platform contracts · adopt canonical identity in place of `products.slug` · consume the decision object · route every exit through `/go/{offerId}` · repoint `EXPO_PUBLIC_*` · release.
**Verification** Zero catalog table reads in the client · every exit produces a click row · verdicts identical to Web for the same product · staged rollout metrics healthy.
**Rollback** Staged rollout revert; server contracts unchanged; older installs continue as an unattributed cohort until they decay.
**Op risk** Medium · **Deploy risk** **High — app store review is outside our control** · **Prod impact** Restores mobile attribution · **Complexity** **XL** · **Duration** 15–20 **plus store review latency** · **Success** Mobile revenue is measurable.

### E12 — Adapter Completion
**Objective** All 8 stores ingest through the adapter contract.
**Outcome** Amazon restarted; Noon, Samsung KSA, Shaker, SWSG added; Jarir migrated off the legacy path.
**Prerequisites** E1, E2, E4.
**Steps** One adapter per store, each shadowed against the legacy scraper before cutover · restart Amazon (D5) · retire `discover-products` when Jarir is migrated.
**Verification** Per-store coverage and save-rate at or above the legacy baseline before each cutover; 8/8 stores producing `raw_observations`.
**Rollback** Per store — revert to the legacy scraper.
**Op risk** Medium · **Deploy risk** Low (incremental) · **Prod impact** Coverage rises from 3 to 8 stores · **Complexity** L · **Duration** 12–18 · **Success** One ingestion contract, full store coverage.

### E13 — Recommendations & Embeddings
**Objective** Restore semantic personalisation on canonical identity.
**Outcome** `vector`/`pgmq`/`util` installed on System A; `embed` deployed; embeddings on canonical products; recommendation RPCs live.
**Prerequisites** E9, E6.
**Steps** Apply the embedding infrastructure (migration 12/13 equivalent) to System A · deploy the `embed` Edge Function · provision `GOOGLE_AI_API_KEY` · embed canonical text · re-key recommendation functions to canonical identity · map historical interactions via `product_matches`.
**Verification** Embedding coverage at parity with canonical count · `source` distribution shows the semantic tier active, not silently degraded to popularity · contract unchanged for clients.
**Rollback** RPC reverts to popularity-only.
**Op risk** Low · **Deploy risk** Low · **Prod impact** Recommendation quality improves · **Complexity** L · **Duration** 8–12 · **Success** The semantic tier functions for the first time in production.

### E14 — Search Index Authority Cutover
**Objective** One owned index serves all clients.
**Outcome** `tawveeri_tps_products` serves production; the legacy `products` index is retired.
**Prerequisites** E5, E6 (canonical content at coverage).
**Steps** Shadow-compare both indexes on a fixed bilingual query set · reconcile the response schema · switch by configuration flag · retain the legacy index as standby for one observation period.
**Verification** Coverage matches canonical count · relevance equal or better on the query set · zero-result rate and latency not worse · no code references the legacy index.
**Rollback** Flip the flag back (seconds).
**Op risk** Medium · **Deploy risk** Low · **Prod impact** Search quality — the primary funnel · **Complexity** M · **Duration** 5–8 · **Success** The platform owns its retrieval surface.

### E15 — Legacy Retirement
**Objective** One system.
**Outcome** System B, the VPS, and the non-canonical domain are decommissioned.
**Prerequisites** E10, E11, E12, E14 + an observation period on each.
**Steps** Redirect the retired domain · confirm zero readers of System B for a full observation period · snapshot and archive System B · **retire from use; do not drop data within this plan**.
**Verification** Zero traffic and zero database reads on System B for the observation period; archive restorable.
**Rollback** Re-point DNS; System B retained intact throughout.
**Op risk** **High if premature** · **Deploy risk** Medium · **Prod impact** Requires all prior phases verified · **Complexity** M · **Duration** 5 + observation · **Success** One platform, no data lost.

### E16 — Contracts & Documentation Alignment
**Objective** The repository describes reality.
**Outcome** `types.ts` matches System A post-consolidation; `CLAUDE.md` corrected; runbooks exist for every operational procedure.
**Prerequisites** E9 (and updated again after E15).
**Steps** Regenerate types from the consolidated schema · correct the Phase-13 documentation drift (framework version, fonts, migration count, search architecture, mobile data model) · write runbooks for each pipeline stage, backfill, reindex, cutover and rollback · consolidate the stale governance documents.
**Verification** Schema-vs-types diff clean; every manual procedure has a runbook; one authoritative document per domain.
**Rollback** N/A.
**Op risk** None · **Deploy risk** None · **Prod impact** None · **Complexity** M · **Duration** 5–8 (continuous) · **Success** No contributor starts from a false model.

---

## Dependency graph

```
E0 ─┬─► E1 ─┬─► E2 ─────────────┬─► E6 ─┬─► E7
    │       ├─► E4 ─┬─► E12      │      └─► E5 ──► E14
    │       │       └─► E5       │
    │       └─► (SLIs gate every later acceptance)
    │
    ├─► E3   (independent — security, no dependents)
    │
    ├─► E9 ─┬─► E10 ──► E11 ──┐
    │       └─► E13           │
    │                         ├─► E15
    E8 (independent)          │
    E12, E14 ─────────────────┘
    E16 (continuous; re-run after E9 and E15)

PARALLEL TRACKS
  Track 1 — Data correctness:  E1 → E2 → E6 → E7 → E5 → E14
  Track 2 — Consolidation:     E9 → E10 → E11 → E15
  Track 3 — Independent:       E3 · E8 · E16
  Track 4 — Coverage:          E4 → E12
```

### True critical path

```
E0 → E9 → E10 → E11 → E15
 1  +  12 +  12 +  20  + 5  = ~50 working days + app-store review + observation
```

**Track 2 is the critical path, and E11 sets it.** Mobile carries a dependency no engineering effort can compress: **app store review latency**, plus the tail of users who do not update. Track 1 (E1→E14, ~35–50 days) runs entirely in parallel and does not gate consolidation.

**Implication:** start E11's client work as early as its prerequisites allow. Every day E9/E10 slips pushes the whole programme by a day; slippage inside Track 1 does not.

---

## Task classification

**Immediate** (start now; no destination decision required)
E0 · E1 (observability — gates every later acceptance) · E2 (silent live correctness defect) · E3 (live PII exposure).

**Before launch** (required for the unified platform to be correct)
E4 · E6 · E7 · E9 · E10 · E11 · E14 · E5.

**After launch** (safe once one platform is live)
E12 (adapter completion — coverage grows incrementally) · E13 (semantic tier — recommendations degrade gracefully to popularity meanwhile) · E15 (retirement, after observation).

**Nice to have**
E8 (decision-layer surfacing — high user value, zero architectural dependency; genuinely optional to *sequencing*, not to product quality).

**Technical debt** (carry explicitly; do not let it disappear)
Scheduler defined in the database rather than version control (addressed by E4) · `algolia-sync.ts` misnamed and mis-scripted (E5) · `types.ts` describing a system being retired (E16) · duplicated AR↔EN dictionaries, saved-search and spec modules · two design systems · `docker-compose.yml` provisioning retired Flask · `railway.json` superseded by `railway.toml` · backup and tmp tables in production (`canonical_products_backup`, `products_category_backup_20260626`, `tmp_ac_matches`, `tmp_matches`) · nine production tables with no repository representation.

---

## Final review — remaining assumptions, contradictions and hidden risks

### Architectural contradictions

**C1 — 80.4 % of canonical linkage bypassed the corroboration invariant.**
`price_history.canonical_product_id` was populated for 48,188 rows by migration `005_link_products` using **name + brand matching**, not by the TPS identity process. Blueprint invariant I3 requires corroborated identity (≥2 stores, confidence-gated, decision recorded in `identity_resolution_events` — of which there are only 37). **The canonical graph's quality is therefore largely unvalidated.** This is not a process gap; it is a correctness question about data the entire intelligence layer already rests on. E6 must include an audit of bulk-linked rows, not merely automate future ones.

**C2 — Registration-based extension is asserted but only 25 % exercised.**
2 of 8 adapters and 2 of N category plugins exist. The claim that expansion is "one adapter file + one line" is unproven at scale; E12 is the first real test and may surface contract gaps.

**C3 — Category coverage is misaligned with plugin coverage.**
`canonical_products` is ~40 % accessories (881 of the ~1,000 categorised), while plugins exist only for `ac` and `mobile`. Most canonical products were therefore created outside the plugin path — consistent with C1.

### Hidden risks

**H1 — Ingestion save-rate is very low and unexplained.** `store_sync_status` shows Extra fetched 27,140 and saved 633 (2.3 %); Almanea fetched 29,400, saved 444 (1.5 %). Whether this is deduplication working correctly or silent data loss is **unknown** and should be answered in E1 before E12 multiplies the pattern across six more stores.

**H2 — Third-party keys are hardcoded and merchant-controlled.** Almanea's Algolia keys and Extra's Unbxd site key sit in source. A merchant rotating them stops ingestion — and until E1 lands, silently.

**H3 — `raw_observations` grows unbounded with nothing consuming it.** 124,637 rows, 100 % pending, growing ~5,000/day. Storage and drain time both scale until E6.

**H4 — Extra's paging state is at `next_page = 3009`.** Either a very large catalog is being walked slowly, or paging never resets. Worth confirming before E12.

**H5 — `price_history` is dual-keyed.** Rows exist keyed by `canonical_product_id` and by `product_store_id`. Consolidation must not assume one key.

**H6 — System B's statement timeouts indicate missing indexes.** E9 must create indexes deliberately rather than inherit the shape that produced them.

**H7 — The TPS output path is untested at scale.** `tps_product_projection` holds 3 records. E6 will raise that by orders of magnitude, exercising projection and sync code that has never run at volume.

**H8 — `waffar_conversations` is empty.** Either the assistant does not persist conversations or it is unused. Unresolved; low risk, but it means assistant usage is currently unmeasurable.

**H9 — The mobile long tail.** Users who never update remain on System B's contract after E15. The retirement criterion must be traffic-based, not date-based.

### Assumptions that remain (stated, not hidden)

1. System B's registered user count is small — **unverified** until E0 delivers the service-role key. If it is large, E10's complexity and duration rise materially.
2. The shipped mobile build matches repository source — **unverified**.
3. `scripts/database/` 01–21 is a faithful specification for E9's DDL — it describes System B, which is being retired; it has not been validated as a target-state specification.
4. Deal and price-intelligence thresholds (`MIN_PRICE_POINTS = 2`, 30-day window) remain provisional, self-described in code as young-platform values.

---

## Governing rule

No phase is complete because code merged. Completion requires the stated verification evidence and, for every cutover phase (E4, E6, E10, E11, E14, E15), a **rollback drill that has actually been performed**.
