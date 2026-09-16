const fs = require('fs');
const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const result = { measured_at: new Date().toISOString(), method: 'Read rendered Samsung retailer label independently; usual harness omits Samsung from FULL_STORE regex. No outbound clicks.', rows: [] };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });
    for (const query of ['QA75QN80HAUXSA', 'SM-X400NZSAMEA']) {
      const url = `https://tawveeri.com/ar/search?q=${encodeURIComponent(query)}`;
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('[data-testid="product-card"][data-best-price]', { timeout: 45000 });
      const cards = await page.evaluate(() => [...document.querySelectorAll('[data-testid="product-card"], [data-testid="smart-pick"]')].map(card => ({
        kind: card.getAttribute('data-testid'),
        price: card.getAttribute('data-best-price'),
        stores: card.getAttribute('data-store-count'),
        text: card.innerText,
        samsung_retailer_label: /سامسونج السعودية|Samsung Saudi|Samsung KSA/i.test(card.innerText),
        links: [...card.querySelectorAll('a[href]')].map(a => ({ text: a.innerText, href: a.getAttribute('href') })),
      })));
      result.rows.push({ query, url, status: response.status(), cards });
      fs.writeFileSync('docs/evidence/samsung-rendered-cards-after-2026-09-16.json', JSON.stringify(result, null, 2) + '\n');
      console.log(query, JSON.stringify(cards.map(c => ({ kind: c.kind, price: c.price, samsung_retailer_label: c.samsung_retailer_label }))));
    }
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
