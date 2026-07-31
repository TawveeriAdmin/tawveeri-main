#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY BASELINE HARNESS — measures the SERVED RESPONSE, not the hydrated DOM.
//
// WHY THIS EXISTS ALONGSIDE ui-journey.js. That harness drives a real browser and asserts
// the rendered page; it is the right tool for "does the card agree with the compare page".
// But it is structurally blind to four things, and every one of them has produced a real
// defect in this project:
//
//   1. WHAT THE SERVER ACTUALLY SENDS. Puppeteer reports the DOM *after* hydration. A claim
//      can be absent from the served HTML and appear after JS, or — the case that matters —
//      be PRESENT in the served HTML and replaced after JS. Crawlers, link previews and
//      LLM fetchers only ever see the served bytes. The retired homepage figures were
//      audited on one surface and survived on another for exactly this reason.
//   2. THE HOMEPAGE LEG. ui-journey.js starts at /search?q=… and therefore never measured
//      whether a shopper can START. STANDING_DIRECTIVE §3.5 and REDESIGN_BRIEF §12 both ask
//      for homepage → product → retailer; it has been NOT REACHED for four sessions.
//   3. DEAD-END EXITS. An exit rendered as `/go/null` looks like a working button and is a
//      lost customer. Measured 2026-07-30 at 1 in 695 rendered exits.
//   4. LOCALE INDEPENDENCE. A single blended number hid that /en/about served Arabic.
//
// NON-ASCII SAFETY — learned the hard way, 2026-07-30. `curl -d '{"query":"مكيف"}'` is
// mangled by Windows argv conversion: the request arrives corrupted and the server returns
// a fallback result set. That nearly produced a false finding that Arabic search was broken.
// Every request here sends a UTF-8 **Buffer** built by Node, never a shell-interpolated
// string, so the bytes on the wire are the bytes we intended. `assertUtf8Safe()` proves it
// at startup and the run aborts if the guarantee does not hold.
//
// READ-ONLY BY CONSTRUCTION:
//   • NEVER issues GET /go/<id> — that route INSERTS into `outbound_clicks` and would
//     pollute the beta funnel. Exit destinations are resolved read-only from
//     `normalized_product_observations.normalized_payload._url`, which is exactly what the
//     /go route reads before building the affiliate link.
//   • Retailer reachability is a plain GET to the retailer, never through our exit layer.
//   • Writes nothing to any Tawveeri table.
//
// Usage:
//   node scripts/tps-analysis/journey-baseline.js
//   node scripts/tps-analysis/journey-baseline.js --locale ar
//   node scripts/tps-analysis/journey-baseline.js --json
//   node scripts/tps-analysis/journey-baseline.js --no-retailer   # skip outbound GETs
//   BASE_URL=http://localhost:3001 node scripts/tps-analysis/journey-baseline.js
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const BASE = (process.env.BASE_URL || 'https://tawveeri.com').replace(/\/$/, '');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const JSON_OUT = argv.includes('--json');
const SKIP_RETAILER = argv.includes('--no-retailer');
const ONLY_LOCALE = flag('locale', null);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Tawveeri-JourneyBaseline';
const CRAWLER_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// ── The journey set. Arabic and English are measured INDEPENDENTLY, never blended: they
// exercise different parsers, different catalogues and different rendering paths. ──
const JOURNEYS = {
  ar: ['مكيف سبليت', 'غسالة سامسونج', 'ايفون', 'لابتوب', 'تلفزيون 65 بوصة', 'ثلاجة', 'شاشة', 'سماعات', 'ايباد', 'مكنسة'],
  en: ['air conditioner', 'washing machine', 'iphone 15', 'laptop', 'lg tv', 'refrigerator', 'monitor', 'headphones', 'ipad', 'vacuum'],
};

// ─────────────────────────── utilities ───────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Visible, SERVER-RENDERED text: scripts and styles removed so a string inside an RSC
 *  payload can never be mistaken for published copy. This distinction is the whole point. */
function servedText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Arabic-Indic digits → ASCII, and drop thousands separators (Arabic ٬ and Latin ,).
 *  WITHOUT THIS the harness reports a false price mismatch on every Arabic page: the compare
 *  page renders «أرخص سعر ١٬٩٠٠» while the card's JSON says 1900. Caught 2026-07-30 — the
 *  first run flagged 18 "price absent from product page" failures that were all this.
 *  An English-only harness could never have found it. */
