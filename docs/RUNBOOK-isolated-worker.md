# Runbook — Isolated Worker (`tawveeri-worker`)

Practical "what do I actually do" doc for the background scraping/intelligence worker,
separated from `tawveeri-main` (the public web service) since the 2026-09-17 SEV-1. See
`docs/DECISIONS.md` (ADR pending — search for "isolated worker") for the full incident,
design rationale, and validation evidence this draws on.

## Why this service exists

The original architecture ran all scraping/discovery/intelligence jobs as a child process of
`tawveeri-main`'s own Next.js server process (`src/instrumentation.ts` spawning
`scripts/scheduler.js`). A stuck job (samsung_delta_watch run #10, 2026-09-17) exhausted the
web container's memory and took the public site down with it — the job and the website shared
one resource budget with no boundary between them.

`tawveeri-worker` is a second Railway service, same repo/branch, that owns ALL heavy background
work. `tawveeri-main` no longer runs any scraper, discovery, or intelligence-refresh code path —
`DISABLE_INPROCESS_SCHEDULER=1` is set on it permanently. A worker crash, hang, or resource spike
can only affect the worker's own container; it structurally cannot take the website down.

## Architecture

- **Config:** `railway.worker.toml` is documentation only — Railway's config-as-code
  (`railwayConfigFile`) is deprecated platform-wide (confirmed live, 2026-09-17: the API rejects
  it with "Use Infrastructure as Code (.railway/railway.ts) instead"). The service's REAL
  `buildCommand`/`startCommand` are set directly via `serviceInstanceUpdate` (`railway api` or the
  dashboard) — **when you change one, change both, or the live service silently keeps the old
  value.** (Also found live: a `buildCommand` override is accepted/persisted/echoed by the API but
  Railpack does not actually apply it for this project — confirmed across two full deploy cycles
  including one genuine cache-busted rebuild. `startCommand` overrides ARE reliably applied. This
  is why the tini fetch below runs as a startCommand prefix, not a build step.)
- **PID 1 / process reaping:** `startCommand` is `node scripts/worker/fetch-tini.js && bin/tini --
  node --import tsx scripts/worker/index.ts`. `fetch-tini.js` downloads krallin/tini's static amd64
  binary (sha256-pinned, fails closed on mismatch) on first boot and verifies-then-skips on later
  restarts. tini runs as PID 1 so any process reparented to it (a killed job's still-alive
  grandchildren — Chromium renderers, nested pipeline scripts) gets reaped instead of accumulating
  as zombies forever. Verified live via an isolated `railway ssh` fixture: before the fix, a
  SIGTERM-ignoring grandchild stayed `Z <defunct>` at 15s+; after, it's gone within seconds of the
  parent's SIGKILL.
- **Concurrency:** exactly one heavy job runs at a time, enforced by a Postgres advisory lock
  (`pg_advisory_lock(748219001)`, `scripts/worker/lib/global-lock.ts`) held over the SESSION pooler
  (port 5432 — the transaction pooler on 6543 would silently break advisory-lock semantics; verified
  live with a real two-connection test). `price_update` and `manual_trigger` are `highPriority: true`
  and always served first from the pending queue.
- **Timeouts / termination:** every job is spawned via `scripts/worker/lib/proc-guard.ts` with
  `detached: true` (its own Linux process group) and a hard `timeoutMs`. On timeout: SIGTERM the
  whole group, wait `graceMs` (default 30s), SIGKILL if still alive. Verified live with a genuine
  forced lock-loss test (killed the lock's own DB backend via `pg_terminate_backend`): the
  `onLost` callback fired ~1ms after termination, cascaded into the running job's cancellation,
  SIGTERM → (a SIGTERM-ignoring fixture child) → SIGKILL after the grace period, and a file the
  child was writing every 200ms stopped growing at exactly that point and never resumed — proof
  the work itself stopped, not just that a callback fired.
- **Per-unit bounding:** `price_update` and `discovery` each spawn ONE store (or store×category)
  as its own child process with its own timeout, not a shared loop under one outer timeout — a
  single slow/broken merchant cannot starve every other merchant's turn. The outer job-level
  timeout (price_update 75min, discovery 60min) is a rare-case backstop; when it fires, the parent
  forwards its own SIGTERM into whichever per-unit child is currently active (nested `detached`
  process groups don't inherit signals automatically — this cascade is required and is what makes
  the backstop actually work, verified live 2026-09-17: a discovery run that hit its 60min ceiling
  correctly cancelled the in-flight `samsung_ksa/accessories` unit within 12s and closed its row).
- **Boot-time orphan recovery:** a mid-run deploy swaps the container before the old one's SIGTERM
  cascade can close its `scraping_runs` row — `reapOrphanedRuns()` (`lib/job-state.ts`) runs once
  at boot, before any job is scheduled, and closes any row still `'running'` older than
  `WORKER_STALE_RUN_THRESHOLD_MS` (default 20min) as `'failed'`. This threshold must stay
  comfortably above every scraping_runs-writing job's real per-row ceiling — see the table below.
  `refresh`/`reobserve` don't write `scraping_runs` at all so they aren't affected by this
  threshold either way. `samsung_delta_watch` writes a SEPARATE table (`samsung_delta_watch_runs`)
  with its OWN boot-time reaper, `reapOrphanedSamsungRuns()` (added 2026-09-18 — this table had NO
  recovery at all until then; `samsung-delta-watch.ts`'s SIGTERM handler only calls
  `process.exit(143)`, never closing its own row, and a SIGKILL gives no chance to either way).
  Threshold: `WORKER_SAMSUNG_STALE_RUN_THRESHOLD_MS` (default 60min — real margin over Samsung's
  own 45min configured timeout). Found live on first deploy: run id=10, the ORIGINAL SEV-1
  INCIDENT ROW, had been stuck `'running'` for 18h51m, undiscovered through this entire migration,
  until this reaper closed it.

### Per-row ceiling vs. the 20-minute reap threshold (audited 2026-09-17)

| Job | Writes `scraping_runs`? | Real per-row ceiling | Margin |
|---|---|---|---|
| price_update | yes, per store | ~8.5min (8min timeout + 30s grace) | wide |
| discovery | yes, per store×category | ~6.5min (6min timeout + 30s grace) | wide |
| feed_ingest | yes, per store | 20min ÷ store count (6 stores ⇒ ~3.3min) | wide at current store count; shrinks if `WORKER_FEED_STORES` drops to 1-2 |
| product_recovery | no (writes `product_recovery_requests`) | n/a | n/a |
| dispatch_sweep | no | n/a | n/a |
| manual_trigger | yes (when enabled) | 20min flat | **zero margin** — currently inert only because `status='pending'` is rejected by a live CHECK constraint (migration `033_scraping_runs_pending_status.sql` drafted, deliberately deferred). Re-check this row before ever applying that migration. |
| refresh, reobserve, samsung_delta_watch | no / separate table | n/a | n/a |

## Environment variables (this service only)

Master switch: `WORKER_JOBS_ENABLED`. Per job: `WORKER_JOB_<NAME>_ENABLED` (default on except where
noted). As of 2026-09-18: ALL EIGHT jobs enabled — `price_update`, `feed_ingest`, `refresh`,
`discovery`, `dispatch_sweep`, `product_recovery`, `reobserve`, `manual_trigger`, and
`samsung_delta_watch` (enabled 2026-09-18 after its `samsung_delta_watch_runs` orphan-recovery gap
was closed — see above — and proven with a real completed run: `status='completed'`, 223 products
updated, 0 failed, 15.4min).

Store lists: `WORKER_INGEST_STORES` (scraper path), `WORKER_FEED_STORES` (feed/API path) — a store
in both is silently excluded from the scraper path (`effectiveScraperStores()`, mirrors ADR-089's
`_feedSet` exclusion) so nothing double-ingests.

Per-job timeouts: `WORKER_PRICE_UPDATE_TIMEOUT_MS` (75min), `WORKER_PRICE_UPDATE_PER_STORE_TIMEOUT_MS`
(8min), `WORKER_DISCOVERY_TIMEOUT_MS` (60min), `WORKER_DISCOVERY_PER_UNIT_TIMEOUT_MS` (6min),
`WORKER_REFRESH_TIMEOUT_MS` (60min — raised from 20min 2026-09-17, see Known limitation below),
`WORKER_FEED_INGEST_TIMEOUT_MS` (20min), `WORKER_PRODUCT_RECOVERY_TIMEOUT_MS` (10min),
`WORKER_DISPATCH_SWEEP_TIMEOUT_MS` (10min), `WORKER_REOBSERVE_TIMEOUT_MS` (15min),
`WORKER_SAMSUNG_TIMEOUT_MS` (45min), `WORKER_MANUAL_TRIGGER_TIMEOUT_MS` (20min).

`WORKER_STALE_RUN_THRESHOLD_MS` (20min) — boot-time orphan-reap threshold, see table above.

**Bounded probe mode** (2026-09-17, extended 2026-09-19): `WORKER_PRICE_UPDATE_PROBE_STORES`
(default `lulu,sharafdg,jarir`), `WORKER_PRICE_UPDATE_PROBE_MAX_PRODUCTS` (default `10`). lulu and
sharafdg: measured at 99–100% `scrape_status='failed'` over 14 days, zero comparable (multi-store)
products, zero outbound/campaign clicks all-time. jarir (added 2026-09-19): 14% price_update
success rate (1045 ok / 7300 offers), only 1 comparable product, zero clicks — but its own
DISCOVERY path is healthy (87/87 successful runs, 14d), so this is a price_update-specific
weakness, not a whole-store block, and probe (not exclusion) fits. This reduces attempt VOLUME
only; existing offers/price history are untouched, ranking is untouched, fully reversible.

**Excluded from price_update entirely** (2026-09-19): `WORKER_PRICE_UPDATE_EXCLUDED_STORES`
(default `lulu`). lulu showed zero comparable products and zero clicks in BOTH the 2026-09-17 and
2026-09-19 reviews, unchanged even at reduced (probe) volume — the probe reduction alone surfaced
no recovered value, only continued cost with nothing to show for it. Scoped specifically to
price_update/Browserless cost — lulu's discovery (178/300 successful runs, 14d, largely non-browser)
is unaffected. Not a permanent removal — reversible by clearing the env var — and not a decision
based on affiliate status (lulu has no affiliate relationship, but that is not the stated reason).

**Kept at full volume, evidence-backed** (2026-09-19): extra (83.6% price_update success rate,
2,526 live `tps_product_projection` rows referencing it) and amazon (21% success rate — a real,
separate parsing/matching issue, not a cost-containment concern — but 10 measured campaign clicks
in 90 days, active enabled `affiliate_campaigns` rows, and the most comparable products of any of
the four browser-dependent stores). Founder's own instruction: don't reduce these two by default;
only extra/amazon showed real, current customer-facing value in this review.

## Browserless cost management (2026-09-19 incident)

**What happened.** A "100% of plan units consumed, further calls billed at overage rates" alert
arrived from Browserless with no way to attribute consumption by store/job/time from our side.
Root cause understood, not just patched: `base-scraper.ts`'s `launchBrowser()` fell back to an
UNCAPPED local Chromium launch on ANY Browserless failure, including quota exhaustion — so once
quota was hit, every subsequent page fetch kept re-attempting Browserless (adding to the very
overage the alert was about) and then silently launching local Chromium, the same unbounded-memory
pattern that caused the original SEV-1. Emergency containment (`BROWSERLESS_API_KEY` removed,
`price_update`/`discovery` paused) stopped the bleeding immediately; this section covers the
durable fix that replaced that emergency pause.

**The fix, four parts:**
1. **Quota/429 → defer, never fall back locally.** `BrowserlessQuotaError` (thrown by
   `launchBrowser()` when the failure text matches `429|quota|rate.?limit|too many|units exhausted`)
   propagates up through `scraping-orchestrator.ts`'s per-product loop, which stops attempting
   FURTHER products for that store this cycle (not N repeated failures) and records the store as
   `deferred_quota` — a distinct, honest status, not folded into ordinary scrape errors.
2. **Non-quota Browserless failures → bounded local fallback.** At most
   `WORKER_LOCAL_FALLBACK_MAX_SESSIONS` (default 2) local Chromium launches per store-run process
   (each store already runs as its own spawned process, so this naturally scopes per store-run).
   Exceeding the cap throws rather than launching again.
3. **Self-imposed daily budget, independent of Browserless's own account limit** (which this
   codebase has no API access to check — no usage endpoint found without dashboard login).
   `WORKER_BROWSERLESS_DAILY_MS_CAP` (default 4h of cumulative session time per rolling 24h window,
   deliberately conservative pending a real plan-tier number — see the cost forecast below) and
   `WORKER_BROWSERLESS_DAILY_MS_WARN` (default 60% of the cap) — crossing WARN logs a warning,
   crossing the cap defers (same as a real quota signal) before ever reaching the account's real
   limit.
4. **Durable, queryable usage tracking** — `worker_browser_sessions` (migration 034): every
   session, Browserless or local, with store/job/connected_via/duration/outcome. Query directly:
   ```sql
   select store_slug, connected_via, count(*) n, sum(duration_ms)/60000.0 total_min
   from worker_browser_sessions where started_at > now() - interval '7 days'
   group by store_slug, connected_via order by total_min desc;
   ```

**Redeploy-dedup guard** (`WORKER_STORE_REFRESH_GUARD_MS`, default 45min, `store-freshness.ts`):
a redeploy restarts the worker, and the boot-kick can re-enqueue a whole job whose last attempt
didn't cleanly succeed — which then re-attempts EVERY store from scratch, including ones that just
finished moments ago in the replaced container. Several redeploys in one troubleshooting session
compounded this into far more Browserless sessions than the job's own interval ever intended. The
guard skips a store/unit whose last successful completion is more recent than the window — logged
clearly (`skipped — completed ... within the redeploy-dedup guard window`), never silent.

**Known limitation, honestly stated:** the Free Browserless tier caps session time at 2 minutes
(Prototyping: 15min, Starter: 30min, Scale: 60min — see the cost forecast). Which tier this account
is on is not visible from here; if it's Free, sessions for slower stores may already be hitting
that platform ceiling regardless of any quota question, which would itself waste units on repeated
reconnects. Only the founder can confirm the current tier from Browserless's own dashboard.

## Operating

```bash
railway logs --service tawveeri-worker                 # tail live logs
railway logs --service tawveeri-worker --lines 200      # recent history
railway variables -s tawveeri-worker -k                 # current env (raw values)
railway variable set -s tawveeri-worker "KEY=VALUE"      # change one var (triggers a redeploy)
railway redeploy -s tawveeri-worker --from-source -y     # force a fresh deploy from the latest commit
```

Heartbeat log line every 60s: `[worker] heartbeat mem=<bytes>/<limit> pids=<n>/1000 queue=[...] running=<job|->`.
Resource limits: 2GB memory / 1 vCPU / single replica (`serviceInstanceLimitsUpdate`, verified via
`railway api search`). Baseline idle: ~60-175MB, ~33-37 pids. Observed peak under a real
discovery+refresh overlap: ~760MB, ~98 pids — comfortable headroom on both axes.

`tps_scheduler_heartbeat` / `tps_job_state` (same tables the old in-process scheduler used, no
schema change) — query directly for `last_success_at` per job if you don't have log access:
```sql
select job, last_success_at, last_note from tps_job_state order by job;
```
A job's `last_success_at` only advances on a clean `success` outcome (never on
timeout/failed/cancelled) — `jobDue()` deliberately keeps retrying a job that hasn't cleanly
succeeded rather than waiting a full interval. A stale `last_success_at` after several ticks means
the job is genuinely struggling, not that nothing has been tried.

