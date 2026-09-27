// Public documentation only. No login, cart mutation, purchase, or account reuse.
const puppeteer = require('puppeteer');
const fs = require('fs');
const dir = 'docs/evidence/home-card-refinement-2026-09-27';
const urls = [
  ['amazon-list', 'https://www.amazon.sa/hz/wishlist/intro'],
  ['amazon-legacy-doc', 'https://webservices.amazon.com/paapi5/documentation/add-to-cart-form.html'],
  ['noon-attribution', 'https://affiliates.noon.com/en/questions?category=commission'],
  ['samsung-order-help', 'https://www.samsung.com/sa_en/shop-faq/products-and-orders/How-do-i-place-an-order.html'],
];
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];
  try {
    for (const [name, url] of urls) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
        if (name === 'noon-attribution') {
          await page.waitForSelector('h3', { timeout: 10000 });
          await page.evaluate(() => {
            const heading = [...document.querySelectorAll('h3')].find(n => n.textContent.includes('orders tracked'));
            heading?.click();
          });
        }
        const text = await page.evaluate(() => document.body.innerText);
        const snippets = text.split('\n').filter(line => /attribut|tracked|cookie|wish|list|cart|deprecated|forbidden|sign.in|place an order|access denied/i.test(line)).join(' ').split(/\s+/).slice(0, 20).join(' ');
        results.push({ name, requested: url, final: page.url(), status: response.status(), title: await page.title(), snippets });
        await page.screenshot({ path: `${dir}/research-${name}.png`, fullPage: false });
      } catch (error) { results.push({ name, requested: url, error: error.message }); }
      await page.close();
    }
    fs.writeFileSync(`${dir}/public-doc-probes.json`, JSON.stringify({ checkedAt: new Date().toISOString(), authenticated: false, cartWrites: false, results }, null, 2));
    console.log(results);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