function normalizeDigits(s) {
  return String(s)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٬,٬  ]/g, '');
}

/** POST JSON as a real UTF-8 Buffer. Never a shell string — see the header note. */
async function postJson(path, obj, { ua = UA } = {}) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(body.length),
      'User-Agent': ua,
    },
    body,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* leave null */ }
  return { status: res.status, json };
}

async function getHtml(path, { ua = UA } = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': ua }, redirect: 'follow' });
  return { status: res.status, url: res.url, html: await res.text() };
}

/** Proves the UTF-8 round-trip before any measurement is taken. If the transport mangles
 *  non-ASCII, every Arabic result would be quietly wrong — abort instead. */
async function assertUtf8Safe() {
  const probe = 'مكيف';
  const { json } = await postJson('/api/search', { query: probe });
  if (!json) return { ok: false, reason: 'no JSON from /api/search' };
  if (typeof json.query === 'string' && json.query !== probe) {
    return { ok: false, reason: `server echoed "${json.query}" for "${probe}" — transport mangled non-ASCII` };
  }
  return { ok: true, echoed: json.query };
}

/** Read-only exit resolution — exactly the field /go reads. Never calls /go. */
async function resolveExitDestination(offerId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/normalized_product_observations?id=eq.${encodeURIComponent(offerId)}&select=normalized_payload`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.normalized_payload?._url ?? null;
}

// ─────────────────────────── legs ───────────────────────────

/** LEG A — can a shopper START, from the bytes the server sent? */
async function legHomepage(locale) {
  const out = { leg: 'A_homepage_served', locale, pass: false, deadEnd: null, detail: {} };
  const { status, html } = await getHtml(`/${locale}`);
  out.detail.status = status;
  if (status !== 200) { out.deadEnd = 'DE1_homepage_not_200'; return out; }

  // Search entry must exist in the SERVED markup, not only after hydration.
  const hasSearchInput = /<input[^>]*(placeholder|aria-label)=["'][^"']*["'][^>]*>/i.test(html);
  // A category route link, server-rendered.
  const catLinks = [...html.matchAll(/href=["']\/(?:ar|en)\/(?:search\?q=|categories)[^"']*["']/gi)].length;

  const text = servedText(html);
  out.detail.hasSearchInput = hasSearchInput;
  out.detail.categoryLinks = catLinks;
  out.detail.servedTextLength = text.length;

  // Crawler parity: the same journey-critical content must be present for a bot.
  const crawler = await getHtml(`/${locale}`, { ua: CRAWLER_UA });
  const crawlerText = servedText(crawler.html);
  out.detail.crawlerStatus = crawler.status;
  // Compare on length within tolerance — a large divergence means bots get a different page.
  const ratio = crawlerText.length / Math.max(text.length, 1);
  out.detail.crawlerParityRatio = Number(ratio.toFixed(3));
  const crawlerParity = crawler.status === 200 && ratio > 0.8 && ratio < 1.25;
  out.detail.crawlerParity = crawlerParity;

  if (!hasSearchInput) out.deadEnd = 'DE1_no_search_entry_in_served_html';
  else if (catLinks === 0) out.deadEnd = 'DE1_no_category_links_in_served_html';
  else if (!crawlerParity) out.deadEnd = 'DE6_crawler_sees_different_page';
  else out.pass = true;
  return out;
}

/** LEG B — does the query return anything, with bytes intact? */
async function legSearch(locale, query) {
  const out = { leg: 'B_search', locale, query, pass: false, deadEnd: null, detail: {} };
  const { status, json } = await postJson('/api/search', { query });
  out.detail.status = status;
  if (status !== 200 || !json) { out.deadEnd = 'DE2_search_error'; return out; }
  if (typeof json.query === 'string' && json.query !== query) {
    out.deadEnd = 'DE7_query_mangled_in_transit';
    out.detail.echoed = json.query;
    return out;
  }
  const products = json.products || [];
  out.detail.returned = products.length;
  out.detail.multiStore = products.filter((p) => (p.store_count || 0) > 1).length;
  out.detail.cardsFullDepth = products.length;
  if (products.length === 0) { out.deadEnd = 'DE2_zero_results'; return out; }
  out.pass = true;
  out.products = products;
  return out;
}

/** LEG C — every rendered exit must have a real destination. This is the leg that catches
 *  `/go/null`: a button that looks healthy and goes nowhere. */
async function legExits(locale, query, products) {
  const out = { leg: 'C_exits', locale, query, pass: false, deadEnd: null, detail: {} };
  const exits = [];
  for (const p of products) {
    for (const s of (p.stores && p.stores.length ? p.stores : [p])) {
      if (s.product_url) exits.push({ url: s.product_url, store: s.store_name || s.store || null });
    }
  }
  out.detail.rendered = exits.length;
  if (exits.length === 0) { out.deadEnd = 'DE4_no_exits_rendered'; return out; }

  const malformed = exits.filter((e) => e.url.startsWith('/go/') && !UUID_RE.test(e.url.slice(4)));
  out.detail.malformed = malformed.length;
  out.detail.malformedSamples = [...new Set(malformed.map((e) => e.url))].slice(0, 3);

  // Resolve a bounded sample read-only; never through /go.
  const goExits = exits.filter((e) => e.url.startsWith('/go/') && UUID_RE.test(e.url.slice(4)));
  const sample = goExits.slice(0, 3);
  let unresolvable = 0;
  const resolved = [];
  for (const e of sample) {
    const dest = await resolveExitDestination(e.url.slice(4));
    if (!dest || !/^https?:\/\//i.test(dest)) unresolvable++;
    else resolved.push({ ...e, dest });
  }
  out.detail.sampled = sample.length;
  out.detail.unresolvable = unresolvable;
  out.resolved = resolved;

  if (malformed.length > 0) out.deadEnd = 'DE4_exit_with_no_valid_destination';
  else if (unresolvable > 0) out.deadEnd = 'DE4_exit_destination_missing';
  else out.pass = true;
  return out;
}

/** LEG D — the product surface, measured from the SERVED response: does the page a shopper
 *  lands on actually name the product, and does its price agree with the card that sent
 *  them there? A disagreement here is the defect that started this harness's predecessor. */
async function legProduct(locale, query, products) {
  const out = { leg: 'D_product_served', locale, query, pass: false, deadEnd: null, detail: {} };
  // Measure the DISTRIBUTION across cards by ACTUALLY FETCHING them, not one lucky card and
  // not a proxy. Testing only the first card that happens to carry a compare URL reports the
  // Smart Pick's health and calls it the journey — which is how the previous gate read
  // 112/112 while most result cards led to a soft 404.
  //
  // Sampling is EVENLY SPACED across the whole result list, never the top slice: the top is
  // compare-rich by construction (relevance-scorer adds +15 for a TPS comparison), so a
  // top-N sample flatters the journey by roughly 2x.
  //
  // This replaced a `has tps_compare_url` proxy. That proxy was exactly right until the slug
  // fix landed, and instantly wrong afterwards — cards now also reach a real page via a
  // resolvable slug. A real storefront slug and a canonical identity-key slug are
  // indistinguishable by shape, so only a fetch can tell them apart.
  const SAMPLE_N = 8;
  const step = Math.max(1, Math.floor(products.length / SAMPLE_N));
  const sample = [];
  for (let i = 0; i < products.length && sample.length < SAMPLE_N; i += step) sample.push(products[i]);
  let reachable = 0;
  const perCard = [];
  for (const c of sample) {
    const dest = c.tps_compare_url || (c.product_slug ? `/${locale}/products/${c.product_slug}` : null);
    if (!dest) { perCard.push({ dest: null, verdict: 'no_link' }); continue; }
    const r = await getHtml(dest);
    const txt = servedText(r.html);
    const soft404 = /المنتج غير موجود|Product not found/i.test(txt);
    const verdict = r.status !== 200 ? 'not_200' : soft404 ? 'soft_404' : 'ok';
    if (verdict === 'ok') reachable++;
    perCard.push({ dest, status: r.status, verdict, viaCompare: Boolean(c.tps_compare_url) });
    await sleep(300);
  }
  out.detail.cardsSampled = sample.length;
  out.detail.cardsReachable = reachable;
  out.detail.cardsViaCompareUrl = perCard.filter((p) => p.viaCompare).length;
  out.detail.perCard = perCard;

  const card = products.find((p) => p.product_slug) || products[0];
  if (!card || !card.product_slug) { out.deadEnd = 'DE3_no_product_page_link'; return out; }

  // Mirror the CARD's own destination logic (components/products/product-card.tsx:113):
  //   tps_compare_url ?? externalProductUrl ?? /{locale}/products/{slug}
  // Testing a path the card does not use would measure a route, not a journey.
  const path = card.tps_compare_url || `/${locale}/products/${card.product_slug}`;
  out.detail.usedCompareUrl = Boolean(card.tps_compare_url);
  const { status, html } = await getHtml(path);
  out.detail.path = path;
  out.detail.status = status;
  if (status !== 200) { out.deadEnd = 'DE3_product_page_not_200'; return out; }

  const text = servedText(html);
  out.detail.servedTextLength = text.length;

  // SOFT 404 — the page answers 200 while telling the shopper the product does not exist.
  // Status alone cannot see this, and a crawler indexes it as a valid page. Measured
  // 2026-07-30: 20 of 20 slugs returned by /api/search resolved to this.
  if (/المنتج غير موجود|Product not found/i.test(text)) {
    out.deadEnd = 'DE3_soft_404_served_as_200';
    return out;
  }
  if (text.length < 200) { out.deadEnd = 'DE3_product_page_empty_served'; return out; }

  // Identity: a distinctive token from the card must appear in the SERVED text.
  const name = String(card.name_en || card.name_ar || '');
  const tokens = name.split(/\s+/).filter((t) => t.length >= 4).slice(0, 4);
  const lowerText = normalizeDigits(text).toLowerCase();
  const identityHits = tokens.filter((t) => lowerText.includes(normalizeDigits(t).toLowerCase())).length;
  out.detail.identityTokens = tokens.length;
  out.detail.identityHits = identityHits;

  // Price agreement: the card's price must be findable in the served page.
  // Compare on DIGIT-NORMALISED text so ١٬٩٠٠ and 1,900 and 1900 are the same number.
  //
  // ALSO accept the price from JSON-LD. The /products/<slug> body is CLIENT-rendered — its
  // visible served text is the shell only (~467 chars) — while its JSON-LD does carry real
  // offers. Checking visible text alone flagged every product-page journey as a price
  // disagreement, which it is not: measured 2026-07-31, all 8 EN passes went via the
  // server-rendered compare page and both "failures" went to a product page. A price
  // integrity claim must never rest on which renderer a route happens to use.
  const price = Number(card.best_price ?? card.current_price ?? 0);
  const normText = normalizeDigits(text);
  let priceShown = price ? normText.includes(String(Math.round(price))) : true;
  if (!priceShown && price) {
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    priceShown = ld.some((b) => normalizeDigits(b).includes(String(Math.round(price))));
    out.detail.priceFromJsonLd = priceShown;
  }
  // Recorded separately: a page whose body renders only after hydration is invisible to any
  // plain-text fetcher, JSON-LD or not.
  out.detail.bodyServerRendered = text.length > 600;
  out.detail.cardPrice = price || null;
  out.detail.priceShownOnServedPage = priceShown;

  if (tokens.length && identityHits === 0) out.deadEnd = 'DE3_product_identity_absent_from_served_html';
  else if (price && !priceShown) out.deadEnd = 'DE5_card_price_absent_from_product_page';
  else out.pass = true;
  return out;
}

/** LEG E — the retailer actually serves the destination. Plain GET to the retailer. */
async function legRetailer(resolved) {
  const out = { leg: 'E_retailer', pass: false, deadEnd: null, detail: {} };
  if (SKIP_RETAILER || !resolved || resolved.length === 0) {
    out.detail.skipped = true; out.pass = true; return out;
  }
  const target = resolved[0];
  try {
    const res = await fetch(target.dest, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    out.detail.dest = target.dest;
    out.detail.status = res.status;
    out.detail.claimedStore = target.store;
    if (res.status >= 400) { out.deadEnd = 'DE5_retailer_dead_link'; return out; }
    out.pass = true;
  } catch (e) {
    out.deadEnd = 'DE5_retailer_unreachable';
    out.detail.error = String(e.message || e).slice(0, 120);
  }
  return out;
}

// ─────────────────────────── runner ───────────────────────────
(async () => {
  const started = new Date().toISOString();
  const guard = await assertUtf8Safe();
  if (!guard.ok) {
    console.error(`ABORT — UTF-8 transport guarantee failed: ${guard.reason}`);
    console.error('Refusing to publish a number measured through a mangled transport.');
    process.exit(2);
  }

  const locales = ONLY_LOCALE ? [ONLY_LOCALE] : ['ar', 'en'];
  const results = [];

  for (const locale of locales) {
    const home = await legHomepage(locale);
    results.push(home);

    for (const query of JOURNEYS[locale] || []) {
      const b = await legSearch(locale, query);
      results.push(b);
      if (!b.pass) { await sleep(400); continue; }

      const c = await legExits(locale, query, b.products);
      results.push(c);

      const d = await legProduct(locale, query, b.products);
      results.push(d);

      const e = await legRetailer(c.resolved);
      results.push({ ...e, locale, query });

      await sleep(600); // stay under our own rate limiter — a 429 reads as a false failure
    }
  }

  // ── report, per locale, never blended ──
  const clean = results.map(({ products, resolved, ...r }) => r);
  if (JSON_OUT) {
    console.log(JSON.stringify({ base: BASE, started, utf8: guard, results: clean }, null, 2));
    return;
  }

  console.log(`\nJOURNEY BASELINE — ${BASE}`);
  console.log(`started ${started}`);
  console.log(`UTF-8 transport verified: server echoed "${guard.echoed}"\n`);

  for (const locale of locales) {
    const rows = clean.filter((r) => r.locale === locale);
    console.log(`═══ ${locale.toUpperCase()} ═══`);
    for (const leg of ['A_homepage_served', 'B_search', 'C_exits', 'D_product_served', 'E_retailer']) {
      const set = rows.filter((r) => r.leg === leg);
      if (!set.length) continue;
      const ok = set.filter((r) => r.pass).length;
      const pct = ((100 * ok) / set.length).toFixed(1);
      console.log(`  ${leg.padEnd(20)} ${String(ok).padStart(3)}/${String(set.length).padEnd(3)}  ${pct}%`);
    }
    // The measurement the previous gate could not make: of the cards a shopper sees, how many
    // lead to a page that exists? Fetched, evenly spaced across each result list.
    const dRows = rows.filter((r) => r.leg === 'D_product_served');
    const sampled = dRows.reduce((n, r) => n + (r.detail?.cardsSampled || 0), 0);
    const reachable = dRows.reduce((n, r) => n + (r.detail?.cardsReachable || 0), 0);
    const pool = rows.filter((r) => r.leg === 'B_search').reduce((n, r) => n + (r.detail?.cardsFullDepth || 0), 0);
    if (sampled) {
      console.log(`  ── CARDS→REAL PAGE   ${String(reachable).padStart(3)}/${String(sampled).padEnd(3)}  ${((100 * reachable) / sampled).toFixed(1)}%   (fetched, evenly spaced; ${pool} cards returned in total)`);
    }

    const full = rows.filter((r) => r.leg === 'B_search').map((r) => r.query)
      .filter((q) => ['B_search', 'C_exits', 'D_product_served', 'E_retailer']
        .every((leg) => rows.find((r) => r.leg === leg && r.query === q)?.pass));
    const totalQ = (JOURNEYS[locale] || []).length;
    console.log(`  ── END-TO-END        ${String(full.length).padStart(3)}/${String(totalQ).padEnd(3)}  ${((100 * full.length) / Math.max(totalQ, 1)).toFixed(1)}%`);

    const deads = rows.filter((r) => r.deadEnd);
    if (deads.length) {
      console.log('  dead ends:');
      const tally = {};
      for (const d of deads) tally[d.deadEnd] = (tally[d.deadEnd] || 0) + 1;
      for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(3)}× ${k}`);
    }
    console.log('');
  }

  // The headline the previous gate could not produce: of the cards a shopper actually sees,
  // how many lead to a page that exists?
  const dRows = clean.filter((r) => r.leg === 'D_product_served');
  const sampled = dRows.reduce((n, r) => n + (r.detail?.cardsSampled || 0), 0);
  const reachable = dRows.reduce((n, r) => n + (r.detail?.cardsReachable || 0), 0);
  const viaCompare = dRows.reduce((n, r) => n + (r.detail?.cardsViaCompareUrl || 0), 0);
  console.log(`RESULT CARDS REACHING A REAL PAGE: ${reachable} of ${sampled} fetched (${((100 * reachable) / Math.max(sampled, 1)).toFixed(1)}%)`);
  console.log(`  of which carried a compare URL:  ${viaCompare}`);

  const malformedTotal = clean.filter((r) => r.leg === 'C_exits').reduce((n, r) => n + (r.detail?.malformed || 0), 0);
  const renderedTotal = clean.filter((r) => r.leg === 'C_exits').reduce((n, r) => n + (r.detail?.rendered || 0), 0);
  console.log(`EXITS WITH NO VALID DESTINATION: ${malformedTotal} of ${renderedTotal} rendered`);
  console.log('(read-only: /go was never called — destinations resolved from the DB)\n');
})();
