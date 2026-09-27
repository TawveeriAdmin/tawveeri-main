const puppeteer = require('puppeteer');
const fs = require('fs');
const base = process.env.HOME_BASE || 'https://tawveeri.com';
const stage = process.env.HOME_STAGE || 'before';
const dir = 'docs/evidence/home-card-refinement-2026-09-27';
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--lang=ar'] });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => localStorage.setItem('tw_test', '1'));
    const results = [];
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width, height: width === 1440 ? 1000 : 844, deviceScaleFactor: 1 });
      const response = await page.goto(`${base}/ar?test=1`, { waitUntil: 'networkidle2', timeout: 90000 });
      const card = await page.waitForSelector('[data-home-entry="homepage_card"]');
      await card.screenshot({ path: `${dir}/${stage}-${width}.png` });
      const layout = await card.evaluate(el => {
        const label = el.firstElementChild;
        const title = el.querySelector('h2');
        return { text: el.innerText, labelFont: getComputedStyle(label).fontSize, titleFont: getComputedStyle(title).fontSize, pageOverflow: document.documentElement.scrollWidth > innerWidth, overflowingElements: [...el.querySelectorAll('*')].filter(n => n.scrollWidth > n.clientWidth + 1 && n.clientWidth > 0).map(n => n.tagName), title: title.textContent };
      });
      results.push({ width, status: response.status(), ...layout });
    }
    fs.writeFileSync(`${dir}/${stage}.json`, JSON.stringify({ base, capturedAt: new Date().toISOString(), results }, null, 2));
    console.log(results);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
