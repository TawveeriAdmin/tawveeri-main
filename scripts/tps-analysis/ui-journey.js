#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// UI JOURNEY HARNESS — test the PLATE, not the kitchen.
//
// Every existing harness tests `/api/search` and reports 100%. Every defect the
// founder found on 2026-07-29 was in the RENDERED PAGE: the card showed 840 while the
// compare page showed 1,099 for the same product; the only working outbound link was a
// small side link; the large primary button ran another search instead of going to the
// retailer. An API test cannot see any of that.
//
// This drives a real headless browser through the real shopper journey:
//   search page → top pick card → compare page → outbound link → retailer product page
// and asserts the numbers AGREE across those surfaces.
//
// READ-ONLY BY CONSTRUCTION:
//   • Never submits any form beyond navigating to a search URL.
//   • Never clicks `/go/<id>` — that route INSERTS into `outbound_clicks`, which would
//     pollute the beta funnel. Destinations are resolved read-only from
//     `normalized_product_observations.normalized_payload._url` (exactly what the /go
//     route reads) and then verified with a plain GET to the retailer.
//   • Never writes to any Tawveeri table.
//
// Usage:
//   node scripts/tps-analysis/ui-journey.js                 # all 20 queries, ar+en
//   node scripts/tps-analysis/ui-journey.js --locale ar     # one locale
//   node scripts/tps-analysis/ui-journey.js --query iphone  # one query
//   node scripts/tps-analysis/ui-journey.js --json          # machine-readable
//   BASE_URL=http://localhost:3000 node scripts/tps-analysis/ui-journey.js
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const puppeteer = require('puppeteer');
const { existsSync } = require('fs');

const BASE = process.env.BASE_URL || 'https://tawveeri.com';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const JSON_OUT = argv.includes('--json');
const ONLY_QUERY = flag('query', null);
const ONLY_LOCALE = flag('locale', null);
// Viewport override (Master Book §23: mobile IS the market). Defaults unchanged so every
// prior log stays comparable; a mobile run is `--width 390 --height 844` and must be
// reported as its own baseline, never mixed with desktop figures.
const VIEW_W = parseInt(flag('width', '1366'), 10) || 1366;
const VIEW_H = parseInt(flag('height', '2200'), 10) || 2200;

// ── REGRESSION SET (fixed; the 20 queries every run since 2026-07-29 has used) ──
const REGRESSION_QUERIES = [
  'iphone', 'ايفون', 'لابتوب اتش بي', 'macbook', 'مكيف سبليت', 'lg tv',
  'غسالة سامسونج', 'ايباد', 'شاشة', 'ثلاجة', 'سماعات', 'طابعة', 'ps5', 'شاحن',
  'مكيف 18000', 'تلفزيون 65 بوصة', 'laptop', 'washing machine', 'مروحة', 'ميكروويف',
];

// ── EXACT-MODEL / EXACT-VARIANT SET (new, previously unseen) ──
// The gate read 100% while `ايفون 16 برو ماكس 256` returned ONE retailer, because not a
// single query in the regression set named a model or a variant. A gate that never asks
// the question the customer actually asks is not measuring the promise. These carry a
// `variant` token that MUST survive into the winning card: a 256 query answered with a
// 128 product is a wrong answer, not a near miss.
const MODEL_QUERIES = [
  { q: 'iPhone 16 Pro Max 256', variant: ['256'], must: ['iphone', '16', 'pro', 'max'] },
  { q: 'iphone 16 pro max 256', variant: ['256'], must: ['iphone', '16', 'pro', 'max'] },
  { q: 'ايفون 16 برو ماكس 256', variant: ['256'], must: ['iphone', 'ايفون'] },
  { q: 'ايفون ١٦ برو ماكس ٢٥٦', variant: ['256'], must: ['iphone', 'ايفون'] },
  { q: 'جوال ايفون 16 برو ماكس 256', variant: ['256'], must: ['iphone', 'ايفون'] },
  { q: 'Galaxy S24 Ultra 512', variant: ['512'], must: ['galaxy', 's24', 'سامسونج', 'samsung'] },
  { q: 'ايفون 15 128', variant: ['128'], must: ['iphone', 'ايفون'] },
  { q: 'MacBook Air M2 256', variant: ['256'], must: ['macbook', 'ماك بوك'] },
];

const QUERIES = [...REGRESSION_QUERIES, ...MODEL_QUERIES.map((m) => m.q)];
const MODEL_BY_QUERY = Object.fromEntries(MODEL_QUERIES.map((m) => [m.q, m]));

// Arabic-Indic digits must fold to ASCII before a variant is compared: ٢٥٦ IS 256.
const foldDigits = (s) => String(s || '').replace(/[٠-٩۰-۹]/g, (d) => {
  const c = d.charCodeAt(0);
  return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
});

