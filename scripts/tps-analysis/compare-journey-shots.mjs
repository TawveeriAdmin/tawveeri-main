// scripts/tps-analysis/compare-journey-shots.mjs — ADR-387 live journey + screenshot harness.
// Runs against PRODUCTION with Puppeteer (its own Chromium instance, closed at exit — never
// touches any other browser process). Read-only: navigates, screenshots, follows /go with
// redirect=manual, and clicks only the compare tray's own controls.
//   node scripts/tps-analysis/compare-journey-shots.mjs <outDir> <tag>
import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'fs';

const [outDir, tag = 'after'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const BASE = 'https://tawveeri.com';
const FRESHDV = `${BASE}/ar/compare/lg%7Csplit%7CFreshDV%7C18000%7CInverter%7Ccool_only`;
const ARTCOOL = `${BASE}/ar/compare/lg%7Csplit%7CArtCool%7C18000%7CInverter%7Ccool_only`;
const SAMSUNG = `${BASE}/ar/products/c938d587-65b2-4474-8a51-507060668aa0`;
const LEGACY = `${BASE}/ar/products/samsung-split-ac-18000-btu-rotary-compressor-heat-and-cold`;
const log = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, typeof v === 'string' ? v : JSON.stringify(v)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--lang=ar-SA'] });
try {
  const shot = async (url, name, width, height = 900, full = true) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 500, hasTouch: width < 500 });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36');
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(1200);
    await page.screenshot({ path: `${outDir}/${name}-${width}-${tag}.png`, fullPage: full });
    const info = await page.evaluate(() => ({ title: document.title, headers: document.querySelectorAll('header').length, mains: document.querySelectorAll('main').length, hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
    note(`${name}@${width}`, { status: res?.status(), ...info });
    return page;
  };

  // 1. Compare pages — mobile 390 / 430, desktop 1280
  for (const w of [390, 430, 1280]) { (await shot(FRESHDV, 'compare-freshdv', w)).close(); }
  for (const w of [390, 1280]) { (await shot(ARTCOOL, 'compare-artcool', w)).close(); }

  // 2. Product page (Samsung) + legacy URL redirect
  (await shot(SAMSUNG, 'product-samsung', 390)).close();
  {
    const page = await browser.newPage();
    const res = await page.goto(LEGACY, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const chain = res?.request().redirectChain().map((r) => `${r.response()?.status()} ${r.url()}`);
    note('legacy-redirect', { finalStatus: res?.status(), finalUrl: page.url(), chain });
    await page.close();
  }

  // 3. Full journey: search → compare → featured offer → /go → merchant
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/ar/search?q=${encodeURIComponent('مكيف LG')}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('a[href*="/compare/"]', { timeout: 60000 }).catch(() => null);
    await sleep(1500);
    await page.screenshot({ path: `${outDir}/journey-1-search-390-${tag}.png`, fullPage: false });
    const compareHref = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/compare/"]')].find((x) => /FreshDV/i.test(x.getAttribute('href') || '')); return a ? a.getAttribute('href') : null; });
    note('journey-compare-link-on-search', compareHref);
    if (compareHref) {
      await page.goto(new URL(compareHref, BASE).toString(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.screenshot({ path: `${outDir}/journey-2-compare-390-${tag}.png`, fullPage: false });
      const featured = await page.evaluate(() => { const s = document.querySelector('section[aria-label]'); const a = s?.querySelector('a[href^="/go/"]'); return a ? { href: a.getAttribute('href'), text: a.textContent?.trim() } : null; });
      note('journey-featured-cta', featured);
      if (featured?.href) {
        const goRes = await fetch(new URL(featured.href, BASE), { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0' } });
        const loc = goRes.headers.get('location');
        note('journey-go', { status: goRes.status, location: loc });
        if (loc) {
          try { const m = await fetch(loc, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131' } }); note('journey-merchant', { status: m.status, url: m.url }); }
          catch (e) { note('journey-merchant', { error: String(e).slice(0, 120) }); }
        }
      }
    }
    // 4. Tray: add two items to compare on the search page, screenshot tray, minimize, restore, clear
    await page.goto(`${BASE}/ar/search?q=${encodeURIComponent('مكيف LG')}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('button[aria-pressed][aria-label*="للمقارنة"]', { timeout: 60000 }).catch(() => null);
    await sleep(800);
    const clicked = await page.evaluate(() => { const btns = [...document.querySelectorAll('button[aria-pressed][aria-label*="للمقارنة"]')].slice(0, 2); btns.forEach((b) => b.click()); return btns.map((b) => b.getAttribute('aria-label')); });
    note('tray-add-clicked', clicked);
    await sleep(1500);
    await page.screenshot({ path: `${outDir}/journey-3-tray-390-${tag}.png`, fullPage: false });
    const trayLinks = await page.evaluate(() => [...document.querySelectorAll('[aria-label="لوحة المقارنة"] a')].map((a) => a.getAttribute('href')));
    note('tray-links', trayLinks);
    const trayCoversButton = await page.evaluate(() => {
      const tray = document.querySelector('[aria-label="لوحة المقارنة"]'); if (!tray) return null;
      const t = tray.getBoundingClientRect();
      const btns = [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.getBoundingClientRect()).filter((r) => r.height > 0 && r.top < window.innerHeight && r.bottom > 0);
      return { trayTop: Math.round(t.top), viewportH: window.innerHeight, visibleButtonsUnderTray: btns.filter((r) => r.bottom > t.top).length, visibleButtons: btns.length };
    });
    note('tray-overlap', trayCoversButton);
    const minimized = await page.evaluate(() => { const b = document.querySelector('button[aria-label="تصغير لوحة المقارنة"]'); if (!b) return false; b.click(); return true; });
    await sleep(600);
    await page.screenshot({ path: `${outDir}/journey-4-tray-minimized-390-${tag}.png`, fullPage: false });
    const restored = await page.evaluate(() => { const b = document.querySelector('button[aria-label="إظهار لوحة المقارنة"]'); if (!b) return false; b.click(); return true; });
    await sleep(600);
    const cleared = await page.evaluate(() => { const b = document.querySelector('button[aria-label="مسح الكل"]'); if (!b) return false; b.click(); return true; });
    await sleep(600);
    const trayGone = await page.evaluate(() => !document.querySelector('[aria-label="لوحة المقارنة"]'));
    note('tray-minimize-restore-clear', { minimized, restored, cleared, trayGone });
    // 5. Tray link resolves (first item) — status of the destination
    if (trayLinks[0]) {
      const r = await fetch(new URL(trayLinks[0], BASE), { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
      note('tray-first-link-status', { status: r.status, url: r.url });
    }
    // 6. Multi-compare page at 390 with two items (re-add)
    await page.evaluate(() => { const btns = [...document.querySelectorAll('button[aria-pressed][aria-label*="للمقارنة"]')].slice(0, 2); btns.forEach((b) => b.click()); });
    await sleep(800);
    await page.goto(`${BASE}/ar/compare`, { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(1500);
    await page.screenshot({ path: `${outDir}/journey-5-multi-compare-390-${tag}.png`, fullPage: true });
    const mc = await page.evaluate(() => ({ hasHorizontalPageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, products: document.querySelectorAll('h3').length }));
    note('multi-compare@390', mc);
    await page.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${outDir}/journey-log-${tag}.json`, JSON.stringify({ at: new Date().toISOString(), tag, log }, null, 1));
}
