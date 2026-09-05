/**
 * Tawveeri scheduler — runs as a PM2 app alongside the Next.js cluster.
 *
 * Two independent loops:
 *   1. SCRAPING   every minute, pokes /api/cron/dispatch (scraping_schedules).
 *   2. INTELLIGENCE REFRESH (ADR-065) every REFRESH_INTERVAL_MS, runs the
 *      derived-intelligence chain so improvements actually reach customers.
 *
 * Why the refresh runs as a CHILD PROCESS rather than an HTTP route: the chain
 * takes minutes (the listing-facts build alone is ~95s), which exceeds any sane
 * request timeout. Spawning it here keeps it under PM2 supervision, gives it the
 * scheduler's environment, and removes the HTTP timeout ceiling entirely.
 *
 * This loop exists because of a measured failure: the search index once held 394
 * of 1,215 products and had not been rebuilt in ~34 hours — 68% of the catalogue
 * was unsearchable, including a full day of identity work, because every link in
 * the chain was a script a human had to remember to run (ADR-062).
 *
 * Deployed via ecosystem.config.js as a single-instance (non-cluster) app.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// ADR-078: Supabase's direct connection is IPv6-only; Railway is IPv4-only, so
// direct pg connections fail with ENETUNREACH. Rewrite to the IPv4 pooler and put
// it back on process.env so every spawned chain script (which inherits this env)
// connects the same way. No-op if already a pooler URL or not a Supabase direct URL.
const { toPoolerDbUrl } = require('./tps-core/pooler-url');
if (process.env.SUPABASE_DB_URL) process.env.SUPABASE_DB_URL = toPoolerDbUrl(process.env.SUPABASE_DB_URL);

const { spawn } = require('child_process');

// ── Heartbeat (ADR-078) ──────────────────────────────────────────────────────
// The scheduler runs in production but leaves no DB trace until its first hourly
// refresh, so there is no way to confirm it actually STARTED (the cwd-path bug
// meant it silently never did). This writes a single-row heartbeat on boot and
// every tick, so `tps:health` / a query can confirm liveness within a minute —
// independent of Railway logs. Best-effort: any failure here never affects scheduling.
let hbClient = null;
async function heartbeat(field) {
  try {
    if (!process.env.SUPABASE_DB_URL) return;
    if (!hbClient) {
      const { Client } = require('pg');
      hbClient = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
      await hbClient.connect();
      await hbClient.query(`create table if not exists tps_scheduler_heartbeat (
        id int primary key default 1, pid int, booted_at timestamptz, last_tick timestamptz,
        last_refresh_at timestamptz, last_refresh_status text)`);
    }
    if (field === 'boot') {
      await hbClient.query(`insert into tps_scheduler_heartbeat (id,pid,booted_at,last_tick) values (1,$1,now(),now())
        on conflict (id) do update set pid=$1, booted_at=now(), last_tick=now()`, [process.pid]);
    } else if (field === 'tick') {
      await hbClient.query(`update tps_scheduler_heartbeat set last_tick=now() where id=1`);
    } else if (typeof field === 'object') {
      await hbClient.query(`update tps_scheduler_heartbeat set last_refresh_at=now(), last_refresh_status=$1 where id=1`, [field.status]);
    }
  } catch (e) { /* never let heartbeat failure affect the scheduler */ }
}

const INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10);
// ADR-067 changed what is affordable here. The projection rebuild went from
// ~21.6 MINUTES to ~12 SECONDS when it became set-based, taking the full chain
// from 25.4 min to 4.6 min. A 12-hourly full refresh was a workaround for a slow
// builder; now the FULL chain runs hourly and there is no separate fast tier —
// projection freshness improves from "up to 12h stale" to "within the hour".
const REFRESH_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL_MS || String(60 * 60 * 1000), 10);
// Retained for operators who want to throttle the chain on constrained hosts:
// set FULL_REFRESH_INTERVAL_MS to run the full chain less often than hourly.
const FULL_REFRESH_INTERVAL_MS = parseInt(process.env.FULL_REFRESH_INTERVAL_MS || "0", 10);
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
const CRON_SECRET = process.env.CRON_SECRET;

// CRON_SECRET gates only the DISPATCH loop (it authenticates the /api/cron/dispatch
// call). The INTELLIGENCE REFRESH runs a child script directly (no HTTP, no secret),
// so a missing CRON_SECRET must NOT kill the process — that would silently take down
// the very automation the founder asked to run ("make it fresh, automate the chain").
// Degrade instead: disable dispatch, keep refresh + heartbeat alive.
const DISPATCH_ENABLED = !!CRON_SECRET;
if (!DISPATCH_ENABLED) {
  console.error('[scheduler] CRON_SECRET missing — dispatch loop DISABLED; intelligence refresh + heartbeat still run');
}