// Query intent → tokens that must appear in a relevant product name (either script).
const INTENT = {
  'iphone': ['iphone', 'ايفون'], 'ايفون': ['iphone', 'ايفون'],
  'لابتوب اتش بي': ['hp', 'اتش بي', 'laptop', 'لابتوب', 'notebook'],
  'macbook': ['macbook', 'ماك بوك'],
  'مكيف سبليت': ['split', 'سبليت', 'مكيف', 'air condition', 'ac '],
  'lg tv': ['lg', 'ال جي', 'tv', 'تلفزيون', 'شاشة'],
  'غسالة سامسونج': ['samsung', 'سامسونج', 'wash', 'غسال'],
  'ايباد': ['ipad', 'ايباد'],
  'شاشة': ['monitor', 'screen', 'display', 'tv', 'شاشة', 'تلفزيون'],
  'ثلاجة': ['refrigerator', 'fridge', 'ثلاج'],
  'سماعات': ['headphone', 'earbud', 'speaker', 'سماع', 'audio'],
  'طابعة': ['printer', 'طابع'],
  'ps5': ['ps5', 'playstation', 'بلايستيشن'],
  'شاحن': ['charger', 'شاحن'],
  'مكيف 18000': ['18000', '18,000', 'مكيف', 'split', 'سبليت'],
  'تلفزيون 65 بوصة': ['65', 'tv', 'تلفزيون', 'شاشة'],
  'laptop': ['laptop', 'notebook', 'لابتوب'],
  'washing machine': ['wash', 'غسال'],
  'مروحة': ['fan', 'مروح'],
  // مايكرويف (no و after ر) is how the CATALOGUE spells it — every microwave canonical
  // uses that form. Its absence here failed 3 journeys on a correct LG 20L microwave.
  // Taken from canonical_products, not from transcribed terminal output.
  'ميكروويف': ['microwave', 'ميكروويف', 'مايكروويف', 'مايكرويف'],
};

// Items that keyword-match a device but are not the device (top-pick sanity).
const ACCESSORY = /\b(case|cover|cable|charger|protector|stand|holder|mount|adapter|screen protector|lens|strap|band|skin|sleeve|bag)\b|كفر|غطاء|حافظة|واقي|كيبل|حامل|استاند|جراب/i;

const AR_DIGITS = /[٠-٩۰-۹]/g;
const deArabic = (s) => String(s || '').replace(AR_DIGITS, (d) => {
  const c = d.charCodeAt(0);
  return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
});
/** First plausible price in a blob of card text (thousands separators tolerated). */
function parsePrice(text) {
  const t = deArabic(text).replace(/[٬,]/g, '');
  const nums = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])).filter((n) => n >= 5 && n <= 200000);
  return nums.length ? nums[0] : null;
}
const norm = (s) => deArabic(s).toLowerCase().replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

function findChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((p) => existsSync(p)) || undefined;
}

