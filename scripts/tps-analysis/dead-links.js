#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// DEAD OUTBOUND LINK CENSUS (read-only)
//
// The 20-query UI journey found 5 dead retailer links. That is a sample, not a count.
// A shopper who taps a price and lands on a 404 does not come back, and these URLs are
// live on every surface right now.
//
// For a random sample of served listings this resolves the outbound URL and buckets it:
//   OK      → a real product page
//   DEAD    → 404/410, or redirected to a homepage or search page
//   BLOCKED → bot wall (403/429/captcha) — truth unknown, EXCLUDED from the dead rate
// and reports by store, by category, and by how stale the listing is.
//
// Read-only: resolves URLs from `normalized_product_observations.normalized_payload._url`
// (never fires /go, which writes to outbound_clicks) and only GETs the retailer.
//
// Usage: node scripts/tps-analysis/dead-links.js [--sample 400] [--json]
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('./../tps-core/pooler-url.js');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const SAMPLE = Number(flag('sample', 400));
const CONCURRENCY = Number(flag('concurrency', 8));
const JSON_OUT = argv.includes('--json');

const REAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': REAL_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
  'Upgrade-Insecure-Requests': '1',
};
const BOTWALL = /robot check|are you a human|captcha|enter the characters you see|access denied|unusual traffic|request blocked|attention required/i;

function classify(finalUrl, status, body) {
  if (status === 403 || status === 429 || status === 503 || BOTWALL.test((body || '').slice(0, 4000))) {
    return { bucket: 'BLOCKED', note: `HTTP ${status}` };
  }
  if (status === 404 || status === 410) return { bucket: 'DEAD', note: `HTTP ${status}` };
  if (status >= 400) return { bucket: 'DEAD', note: `HTTP ${status}` };
  try {
    const u = new URL(finalUrl);
    const path = u.pathname.replace(/\/+$/, '');
    if (path === '' || /^\/(ar|en|en-sa|ar-sa|sa)$/i.test(path)) return { bucket: 'DEAD', note: 'redirected to homepage' };
    if (/\/(search|s)(\/|$)|[?&](q|k|keyword|search)=/i.test(finalUrl)) return { bucket: 'DEAD', note: 'redirected to search' };
  } catch { /* fall through */ }
  return { bucket: 'OK', note: '' };
}

async function check(url) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: HEADERS });
    clearTimeout(t);
    const body = await r.text().catch(() => '');
    return classify(r.url, r.status, body);
  } catch (e) {
    // A timeout is not evidence of a dead link — treat it as unknown, not as a failure.
    return { bucket: 'BLOCKED', note: e && e.name === 'AbortError' ? 'timeout' : `fetch failed: ${e && e.message}` };
  }
}

(async () => {
  const raw = process.env.SUPABASE_DB_URL || '';
  if (!/vyceqrzttspyycdpojtn/.test(raw)) { console.error('REFUSING: not the production project'); process.exit(2); }
  const pg = new Client({ connectionString: toPoolerDbUrl(raw), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query('SET default_transaction_read_only = on');

  const { rows: totals } = await pg.query(`
    select count(*)::int served_listings,
           count(*) filter (where o.normalized_payload->>'_url' is not null)::int with_url
    from normalized_product_observations o
    where o.canonical_product_id is not null`);

  const { rows } = await pg.query(`
    select o.store_id,
           coalesce(c.category, o.detected_category, 'unknown') category,
           o.normalized_payload->>'_url' url,
           o.observed_at::date last_observed,
           (current_date - o.observed_at::date) age_days
    from normalized_product_observations o
    left join canonical_products c on c.id = o.canonical_product_id
    where o.canonical_product_id is not null
      and o.normalized_payload->>'_url' is not null
    order by md5(o.id::text)
    limit $1`, [SAMPLE]);

  await pg.end();

  const results = [];
  let idx = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const i = idx++;
      if (i >= rows.length) return;
      const r = rows[i];
      const c = await check(r.url);
      results.push({ ...r, ...c });
      if (!JSON_OUT && results.length % 25 === 0) process.stderr.write(`  checked ${results.length}/${rows.length}\n`);
    }
  }));

  const tally = (key) => {
    const m = {};
    for (const r of results) {
      const k = String(r[key] ?? 'unknown');
      m[k] = m[k] || { OK: 0, DEAD: 0, BLOCKED: 0 };
      m[k][r.bucket]++;
    }
    for (const k of Object.keys(m)) {
      const known = m[k].OK + m[k].DEAD;
      m[k].dead_pct_of_known = known ? Math.round((m[k].DEAD / known) * 1000) / 10 : null;
    }
    return m;
  };

  const ok = results.filter((r) => r.bucket === 'OK').length;
  const dead = results.filter((r) => r.bucket === 'DEAD').length;
  const blocked = results.filter((r) => r.bucket === 'BLOCKED').length;
  const known = ok + dead;
  const deadPct = known ? Math.round((dead / known) * 1000) / 10 : null;

  const deadAges = results.filter((r) => r.bucket === 'DEAD').map((r) => Number(r.age_days)).sort((a, b) => a - b);
  const okAges = results.filter((r) => r.bucket === 'OK').map((r) => Number(r.age_days)).sort((a, b) => a - b);
  const median = (a) => (a.length ? a[Math.floor(a.length / 2)] : null);

  const summary = {
    served_listings: totals[0].served_listings,
    listings_with_url: totals[0].with_url,
    sampled: results.length,
    OK: ok, DEAD: dead, BLOCKED_excluded: blocked,
    dead_pct_of_known: deadPct,
    estimated_dead_listings: deadPct != null ? Math.round(totals[0].with_url * (deadPct / 100)) : null,
    median_age_days_dead: median(deadAges),
    median_age_days_ok: median(okAges),
    by_store: tally('store_id'),
    by_category: tally('category'),
  };

  if (JSON_OUT) { console.log(JSON.stringify({ summary, results }, null, 2)); return; }
  console.log('\n── DEAD OUTBOUND LINK CENSUS ──────────────');
  console.log(`served listings with a URL: ${summary.listings_with_url} of ${summary.served_listings}`);
  console.log(`sampled ${summary.sampled}  ->  OK ${ok} · DEAD ${dead} · BLOCKED(excluded) ${blocked}`);
  console.log(`DEAD RATE (of resolvable): ${deadPct}%  ->  est. ${summary.estimated_dead_listings} dead listings live`);
  console.log(`median age: dead ${summary.median_age_days_dead}d vs ok ${summary.median_age_days_ok}d`);
  console.log('\nBy store:'); console.table(summary.by_store);
  console.log('By category:'); console.table(summary.by_category);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