// Crash breadcrumbs: if the scheduler dies unexpectedly, leave a trace in the
// heartbeat row (last_refresh_status) so it is diagnosable without Railway logs.
process.on('uncaughtException', (e) => {
  console.error('[scheduler] uncaughtException', e);
  try { heartbeat({ status: `crash:${(e && e.message) || e}` }); } catch (_) { /* ignore */ }
});
process.on('unhandledRejection', (e) => {
  console.error('[scheduler] unhandledRejection', e);
});

// Prove the child actually STARTED as early as possible (before any loop), so
// liveness is confirmable even if a later step fails.
heartbeat('boot');

// ── ADR-252 runtime guards (SEV-1 2026-08-15 remediation) ───────────────────
// 1. POST-BOOT COOLDOWN: no background work in the first minutes after boot — the DB is
//    serving cold caches and the deploy's own traffic; background has no claim on that
//    window, and it is exactly when restart-triggered bursts used to fire.
// 2. PRESSURE GATE: a cheap timed `SELECT 1` before every background run. Slow or failing
//    probe = the DB is under pressure (IO budget, connections, anything) → the run is
//    SKIPPED. Fail-CLOSED by design: if we cannot prove the DB is comfortable, background
//    work does not start. Consumer traffic never consults this gate.
// 3. PERSISTED JOB STATE (tps_job_state): boot kicks consult last_success_at and are
//    SKIPPED when the last success is fresher than the loop interval — a deploy/restart
//    can no longer create work (measured: deploy-kicked passes ran feed ingestion 9–12×/day
//    vs the designed 4×). Interval timers still run; fail-CLOSED on unknown state.
const BOOT_AT = Date.now();
const BOOT_COOLDOWN_MS = parseInt(process.env.BACKGROUND_BOOT_COOLDOWN_MS || String(10 * 60 * 1000), 10);
const PRESSURE_PROBE_MS = parseInt(process.env.PRESSURE_PROBE_SLOW_MS || '1500', 10);

async function pressureOk(kind) {
  if (Date.now() - BOOT_AT < BOOT_COOLDOWN_MS) {
    console.log(`[governor] ${kind} deferred — post-boot cooldown (${Math.round((BOOT_COOLDOWN_MS - (Date.now() - BOOT_AT)) / 60000)}m left)`);
    return false;
  }
  try {
    if (!process.env.SUPABASE_DB_URL) return true;
    const { Client } = require('pg');
    const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    const t0 = Date.now();
    await c.connect();
    await c.query('select 1');
    const ms = Date.now() - t0;
    try { await c.end(); } catch (_) { /* ignore */ }
    if (ms > PRESSURE_PROBE_MS) {
      console.log(`[governor] ${kind} deferred — DB probe ${ms}ms > ${PRESSURE_PROBE_MS}ms (pressure)`);
      return false;
    }
    return true;
  } catch (e) {
    console.log(`[governor] ${kind} deferred — DB probe failed (${(e && e.message) || e})`);
    return false; // fail CLOSED: unprovable comfort = no background work
  }
}

/** true if the job's last success is OLDER than intervalMs (i.e., a boot kick is justified).
 *  Unknown state (no row / DB unreachable) = NOT due — a restart must never create work. */
async function jobDue(job, intervalMs) {
  try {
    if (!process.env.SUPABASE_DB_URL) return false;
    const { Client } = require('pg');
    const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    await c.connect();
    await c.query(`create table if not exists tps_job_state (
      job text primary key, last_success_at timestamptz, last_note text, updated_at timestamptz not null default now())`);
    const { rows } = await c.query('select last_success_at from tps_job_state where job=$1', [job]);
    try { await c.end(); } catch (_) { /* ignore */ }
    const last = rows[0] && rows[0].last_success_at ? new Date(rows[0].last_success_at).getTime() : null;
    if (last == null) return true; // never succeeded → genuinely due
    return Date.now() - last >= intervalMs * 0.8;
  } catch (e) {
    console.log(`[governor] jobDue(${job}) unknown (${(e && e.message) || e}) — treating as NOT due`);
    return false;
  }
}

async function jobDone(job, note) {
  try {
    if (!process.env.SUPABASE_DB_URL) return;
    const { Client } = require('pg');
    const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    await c.connect();
    await c.query(`insert into tps_job_state (job, last_success_at, last_note, updated_at) values ($1, now(), $2, now())
                   on conflict (job) do update set last_success_at=now(), last_note=$2, updated_at=now()`, [job, (note || '').slice(0, 200)]);
    try { await c.end(); } catch (_) { /* ignore */ }
  } catch (_) { /* best-effort */ }
}