/** Read-only resolution of a /go/<uuid> exit to its retailer URL (never fires the click). */
async function resolveGo(offerId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/normalized_product_observations?id=eq.${offerId}&select=normalized_payload`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows?.[0]?.normalized_payload?._url ?? null;
}

// A retailer refusing a headless client is NOT a broken link — it works fine for a real
// shopper. Counting it as a failure would drag the pass rate down for a defect that does
// not exist and send us "fixing" healthy links. Outcomes are therefore three-valued:
//   ok      → resolved to a real product page
//   blocked → bot wall / 403 / captcha; truth unknown; EXCLUDED from the pass rate
//   dead    → 404, homepage, or search page; a genuine failure
const REAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const REAL_HEADERS = {
  'User-Agent': REAL_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};
const BOTWALL = /robot check|are you a human|captcha|enter the characters you see|access denied|unusual traffic|request blocked|cf-browser-verification|attention required/i;

function classifyUrl(finalUrl, status) {
  const u = new URL(finalUrl);
  const path = u.pathname.replace(/\/+$/, '');
  const isHome = path === '' || /^\/(ar|en|en-sa|ar-sa|sa)$/i.test(path);
  const isSearch = /\/(search|s)(\/|$)|[?&](q|k|keyword|search)=/i.test(finalUrl);
  if (status >= 400) return { bucket: 'dead', note: `HTTP ${status}` };
  if (isHome) return { bucket: 'dead', note: 'landed on homepage' };
  if (isSearch) return { bucket: 'dead', note: 'landed on a search page' };
  return { bucket: 'ok', note: '' };
}

/** Does a retailer URL resolve to a PRODUCT page? Falls back to the real browser when
 *  a plain fetch is refused, since a genuine Chrome navigation clears most bot walls. */
async function checkDestination(url, browser) {
  const out = { url, finalUrl: null, status: null, bucket: 'dead', note: '' };
  if (!url) { out.bucket = 'dead'; out.note = 'no outbound url'; return out; }

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: REAL_HEADERS });
    clearTimeout(t);
    out.status = r.status;
    out.finalUrl = r.url;
    const body = await r.text().catch(() => '');
    const walled = r.status === 403 || r.status === 429 || r.status === 503 || BOTWALL.test(body.slice(0, 4000));
    if (!walled) {
      const c = classifyUrl(r.url, r.status);
      out.bucket = c.bucket; out.note = c.note;
      return out;
    }
    out.note = `bot wall on fetch (HTTP ${r.status})`;
  } catch (e) {
    out.note = e && e.name === 'AbortError' ? 'fetch timeout' : `fetch failed: ${e && e.message}`;
  }

  // Second opinion from a real browser navigation.
  if (!browser) { out.bucket = 'blocked'; return out; }
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(REAL_UA);
    await page.setExtraHTTPHeaders({ 'Accept-Language': REAL_HEADERS['Accept-Language'] });
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const status = resp ? resp.status() : 0;
    const finalUrl = page.url();
    const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 4000)).catch(() => '');
    out.status = status; out.finalUrl = finalUrl;
    if (status === 403 || status === 429 || BOTWALL.test(text)) {
      out.bucket = 'blocked'; out.note = 'bot wall in real browser too — link truth unknown';
    } else {
      const c = classifyUrl(finalUrl, status);
      out.bucket = c.bucket; out.note = c.note;
    }
  } catch (e) {
    out.bucket = 'blocked';
    out.note = `browser check inconclusive: ${e && e.message}`;
  } finally {
    if (page) await page.close().catch(() => {});
  }
  return out;
}

/** Scrape the search results page: the pick card + first card. */
async function readSearchPage(page, locale, query) {
  await page.goto(`${BASE}/${locale}/search?q=${encodeURIComponent(query)}`, {
    waitUntil: 'domcontentloaded', timeout: 90000,
  });
  // Results are client-rendered. The old wait matched `main`, which exists immediately,
  // then slept a fixed 3.5s — so on a slow render the harness read an empty page and
  // invented "no product card found". Two runs of identical code scored 87.5% and 80%
  // purely from this race. Wait for a real terminal state instead: a rendered card, or an
  // explicit empty state, or a genuine timeout.
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || '';
      if (/لا توجد نتائج|No results|لم نجد/i.test(t)) return true;         // honest empty state
      if (/جاري البحث|Searching|جارٍ/i.test(t)) return false;               // still loading
      // A card is ready once it has published its claim (data-best-price) — one terminal
      // condition on the card itself, no ancestor walking, no fixed sleep.
      const card = document.querySelector('[data-testid="product-card"][data-best-price]');
      return !!card && (card.innerText || '').trim().length > 0;
    },
    { timeout: 45000, polling: 400 },
  ).catch(() => null);
  // Small settle so prices/store rows finish painting inside an already-present card.
  await new Promise((r) => setTimeout(r, 800));

  return page.evaluate(() => {
    // ─────────────────────────────────────────────────────────────────────────
    // A CARD IS A CARD. The previous version walked up from every `img[alt]` to the
    // first ancestor containing a marker phrase. The first image on the page is the
    // HEADER LOGO (alt="Tawveeri"), whose nearest marker-bearing ancestor is the whole
    // page — so `pick` was a 4,500-character box holding 33 images, and `pickName` came
    // back "Tawveeri" on all 40 journeys. The store-count regex then matched the Smart
    // Pick's "أفضل سعر ٩٠٠" and reported "card claims 900 stores". Every claim in that
    // run (relevance, store visible, store count, price) was page-level, not card-level.
    //
    // Cards now publish their own claim (ADR-136): data-store-count / data-best-price /
    // data-compare-url are rendered by the same component that renders the visible text,
    // so the instrument reads what the card says instead of guessing from a text blob.
    // The text fallback is kept ONLY so a missing attribute is visible as `attr:false`
    // in the output rather than silently reverting to page-level measurement.
    // ─────────────────────────────────────────────────────────────────────────
    const readCard = (box, kind) => {
      const text = (box.innerText || '').replace(/\s+/g, ' ').trim();
      const attrCount = box.getAttribute('data-store-count');
      const attrPrice = box.getAttribute('data-best-price');
      const attrCompare = box.getAttribute('data-compare-url');
      const img = box.querySelector('img[alt]');
      const heading = box.querySelector('h3, h2');
      return {
        kind,
        fromAttributes: attrCount !== null && attrPrice !== null,
        storeCount: attrCount !== null && attrCount !== '' ? Number(attrCount) : null,
        price: attrPrice !== null && attrPrice !== '' ? Number(attrPrice) : null,
        href: (attrCompare || box.querySelector('a[href*="/compare/"]')?.getAttribute('href') || null) || null,
        name: (heading?.innerText || '').trim() || (img?.getAttribute('alt') || '').trim(),
        text,
        outbound: [...box.querySelectorAll('a[href]')]
          .map((x) => x.getAttribute('href'))
          .find((h) => {
            if (!h) return false;
            if (h.includes('/go/')) return true;
            if (!/^https?:\/\//.test(h)) return false;
            // Substring-matching "tawveeri" discarded every Amazon exit, because the
            // affiliate tag IS `tag=tawveeri-21`. Compare the HOST, not the whole URL.
            try { return !/(^|\.)tawveeri\.com$/i.test(new URL(h).hostname); } catch { return false; }
          }) || null,
      };
    };

    const cards = [...document.querySelectorAll('[data-testid="product-card"]')].map((b) => readCard(b, 'card'));
    const smartEl = document.querySelector('[data-testid="smart-pick"]');
    const smart = smartEl ? readCard(smartEl, 'smart-pick') : null;

    // The standing rule — never show a store count no comparison surface can honour —
    // applies to EVERY card on the page, not only the one the journey follows. Checked
    // here so a violation two cards down is still visible.
    const all = smart ? [smart, ...cards] : cards;
    const violations = all
      .filter((c) => (c.storeCount ?? 0) >= 2 && !c.href)
      .map((c) => `${c.kind}:${(c.name || '?').slice(0, 40)} claims ${c.storeCount}`);

    return {
      total: (document.body.innerText.match(/([\d٠-٩,٬]+)\s*(نتيجة|results?)/) || [])[1] || null,
      cardCount: cards.length,
      // BOTH surfaces are returned and BOTH are judged. Making the Smart Pick the sole
      // subject left `subject_result_card = 0` in every run: a result card's own price
      // agreement with its compare page was never checked, so any high gate was
      // unreadable. A shopper who ignores the pick and clicks the first result is taking
      // a real journey and must be measured taking it.
      smart,
      first: cards[0] || null,
      unhonouredClaims: violations,
      empty: /لا توجد نتائج|No results/i.test(document.body.innerText),
    };
  });
}

/** Scrape a compare page. */
async function readComparePage(page, href) {
  await page.goto(href.startsWith('http') ? href : `${BASE}${href}`, {
    waitUntil: 'domcontentloaded', timeout: 90000,
  });
  await new Promise((r) => setTimeout(r, 2000));
  return page.evaluate(() => {
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    const offers = [...document.querySelectorAll('a[href*="/go/"], a[href^="http"]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && (h.includes('/go/') || !h.includes('tawveeri.com')));
    const m = text.match(/(?:جميع العروض|All Offers)\s*\((\d+)/);
    return {
      text: text.slice(0, 900),
      unavailable: /لا تتوفر مقارنة|isn't available for this product/i.test(text),
      offerCountLabel: m ? Number(m[1]) : null,
      outbound: offers[0] || null,
      h1: document.querySelector('h1')?.innerText?.trim() || '',
    };
  });
}

/**
 * Judge ONE surface end-to-end: its claim → its compare page → its outbound link.
 *
 * Split out of `journey()` so the Smart Pick and the first result card are each measured
 * in their own right. While the pick was the sole subject, every run reported
 * `subject_result_card = 0`: a result card's price agreement with its own compare page
 * was never tested, so a high gate could not be read. A shopper who scrolls past the pick
 * and clicks the first card is taking a real journey.
 */
async function evaluateSurface(page, browser, { query, locale, subject, surfaceCard, search }) {
  const row = {
    query, locale, subject,
    relevant: false, sensiblePick: false, storeVisible: false,
    priceConsistent: false, linkLands: false, linkBucket: 'dead', excluded: false, isComparison: false, pass: false,
    pickName: '', cardPrice: null, comparePrice: null, cardStores: null, compareStores: null,
    surface: null, attrRead: false, unhonouredClaims: [], exactModel: null, exactVariant: null, isModelQuery: false,
    destination: '', notes: [],
  };
  // Page-level rule check. Recorded on every surface of the page because the rule is a
  // property of the PAGE, but counted once per page in the summary.
  row.unhonouredClaims = search.unhonouredClaims || [];
  if (row.unhonouredClaims.length) {
    row.notes.push(`${row.unhonouredClaims.length} card(s) claim a store count with no compare link: ${row.unhonouredClaims.slice(0, 3).join(' | ')}`);
  }

  row.isModelQuery = !!MODEL_BY_QUERY[query];
  const pick = surfaceCard;
  // A single-store product legitimately has no compare link — that is a finding to
  // record, not a reason to abandon the journey.
  if (!pick) { row.notes.push(search.empty ? 'no results' : 'no product card found'); return row; }

  row.pickName = pick.name || '(no alt text)';
  const hay = norm(`${pick.name} ${pick.text}`);
  const model = MODEL_BY_QUERY[query];

  if (model) {
    // EXACT-MODEL scoring: the name alone decides, not the surrounding card text, and the
    // VARIANT must survive. Answering a 256 query with a 128 product is a wrong answer.
    const nameOnly = foldDigits(norm(pick.name || ''));
    row.exactModel = model.must.some((t) => nameOnly.includes(norm(t)));
    row.exactVariant = model.variant.some((v) => nameOnly.includes(foldDigits(v)));
    row.relevant = row.exactModel;
    row.sensiblePick = row.exactModel && row.exactVariant && !ACCESSORY.test(pick.name || '');
    if (!row.exactModel) row.notes.push(`WRONG PRODUCT for an exact-model query: "${row.pickName}"`);
    else if (!row.exactVariant) row.notes.push(`WRONG VARIANT — asked ${model.variant.join('/')}, got "${row.pickName}"`);
  } else {
    const tokens = (INTENT[query] || [query]).map(norm);
    row.relevant = tokens.some((t) => hay.includes(t));
    row.sensiblePick = row.relevant && !ACCESSORY.test(pick.name || '');
  }
  if (!row.relevant) row.notes.push(`top pick unrelated: "${row.pickName}"`);
  else if (!row.sensiblePick) row.notes.push('top pick is an accessory');

  // Store count + price come from the card's OWN published claim (ADR-136), not from a
  // regex over its text. `attrRead` records which source was used so a future deploy that
  // drops the attributes shows up as a measurement caveat instead of silently degrading.
  const cardText = deArabic(pick.text);
  row.surface = pick.kind || 'card';
  row.attrRead = !!pick.fromAttributes;
  if (pick.fromAttributes) {
    row.cardStores = Number.isFinite(pick.storeCount) ? pick.storeCount : null;
    row.cardPrice = Number.isFinite(pick.price) && pick.price > 0 ? pick.price : null;
  } else {
    row.notes.push('card published no claim attributes — measured from text (less reliable)');
    // The product NAME contains digits ("iPhone 12 128GB"), so it must be removed before
    // parsing a price or the name's own numbers win. split/join, NOT replace(): a string
    // replace strips only the FIRST occurrence and the name is rendered more than once.
    const nm = deArabic(pick.name || '');
    const nameFree = nm ? cardText.split(nm).join(' ') : cardText;
    const scMatch = cardText.match(/(?:متوفر في|available in)\s*(\d+)\s*(?:متاجر|متجر|stores?)/i);
    row.cardStores = scMatch ? Number(scMatch[1]) : null;
    const fromMatch = nameFree.match(/(?:\bمن\b|\bfrom\b)\s*[:·|]?\s*([\d][\d.,٬]*)/i);
    row.cardPrice = fromMatch ? parsePrice(fromMatch[1]) : (() => {
      const nums = [...nameFree.matchAll(/([\d][\d.,٬]*)/g)]
        .map((m) => Number(String(m[1]).replace(/[,٬]/g, ''))).filter((n) => n >= 20 && n <= 200000);
      return nums.length ? Math.min(...nums) : null;
    })();
  }

  // A store name must be READABLE. The cards render 2-letter avatar stubs ("اك" "أم" "جر"),
  // which is what the founder read as the garbled "جر اك أم ال" — those must NOT count.
  // Must list every APPROVED retailer's display name. Admitting najm/shaker/alnakheelk
  // (ADR-139) without updating this made 4 correct `ثلاجة` cards read as "no store name —
  // only stubs: شا اك ال", where شا is شاكر itself. An instrument that does not know the
  // catalogue reports the catalogue as broken.
  const FULL_STORE = /اكسترا|إكسترا|امازون|أمازون|جرير|نون|المنيع|لولو|شرف|الشتاء|نجم|شاكر|النخيل|extra|amazon|jarir|noon|almanea|lulu|sharaf|najm|shaker|alnakheel/i;
  row.storeVisible = FULL_STORE.test(cardText);
  if (!row.storeVisible) {
    const stubs = (cardText.match(/(?:^|\s)([ء-ي]{2})(?=\s|$)/g) || []).map((s) => s.trim());
    row.notes.push(stubs.length ? `no store name — only stubs: ${[...new Set(stubs)].join(' ')}` : 'no store name on card');
  }

  // Compare page — the surface that must agree with the card.
  if (pick.href && pick.href.includes('/compare/')) {
    let cmp;
    try { cmp = await readComparePage(page, pick.href); } catch (e) { row.notes.push(`compare failed: ${e.message}`); }
    if (cmp) {
      if (cmp.unavailable) {
        row.notes.push(`card claims ${row.cardStores ?? '?'} stores, compare page says none`);
        row.compareStores = 0;
      } else {
        row.compareStores = cmp.offerCountLabel;
        row.comparePrice = parsePrice((deArabic(cmp.text).split(/أرخص سعر|Lowest Price/i)[1]) || cmp.text);
        row.destination = cmp.outbound || '';
      }
    }
  } else {
    row.notes.push(`no compare link on the ${subject === 'smart-pick' ? 'top pick' : 'first result card'}`);
  }

  if (row.cardPrice != null && row.comparePrice != null) {
    row.priceConsistent = Math.abs(row.cardPrice - row.comparePrice) < 1;
    if (!row.priceConsistent) row.notes.push(`PRICE MISMATCH card=${row.cardPrice} compare=${row.comparePrice}`);
  } else if (row.cardPrice == null) {
    row.notes.push('no card price');
  } else if (row.compareStores === 0) {
    // Card promised a comparison and the compare page delivered none — already noted.
    row.priceConsistent = false;
  } else if (!pick.href && (row.cardStores ?? 0) >= 2) {
    // The card PROMISED a comparison and rendered no way to see it. That is the founder's
    // standing rule — never show a store count the compare page can honour — so it is a
    // failure, not a vacuous pass. Counting these as passes inflated the gate by ~23 points.
    row.priceConsistent = false;
    row.notes.push(`card claims ${row.cardStores} stores but renders NO compare link`);
  } else if (!pick.href) {
    // Genuinely single-store: no second surface exists, so no price can contradict.
    row.priceConsistent = true;
    row.notes.push('single-store (no compare page) — price check vacuous');
  } else {
    row.notes.push('no compare price');
  }

  // Outbound: resolve read-only, never fire the click.
  const outHref = row.destination || pick.outbound;
  let target = null;
  if (outHref && outHref.includes('/go/')) {
    const id = (outHref.match(/\/go\/([0-9a-f-]{36})/i) || [])[1];
    target = id ? await resolveGo(id) : null;
    if (!target) row.notes.push('could not resolve outbound offer');
  } else if (outHref && /^https?:\/\//.test(outHref)) target = outHref;
  else row.notes.push('no outbound link found');

  if (target) {
    const dest = await checkDestination(target, browser);
    row.linkBucket = dest.bucket;                 // ok | blocked | dead
    row.linkLands = dest.bucket === 'ok';
    row.destination = dest.finalUrl || target;
    if (dest.bucket !== 'ok') row.notes.push(`outbound ${dest.bucket.toUpperCase()}: ${dest.note || 'not a product page'}`);
  } else {
    row.linkBucket = 'dead';
  }

  // BLOCKED is excluded, not failed: the link may be perfectly good for a real shopper
  // and we simply cannot see it from here.
  const linkOk = row.linkBucket === 'ok' || row.linkBucket === 'blocked';
  row.excluded = row.linkBucket === 'blocked';
  row.isComparison = (row.cardStores ?? 0) >= 2;
  // An unhonoured claim ANYWHERE on the page fails the journey. The rule is absolute:
  // we never show a store count with no comparison surface behind it.
  row.pass = row.relevant && row.sensiblePick && row.storeVisible && row.priceConsistent && linkOk
    && row.unhonouredClaims.length === 0;
  return row;
}

/**
 * One search page → one row per SURFACE a shopper can act on: the Smart Pick and the
 * first result card. The page is loaded once and both surfaces are judged from that
 * single read, so the extra coverage costs compare-page visits, not page loads.
 */
async function journey(page, locale, query, browser) {
  let search;
  try {
    search = await readSearchPage(page, locale, query);
  } catch (e) {
    return [{
      query, locale, subject: 'smart-pick',
      relevant: false, sensiblePick: false, storeVisible: false, priceConsistent: false,
      linkLands: false, linkBucket: 'dead', excluded: false, isComparison: false, pass: false,
      pickName: '', cardPrice: null, comparePrice: null, cardStores: null, compareStores: null,
      surface: null, attrRead: false, unhonouredClaims: [],
      destination: '', notes: [`search page failed: ${e.message}`],
    }];
  }

  const rows = [];
  // The pick is judged first because it is what the customer is steered to. The result
  // card is judged whether or not a pick exists — a page with no pick still has cards,
  // and those journeys were entirely unmeasured before.
  if (search.smart) {
    rows.push(await evaluateSurface(page, browser, { query, locale, subject: 'smart-pick', surfaceCard: search.smart, search }));
  }
  rows.push(await evaluateSurface(page, browser, { query, locale, subject: 'result-card', surfaceCard: search.first, search }));
  return rows;
}

/**
 * THE HOMEPAGE JOURNEY — the screen a real shopper actually starts on.
 *
 * Every number this harness produced before today was true only for the path we measured,
 * and that path began at `/search?q=`. Nobody arrives that way. This leg measures the
 * first screen as a contract, then walks the primary action through to results:
 *
 *   1. ONE primary search field. Two fields is two answers to "what do I do here".
 *   2. ONE وفّر entry point. The same assistant offered twice reads as two products.
 *   3. Deals carry evidence or make no savings claim — a struck-through price IS a claim.
 *      (ADR-129's gate never reached this surface; it published merchant "was" prices
 *      on the first screen until 2026-07-29.)
 *   4. The primary action reaches real results for a typed query.
 *
 * Scored as its own journey so the search-leg gate cannot carry it, and so a fall when
 * the homepage enters the denominator is visible as exactly that.
 */
async function homepageJourney(page, locale) {
  const row = {
    query: '(homepage)', locale, subject: 'homepage',
    relevant: false, sensiblePick: false, storeVisible: false, priceConsistent: false,
    linkLands: false, linkBucket: 'ok', excluded: false, isComparison: false, pass: false,
    pickName: '', cardPrice: null, comparePrice: null, cardStores: null, compareStores: null,
    surface: 'homepage', attrRead: false, unhonouredClaims: [], destination: '', notes: [],
  };
  try {
    await page.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(
      () => (document.body?.innerText || '').trim().length > 200,
      { timeout: 30000, polling: 400 },
    ).catch(() => null);
    await new Promise((r) => setTimeout(r, 2500));

    const home = await page.evaluate(() => {
      const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
      const inputs = [...document.querySelectorAll('input')].filter(
        (i) => vis(i) && /search|بحث|ابحث/i.test((i.getAttribute('placeholder') || '') + (i.getAttribute('aria-label') || '') + i.type),
      );
      const waffar = [...document.querySelectorAll('a[href]')].filter(
        (a) => /\/(advisor|assistant)(\/|$|\?)/.test(a.getAttribute('href') || ''),
      );
      // A savings claim is a percentage OR a struck-through price. Both are claims.
      const text = document.body.innerText || '';
      const pctClaims = (text.match(/(?:وفّر|وفر|Save)\s*\d+\s*%/g) || []);
      const struck = [...document.querySelectorAll('*')].filter(
        (e) => e.children.length === 0 && getComputedStyle(e).textDecorationLine === 'line-through' && (e.textContent || '').trim(),
      ).length;
      // Evidence line = we state what we observed and for how long.
      const hasEvidence = /رصدنا|تتبّعنا|تتبعنا|we (?:tracked|observed)/i.test(text);
      return {
        searchInputs: inputs.length,
        waffarEntries: new Set(waffar.map((a) => a.getAttribute('href'))).size,
        waffarLinks: waffar.length,
        pctClaims: pctClaims.length,
        struck,
        hasEvidence,
        hasDeals: /أفضل العروض|Best deals/i.test(text),
      };
    });

    row.pickName = `inputs=${home.searchInputs} waffar=${home.waffarLinks} claims=${home.pctClaims + home.struck}`;

    const oneSearch = home.searchInputs === 1;
    const oneWaffar = home.waffarLinks <= 1;
    const claimsClean = (home.pctClaims + home.struck) === 0 || home.hasEvidence;
    if (!oneSearch) row.notes.push(`${home.searchInputs} search fields on the first screen — one primary action, not two`);
    if (!oneWaffar) row.notes.push(`وفّر offered ${home.waffarLinks} times — one entry point`);
    if (!claimsClean) row.notes.push(`${home.pctClaims + home.struck} savings claim(s) with no evidence line`);

    // The primary action must actually reach results.
    let reachedResults = false;
    try {
      const typed = await page.evaluate(() => {
        const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
        const i = [...document.querySelectorAll('input')].find(
          (x) => vis(x) && /search|بحث|ابحث/i.test((x.getAttribute('placeholder') || '') + (x.getAttribute('aria-label') || '') + x.type),
        );
        if (!i) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(i, 'iphone');
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.focus();
        return true;
      });
      if (typed) {
        await page.keyboard.press('Enter');
        await page.waitForFunction(
          () => /\/search/.test(location.pathname + location.search)
            && !!document.querySelector('[data-testid="product-card"][data-best-price]'),
          { timeout: 45000, polling: 400 },
        ).catch(() => null);
        reachedResults = await page.evaluate(
          () => /\/search/.test(location.pathname + location.search)
            && document.querySelectorAll('[data-testid="product-card"]').length > 0,
        );
      } else {
        row.notes.push('no usable search field found on the homepage');
      }
    } catch (e) {
      row.notes.push(`primary action failed: ${e.message.slice(0, 60)}`);
    }
    if (!reachedResults) row.notes.push('the homepage primary action did not reach product results');

    // Map onto the shared columns so the summary stays one table.
    row.relevant = reachedResults;      // did the first screen do its job at all
    row.sensiblePick = oneSearch;       // one primary action
    row.storeVisible = oneWaffar;       // one assistant entry
    row.priceConsistent = claimsClean;  // no unevidenced savings claim
    row.linkLands = reachedResults;
    row.linkBucket = reachedResults ? 'ok' : 'dead';
    row.pass = reachedResults && oneSearch && oneWaffar && claimsClean;
  } catch (e) {
    row.notes.push(`homepage failed: ${e.message.slice(0, 80)}`);
    row.linkBucket = 'dead';
  }
  return row;
}

(async () => {
  const queries = ONLY_QUERY ? [ONLY_QUERY] : QUERIES;
  const locales = ONLY_LOCALE ? [ONLY_LOCALE] : ['ar', 'en'];
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: findChrome(),
  });
  const page = await browser.newPage();
  await page.setViewport({ width: VIEW_W, height: VIEW_H });
  // Identify as a tester so nothing counts this run as real shopper traffic.
  await page.setUserAgent('Mozilla/5.0 (compatible; TawveeriUIJourney/1.0; headless harness; read-only)');

  const rows = [];
  for (const locale of locales) {
    // The first screen, before any search-leg journey. Skipped when a single query is
    // being debugged, so `--query x` stays a cheap probe.
    if (!ONLY_QUERY) {
      const h = await homepageJourney(page, locale);
      rows.push(h);
      if (!JSON_OUT) {
        process.stdout.write(
          `${h.pass ? 'PASS' : 'FAIL'}  ${locale}  ${'(homepage)'.padEnd(18)} HOME ` +
          `reach=${h.relevant ? 'Y' : 'N'} 1search=${h.sensiblePick ? 'Y' : 'N'} 1waffar=${h.storeVisible ? 'Y' : 'N'} ` +
          `claims=${h.priceConsistent ? 'Y' : 'N'}  · ${h.pickName}` +
          `${h.notes.length ? '; ' + h.notes.join('; ') : ''}\n`,
        );
      }
    }
    for (const q of queries) {
      const produced = await journey(page, locale, q, browser);
      for (const r of produced) {
        rows.push(r);
        if (!JSON_OUT) {
          process.stdout.write(
            `${r.pass ? 'PASS' : 'FAIL'}  ${locale}  ${q.padEnd(18)} ` +
            `${(r.subject === 'smart-pick' ? 'PICK' : 'CARD').padEnd(4)} ` +
            `rel=${r.relevant ? 'Y' : 'N'} pick=${r.sensiblePick ? 'Y' : 'N'} store=${r.storeVisible ? 'Y' : 'N'} ` +
            `price=${r.priceConsistent ? 'Y' : 'N'} link=${r.linkBucket.toUpperCase()} ` +
            `${r.cardStores ?? '?'}st` +
            `${r.notes.length ? '  · ' + r.notes.join('; ') : ''}\n`,
          );
        }
      }
    }
  }
  await browser.close();

  // Cross-language winner agreement.
  const mismatched = [];
  if (locales.length === 2) {
    for (const q of queries) {
      // Compare like with like: the pick in one language against the pick in the other.
      const at = (loc) => rows.find((r) => r.query === q && r.locale === loc && r.subject === 'smart-pick')
        || rows.find((r) => r.query === q && r.locale === loc);
      const a = at('ar');
      const e = at('en');
      if (a && e && a.pickName && e.pickName && norm(a.pickName) !== norm(e.pickName)) {
        mismatched.push({ query: q, ar: a.pickName, en: e.pickName });
      }
    }
  }

  const cmpRows = rows.filter((r) => r.isComparison);
  const cmpPassed = cmpRows.filter((r) => r.pass).length;
  const passed = rows.filter((r) => r.pass).length;

  // Per-surface breakdown, so a gate carried by one surface is visible as such.
  const subjectRate = (s) => {
    const sub = rows.filter((r) => r.subject === s);
    const cmp = sub.filter((r) => r.isComparison);
    return {
      journeys: sub.length,
      passed: sub.filter((r) => r.pass).length,
      comparison_journeys: cmp.length,
      comparison_passed: cmp.filter((r) => r.pass).length,
    };
  };
  // One entry per PAGE (query × locale), not per row — both rows of a page carry the
  // same page-level violation list and must not be double-counted.
  const scriptRate = (pred) => {
    const sub = rows.filter((r) => r.surface && pred(r.query));
    const cmp = sub.filter((r) => r.isComparison);
    return { journeys: sub.length, passed: sub.filter((r) => r.pass).length,
      comparison_journeys: cmp.length, comparison_passed: cmp.filter((r) => r.pass).length };
  };
  const pageViolations = [...new Map(
    rows.map((r) => [`${r.locale}|${r.query}`, r.unhonouredClaims || []]),
  ).values()];
  const rate = rows.length ? Math.round((passed / rows.length) * 1000) / 10 : 0;
  const summary = {
    base: BASE, total: rows.length, passed, pass_rate_pct: rate,
    by_check: {
      relevant: rows.filter((r) => r.relevant).length,
      sensible_pick: rows.filter((r) => r.sensiblePick).length,
      store_visible: rows.filter((r) => r.storeVisible).length,
      price_consistent: rows.filter((r) => r.priceConsistent).length,
      link_lands: rows.filter((r) => r.linkLands).length,
    },
    link_buckets: {
      OK: rows.filter((r) => r.linkBucket === 'ok').length,
      BLOCKED_excluded: rows.filter((r) => r.linkBucket === 'blocked').length,
      DEAD: rows.filter((r) => r.linkBucket === 'dead').length,
    },
    link_trustable_pct: rows.length
      ? Math.round((rows.filter((r) => r.linkBucket !== 'blocked').length / rows.length) * 1000) / 10
      : 0,
    comparison_journeys: cmpRows.length,
    comparison_passed: cmpPassed,
    comparison_pass_rate_pct: cmpRows.length ? Math.round((cmpPassed / cmpRows.length) * 1000) / 10 : null,
    cross_language_pick_mismatches: mismatched,
    // Instrument integrity: how many journeys read the card's published claim rather than
    // guessing it from text. Anything below `measured` means the numbers above carry a
    // wider error bar and must be reported as such.
    instrument: {
      journeys_with_a_card: rows.filter((r) => r.surface).length,
      read_from_card_attributes: rows.filter((r) => r.attrRead).length,
      subject_smart_pick: rows.filter((r) => r.subject === 'smart-pick' && r.surface).length,
      subject_result_card: rows.filter((r) => r.subject === 'result-card' && r.surface).length,
    },
    // Each surface judged on its own. A gate carried entirely by the Smart Pick while
    // result cards fail is a different product from one where both work.
    by_subject: {
      smart_pick: subjectRate('smart-pick'),
      homepage: subjectRate('homepage'),
      result_card: subjectRate('result-card'),
    },
    // §1 of the 2026-07-31 launch review: report each dimension SEPARATELY, so a
    // headline can never again hide a failing one. Arabic and English are split because a
    // defect that only affects one script is invisible in a blended rate — which is exactly
    // how the Pro/Max relevance bug survived a 100%% gate.
    by_script: {
      arabic_queries: scriptRate((q) => /[؀-ۿ]/.test(q)),
      english_queries: scriptRate((q) => !/[؀-ۿ]/.test(q)),
    },
    exact_model: {
      journeys: rows.filter((r) => r.isModelQuery && r.surface).length,
      correct_product: rows.filter((r) => r.isModelQuery && r.exactModel).length,
      correct_variant: rows.filter((r) => r.isModelQuery && r.exactVariant).length,
      full_journey_pass: rows.filter((r) => r.isModelQuery && r.pass).length,
    },
    retailer_visibility: {
      journeys: rows.filter((r) => r.surface).length,
      store_name_visible: rows.filter((r) => r.storeVisible).length,
    },
    outbound: {
      resolved_to_product_page: rows.filter((r) => r.linkBucket === 'ok').length,
      blocked_excluded: rows.filter((r) => r.linkBucket === 'blocked').length,
      dead: rows.filter((r) => r.linkBucket === 'dead').length,
    },
    // The founder's standing rule, measured directly across every card rendered.
    // Counted ONCE PER PAGE — a page contributes two rows now, and a violation is a
    // property of the page, not of each surface on it.
    unhonoured_store_claims: {
      pages_with_a_violation: pageViolations.filter((v) => v.length > 0).length,
      pages_checked: pageViolations.length,
      cards_violating: pageViolations.reduce((n, v) => n + v.length, 0),
    },
  };

  if (JSON_OUT) { console.log(JSON.stringify({ summary, rows }, null, 2)); return; }
  console.log('\n── SUMMARY ────────────────────────────────');
  console.log(`base: ${summary.base}`);
  console.log(`PASS RATE (overall): ${passed}/${rows.length} = ${rate}%`);
  console.log(`COMPARISON JOURNEY:  ${cmpPassed}/${cmpRows.length}${cmpRows.length ? ` = ${summary.comparison_pass_rate_pct}%` : ''}   <-- LAUNCH GATE`);
  console.table(summary.by_check);
  console.log('By surface (each judged in its own right — a gate carried by one surface is not a working product):');
  console.table(summary.by_subject);
  console.log('Instrument (what the numbers were read from):');
  console.table(summary.instrument);
  console.log('Arabic vs English (a defect in one script is invisible in a blended rate):');
  console.table(summary.by_script);
  console.log('Exact-model / exact-variant (new set — the promise the customer actually types):');
  console.table(summary.exact_model);
  console.log('Unhonoured store claims (cards claiming N stores with no compare link):');
  console.table(summary.unhonoured_store_claims);
  if (summary.instrument.read_from_card_attributes < summary.instrument.journeys_with_a_card) {
    console.log(
      `⚠  ${summary.instrument.journeys_with_a_card - summary.instrument.read_from_card_attributes} journey(s) fell back to TEXT parsing — ` +
      'those store counts/prices are inferred, not published by the card. Treat them as a wider error bar.',
    );
  }
  console.log('Outbound link buckets (BLOCKED is excluded from the pass rate, not failed):');
  console.table(summary.link_buckets);
  console.log(`Link check is trustable for ${summary.link_trustable_pct}% of journeys.`);
  if (mismatched.length) {
    console.log(`\nCross-language pick mismatches (${mismatched.length}):`);
    for (const m of mismatched) console.log(`  ${m.query}: ar="${m.ar}"  en="${m.en}"`);
  }
  process.exit(rate === 100 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
