# Production Execution Topology

**Purpose:** Explain every process writing to production, and what triggers it.
**Method:** Repository evidence, runtime probing, and temporal forensics on ingested data. Read-only. No production modification.
**Evidence date:** 2026-07-20.

**Classification key:** `VERIFIED` proven by direct evidence · `PARTIALLY VERIFIED` mechanism proven, trigger correlated but not directly observed · `INFERRED` consistent with evidence, not proven · `UNKNOWN` cannot be established without access the repository does not provide.

---

## 1. Execution graph (as it actually runs)

```
┌─ TRIGGER LAYER ────────────────────────────────────────────────────────────┐
│                                                                            │
│  [T1] GitHub Actions  .github/workflows/tps-heartbeat.yml                  │
│       cron '0 */6 * * *'  → POST tawveeri.com/api/cron/discover-products    │
│       body {"store_slug":"jarir","max_pages":3}  auth secrets.CRON_SECRET   │
│       STATUS: PARTIALLY VERIFIED                                           │
│                                                                            │
│  [T2] Supabase pg_cron (System A) → POST /api/cron/discover-firecrawl       │
│       fires 00:00 / 06:00 / 12:00 / 18:00 UTC, second-accurate             │
│       STATUS: VERIFIED — owner-confirmed 2026-07-20                        │
│                                                                            │
│  [T3] PM2 scheduler (scripts/scheduler.js) → /api/cron/dispatch            │
│       STATUS: VERIFIED NOT RUNNING against System A                        │
│                                                                            │
│  [T4] In-app scheduler   STATUS: VERIFIED ABSENT                           │
│  [T5] TPS pipeline trigger (L1→L5)   STATUS: VERIFIED ABSENT               │
│  [T6] Algolia sync trigger   STATUS: VERIFIED ABSENT                       │
└────────────────────────────────────────────────────────────────────────────┘
            │                                   │
            ▼ [T1]                              ▼ [T2]
┌───────────────────────────┐      ┌────────────────────────────────────┐
│ /api/cron/discover-products│      │ /api/cron/discover-firecrawl        │
│ ScrapingOrchestrator       │      │ getEnabledAdapters() → 2 adapters   │
│ → BaseScraper (jarir)      │      │ → almanea (algolia)                 │
│ → IngestionService         │      │ → extra   (unbxd_extra)             │
│ source_method='scraper'    │      │ source_method = adapter._source     │
│ VERIFIED                   │      │ VERIFIED                            │
└─────────────┬──────────────┘      └──────────────┬─────────────────────┘
              │                                    │
              ▼                                    ▼
      raw_observations  (124,637 total, 100% processing_status='pending')
      price_history     (append; canonical_product_id NULL on new rows)
      product_stores    (2 distinct store_id only)
      store_sync_status (paging state — Extra, Almanea only)
              │
              ╳  NO TRIGGER — pipeline stops here
              │
      normalized_product_observations  2,939   (last written June, manual)
      identity_resolution_events          37
      canonical_products               2,168   (bulk-linked by migration 005)
      product_matches                     76
      tps_product_projection               3
              │
              ╳  NO TRIGGER — sync script overwritten at commit d386ede
              │
      Algolia products              859 records, stale since 2026-07-07
      Algolia tawveeri_tps_products   3 records, stale since 2026-06-29
              │
              ▼
      /api/search  (Algolia → Supabase fallback → TPS merge) → decision layer
              ▼
      /go/{offerId} → outbound_clicks (31 total) → merchant
```

---

## 2. Process register

### P1 — Jarir discovery
| | |
|---|---|
| **Trigger** | GitHub Actions `tps-heartbeat.yml`, `0 */6 * * *` — **PARTIALLY VERIFIED** |
| **Runtime** | Next.js route on Railway |
| **Deployment** | `tawveeri.com` |
| **Source code** | `src/app/api/cron/discover-products/route.ts` → `ScrapingOrchestrator` → `JarirScraper` → `IngestionService` |
| **Configuration** | Workflow file; `secrets.CRON_SECRET`; `max_pages: 3` |
| **Environment** | Railway env, System A database |
| **Outputs** | `raw_observations` (50,288 total, 2,842 last 24 h, `source_method='scraper'`), `price_history` (11,734 under `jarir`), `product_stores` |
| **Downstream** | Search fallback; TPS (blocked — see P5) |
| **Health verification** | None. `scraping_runs` = 0; `scraping_run_id` NULL on every row |
| **Failure behaviour** | Silent. A failed run leaves no trace anywhere |
| **Evidence** | Session correlation: `raw_observations` 13:48:16→13:57:11 exactly matches `price_history` 13:48:19→13:57:50. Cadence irregular (08:44, 13:48 ≈ 5 h 04 m apart) — consistent with GitHub Actions cron drift, which GitHub does not guarantee to be on time |
| **Why only PARTIALLY VERIFIED** | The workflow exists and targets this route; the data matches its store and cadence pattern. Run history could not be read — `gh` CLI is unavailable and no GitHub token is configured |

