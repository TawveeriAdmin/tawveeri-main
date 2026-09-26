// scripts/tps-analysis/compare-gaps-journey.mjs — ADR-388 live journey + screenshot harness.
// Runs against PRODUCTION with Puppeteer (its own Chromium instance, closed at exit — never
// touches any other browser process). Read-only: navigates, screenshots, follows one /go with
// redirect=manual, clicks only the cards' own "add to compare" buttons and the tray controls.
// Every page visit carries the `tw_test=1` cookie so the visit is tagged as a test, never as
// a real shopper (the /go route, the search route and the home page all read that cookie).
//   node scripts/tps-analysis/compare-gaps-journey.mjs <outDir> <tag>
import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'fs';

const [outDir, tag = 'after'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const BASE = 'https://tawveeri.com';
const FRESHDV_KEY = 'lg|split|FreshDV|18000|Inverter|cool_only';
const ARTCOOL_KEY = 'lg|split|ArtCool|18000|Inverter|cool_only';
const FRESHDV = `${BASE}/ar/compare/${encodeURIComponent(FRESHDV_KEY)}`;
const ARTCOOL = `${BASE}/ar/compare/${encodeURIComponent(ARTCOOL_KEY)}`;
const LEGACY = `${BASE}/ar/products/samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold`;
const SAMSUNG_Q = 'مكيف سامسونج 18000';
const LG_Q = 'مكيف LG 18000';
const UA_MOBILE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36';
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36';
const log = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, typeof v === 'string' ? v : JSON.stringify(v)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--lang=ar-SA'] });
try {
  const newPage = async (width, height = width < 500 ? 844 : 900) => {
    const page = await browser.newPage();
    await page.setCookie({ name: 'tw_test', value: '1', domain: 'tawveeri.com', path: '/' });
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 500, hasTouch: width < 500 });
    await page.setUserAgent(width < 500 ? UA_MOBILE : UA_DESKTOP);
    return page;
  };
  const pageFacts = (page) => page.evaluate(() => ({
    title: document.title,
    headers: document.querySelectorAll('header').length,
    mains: document.querySelectorAll('main').length,
    hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
  }));
  const mainText = (page) => page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\n{2,}/g, '\n').slice(0, 6000));

  // ── 1. Samsung search: how many cards for the one Extra listing? (real path, fresh session, no cache)
  {
    const page = await newPage(390);
    let apiPayload = null;
    page.on('response', async (res) => {
      if (res.url().includes('/api/search') && res.request().method() === 'POST') {
        try { apiPayload = await res.json(); } catch { /* ignore */ }
      }
    });
    await page.goto(`${BASE}/ar/search?q=${encodeURIComponent(SAMSUNG_Q)}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector('[data-compare-url]', { timeout: 60000 }).catch(() => null);
    await sleep(1500);
    await page.screenshot({ path: `${outDir}/samsung-search-390-${tag}.png`, fullPage: true });
    const cards = await page.evaluate(() => [...document.querySelectorAll('[data-compare-url]')].map((c) => ({
      text: (c.querySelector('h3, h2, [class*="title"]')?.textContent || c.textContent || '').trim().slice(0, 90),
      compare: c.getAttribute('data-compare-url'),
      hasGo: !!c.querySelector('a[href^="/go/"]'),
      hasExternal: !!c.querySelector('a[target="_blank"]'),
      noLinkNotice: /رابط المتجر غير متاح/.test(c.textContent || ''),
      hasImage: !!c.querySelector('img[src*="http"], img[srcset]'),
    })));
    const samsungCards = cards.filter((c) => /سامسونج|samsung/i.test(c.text));
    const apiSamsung = (apiPayload?.products || []).filter((p) => /سامسونج|samsung/i.test(`${p.name_ar} ${p.name_en}`)).map((p) => ({
      id: p.id ?? p.product_id, slug: p.product_slug ?? p.slug, key: p.tps_identity_key ?? null, name_ar: p.name_ar,
      stores: (p.stores || p.product_stores || []).map((s) => ({ store: s.store ?? s.stores?.id, price: s.current_price, url: (s.product_url || '').slice(0, 70), obs: s.observed_at ?? null })),
    }));
    note('samsung-search', { domCardsTotal: cards.length, samsungDomCards: samsungCards.length, samsungCards, apiSamsungCount: apiSamsung.length, apiSamsung });
    await page.close();
  }

  // ── 2. The two compare pages (single-product, multi-store) — text + screenshots
  const single = {};
  for (const [name, url, key] of [['freshdv', FRESHDV, FRESHDV_KEY], ['artcool', ARTCOOL, ARTCOOL_KEY]]) {
    for (const w of [390, 1280]) {
      const page = await newPage(w);
      const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
      await sleep(1000);
      await page.screenshot({ path: `${outDir}/compare-${name}-${w}-${tag}.png`, fullPage: true });
      const facts = await pageFacts(page);
      if (w === 390) {
        const text = await mainText(page);
        const eligibleHeading = text.match(/العروض الداخلة في المقارنة[^\n]*/)?.[0] ?? null;
        const olderHeading = text.match(/(أسعار أقدم|خارج المقارنة)[^\n]*/)?.[0] ?? null;
        const featured = await page.evaluate(() => {
          const s = document.querySelector('section[aria-label="العرض المقترح"]');
          return s ? s.innerText.replace(/\n+/g, ' | ').slice(0, 400) : null;
        });
        const jsonld = await page.evaluate(() => { const el = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent || ''); } catch { return null; } }).find((j) => j && j['@type'] === 'Product'); return el ? { low: el.offers?.lowPrice, high: el.offers?.highPrice, count: el.offers?.offerCount } : null; });
        single[name] = { key, status: res?.status(), eligibleHeading, olderHeading, featured, jsonld };
        note(`compare-${name}@390`, { ...facts, ...single[name] });
      } else note(`compare-${name}@${w}`, facts);
      await page.close();
    }
  }
  // API view of the same two identities (the same derivation the page uses)
  for (const [name, key] of [['freshdv', FRESHDV_KEY], ['artcool', ARTCOOL_KEY]]) {
    const r = await fetch(`${BASE}/api/compare?key=${encodeURIComponent(key)}&locale=ar`, { headers: { cookie: 'tw_test=1', 'user-agent': UA_DESKTOP } });
    const j = await r.json().catch(() => null);
    note(`api-compare-${name}`, j ? { status: r.status, summary: j.summary, offers: (j.offers || []).map((o) => ({ store: o.store_slug, price: o.price, avail: o.availability, obs: o.observed_at, stale: o.stale })) } : { status: r.status });
  }

  // ── 3. Product page for the Samsung listing (via the legacy slug → 308 → real page)
  {
    const page = await newPage(390);
    const res = await page.goto(LEGACY, { waitUntil: 'networkidle2', timeout: 120000 });
    const chain = res?.request().redirectChain().map((r) => `${r.response()?.status()} ${r.url()}`);
    await sleep(800);
    await page.screenshot({ path: `${outDir}/product-samsung-390-${tag}.png`, fullPage: true });
    const text = await mainText(page);
    note('product-samsung', {
      finalStatus: res?.status(), finalUrl: page.url(), chain, ...(await pageFacts(page)),
      singleStoreNotice: /متجر واحد/.test(text), bestPriceBadge: /أفضل سعر/.test(text),
      excerpt: text.match(/(متجر واحد|أفضل سعر|السعر المرصود|رصدناه)[^\n]*/g)?.slice(0, 8) ?? [],
    });
    await page.close();
  }

  // ── 4. The founder's journey: search «مكيف LG 18000» → add FreshDV + ArtCool → /ar/compare → reload
  {
    const page = await newPage(390);
    await page.goto(`${BASE}/ar/search?q=${encodeURIComponent(LG_Q)}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector('[data-compare-url]', { timeout: 60000 }).catch(() => null);
    await sleep(1200);
    const added = await page.evaluate(() => {
      const out = [];
      for (const needle of ['FreshDV', 'ArtCool']) {
        // The Smart Pick card carries data-compare-url too but has no add-to-compare button —
        // pick the PRODUCT card (the one with the button).
        const card = [...document.querySelectorAll('[data-compare-url]')].find((c) => (c.getAttribute('data-compare-url') || '').includes(needle) && c.querySelector('button[aria-pressed]'));
        const btn = card?.querySelector('button[aria-pressed="false"]');
        if (btn) { btn.click(); out.push({ needle, clicked: btn.getAttribute('aria-label'), compare: card.getAttribute('data-compare-url') }); }
        else out.push({ needle, clicked: null, cardFound: !!card });
      }
      return out;
    });
    note('journey-add-to-compare', added);
    await sleep(1500);
    await page.screenshot({ path: `${outDir}/journey-tray-390-${tag}.png`, fullPage: false });
    const tray = await page.evaluate(() => {
      const t = document.querySelector('[aria-label="لوحة المقارنة"]'); if (!t) return null;
      const r = t.getBoundingClientRect();
      const btns = [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.getBoundingClientRect()).filter((b) => b.height > 0 && b.top < window.innerHeight && b.bottom > 0);
      return { links: [...t.querySelectorAll('a')].map((a) => a.getAttribute('href')), trayTop: Math.round(r.top), viewportH: window.innerHeight, visibleButtonsUnderTray: btns.filter((b) => b.bottom > r.top).length };
    });
    note('journey-tray', tray);
    const storage = await page.evaluate(() => ({ ids: JSON.parse(localStorage.getItem('compare_products') || '[]'), cacheKeys: Object.keys(JSON.parse(localStorage.getItem('compare_products_cache') || '{}')) }));
    note('journey-localstorage', storage);

    const readMulti = async (label, w) => {
      await page.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
      await page.goto(`${BASE}/ar/compare`, { waitUntil: 'networkidle2', timeout: 120000 });
      await sleep(2500);
      await page.screenshot({ path: `${outDir}/multi-compare-${w}-${label}-${tag}.png`, fullPage: true });
      const text = await mainText(page);
      const rows = (re) => text.match(re)?.[0] ?? null;
      const facts = await pageFacts(page);
      const columns = await page.evaluate(() => [...document.querySelectorAll('main h3')].map((h) => h.textContent?.trim().slice(0, 80)));
      note(`multi-compare@${w}-${label}`, {
        ...facts, columns,
        storesRow: rows(/المتاجر[^\n]*\n[^\n]*\n?[^\n]*/), spreadRow: rows(/فرق السعر بين المتاجر[^\n]*\n[^\n]*\n?[^\n]*/),
        observedRow: rows(/آخر رصد[^\n]*\n[^\n]*\n?[^\n]*/), bestStoreRow: rows(/أفضل متجر[^\n]*\n[^\n]*\n?[^\n]*/),
        strikethrough: await page.evaluate(() => document.querySelectorAll('main .line-through').length),
        brandLine: rows(/(إل جي|lg)[^\n]{0,40}/i), unknownCells: (text.match(/غير متاح/g) || []).length,
        excerpt: text.slice(0, 2500),
      });
    };
    await readMulti('first', 390);
    await page.reload({ waitUntil: 'networkidle2', timeout: 120000 });
    await sleep(2500);
    await page.screenshot({ path: `${outDir}/multi-compare-390-reloaded-${tag}.png`, fullPage: true });
    note('multi-compare@390-reloaded', { ...(await pageFacts(page)), columns: await page.evaluate(() => [...document.querySelectorAll('main h3')].map((h) => h.textContent?.trim().slice(0, 80))) });
    await readMulti('after-reload', 430);
    await readMulti('after-reload', 1280);

    // Tray controls on the search page: minimize → restore → remove one → clear
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/ar/search?q=${encodeURIComponent(LG_Q)}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector('[aria-label="لوحة المقارنة"]', { timeout: 30000 }).catch(() => null);
    const minimized = await page.evaluate(() => { const b = document.querySelector('button[aria-label="تصغير لوحة المقارنة"]'); if (!b) return false; b.click(); return true; });
    await sleep(500);
    const restored = await page.evaluate(() => { const b = document.querySelector('button[aria-label="إظهار لوحة المقارنة"]'); if (!b) return false; b.click(); return true; });
    await sleep(500);
    const cleared = await page.evaluate(() => { const b = document.querySelector('button[aria-label="مسح الكل"]'); if (!b) return false; b.click(); return true; });
    await sleep(500);
    const trayGone = await page.evaluate(() => !document.querySelector('[aria-label="لوحة المقارنة"]'));
    const idsAfterClear = await page.evaluate(() => localStorage.getItem('compare_products'));
    note('tray-controls', { minimized, restored, cleared, trayGone, idsAfterClear });

    // Old selection shape: ids saved by an older client (no observed_at in cache) → page must still render
    await page.evaluate(() => {
      const cache = JSON.parse(localStorage.getItem('compare_products_cache') || '{}');
      localStorage.setItem('compare_products', JSON.stringify(['00000000-0000-4000-8000-000000000000']));
      localStorage.setItem('compare_products_cache', JSON.stringify(cache));
    });
    await page.goto(`${BASE}/ar/compare`, { waitUntil: 'networkidle2', timeout: 120000 });
    await sleep(2000);
    note('multi-compare-unknown-old-id', { text: (await mainText(page)).slice(0, 300), ...(await pageFacts(page)) });
    await page.close();
  }

  // ── 5. One exit to a store without purchase: featured CTA on FreshDV → /go (302) → merchant (200)
  {
    const page = await newPage(390);
    await page.goto(FRESHDV, { waitUntil: 'networkidle2', timeout: 120000 });
    const featured = await page.evaluate(() => { const s = document.querySelector('section[aria-label="العرض المقترح"]'); const a = s?.querySelector('a[href^="/go/"]'); return a ? { href: a.getAttribute('href'), text: a.textContent?.trim() } : null; });
    note('journey-featured-cta', featured);
    if (featured?.href) {
      const goRes = await fetch(new URL(featured.href, BASE), { redirect: 'manual', headers: { 'user-agent': UA_MOBILE, cookie: 'tw_test=1' } });
      const loc = goRes.headers.get('location');
      note('journey-go', { status: goRes.status, location: loc });
      if (loc) {
        try { const m = await fetch(loc, { redirect: 'follow', headers: { 'user-agent': UA_DESKTOP } }); note('journey-merchant', { status: m.status, url: m.url }); }
        catch (e) { note('journey-merchant', { error: String(e).slice(0, 120) }); }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${outDir}/journey-log-${tag}.json`, JSON.stringify({ at: new Date().toISOString(), tag, log }, null, 1));
}
