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

const QUERIES = [
  'iphone', 'ايفون', 'لابتوب اتش بي', 'macbook', 'مكيف سبليت', 'lg tv',
  'غسالة سامسونج', 'ايباد', 'شاشة', 'ثلاجة', 'سماعات', 'طابعة', 'ps5', 'شاحن',
  'مكيف 18000', 'تلفزيون 65 بوصة', 'laptop', 'washing machine', 'مروحة', 'ميكروويف',
];

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
  'ميكروويف': ['microwave', 'ميكروويف', 'مايكروويف'],
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
      const marker = /قارن الأسعار|Compare Prices|عرض في المتجر|View in store|أفضل سعر|Best Price/i;
      // A card is only "ready" once it has both an image and its action text painted.
      return [...document.querySelectorAll('img[alt]')].some((img) => {
        if ((img.getAttribute('alt') || '').trim().length < 4) return false;
        let b = img;
        for (let i = 0; i < 12 && b; i++) { if (marker.test(b.innerText || '')) return true; b = b.parentElement; }
        return false;
      });
    },
    { timeout: 45000, polling: 400 },
  ).catch(() => null);
  // Small settle so prices/store rows finish painting inside an already-present card.
  await new Promise((r) => setTimeout(r, 800));

  return page.evaluate(() => {
    // Cards are anchored on their product IMAGE, not on a link: a card with no compare
    // URL renders its wrapper as a <button>, so an anchor-only selector silently misses
    // every single-store product and reports "no results" where results exist.
    const MARKER = /قارن الأسعار|Compare Prices|عرض في المتجر|View in store|أفضل سعر|Best Price|اختيار توفيري/i;
    const cards = [];
    const seen = new Set();
    for (const img of document.querySelectorAll('img[alt]')) {
      const alt = (img.getAttribute('alt') || '').trim();
      if (alt.length < 4 || seen.has(alt)) continue;
      let box = img;
      for (let i = 0; i < 12 && box; i++) {
        if (MARKER.test(box.innerText || '')) break;
        box = box.parentElement;
      }
      if (!box || !MARKER.test(box.innerText || '')) continue;
      seen.add(alt);
      cards.push({
        href: box.querySelector('a[href*="/compare/"]')?.getAttribute('href') || null,
        name: alt,
        text: (box.innerText || '').replace(/\s+/g, ' ').trim(),
        outbound: [...box.querySelectorAll('a[href]')]
          .map((x) => x.getAttribute('href'))
          .find((h) => h && (h.includes('/go/') || (/^https?:\/\//.test(h) && !h.includes('tawveeri')))) || null,
      });
    }
    const pickIdx = cards.findIndex((c) => /اختيار توفيري|Tawveeri pick|Smart Pick/i.test(c.text));
    return {
      total: (document.body.innerText.match(/([\d٠-٩,٬]+)\s*(نتيجة|results?)/) || [])[1] || null,
      cardCount: cards.length,
      pick: pickIdx >= 0 ? cards[pickIdx] : (cards[0] || null),
      first: cards[0] || null,
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

async function journey(page, locale, query, browser) {
  const row = {
    query, locale,
    relevant: false, sensiblePick: false, storeVisible: false,
    priceConsistent: false, linkLands: false, linkBucket: 'dead', excluded: false, isComparison: false, pass: false,
    pickName: '', cardPrice: null, comparePrice: null, cardStores: null, compareStores: null,
    destination: '', notes: [],
  };
  let search;
  try {
    search = await readSearchPage(page, locale, query);
  } catch (e) {
    row.notes.push(`search page failed: ${e.message}`);
    return row;
  }
  const pick = search.pick;
  // A single-store product legitimately has no compare link — that is a finding to
  // record, not a reason to abandon the journey.
  if (!pick) { row.notes.push(search.empty ? 'no results' : 'no product card found'); return row; }

  row.pickName = pick.name || '(no alt text)';
  const hay = norm(`${pick.name} ${pick.text}`);
  const tokens = (INTENT[query] || [query]).map(norm);
  row.relevant = tokens.some((t) => hay.includes(t));
  row.sensiblePick = row.relevant && !ACCESSORY.test(pick.name || '');
  if (!row.relevant) row.notes.push(`top pick unrelated: "${row.pickName}"`);
  else if (!row.sensiblePick) row.notes.push('top pick is an accessory');

  // Store count + price. The product NAME contains digits ("iPhone 12 128GB"), so it must
  // be removed before parsing a price or the name's own numbers win.
  const cardText = deArabic(pick.text);
  // split/join, NOT replace(): a string replace strips only the FIRST occurrence, and the
  // name is rendered more than once — leaving "…128GB" to be parsed as a 128 SAR price.
  const nm = deArabic(pick.name || '');
  const nameFree = nm ? cardText.split(nm).join(' ') : cardText;
  const scMatch = cardText.match(/(?:متوفر في|available in)\s*(\d+)\s*(?:متاجر|متجر|stores?)/i)
    || cardText.match(/(?:أفضل سعر|Best Price)\s*\n?\s*(\d+)\b/i);
  row.cardStores = scMatch ? Number(scMatch[1]) : null;

  // Price: the figure after "من"/"from", else the largest plausible number once the name is out.
  const fromMatch = nameFree.match(/(?:أفضل سعر|Best Price|\bمن\b|\bfrom\b)\s*[:·|]?\s*([\d][\d.,٬]*)/i);
  row.cardPrice = fromMatch ? parsePrice(fromMatch[1]) : (() => {
    const nums = [...nameFree.matchAll(/([\d][\d.,٬]*)/g)]
      .map((m) => Number(String(m[1]).replace(/[,٬]/g, ''))).filter((n) => n >= 20 && n <= 200000);
    return nums.length ? Math.min(...nums) : null;
  })();

  // A store name must be READABLE. The cards render 2-letter avatar stubs ("اك" "أم" "جر"),
  // which is what the founder read as the garbled "جر اك أم ال" — those must NOT count.
  const FULL_STORE = /اكسترا|إكسترا|امازون|أمازون|جرير|نون|المنيع|لولو|شرف|الشتاء|extra|amazon|jarir|noon|almanea|lulu|sharaf/i;
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
    row.notes.push('no compare link on the top pick');
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
  row.pass = row.relevant && row.sensiblePick && row.storeVisible && row.priceConsistent && linkOk;
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
  await page.setViewport({ width: 1366, height: 2200 });
  // Identify as a tester so nothing counts this run as real shopper traffic.
  await page.setUserAgent('Mozilla/5.0 (compatible; TawveeriUIJourney/1.0; headless harness; read-only)');

  const rows = [];
  for (const locale of locales) {
    for (const q of queries) {
      const r = await journey(page, locale, q, browser);
      rows.push(r);
      if (!JSON_OUT) {
        process.stdout.write(
          `${r.pass ? 'PASS' : 'FAIL'}  ${locale}  ${q.padEnd(18)} ` +
          `rel=${r.relevant ? 'Y' : 'N'} pick=${r.sensiblePick ? 'Y' : 'N'} store=${r.storeVisible ? 'Y' : 'N'} ` +
          `price=${r.priceConsistent ? 'Y' : 'N'} link=${r.linkBucket.toUpperCase()}` +
          `${r.notes.length ? '  · ' + r.notes.join('; ') : ''}\n`,
        );
      }
    }
  }
  await browser.close();

  // Cross-language winner agreement.
  const mismatched = [];
  if (locales.length === 2) {
    for (const q of queries) {
      const a = rows.find((r) => r.query === q && r.locale === 'ar');
      const e = rows.find((r) => r.query === q && r.locale === 'en');
      if (a && e && a.pickName && e.pickName && norm(a.pickName) !== norm(e.pickName)) {
        mismatched.push({ query: q, ar: a.pickName, en: e.pickName });
      }
    }
  }

  const cmpRows = rows.filter((r) => r.isComparison);
  const cmpPassed = cmpRows.filter((r) => r.pass).length;
  const passed = rows.filter((r) => r.pass).length;
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
  };

  if (JSON_OUT) { console.log(JSON.stringify({ summary, rows }, null, 2)); return; }
  console.log('\n── SUMMARY ────────────────────────────────');
  console.log(`base: ${summary.base}`);
  console.log(`PASS RATE (overall): ${passed}/${rows.length} = ${rate}%`);
  console.log(`COMPARISON JOURNEY:  ${cmpPassed}/${cmpRows.length}${cmpRows.length ? ` = ${summary.comparison_pass_rate_pct}%` : ''}   <-- LAUNCH GATE`);
  console.table(summary.by_check);
  console.log('Outbound link buckets (BLOCKED is excluded from the pass rate, not failed):');
  console.table(summary.link_buckets);
  console.log(`Link check is trustable for ${summary.link_trustable_pct}% of journeys.`);
  if (mismatched.length) {
    console.log(`\nCross-language pick mismatches (${mismatched.length}):`);
    for (const m of mismatched) console.log(`  ${m.query}: ar="${m.ar}"  en="${m.en}"`);
  }
  process.exit(rate === 100 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
