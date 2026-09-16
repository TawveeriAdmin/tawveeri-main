const fs = require('fs');
const puppeteer = require('puppeteer');

async function main() {
  const sample = JSON.parse(fs.readFileSync('docs/evidence/samsung-coverage-before-2026-09-16.json')).queries.sample.rows;
  const result = { measured_at: new Date().toISOString(), method: 'Independent browser reads of the same frozen ten Samsung source pages; no cart or purchase actions.', rows: [] };
  const browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });
    for (const row of sample) {
      try {
        const response = await page.goto(row.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));
        const rendered = await page.evaluate(() => ({
          title: document.title,
          headings: [...document.querySelectorAll('h1')].map(e => e.innerText),
          priceTexts: [...document.querySelectorAll('[class*="price"]')].filter(e => e.getClientRects().length && /\d/.test(e.innerText)).map(e => e.innerText.trim()).filter(s => s.length < 500).slice(0, 30),
          actions: [...document.querySelectorAll('button, a')].filter(e => e.getClientRects().length && /buy now|add to cart|out of stock|notify me|where to buy/i.test(e.innerText)).map(e => ({ text: e.innerText.trim(), disabled: !!e.disabled })).slice(0, 15),
        }));
        result.rows.push({ url: row.url, stored_price: row.price, status: response.status(), final_url: page.url(), measured_at: new Date().toISOString(), ...rendered });
        console.log(row.category, response.status(), JSON.stringify(rendered.priceTexts).slice(0, 300));
      } catch (e) { result.rows.push({ url: row.url, error: e.message }); }
      fs.writeFileSync('docs/evidence/samsung-source-browser-2026-09-16.json', JSON.stringify(result, null, 2) + '\n');
    }
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
