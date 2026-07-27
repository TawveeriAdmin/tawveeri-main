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

// ── Intelligence refresh loop ───────────────────────────────────────────────
let refreshRunning = false;

/**
 * Run the refresh chain. `full` also rebuilds the projection. Overlapping runs
 * are refused rather than queued: two concurrent rebuilds would fight over the
 * same derived tables, and skipping a tick is harmless because the next one
 * recomputes from the same evidence (every step is idempotent).
 */
function runRefresh(full) {
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
setTimeout(() => runRefresh(true), FIRST_REFRESH_DELAY_MS);
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
const INGEST_FEED_STORES = (process.env.INGEST_FEED_STORES ?? 'almanea').split(',').map((s) => s.trim()).filter(Boolean);
const _feedSet = new Set(INGEST_FEED_STORES);
// noon (approved) is now ingested via its internal-catalog-API scraper — recovered 2026-07-27 as the
// 5th active retailer (Rakhys's #1). Kept here so the scheduler auto-refreshes + grows its catalogue.
const INGEST_STORES = (process.env.INGEST_STORES ?? 'noon').split(',').map((s) => s.trim()).filter(Boolean).filter((s) => !_feedSet.has(s));
const INGEST_DISCOVERY_MS = parseInt(process.env.INGEST_DISCOVERY_MS || String(12 * 60 * 60 * 1000), 10); // 12h
const INGEST_PRICE_MS = parseInt(process.env.INGEST_PRICE_MS || String(6 * 60 * 60 * 1000), 10);           // 6h
const INGEST_FIRST_DELAY_MS = parseInt(process.env.INGEST_FIRST_DELAY_MS || String(5 * 60 * 1000), 10);    // 5m after boot
// Broad category buckets each store's cron scraper knows how to crawl.
const INGEST_CATEGORIES = {
  shaker: ['tv', 'appliance', 'kitchen'],
  samsung_ksa: ['tv', 'mobile'],
  // valid ProductCategory enums only (NOT 'smartwatch'/'headphones' — use 'wearable'/'audio').
  noon: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'monitor', 'gaming', 'appliance', 'camera'],
};

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

let ingestRunning = false;
async function runDiscovery() {
  if (ingestRunning) { console.log('[ingest] discovery still running — skipping'); return; }
  ingestRunning = true;
  try {
    for (const slug of INGEST_STORES) {
      for (const cat of (INGEST_CATEGORIES[slug] || ['tv'])) {
        const r = await cronPost('/api/cron/discover-products', { store_slug: slug, category: cat, max_pages: 3 });
        if (r) console.log(`[ingest] discovery ${slug}/${cat}: discovered=${r.products_discovered} created=${r.products_created} linked=${r.products_linked}`);
      }
    }
  } finally { ingestRunning = false; }
}
async function runPriceUpdate() {
  for (const slug of INGEST_STORES) {
    const r = await cronPost('/api/cron/update-prices', { store_slug: slug, max_products: 400, older_than_hours: 12 });
    if (r) console.log(`[ingest] price-update ${slug}: ${JSON.stringify(r).slice(0, 120)}`);
  }
}

if (DISPATCH_ENABLED && INGEST_STORES.length) {
  console.log(`[ingest] merchant ingestion enabled for [${INGEST_STORES.join(', ')}] — discovery every ${(INGEST_DISCOVERY_MS / 3600000).toFixed(0)}h, prices every ${(INGEST_PRICE_MS / 3600000).toFixed(0)}h`);
  setTimeout(runDiscovery, INGEST_FIRST_DELAY_MS);
  setInterval(runDiscovery, INGEST_DISCOVERY_MS);
  setInterval(runPriceUpdate, INGEST_PRICE_MS);
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
function runFeedIngest() {
  if (feedIngestRunning) { console.log('[feed-ingest] previous run still in progress — skipping'); return; }
  if (!INGEST_FEED_STORES.length) return;
  feedIngestRunning = true;
  const slugs = [...INGEST_FEED_STORES];
  // One store at a time in a single child chain — bounds resource use on the host.
  const runOne = (i) => {
    if (i >= slugs.length) { feedIngestRunning = false; return; }
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
  setTimeout(runFeedIngest, INGEST_FIRST_DELAY_MS + 90 * 1000);
  setInterval(runFeedIngest, INGEST_FEED_MS);
}

process.on('SIGTERM', () => {
  console.log('[scheduler] SIGTERM received — exiting');
  process.exit(0);
});
