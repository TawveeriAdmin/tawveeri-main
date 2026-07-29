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

/** Does a retailer URL actually resolve to a PRODUCT page (not a homepage/search)? */
async function checkDestination(url) {
  const out = { url, finalUrl: null, status: null, isProduct: false, note: '' };
  if (!url) { out.note = 'no outbound url'; return out; }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(url, {
      redirect: 'follow', signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36' },
    });
    clearTimeout(t);
    out.status = r.status;
    out.finalUrl = r.url;
    const u = new URL(r.url);
    const path = u.pathname.replace(/\/+$/, '');
    const isHome = path === '' || path === '/' || /^\/(ar|en|en-sa|ar-sa)$/i.test(path);
    const isSearch = /\/(search|s)\b|[?&](q|k|keyword|search)=/i.test(r.url);
    out.isProduct = r.status < 400 && !isHome && !isSearch;
    if (isHome) out.note = 'landed on homepage';
    else if (isSearch) out.note = 'landed on a search page';
    else if (r.status >= 400) out.note = `HTTP ${r.status}`;
  } catch (e) {
    out.note = e && e.name === 'AbortError' ? 'timeout' : `fetch failed: ${e && e.message}`;
  }
  return out;
}

/** Scrape the search results page: the pick card + first card. */
async function readSearchPage(page, locale, query) {
  await page.goto(`${BASE}/${locale}/search?q=${encodeURIComponent(query)}`, {
    waitUntil: 'domcontentloaded', timeout: 90000,
  });
  await page.waitForSelector('a[href*="/compare/"], a[href*="/products/"], main', { timeout: 45000 }).catch(() => null);
  // Client-rendered results: give the fetch + paint a moment to settle.
  await new Promise((r) => setTimeout(r, 3500));

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

async function journey(page, locale, query) {
  const row = {
    query, locale,
    relevant: false, sensiblePick: false, storeVisible: false,
    priceConsistent: false, linkLands: false, pass: false,
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
  } else if (!pick.href) {
    // Single-store product: there is no second surface, so no price can contradict.
    // Recorded explicitly so a vacuous pass is never mistaken for a verified comparison.
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
    const dest = await checkDestination(target);
    row.linkLands = dest.isProduct;
    row.destination = dest.finalUrl || target;
    if (!dest.isProduct) row.notes.push(`outbound: ${dest.note || 'not a product page'}`);
  }

  row.pass = row.relevant && row.sensiblePick && row.storeVisible && row.priceConsistent && row.linkLands;
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
      const r = await journey(page, locale, q);
      rows.push(r);
      if (!JSON_OUT) {
        process.stdout.write(
          `${r.pass ? 'PASS' : 'FAIL'}  ${locale}  ${q.padEnd(18)} ` +
          `rel=${r.relevant ? 'Y' : 'N'} pick=${r.sensiblePick ? 'Y' : 'N'} store=${r.storeVisible ? 'Y' : 'N'} ` +
          `price=${r.priceConsistent ? 'Y' : 'N'} link=${r.linkLands ? 'Y' : 'N'}` +
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
    cross_language_pick_mismatches: mismatched,
  };

  if (JSON_OUT) { console.log(JSON.stringify({ summary, rows }, null, 2)); return; }
  console.log('\n── SUMMARY ────────────────────────────────');
  console.log(`base: ${summary.base}`);
  console.log(`PASS RATE: ${passed}/${rows.length} = ${rate}%`);
  console.table(summary.by_check);
  if (mismatched.length) {
    console.log(`\nCross-language pick mismatches (${mismatched.length}):`);
    for (const m of mismatched) console.log(`  ${m.query}: ar="${m.ar}"  en="${m.en}"`);
  }
  process.exit(rate === 100 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
