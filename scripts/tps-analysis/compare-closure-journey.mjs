// scripts/tps-analysis/compare-closure-journey.mjs — ADR-389 acceptance journey (production).
// Puppeteer, own Chromium, read-only; every visit carries tw_test=1. Records, per viewport:
// the Samsung search (one card, wording), the LG search pills (eligible vs total), the
// multi-compare with FreshDV+ArtCool (numbers, clipping, truncation, badges), the single pages
// (store name not truncated, brand badge, availability wording), the Samsung product page
// (title, image, badge, reference price label), tray controls, legacy 308, one /go exit, and
// any console/network CORS error the pages themselves emit.
//   node scripts/tps-analysis/compare-closure-journey.mjs <outDir> <tag>
import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'fs';

const [outDir, tag = 'after'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const BASE = 'https://tawveeri.com';
const FRESHDV_KEY = 'lg|split|FreshDV|18000|Inverter|cool_only';
const ARTCOOL_KEY = 'lg|split|ArtCool|18000|Inverter|cool_only';
const LEGACY = `${BASE}/ar/products/samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold`;
const UA_MOBILE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36';
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36';
const log = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, typeof v === 'string' ? v : JSON.stringify(v)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const consoleIssues = [];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--lang=ar-SA'] });
try {
  const newPage = async (width) => {
    const page = await browser.newPage();
    await page.setCookie({ name: 'tw_test', value: '1', domain: 'tawveeri.com', path: '/' });
    await page.setViewport({ width, height: width < 500 ? 844 : 900, deviceScaleFactor: width < 500 ? 2 : 1, isMobile: width < 500, hasTouch: width < 500 });
    await page.setUserAgent(width < 500 ? UA_MOBILE : UA_DESKTOP);
    page.on('console', (m) => { if (m.type() === 'error' || /cors|blocked by/i.test(m.text())) consoleIssues.push({ page: page.url().slice(0, 80), type: m.type(), text: m.text().slice(0, 200) }); });
    page.on('requestfailed', (r) => { if (!/tawveeri\.com/.test(r.url())) consoleIssues.push({ page: page.url().slice(0, 80), failed: r.url().slice(0, 120), reason: r.failure()?.errorText }); });
    return page;
  };
  const pageFacts = (page) => page.evaluate(() => ({
    hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    clientW: document.documentElement.clientWidth, headers: document.querySelectorAll('header').length, mains: document.querySelectorAll('main').length,
  }));
  const visibility = (page) => page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const rect = (el) => el.getBoundingClientRect();
    const clippedBy = (el) => { let p = el.parentElement; const r = rect(el); while (p) { const cs = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX)) { const pr = rect(p); if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5) return true; } p = p.parentElement; } return false; };
    const important = [...document.querySelectorAll('main a, main button, main [data-lowest-badge], main [data-featured-store], main h3')].filter((e) => rect(e).height > 0 && /الأقل سعرًا|عرض المتجر|اذهب إلى|عرض المنتج|كل عروض|متجر النخيل|شاكر|إكسترا|نجم/.test(e.textContent || ''));
    const bad = important.map((e) => ({ text: e.textContent.trim().slice(0, 40), left: Math.round(rect(e).left), right: Math.round(rect(e).right), offscreen: rect(e).left < 0 || rect(e).right > vw + 0.5, clipped: clippedBy(e), truncated: e.matches('p, span, h3') && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis' })).filter((x) => x.offscreen || x.clipped || x.truncated);
    const small = [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 10).map((e) => e.textContent.trim().slice(0, 30));
    return { checked: important.length, problems: bad, fontsUnder10px: small.slice(0, 8) };
  });
  const mainText = (page) => page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\n{2,}/g, '\n').slice(0, 7000));

  // ── 1. Samsung search (real path) ──
  {
    const page = await newPage(390);
    let api = null;
    page.on('response', async (res) => { if (res.url().includes('/api/search') && res.request().method() === 'POST') { try { api = await res.json(); } catch { /* ignore */ } } });
    await page.goto(`${BASE}/ar/search?q=${encodeURIComponent('مكيف سامسونج 18000')}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector('[data-compare-url]', { timeout: 60000 }).catch(() => null);
    await sleep(1200);
    await page.screenshot({ path: `${outDir}/samsung-search-390-${tag}.png`, fullPage: true });
    const info = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-compare-url]')].filter((c) => c.querySelector('button[aria-pressed]'));
      const pick = document.querySelector('[data-testid="smart-pick"]');
      return {
        productCards: cards.length,
        cardBrandLine: cards[0]?.querySelector('p.t-small')?.textContent?.trim() ?? null,
        cardHasBestBadge: cards.some((c) => /أفضل سعر/.test(c.textContent || '')),
        cardReferencePrice: cards[0]?.querySelector('[data-reference-price]')?.textContent?.trim() ?? null,
        smartPickText: pick ? pick.innerText.replace(/\n+/g, ' | ').slice(0, 300) : null,
        smartPickSaysBest: pick ? /أفضل سعر|أرخص سعر/.test(pick.innerText) : null,
      };
    });
    note('samsung-search', { apiSamsungProducts: (api?.products || []).filter((p) => /سامسونج|samsung/i.test(`${p.name_ar} ${p.name_en}`)).length, ...info });
    await page.close();
  }

  // ── 2. LG search: pills (eligible vs total) ──
  {
    const page = await newPage(390);
    await page.goto(`${BASE}/ar/search?q=${encodeURIComponent('مكيف LG 18000')}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector('[data-compare-url]', { timeout: 60000 }).catch(() => null);
    await sleep(1200);
    const pills = await page.evaluate(() => [...document.querySelectorAll('[data-compare-url]')].filter((c) => c.querySelector('button[aria-pressed]')).slice(0, 6).map((c) => ({
      name: c.querySelector('h3')?.textContent?.trim().slice(0, 50), pill: c.querySelector('[data-eligible-stores]')?.textContent?.trim() ?? null,
      eligible: c.querySelector('[data-eligible-stores]')?.getAttribute('data-eligible-stores') ?? null, total: c.querySelector('[data-eligible-stores]')?.getAttribute('data-total-stores') ?? null,
      bestBadge: /أفضل سعر/.test(c.textContent || ''), refPrice: c.querySelector('[data-reference-price]')?.textContent?.trim() ?? null,
    })));
    note('lg-search-pills', pills);
    await page.screenshot({ path: `${outDir}/lg-search-390-${tag}.png`, fullPage: false });

    // ── 3. add FreshDV + ArtCool → multi-compare (390/430/1280), reload ──
    const added = await page.evaluate(() => ['FreshDV', 'ArtCool'].map((n) => { const c = [...document.querySelectorAll('[data-compare-url]')].find((x) => (x.getAttribute('data-compare-url') || '').includes(n) && x.querySelector('button[aria-pressed]')); const b = c?.querySelector('button[aria-pressed="false"]'); if (b) { b.click(); return { n, ok: true }; } return { n, ok: false }; }));
    note('journey-add-to-compare', added);
    await sleep(1200);
    const tray = await page.evaluate(() => { const t = document.querySelector('[aria-label="لوحة المقارنة"]'); if (!t) return null; const r = t.getBoundingClientRect(); const btns = [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.getBoundingClientRect()).filter((b) => b.height > 0 && b.top < window.innerHeight && b.bottom > 0); return { links: [...t.querySelectorAll('a')].map((a) => a.getAttribute('href')), trayTop: Math.round(r.top), visibleButtonsUnderTray: btns.filter((b) => b.bottom > r.top).length }; });
    note('journey-tray', tray);
    // minimized pill vs. buttons
    await page.evaluate(() => document.querySelector('button[aria-label="تصغير لوحة المقارنة"]')?.click());
    await sleep(400);
    const trayMin = await page.evaluate(() => { const pill = document.querySelector('button[aria-label="إظهار لوحة المقارنة"]'); if (!pill) return null; const r = pill.getBoundingClientRect(); const overl = [...document.querySelectorAll('a,button')].filter((e) => e !== pill && !pill.contains(e) && e.getBoundingClientRect().height > 0).map((e) => ({ e, b: e.getBoundingClientRect() })).filter(({ b }) => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top).map(({ e }) => e.textContent.trim().slice(0, 30)); return { pill: { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }, overlappingControls: overl }; });
    note('tray-minimized-overlap', trayMin);
    await page.screenshot({ path: `${outDir}/tray-minimized-390-${tag}.png`, fullPage: false });
    await page.evaluate(() => document.querySelector('button[aria-label="إظهار لوحة المقارنة"]')?.click());
    await sleep(300);

    const multi = {};
    for (const [w, label] of [[390, 'first'], [390, 'reload'], [430, 'reload'], [1280, 'reload']]) {
      await page.setViewport({ width: w, height: w < 500 ? 844 : 900, deviceScaleFactor: w < 500 ? 2 : 1, isMobile: w < 500, hasTouch: w < 500 });
      if (label === 'first') await page.goto(`${BASE}/ar/compare`, { waitUntil: 'networkidle2', timeout: 120000 }); else await page.reload({ waitUntil: 'networkidle2', timeout: 120000 });
      await sleep(2500);
      await page.screenshot({ path: `${outDir}/multi-compare-${w}-${label}-${tag}.png`, fullPage: true });
      const text = await mainText(page);
      const rows = (re) => text.match(re)?.[0]?.replace(/\n/g, ' | ') ?? null;
      const facts = await pageFacts(page);
      multi[`${w}-${label}`] = {
        ...facts, columns: await page.evaluate(() => [...document.querySelectorAll('main h3')].map((h) => h.textContent?.trim().slice(0, 60))),
        stores: rows(/المتاجر\n[^\n]*\n[^\n]*\n?[^\n]*/), spread: rows(/فرق السعر بين المتاجر\n[^\n]*\n[^\n]*/), observed: rows(/آخر رصد\n[^\n]*\n[^\n]*/),
        strikethrough: await page.evaluate(() => document.querySelectorAll('main .line-through').length),
        referencePrices: await page.evaluate(() => document.querySelectorAll('main [data-reference-price]').length),
        allOffersLinks: await page.evaluate(() => [...document.querySelectorAll('[data-all-offers-link]')].map((a) => `${a.textContent.trim()} → ${a.getAttribute('href')}`)),
        servicesUnknownRow: await page.evaluate(() => document.querySelector('[data-services-unknown]')?.textContent?.trim() ?? null),
        refreshFailed: await page.evaluate(() => document.querySelectorAll('[data-refresh-failed]').length),
        visibility: await visibility(page),
        excerpt: text.slice(0, 1800),
      };
      note(`multi-compare@${w}-${label}`, multi[`${w}-${label}`]);
    }
    // tray controls: remove one, clear
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/ar/search?q=${encodeURIComponent('مكيف LG 18000')}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector('[aria-label="لوحة المقارنة"]', { timeout: 30000 }).catch(() => null);
    const controls = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const count = () => JSON.parse(localStorage.getItem('compare_products') || '[]').length;
      const before = count();
      const removeBtn = document.querySelector('[aria-label="لوحة المقارنة"] button[aria-label^="إزالة"], [aria-label="لوحة المقارنة"] button[aria-label*="إزالة"]');
      removeBtn?.click(); await sleep(400);
      const afterRemove = count();
      document.querySelector('button[aria-label="تصغير لوحة المقارنة"]')?.click(); await sleep(300);
      const minimized = !!document.querySelector('button[aria-label="إظهار لوحة المقارنة"]');
      document.querySelector('button[aria-label="إظهار لوحة المقارنة"]')?.click(); await sleep(300);
      const restored = !!document.querySelector('[aria-label="لوحة المقارنة"]');
      document.querySelector('button[aria-label="مسح الكل"]')?.click(); await sleep(400);
      return { before, afterRemove, removeButtonFound: !!removeBtn, minimized, restored, trayGone: !document.querySelector('[aria-label="لوحة المقارنة"]'), idsAfterClear: localStorage.getItem('compare_products') };
    });
    note('tray-controls', controls);
    await page.close();
  }

  // ── 4. Single compare pages ──
  for (const [name, key] of [['freshdv', FRESHDV_KEY], ['artcool', ARTCOOL_KEY]]) {
    for (const w of [390, 1280]) {
      const page = await newPage(w);
      await page.goto(`${BASE}/ar/compare/${encodeURIComponent(key)}`, { waitUntil: 'networkidle2', timeout: 120000 });
      await sleep(800);
      await page.screenshot({ path: `${outDir}/compare-${name}-${w}-${tag}.png`, fullPage: true });
      const info = await page.evaluate(() => {
        const s = document.querySelector('section[aria-label="العرض المقترح"]');
        const featuredStore = document.querySelector('[data-featured-store]');
        const badges = [...document.querySelectorAll('section[aria-label="المنتج"] [class*="badge"], section[aria-label="المنتج"] span')].map((b) => b.textContent.trim()).filter((t) => t && t.length < 30).slice(0, 6);
        const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((x) => { try { return JSON.parse(x.textContent || ''); } catch { return null; } }).find((j) => j && j['@type'] === 'Product');
        return {
          featured: s ? s.innerText.replace(/\n+/g, ' | ').slice(0, 260) : null,
          featuredStoreName: featuredStore?.textContent?.trim() ?? null,
          featuredStoreTruncated: featuredStore ? featuredStore.scrollWidth > featuredStore.clientWidth + 1 : null,
          identityBadges: badges,
          availabilityLines: [...document.querySelectorAll('main li span')].map((e) => e.textContent.trim()).filter((t) => /التوفر غير مذكور|متوفر|غير متوفر/.test(t)).slice(0, 8),
          jsonldAvailability: jsonld?.offers?.offers?.map((o) => o.availability ?? '(none)') ?? null,
          eligibleHeading: (document.body.innerText.match(/العروض الداخلة في المقارنة[^\n]*/) || [null])[0],
        };
      });
      note(`compare-${name}@${w}`, { ...(await pageFacts(page)), ...info, visibility: await visibility(page) });
      await page.close();
    }
  }

  // ── 5. Samsung product page via legacy slug ──
  {
    const page = await newPage(390);
    const res = await page.goto(LEGACY, { waitUntil: 'networkidle2', timeout: 120000 });
    const chain = res?.request().redirectChain().map((r) => `${r.response()?.status()} ${r.url()}`);
    await sleep(1200);
    await page.screenshot({ path: `${outDir}/product-samsung-390-${tag}.png`, fullPage: true });
    const info = await page.evaluate(() => ({
      h1: document.querySelector('main h1')?.textContent?.trim() ?? null,
      merchantTitle: document.querySelector('[data-merchant-title]')?.textContent?.trim() ?? null,
      heroImage: (() => { const img = document.querySelector('main img'); return img ? { src: (img.getAttribute('src') || '').slice(0, 100), natural: img.naturalWidth } : null; })(),
      singleStoreNotice: (document.body.innerText.match(/متجر واحد[^\n]*/g) || []),
      bestBadge: /أفضل سعر/.test(document.querySelector('main')?.innerText || ''),
      referencePrices: [...document.querySelectorAll('main [data-reference-price]')].map((e) => e.textContent.trim()).slice(0, 3),
      bareStrikethrough: document.querySelectorAll('main .line-through:not([data-reference-price] *)').length,
      title: document.title,
    }));
    note('product-samsung', { finalStatus: res?.status(), chain, ...(await pageFacts(page)), ...info });
    await page.close();
  }

  // ── 6. One deliberate exit: featured CTA on FreshDV → /go → merchant (no purchase) ──
  {
    const page = await newPage(390);
    await page.goto(`${BASE}/ar/compare/${encodeURIComponent(FRESHDV_KEY)}`, { waitUntil: 'networkidle2', timeout: 120000 });
    const featured = await page.evaluate(() => { const s = document.querySelector('section[aria-label="العرض المقترح"]'); const a = s?.querySelector('a[href^="/go/"]'); return a ? { href: a.getAttribute('href'), text: a.textContent?.trim() } : null; });
    note('journey-featured-cta', featured);
    // hover/focus must not produce any outbound request
    const before = consoleIssues.length;
    await page.hover('section[aria-label="العرض المقترح"] a[href^="/go/"]').catch(() => null);
    await sleep(1500);
    note('hover-no-outbound', { newIssues: consoleIssues.slice(before) });
    if (featured?.href) {
      const goRes = await fetch(new URL(featured.href, BASE), { redirect: 'manual', headers: { 'user-agent': UA_MOBILE, cookie: 'tw_test=1' } });
      const loc = goRes.headers.get('location');
      note('journey-go', { status: goRes.status, location: loc });
      if (loc) { try { const m = await fetch(loc, { redirect: 'follow', headers: { 'user-agent': UA_DESKTOP } }); note('journey-merchant', { status: m.status, url: m.url }); } catch (e) { note('journey-merchant', { error: String(e).slice(0, 120) }); } }
    }
    await page.close();
  }
  note('console-and-network-issues', consoleIssues.slice(0, 30));
} finally {
  await browser.close();
  writeFileSync(`${outDir}/closure-log-${tag}.json`, JSON.stringify({ at: new Date().toISOString(), tag, log }, null, 1));
}