const jitterMs = (maxMin) => Math.floor(Math.random() * maxMin * 60 * 1000);

// ── Intelligence refresh loop ───────────────────────────────────────────────
let refreshRunning = false;

/**
 * Run the refresh chain. `full` also rebuilds the projection. Overlapping runs
 * are refused rather than queued: two concurrent rebuilds would fight over the
 * same derived tables, and skipping a tick is harmless because the next one
 * recomputes from the same evidence (every step is idempotent).
 */
async function runRefresh(full) {
  if (!(await pressureOk('refresh'))) return;
  if (refreshRunning) {
    console.log('[refresh] previous run still in progress — skipping this tick');
    return;
  }
  refreshRunning = true;
  const started = Date.now();
  const args = ['tsx', 'scripts/tps-core/refresh-intelligence.ts'];
  if (!full) args.push('--fast');
  // `presentation` (images + measured exit links) is part of the chain, so a
  // newly-projected product never reaches search without a picture or a way to buy.
  const child = spawn('npx', args, { cwd: process.cwd(), shell: true, env: process.env });

  let tail = '';
  const capture = (buf) => { tail = (tail + buf.toString()).slice(-1500); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);

  child.on('close', (code) => {
    refreshRunning = false;
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    heartbeat({ status: code === 0 ? 'ok' : `fail(${code})` });
    if (code === 0) {
      jobDone('refresh', `ok ${mins}m`);
      console.log(`[refresh] ${full ? 'full' : 'fast'} chain OK in ${mins}m`);
    } else {
      console.error(`[refresh] ${full ? 'full' : 'fast'} chain FAILED (exit ${code}) after ${mins}m`);
      console.error(tail.split('\n').filter((l) => l.includes('FAIL') || l.includes('SKIP')).join('\n'));
    }
  });
  child.on('error', (err) => {
    refreshRunning = false;
    console.error('[refresh] could not start:', err?.message || err);
  });
}

