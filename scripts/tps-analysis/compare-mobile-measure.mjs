// Read-only live measurement of clipping/overflow at 390/430 on production (tw_test tagged).
import puppeteer from 'puppeteer';
const BASE = 'https://tawveeri.com';
const [outDir = 'C:/Users/Hp/AppData/Local/Temp/claude/c--Users-Hp-Downloads-Tawveeri-Official/f8494402-f817-4407-b594-62253acd3dab/scratchpad', tag = 'probe'] = process.argv.slice(2);
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--lang=ar-SA'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
await page.setCookie({ name: 'tw_test', value: '1', domain: 'tawveeri.com', path: '/' });
const measure = () => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const clippedBy = (el) => { // nearest ancestor with overflow hidden/auto that cuts el
    let p = el.parentElement; const r = el.getBoundingClientRect();
    while (p) { const cs = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const pr = p.getBoundingClientRect(); if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5) return { by: p.className.slice(0, 60), pl: Math.round(pr.left), pr: Math.round(pr.right) }; } p = p.parentElement; }
    return null;
  };
  const textOverflow = (el) => ({ scrollW: el.scrollWidth, clientW: el.clientWidth, truncated: el.scrollWidth > el.clientWidth + 1, text: el.textContent.trim().slice(0, 40) });
  const out = { vw };
  const badges = [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && /الأقل سعرًا بين المختارة/.test(e.textContent || ''));
  out.badges = badges.map((b) => ({ ...rect(b), offscreen: b.getBoundingClientRect().left < 0 || b.getBoundingClientRect().right > vw, clip: clippedBy(b), ...textOverflow(b) }));
  const btns = [...document.querySelectorAll('main a, main button')].filter((e) => /عرض المتجر|اذهب إلى|عرض المنتج/.test(e.textContent || ''));
  out.buttons = btns.map((b) => ({ ...rect(b), offscreen: b.getBoundingClientRect().left < 0 || b.getBoundingClientRect().right > vw, clip: clippedBy(b), text: b.textContent.trim().slice(0, 30) }));
  const names = [...document.querySelectorAll('main p.truncate, main span.truncate, main h3')];
  out.truncated = names.map(textOverflow).filter((t) => t.truncated);
  const scroller = document.querySelector('main .overflow-x-auto');
  out.tableScroll = scroller ? { scrollW: scroller.scrollWidth, clientW: scroller.clientWidth } : null;
  const smallFonts = [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).length;
  out.textUnder11px = smallFonts;
  return out;
});
const results = {};
for (const w of [390, 430]) {
  await page.setViewport({ width: w, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  // multi-compare with two items: seed via search adds
  await page.goto(`${BASE}/ar/search?q=${encodeURIComponent('مكيف LG 18000')}`, { waitUntil: 'networkidle2', timeout: 120000 });
  await page.waitForSelector('[data-compare-url]', { timeout: 60000 }).catch(() => null);
  await sleep(800);
  await page.evaluate(() => { for (const n of ['FreshDV', 'ArtCool']) { const c = [...document.querySelectorAll('[data-compare-url]')].find((x) => (x.getAttribute('data-compare-url') || '').includes(n) && x.querySelector('button[aria-pressed]')); c?.querySelector('button[aria-pressed="false"]')?.click(); } });
  await sleep(600);
  // minimized tray vs buttons
  await page.evaluate(() => document.querySelector('button[aria-label="تصغير لوحة المقارنة"]')?.click());
  await sleep(400);
  const trayMin = await page.evaluate(() => { const pill = document.querySelector('button[aria-label="إظهار لوحة المقارنة"]'); if (!pill) return null; const r = pill.getBoundingClientRect(); const overl = [...document.querySelectorAll('a,button')].filter((e) => e !== pill && !pill.contains(e) && e.getBoundingClientRect().height > 0).map((e) => ({ e, b: e.getBoundingClientRect() })).filter(({ b }) => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top).map(({ e }) => e.textContent.trim().slice(0, 30)); return { pill: { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }, overlapping: overl }; });
  await page.goto(`${BASE}/ar/compare`, { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(2500);
  const m = await measure();
  await page.screenshot({ path: `${outDir}/multi-${w}-${tag}.png`, clip: { x: 0, y: 150, width: w, height: 700 } });
  await page.goto(`${BASE}/ar/compare/${encodeURIComponent('lg|split|FreshDV|18000|Inverter|cool_only')}`, { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(800);
  const s = await measure();
  await page.screenshot({ path: `${outDir}/single-${w}-${tag}.png`, clip: { x: 0, y: 150, width: w, height: 600 } });
  results[w] = { trayMin, multi: m, single: s };
  await page.evaluate(() => localStorage.clear());
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