### P2 — Extra + Almanea discovery
| | |
|---|---|
| **Trigger** | **Supabase pg_cron on System A** (owner-confirmed 2026-07-20), firing 00:00/06:00/12:00/18:00 UTC via pg_net HTTP call — **VERIFIED** |
| **Runtime** | Next.js route on Railway |
| **Deployment** | `tawveeri.com` |
| **Source code** | `src/app/api/cron/discover-firecrawl/route.ts` → `getEnabledAdapters()` → `adapters/almanea.ts`, `adapters/extra.ts` |
| **Configuration** | `STORE_ADAPTERS` registry; hardcoded Almanea Algolia keys; hardcoded Extra Unbxd site key; paging state in `store_sync_status` |
| **Outputs** | `raw_observations` — Almanea 33,080 (`source_method='algolia'`), Extra 39,240 (`unbxd_extra`); `price_history` — Almanea 31,005, Extra 17,150; `store_sync_status` |
| **Downstream** | Same as P1 |
| **Health verification** | Partial — `store_sync_status` records `status`, `last_started_at`, `last_finished_at`, `next_page`, `total_fetched`, `total_saved`, `last_error`. Not surfaced in any dashboard |
| **Failure behaviour** | `last_error` recorded per store; no alerting |
| **Evidence (writer) — VERIFIED** | `discover-firecrawl/route.ts:42` writes `source_method: p._source \|\| 'api'`; `adapters/extra.ts:71` emits `_source:'unbxd_extra'`; `adapters/types.ts:22` documents `'algolia' \| 'unbxd_extra'`. Production values match exactly |
| **Evidence (cadence)** | Almanea starts :00:06 past each 6-hour boundary; Extra starts ≈:04:05, immediately after Almanea completes. Sequential, single-process, second-accurate across all observed runs |

### P3 — PM2 scheduler — **VERIFIED NOT PARTICIPATING**
`scripts/scheduler.js` posts to `/api/cron/dispatch`, which reads `scraping_schedules`. On System A both `scraping_schedules` and `scraping_runs` contain **0 rows**, so this path has never executed against System A. PM2 belongs to the VPS deployment (`ecosystem.config.js`), which serves System B.

### P4 — In-app scheduler — **VERIFIED ABSENT**
`src/instrumentation.ts` registers only Sentry. The three `setInterval` calls in the codebase are the middleware rate-limit cleaner, the search-cache cleaner, and a 30-second admin dashboard refresh. None triggers ingestion.

### P5 — TPS knowledge pipeline — **VERIFIED ABSENT**
No trigger of any kind exists. 124,637 raw observations, **100 % still `processing_status='pending'`**. Downstream volumes (2,939 / 37 / 76 / 3) correspond to manual script runs in June. The 80.4 % canonical linkage on `price_history` came from bulk migration `005_link_products` (name + brand matching), not from the matcher.

### P6 — Algolia sync — **VERIFIED ABSENT**
The sync code was replaced at commit `d386ede` while the filename and the `algolia:sync` npm script were retained. Index `products` last updated 2026-07-07; `tawveeri_tps_products` 2026-06-29.

### P7 — Edge Function `embed` — **VERIFIED NOT DEPLOYED**
`404 NOT_FOUND` on System A. The `vector`, `pgmq` and `util` schemas are absent, so the embedding pipeline could not run even if invoked.

### P8 — System B (`tawveeri.etlaq.sa`) — **VERIFIED DORMANT**
Zero price observations in 30 days; `product_stores.last_checked_at` zero updates in 30 days. Serving requests (health uptime ≈ 10.8 days) but ingesting nothing.

---

## 3. Trigger analysis for P2 — what was excluded, and what remains

**Excluded by evidence:**

| Candidate | Why excluded |
|---|---|
| PM2 scheduler | Targets `/api/cron/dispatch`; `scraping_schedules` = 0 on System A; PM2 config belongs to the VPS serving System B |
| GitHub Actions | Only one workflow has ever existed in the repository (`b852bb6`); it targets `discover-products` with `store_slug: jarir`. GitHub scheduled runs drift by minutes to hours; P2 is second-accurate |
| In-app scheduling | Verified absent |
| Railway config in repository | No cron entry in `railway.toml`, `railway.json`, or any Procfile/nixpacks file |