async function tick() {
  const started = Date.now();
  heartbeat('tick');
  if (!DISPATCH_ENABLED) return; // no secret → nothing to authenticate the dispatch call
  try {
    const res = await fetch(`${BASE_URL}/api/cron/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: '{}',
    });
    const elapsed = Date.now() - started;
    if (!res.ok) {
      console.error(`[scheduler] dispatch HTTP ${res.status} after ${elapsed}ms`);
      return;
    }
    const json = await res.json();
    if (json?.dispatched?.length) {
      console.log(
        `[scheduler] ${elapsed}ms — dispatched ${json.dispatched.length} schedule(s):`,
        json.dispatched.map((d) => `${d.store_slug}/${d.job_type}`).join(', ')
      );
    }
  } catch (err) {
    console.error('[scheduler] tick failed:', err?.message || err);
  }
}

// Signal PM2 that we're ready (matches wait_ready in ecosystem.config.js).
if (process.send) {
  process.send('ready');
}

console.log(`[scheduler] started — polling ${BASE_URL}/api/cron/dispatch every ${INTERVAL_MS}ms`);
console.log(`[refresh]   full intelligence chain every ${(REFRESH_INTERVAL_MS / 60000).toFixed(0)}m (~4.6 min per run since ADR-067)`);

// Write a boot heartbeat immediately so liveness is confirmable within a minute.
heartbeat('boot');
// Fire once immediately so PM2 restarts have an instant first tick, then every N ms.
tick();
setInterval(tick, INTERVAL_MS);

// Intelligence refresh. A FIRST run fires shortly after boot (not instantly — a
// short delay lets the server warm up and avoids a tight restart-loop storm),
// then hourly. Firing soon after boot means data is fresh within minutes of a
// deploy instead of up to an hour later, and lets the automation be verified
// end-to-end right after release. Idempotent + the refreshRunning guard means a
// restart can never stack overlapping rebuilds.
const FIRST_REFRESH_DELAY_MS = parseInt(process.env.FIRST_REFRESH_DELAY_MS || '120000', 10);
setTimeout(async () => { if (await jobDue('refresh', REFRESH_INTERVAL_MS)) runRefresh(true); else console.log('[governor] boot refresh kick skipped — last success is fresh'); }, FIRST_REFRESH_DELAY_MS + jitterMs(3));
setInterval(() => runRefresh(true), REFRESH_INTERVAL_MS);
if (FULL_REFRESH_INTERVAL_MS > 0) setInterval(() => runRefresh(true), FULL_REFRESH_INTERVAL_MS);

// ── Merchant ingestion loop (ADR-082) ────────────────────────────────────────
// The ADR-069 scraping_schedules dispatcher never ran in production: the knowledge
// DB's scraping_schedules is a minimal stub (integer store_id, is_active) while the
// dispatcher's fetchDueSchedules SELECTs legacy columns (cron_expression/is_enabled/
// max_pages…) that only ever existed on the legacy DB — a two-database convergence
// artifact. Rather than migrate a fragile mid-convergence schema for a never-run
// subsystem, this drives the PROVEN per-store cron routes directly (verified live:
// shaker discovery created 80 TVs + 96 appliances). It onboards merchants whose
// scrapers work but were never ingested (shaker, samsung_ksa) → merchant overlap →
// the only lever that grows realized comparisons (89.6% of products are single-store).
// Fully reversible: INGEST_STORES='' disables it. Gated on CRON_SECRET.
//
// ADR-089: stores sourced from a structured provider feed (INGEST_FEED_STORES, below)
// are ingested via the feed loop, not scraped here — so they are EXCLUDED from the
// scraper set even if still listed in INGEST_STORES. This guarantees no store is ever
// ingested by both paths (which would double-count observations), regardless of how the
// production env is configured. Setting INGEST_FEED_STORES='' returns shaker to scraping.
// shaker (WooCommerce), almanea (Algolia), najm (Salla) are sourced via credential-free
// structured adapters — cleaner + richer than scraping. They auto-refresh through the feed
// loop. Dedup is by listing identity (almanea keys on the `-p-<id>` productId regardless of
// host), so the feed never double-counts against any legacy scraper. ADR-089/094/095.
// SCOPE (Founder Directive 2026-07-27): ingest ONLY approved-27 retailers. shaker, najm and
// samsung_ksa are NOT in the approved portfolio → dropped from the ingestion defaults. almanea
// is the only approved credential-free feed-sourced store currently wired here.
// NOTE: production Railway env vars (INGEST_FEED_STORES / INGEST_STORES) OVERRIDE these defaults —
// they MUST be updated to drop shaker/najm/samsung_ksa for the scope reduction to fully take
// effect on the running scheduler (see docs/RETAILER-MATRIX.md → "Founder actions required").
// FOUNDER DECISION 2026-08-02 (closed): re-admit shaker, najm and alnakheelk to ingestion.
// All three are `sourcing: "api"` in the provider registry (WooCommerce / Salla structured
// feeds), so they belong in the FEED loop — putting them in the scraper set would ingest
// them by the wrong path, and the _feedSet exclusion below guarantees no store is ever
// ingested twice.
const INGEST_FEED_STORES = (process.env.INGEST_FEED_STORES ?? 'almanea,shaker,najm,alnakheelk,swsg').split(',').map((s) => s.trim()).filter(Boolean);
const _feedSet = new Set(INGEST_FEED_STORES);
// noon (Rakhys's #1, internal-catalog API) + lulu (Akinon/Cloudflare via Puppeteer) were recovered
// 2026-07-27 as the 5th & 6th active retailers. Kept here so the scheduler auto-refreshes + grows
// their catalogues. Both scrapers are concurrency-safe.
// extra added 2026-07-27: its own (broken) schedule only runs discovery and never refreshed prices,
// so Extra went stale. The INGEST loop's price-update path (now unblocked — see runPriceUpdateJob
// schema-drift fix) keeps Extra's 838 prices fresh via the repaired Puppeteer JSON-LD scraper.
// FOUNDER DECISION 2026-08-02 (closed):
//   ACTIVATE swsg · re-admit samsung_ksa · DROP noon, lulu, sharafdg.
// swsg was retired, then RECOVERED (ADR-179): its HTML storefront 403s our egress, but its
// Magento GraphQL endpoint is public and answers 4,274 products. It ingests through the FEED
// loop now, not the scraper loop — the sourcing mode was the difference, not the retailer.
// noon and sharafdg are refused at the retailer from our production egress (noon: request
// stalls ~229s; sharafdg: HTTP 403 on search AND product pages, verified in
// scraping_runs.error_summary). No proxy or paid egress is used to circumvent a deliberate
// block. lulu was ingesting fine and was dropped by decision, not by failure.
// All three are also removed from the DISPLAY gate — a retailer we cannot refresh must not
// be shown, only get older. See src/lib/retailers/approved-retailers.ts.
const INGEST_STORES = (process.env.INGEST_STORES ?? 'extra,samsung_ksa,noon').split(',').map((s) => s.trim()).filter(Boolean).filter((s) => !_feedSet.has(s));
const INGEST_DISCOVERY_MS = parseInt(process.env.INGEST_DISCOVERY_MS || String(12 * 60 * 60 * 1000), 10); // 12h
const INGEST_PRICE_MS = parseInt(process.env.INGEST_PRICE_MS || String(6 * 60 * 60 * 1000), 10);           // 6h
const INGEST_FIRST_DELAY_MS = parseInt(process.env.INGEST_FIRST_DELAY_MS || String(20 * 60 * 1000), 10);   // 20m after boot (let the app + PostgREST settle before adding scraper load — 2026-07-27 incident)
// Broad category buckets each store's cron scraper knows how to crawl.
const INGEST_CATEGORIES = {
  shaker: ['tv', 'appliance', 'kitchen'],
  samsung_ksa: ['tv', 'mobile'],
  // swsg (Sheta & Saif) activated 2026-08-02. Its catalogue is appliances/kitchen-led;
  // `tv` is included because that is where cross-retailer overlap actually exists.
  swsg: ['tv', 'appliance', 'kitchen', 'smartphone'],
  // valid ProductCategory enums only (NOT 'smartwatch'/'headphones' — use 'wearable'/'audio').
  noon: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'monitor', 'gaming', 'appliance', 'camera'],
  lulu: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'kitchen', 'appliance', 'monitor'],
  sharafdg: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'appliance', 'monitor', 'camera'],
};

// ── QUEUE-AWARE ADMISSION / BACKPRESSURE (ADR-148) ───────────────────────────
// Ingestion used to be purely time-driven: fetch every 6h/12h regardless of whether
// anything downstream could keep up. Normalization is the slower stage, so a fetch
// schedule that ignores queue depth lets the queue grow without bound — measured
// 2026-07-30: almanea 320,386 and jarir 49,338 observations fetched, paid for, and
// invisible to customers, while every hourly run still reported success.
//
// This is the standard fetch-vs-process backpressure control: the producer asks the
// queue how deep it is and yields when the consumer is behind. Hysteresis (HIGH to
// stop, LOW to resume) prevents flapping at the threshold.
//
// FRESHNESS IS PROTECTED, deliberately. Only DISCOVERY and the almanea FEED are gated —
// they are what creates backlog. Two things are NEVER gated:
//   • the intelligence refresh chain — it is the consumer, gating it would be suicide;
//   • PRICE UPDATES — a stale price is the customer-visible harm this platform exists to
//     prevent, while a marginally smaller catalogue is not.
// Price updates were briefly given a high ceiling (250,000) instead of an exemption. That
// was wrong and was caught before it ran: measured backlog at the time was 271,845, i.e.
// ALREADY above the ceiling, so the "safety valve" would have silently stopped price
// refresh on launch eve — the exact harm the gate exists to avoid. A threshold that trips
// in the state you are actually in is not a safety valve. Price updates are also bounded
// by construction (max_products per store per 6h), so they cannot outrun normalization.
// Skipping is safe because every loop is idempotent and the next tick re-evaluates.
//
// REVERSIBLE: INGEST_BACKPRESSURE_HIGH=0 disables the gate entirely.
// THRESHOLDS CORRECTED 2026-07-30, hours after they were set, because the first values
// optimised the wrong thing. 50,000/20,000 was chosen to keep the QUEUE tidy. Two
// measurements then landed:
//   1. draining 142,282 observations produced ZERO new customer-visible comparisons, so
//      backlog size has ~no customer value;
//   2. DISCOVERY is the de-facto price-observation source — today it wrote almanea 14,057,
//      noon 737, jarir 588, lulu 534 rows, each carrying a price, while the price_update
//      loop managed ONE successful product across four stores.
// So a 50,000 gate traded HIGH customer value (price freshness) for ~NO customer value
// (a shorter queue), and would have blocked discovery for ~16 hours across launch.
// No degradation was ever observed at 370,000 rows behind, so that is not the danger line.
// These values keep a genuine runaway guard while never blocking normal operation.
const BP_HIGH = parseInt(process.env.INGEST_BACKPRESSURE_HIGH || '500000', 10);
const BP_LOW = parseInt(process.env.INGEST_BACKPRESSURE_LOW || '400000', 10);
let bpTripped = false; // hysteresis latch

/** Total rows behind = sum of every store's own cursor lag (the ADR-147 definition). */
async function rowsBehind() {
  if (!process.env.SUPABASE_DB_URL) return null;
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    const { rows } = await c.query(`select coalesce(sum((select count(*) from raw_observations o
                                     where o.store_id = k.store_id and o.id > k.last_raw_id)), 0)::text n
                                    from tps_progress_cursors k where k.category = '_all_'`);
    return Number(rows[0].n);
  } catch (e) {
    console.error('[backpressure] probe failed:', e?.message || e);
    return null;          // fail OPEN — a probe failure must never stop ingestion
  } finally { try { await c.end(); } catch (_) { /* ignore */ } }
}

/**
 * Admission control for BACKLOG-CREATING ingestion only (discovery + feed).
 * Price updates never call this — see the freshness note above.
 * @returns {Promise<boolean>} true if this ingestion may proceed
 */
async function admit(kind) {
  if (BP_HIGH <= 0) return true;                       // gate disabled
  const n = await rowsBehind();
  if (n === null) return true;                         // unknown → fail open
  if (bpTripped && n <= BP_LOW) {
    bpTripped = false;
    console.log(`[backpressure] rows-behind ${n} <= low-water ${BP_LOW} — resuming ingestion`);
  } else if (!bpTripped && n > BP_HIGH) {
    bpTripped = true;
    console.log(`[backpressure] rows-behind ${n} > high-water ${BP_HIGH} — deferring ${kind}`);
  }
  if (bpTripped) {
    console.log(`[backpressure] ${kind} deferred — rows-behind ${n}, resumes at <= ${BP_LOW}`);
    return false;
  }
  return true;
}

async function cronPost(path, body) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CRON_SECRET}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) { console.error(`[ingest] ${path} HTTP ${res.status}`); return null; }
    return await res.json().catch(() => ({}));
  } catch (e) { console.error(`[ingest] ${path} failed:`, e?.message || e); return null; }
}

// THROTTLE (2026-07-27 incident): running discovery for all INGEST_STORES back-to-back, on top of
// the intelligence-refresh chain, overloaded the DB and wedged PostgREST (ADR-099). Space every
// scraper call out (staggerMs) and keep batches small so sustained write pressure stays low.
const STAGGER_MS = parseInt(process.env.INGEST_STAGGER_MS || '20000', 10); // 20s between scraper calls
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ingestRunning = false;
async function runDiscovery() {
  if (!(await pressureOk('discovery'))) return;
  if (ingestRunning) { console.log('[ingest] discovery still running — skipping'); return; }
  if (feedIngestRunning || refreshRunning) { console.log('[ingest] refresh/feed active — deferring discovery'); return; }
  if (!(await admit('discovery'))) return;   // ADR-148 backpressure
  ingestRunning = true;
  try {
    for (const slug of INGEST_STORES) {
      for (const cat of (INGEST_CATEGORIES[slug] || ['tv'])) {
        const r = await cronPost('/api/cron/discover-products', { store_slug: slug, category: cat, max_pages: 2 });
        if (r) console.log(`[ingest] discovery ${slug}/${cat}: discovered=${r.products_discovered} created=${r.products_created} linked=${r.products_linked}`);
        await sleep(STAGGER_MS);
      }
    }
    jobDone('discovery', 'ok');
  } finally { ingestRunning = false; }
}
async function runPriceUpdate() {
  if (!(await pressureOk('price_update'))) return;
  if (ingestRunning || feedIngestRunning || refreshRunning) { console.log('[ingest] busy — deferring price-update'); return; }
  // NOT gated by backpressure — price freshness is the customer-visible promise, and this
  // loop is bounded by max_products per store per cycle, so it cannot outrun normalization.
  for (const slug of INGEST_STORES) {
    // 120 was sized when the queue never advanced, so the number did not matter — the same
    // 120 rows were re-attempted every cycle forever. Now that `last_checked_at` is stamped
    // the cap sets the CYCLE TIME: healthy retailers hold ~9,000 offers, so 120/store/6h is a
    // ~3.8-day lap and a price a customer sees could be that old. 300 makes it ~1.5 days.
    // Bounded and reversible: INGEST_PRICE_MAX_PRODUCTS=120 restores the old behaviour.
    const maxProducts = parseInt(process.env.INGEST_PRICE_MAX_PRODUCTS || '300', 10);
    const r = await cronPost('/api/cron/update-prices', { store_slug: slug, max_products: maxProducts, older_than_hours: 12 });
    if (r) console.log(`[ingest] price-update ${slug}: ${JSON.stringify(r).slice(0, 120)}`);
    await sleep(STAGGER_MS);
  }
  jobDone('price_update', 'ok');
}

if (DISPATCH_ENABLED && INGEST_STORES.length) {
  console.log(`[ingest] merchant ingestion enabled for [${INGEST_STORES.join(', ')}] — discovery every ${(INGEST_DISCOVERY_MS / 3600000).toFixed(0)}h, prices every ${(INGEST_PRICE_MS / 3600000).toFixed(0)}h`);
  setTimeout(async () => { if (await jobDue('discovery', INGEST_DISCOVERY_MS)) runDiscovery(); else console.log('[governor] boot discovery kick skipped'); }, INGEST_FIRST_DELAY_MS + jitterMs(5));
  setInterval(runDiscovery, INGEST_DISCOVERY_MS);
  // ADR-148 — PRICE REFRESH HAD NEVER RUN ON THE SCHEDULED PATH.
  // This line used to be `setInterval` ONLY, with no initial timer, while discovery and
  // the feed loop both got a `setTimeout` kick. So the 6-hour price clock restarted from
  // zero on every process start, and any restart cadence faster than 6h meant scheduled
  // price updates fired NEVER. Measured 2026-07-30: of 44 `price_update` runs in the
  // preceding 7 days, **every single one was `triggered_by='manual'` and not one was
  // `'schedule'`**, while scheduler-triggered DISCOVERY runs were recorded normally in the
  // same table — so this was not an attribution artifact. Railway restarted 4+ times that
  // day alone. Price freshness is the customer-visible promise of this platform, and the
  // loop meant to deliver it was dead on arrival after every deploy.
  setTimeout(async () => { if (await jobDue('price_update', INGEST_PRICE_MS)) runPriceUpdate(); else console.log('[governor] boot price-update kick skipped'); }, INGEST_FIRST_DELAY_MS + 2 * 60 * 1000 + jitterMs(5));
  setInterval(runPriceUpdate, INGEST_PRICE_MS);
}

// ── Demand-driven catalog recovery loop (Truth Hardening Final Closure mission, 2026-09-05,
//    ADR-292) ─────────────────────────────────────────────────────────────────────────────
// Async worker half of query-triggered recovery: POST /api/search/route.ts queues a durable
// product_recovery_requests row on a real, exact-model CATALOG_MISSING zero-result; THIS loop
// drains it, exactly like every other background job here — pressure-gated, mutually exclusive
// with the other heavy loops, small bounded batch (5, enforced server-side in the route
// itself). Reversible: PRODUCT_RECOVERY_MS=0 disables it.
const PRODUCT_RECOVERY_MS = parseInt(process.env.PRODUCT_RECOVERY_MS || String(10 * 60 * 1000), 10); // 10m
let productRecoveryRunning = false;
async function runProductRecovery() {
  if (PRODUCT_RECOVERY_MS <= 0) return;
  if (!(await pressureOk('product_recovery'))) return;
  if (productRecoveryRunning) { console.log('[recovery] previous run still in progress — skipping'); return; }
  if (ingestRunning || feedIngestRunning || refreshRunning) { console.log('[recovery] busy — deferring product-recovery'); return; }
  productRecoveryRunning = true;
  try {
    const r = await cronPost('/api/cron/product-recovery', {});
    if (r) console.log(`[recovery] processed ${r.processed ?? 0} recovery request(s)`);
    jobDone('product_recovery', 'ok');
  } finally { productRecoveryRunning = false; }
}
if (DISPATCH_ENABLED && PRODUCT_RECOVERY_MS > 0) {
  console.log(`[recovery] product recovery enabled — every ${(PRODUCT_RECOVERY_MS / 60000).toFixed(0)}m`);
  setTimeout(async () => { if (await jobDue('product_recovery', PRODUCT_RECOVERY_MS)) runProductRecovery(); else console.log('[governor] boot product-recovery kick skipped'); }, INGEST_FIRST_DELAY_MS + 4 * 60 * 1000 + jitterMs(5));
  setInterval(runProductRecovery, PRODUCT_RECOVERY_MS);
}

// ── Feed ingestion loop (ADR-089) ─────────────────────────────────────────────
// Providers whose sourcing is a structured feed (WooCommerce Store API) ingest
// through the provider framework instead of the HTML-scraper cron routes — cleaner,
// more complete, no anti-bot. This spawns the SAME ingest-via-provider script the
// manual path uses (which writes to raw_observations via the unified IngestionService,
// so the hourly refresh normalizes it like any other observation). No CRON_SECRET
// needed (it writes the DB directly, no HTTP hop) — it runs like the refresh child.
// Reversible: INGEST_FEED_STORES='' disables it (and returns those stores to scraping).
const INGEST_FEED_MS = parseInt(process.env.INGEST_FEED_MS || String(6 * 60 * 60 * 1000), 10); // 6h
let feedIngestRunning = false;
async function runFeedIngest() {
  if (!(await pressureOk('feed_ingest'))) return;
  if (feedIngestRunning) { console.log('[feed-ingest] previous run still in progress — skipping'); return; }
  if (!INGEST_FEED_STORES.length) return;
  // The feed loop is almanea's ingestion path and the single largest backlog producer
  // measured (320,386 rows behind). It is gated as discovery, not as price.
  if (!(await admit('discovery'))) return;
  feedIngestRunning = true;
  const slugs = [...INGEST_FEED_STORES];
  // One store at a time in a single child chain — bounds resource use on the host.
  const runOne = (i) => {
    if (i >= slugs.length) { feedIngestRunning = false; jobDone('feed_ingest', 'ok'); return; }
    const slug = slugs[i];
    const child = spawn('npx', ['tsx', 'scripts/tps-core/ingest-via-provider.ts', slug], { cwd: process.cwd(), shell: true, env: process.env });
    let tail = '';
    const cap = (b) => { tail = (tail + b.toString()).slice(-800); };
    child.stdout.on('data', cap);
    child.stderr.on('data', cap);
    child.on('close', (code) => {
      const last = tail.split('\n').map((l) => l.trim()).filter((l) => l && !l.includes('injected env')).slice(-1)[0] || '';
      console.log(`[feed-ingest] ${slug} exit ${code}: ${last}`);
      runOne(i + 1);
    });
    child.on('error', (err) => { console.error(`[feed-ingest] ${slug} could not start:`, err?.message || err); runOne(i + 1); });
  };
  runOne(0);
}
if (INGEST_FEED_STORES.length) {
  console.log(`[feed-ingest] feed ingestion enabled for [${INGEST_FEED_STORES.join(', ')}] — every ${(INGEST_FEED_MS / 3600000).toFixed(0)}h`);
  // Stagger after the scraper discovery kick so the two ingestion paths don't spike together.
  setTimeout(async () => { if (await jobDue('feed_ingest', INGEST_FEED_MS)) runFeedIngest(); else console.log('[governor] boot feed kick skipped'); }, INGEST_FIRST_DELAY_MS + 90 * 1000 + jitterMs(5));
  setInterval(runFeedIngest, INGEST_FEED_MS);
}

// ── Comparable re-observation loop (ADR-195 · U2b) ───────────────────────────
// The price loop covers INGEST_STORES and selects by storefront staleness, so a
// comparable's CHEAPEST offer — the claim surface of the product this platform sells —
// can go unobserved for weeks (measured 2026-08-03: 162 cheapest-offer pairs >168h
// unobserved; extra 79 · amazon 59 · jarir 9). This loop re-observes exactly those
// pairs through the same write path (updateProductPrice → IngestionService →
// raw_observations); the hourly refresh normalizes them like any observation.
// Bounded (REOBSERVE_LIMIT per run, per-store cap inside the script), additive-only,
// and reversible: REOBSERVE_LIMIT=0 disables it.
const REOBSERVE_MS = parseInt(process.env.REOBSERVE_MS || String(6 * 60 * 60 * 1000), 10); // 6h
const REOBSERVE_LIMIT = parseInt(process.env.REOBSERVE_LIMIT || '60', 10);
let reobserveRunning = false;
async function runReobserve() {
  if (REOBSERVE_LIMIT <= 0) return;
  if (!(await pressureOk('reobserve'))) return;
  if (reobserveRunning) { console.log('[reobserve] previous run still in progress — skipping'); return; }
  if (refreshRunning || feedIngestRunning || ingestRunning) { console.log('[reobserve] busy — deferring'); return; }
  reobserveRunning = true;
  const child = spawn('npx', ['tsx', 'scripts/tps-core/reobserve-comparables.ts', '--go', `--limit=${REOBSERVE_LIMIT}`], { cwd: process.cwd(), shell: true, env: process.env });
  let tail = '';
  const cap = (b) => { tail = (tail + b.toString()).slice(-800); };
  child.stdout.on('data', cap);
  child.stderr.on('data', cap);
  child.on('close', (code) => {
    reobserveRunning = false;
    if (code === 0) jobDone('reobserve', 'ok');
    const last = tail.split('\n').map((l) => l.trim()).filter((l) => l && !l.includes('injected env')).slice(-1)[0] || '';
    console.log(`[reobserve] exit ${code}: ${last}`);
  });
  child.on('error', (err) => { reobserveRunning = false; console.error('[reobserve] could not start:', err?.message || err); });
}
if (REOBSERVE_LIMIT > 0) {
  console.log(`[reobserve] comparable re-observation enabled — every ${(REOBSERVE_MS / 3600000).toFixed(0)}h, limit ${REOBSERVE_LIMIT}/run`);
  // After the ingest kicks, offset from the feed loop's start so the paths don't spike together.
  setTimeout(async () => { if (await jobDue('reobserve', REOBSERVE_MS)) runReobserve(); else console.log('[governor] boot reobserve kick skipped'); }, INGEST_FIRST_DELAY_MS + 5 * 60 * 1000 + jitterMs(5));
  setInterval(runReobserve, REOBSERVE_MS);
}

process.on('SIGTERM', () => {
  console.log('[scheduler] SIGTERM received — exiting');
  process.exit(0);
});