## Gotcha: transient Turbopack build-cache corruption

Observed once (2026-09-17): a `railway variable set` (no code change) triggered a rebuild that
failed with `TurbopackInternalError: Failed to restore data for task TaskId 1 ... failed to open
file .../00000147.sst: No such file or directory` — a corrupted persistent Turbopack build cache
entry, unrelated to any code change. Railway kept the previous successful deployment's container
running throughout (no outage); a second, identical deploy attempt (another `railway variable set`
or `railway redeploy --from-source -y`) succeeded immediately. If a deploy fails with a
`TurbopackInternalError` referencing `.next/cache/turbopack/.../*.sst`, just retry — do not assume
it's your change.

## Rollback

Set `WORKER_JOBS_ENABLED=0` (master switch) to stop all worker execution without touching
`tawveeri-main`. To fully stand down a single job, set its `WORKER_JOB_<NAME>_ENABLED=0`. Neither
action reactivates the old in-process scheduler — `DISABLE_INPROCESS_SCHEDULER=1` on `tawveeri-main`
is a separate, independent kill switch and must be unset explicitly (not recommended; that's the
config that caused the original SEV-1).

## Resolved: refresh pipeline propagation (was "Known limitation," 2026-09-17 → 2026-09-18)

`refresh` (`scripts/tps-core/refresh-intelligence.ts`, a 10-step pipeline, pre-existing script not
part of this migration) timed out on its first two attempts (20min, then a raised 60min) without
its own step-1 (`normalize-incremental.ts`) summary line ever printing. `runScript()` wraps each
step in a synchronous `spawnSync` with no internal per-step timeout, so the outer proc-guard timeout
was the only bound and a still-working step looked identical to a stuck one from the outside.
Investigated live: step 1's advisory lock (`LANE_KEY=8148148`) was NOT contended — ruling out a
deadlock. Direct query evidence at the time showed real, DB-committed, resumable progress (cursor
advancing between attempts, `normalized_product_observations` gaining rows) — diagnosed as a
treadmill effect from `feed_ingest`/`discovery`/`price_update` all restoring on the same day, each
adding to the very backlog normalize was draining, not a stall.