**Remaining candidates — cannot be discriminated without access the repository does not provide:**

1. **Supabase Dashboard Cron** (pg_cron + pg_net). Circumstantial support: both the `cron` and `net` schemas exist on System A, while migration `12-ai-recommendations-infrastructure.sql` — the only repository artifact that would install them — was demonstrably **not** applied (no `vector`, `pgmq`, or `util`). Something enabled them by another means, and the Supabase Cron feature auto-enables exactly these two extensions. **INFERRED, not verified.**
2. **Railway-dashboard cron** configured outside the repository. **UNKNOWN.**
3. **External HTTP cron service.** **UNKNOWN.**

**Why this cannot be resolved from here:** `cron` and `net` are not exposed through PostgREST (`PGRST106 — Only the following schemas are exposed: public, graphql_public`). Reading `cron.job` requires either a direct database connection (`SUPABASE_DB_URL` is not configured) or Supabase dashboard access. Exposing the schema would be a production modification and is out of scope.

**How to resolve it — three read-only checks the owner can run:**
1. Supabase Dashboard → Integrations → Cron: list jobs on `vyceqrzttspyycdpojtn`.
2. Railway Dashboard → service → Settings → Cron schedule.
3. `SELECT jobid, schedule, command, active FROM cron.job;` via the SQL editor.

---

## 4. Defects surfaced by this exercise

| # | Defect | Evidence | Impact |
|---|---|---|---|
| D1 | **Store naming is inconsistent between tables.** Jarir writes `raw_observations.store_name = 'جرير'` but `price_history.store_name = 'jarir'`. Amazon shows the same split (`أمازون` / `amazon`) | 50,288 vs 11,734 rows under different keys | Any join or aggregation keyed on `store_name` silently under-counts. Affects TPS matching and per-store analytics |
| D2 | **No run logging on either active scraper** | `scraping_runs` = 0; `scraping_run_id` NULL on all rows | Failures are invisible; no coverage or freshness SLI is computable |
| D3 | **`price_history.canonical_product_id` is NULL on new rows** | Newest row inspected | Fresh prices do not reach the canonical graph, so deal verdicts run on ageing data |
| D4 | **Two ingestion paths with different contracts** | P1 writes `product_stores`; P2 writes `store_sync_status` | No shared claim-locking; concurrent runs are possible |
| D5 | **Amazon ingestion has stopped** | 2,029 raw observations, 0 in last 24 h | Silent loss of a store, undetectable without D2 fixed |
| D6 | **Only 3 of 8 registered stores are ingesting** | `stores` has 8 rows; only Jarir, Extra, Almanea active | Coverage far below the registry |
| D7 | **`product_stores` contains only 2 distinct `store_id`** | 7,124 rows, 2 stores | The legacy catalog table is being written by only part of the pipeline |

---

## 5. Confidence statement

| Area | Classification |
|---|---|
| What writes to System A | **VERIFIED** — two routes, both repository code, proven by `source_method` matching adapter source strings and by session correlation |
| Ingestion volumes and cadence | **VERIFIED** — exact counts and second-level timing |
| Jarir trigger | **PARTIALLY VERIFIED** — workflow exists and targets it; run history unreadable |
| Extra/Almanea trigger | **VERIFIED** — Supabase pg_cron, owner-confirmed 2026-07-20. The earlier inference (pg_cron + pg_net, based on both schemas existing while migration 12 was never applied) is confirmed correct |
| TPS pipeline trigger | **VERIFIED ABSENT** |
| Algolia sync trigger | **VERIFIED ABSENT** |
| PM2 / in-app scheduling | **VERIFIED NOT PARTICIPATING** |
| Embedding pipeline | **VERIFIED NOT DEPLOYED** |
| System B activity | **VERIFIED DORMANT** |

**All production execution paths are now accounted for.** Architecture Reconciliation is **COMPLETE** as of 2026-07-20, when the owner confirmed Supabase pg_cron as the trigger for `/api/cron/discover-firecrawl`.

**Consequence of the pg_cron finding — carried into the transition plan:** the platform's primary scheduler is defined **inside the database**, not in version control. The schedule is therefore invisible to code review, absent from the repository, and lost on any database restore or migration. This is recorded as a first-class technical debt item (see `ENGINEERING-TRANSITION-PLAN.md`, phase E4).