**Resolved 2026-09-18, third attempt:** `refresh` completed a full clean pass — **10/10 steps
succeeded in 1500.1s** — once the one-time restoration-day backlog cleared. `search` step synced
8,978 products to the TPS index; `storefront-search` synced 15,183 products / 28,749 offers to the
LIVE customer-facing Algolia index. Traced a specific real product end-to-end with matching IDs and
timestamps to confirm this isn't just an aggregate count: `raw_observations` id 2742692 (almanea,
a Samsung AC) → `normalized_product_observations` (same timestamp) → `tps_product_projection`
(`lowest_price=2099, store_count=2`) → the exact same `offer_id` confirmed live in
`GET /api/v1/tps/search`'s real JSON response, showing a genuine 3-store comparison. Do not assume
every future cycle needs three attempts — this was specifically the first-day combined-restoration
backlog; a normal steady-state cycle (only the hourly increment, not a multi-job catch-up) should
complete well within the 60min budget. If a FUTURE run times out repeatedly again, re-measure the
backlog and rate first (see the query patterns above) before assuming this same explanation applies
— don't skip that measurement and just raise the timeout again.

**Do not** respond to a further timeout by blindly raising `WORKER_REFRESH_TIMEOUT_MS` again — the
one raise already made was evidence-informed (ruled out lock contention and an oversized one-time
backlog first). If it is still not completing after the backlog has had time to drain, the next
step is per-step timing instrumentation inside `refresh-intelligence.ts` itself (e.g. have
`runScript()` log a start line before each `spawnSync`, not just the result after), not another
timeout increase — this is pre-existing script behavior under first-day combined load, not a worker
isolation defect, and any deeper fix to `normalize-incremental.ts`'s own throughput is out of this
migration's scope.
