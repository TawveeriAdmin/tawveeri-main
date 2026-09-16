/* Actual frozen-cohort customer journeys. Read-only: never request /go itself. */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const puppeteer = require('puppeteer');
const arg = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const base = arg('base', 'https://tawveeri.com');
const phase = arg('phase', 'after');
const apiOnly = process.argv.includes('--api-only');
const output = `docs/evidence/samsung-recovery-journeys-${phase}-2026-09-16.json`;
const cohort = JSON.parse(fs.readFileSync('docs/evidence/samsung-recovery-journey-cohort-2026-09-16.json'));
const isSamsung = offer => offer.store === 'samsung_ksa' || offer.store_slug === 'samsung_ksa'
  || /سامسونج السعودية|Samsung Saudi|Samsung KSA/i.test(offer.store_name || offer.store_display_name || '');
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
  return { status: response.status, finalUrl: response.url, text: await response.text() };
}
async function resolveExit(link) {
  const id = link?.match(/\/go\/([0-9a-f-]{36})/i)?.[1];
  if (!id) return link?.startsWith('https://www.samsung.com/') ? link : null;
  const response = await request(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/normalized_product_observations?id=eq.${id}&select=normalized_payload`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (response.status !== 200) throw new Error(`Exit provenance lookup HTTP ${response.status}`);
  return JSON.parse(response.text)[0]?.normalized_payload?._url || null;
}
async function main() {
  const result = { startedAt: new Date().toISOString(), base, phase, apiOnly, cohortFrozenAt: cohort.frozenAt,
    method: 'Real search/compare APIs and rendered pages; merchant destination resolved through the exact NPO UUID without generating an outbound click.', rows: [] };
  const browser = apiOnly ? null : await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = browser ? await browser.newPage() : null;
  if (page) await page.setUserAgent('Mozilla/5.0 (compatible; TawveeriUIJourney/1.0; headless harness; read-only)');
  try {
    for (const item of cohort.rows) {
      const row = { model: item.model, category: item.category, observedAt: new Date().toISOString(),
        sourceAtFreeze: { price: item.sourceProduct.current_price, availability: item.sourceProduct.availability } };
      try {
        const response = await request(`${base}/api/search`, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: item.model, pageSize: 20 }) });
        row.searchStatus = response.status;
        const search = JSON.parse(response.text);
        row.search = (search.products || []).map(product => ({ name: product.name_en, key: product.tps_identity_key,
          compareUrl: product.tps_compare_url, price: product.current_price, stores: (product.stores || [product]).map(offer => ({
            store: offer.store, store_name: offer.store_name, current_price: offer.current_price,
            original_price: offer.original_price, availability: offer.availability, product_url: offer.product_url })) }));
        const exact = row.search.filter(product => product.key === `samsung|MODEL:${item.model}`
          || product.name?.toUpperCase().includes(item.model));
        row.samsungOffers = exact.flatMap(product => product.stores.filter(isSamsung));
        const compare = await request(`${base}/api/compare?key=${encodeURIComponent(`samsung|MODEL:${item.model}`)}&locale=ar`);
        row.compareStatus = compare.status;
        row.comparison = JSON.parse(compare.text);
        if (page) {
          await page.goto(`${base}/ar/search?q=${encodeURIComponent(item.model)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForSelector('[data-testid="product-card"], [data-testid="smart-pick"]', { timeout: 20000 }).catch(() => {});
          row.renderedSearch = await page.evaluate(() => [...document.querySelectorAll('[data-testid="product-card"], [data-testid="smart-pick"]')].map(card => ({
            text: card.innerText, price: card.getAttribute('data-best-price'), stores: card.getAttribute('data-store-count'),
            links: [...card.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
          })));
          if (compare.status === 200) {
            const navigation = await page.goto(`${base}/ar/compare/${encodeURIComponent(`samsung|MODEL:${item.model}`)}`, { waitUntil: 'networkidle2', timeout: 60000 });
            row.renderedComparison = { status: navigation.status(), ...await page.evaluate(() => ({ text: document.body.innerText,
              links: [...document.querySelectorAll('a[href^="/go/"]')].map(a => a.getAttribute('href')) })) };
          }
          const exit = row.samsungOffers[0]?.product_url;
          row.destination = await resolveExit(exit);
          if (row.destination) {
            if (new URL(row.destination).hostname !== 'www.samsung.com') throw new Error('Unexpected Samsung destination host');
            const merchant = await request(row.destination);
            const modelCodes = [...merchant.text.matchAll(/digitalData\.product\.model_code\s*=\s*"([^"]+)"|"presetModel"\s*:\s*"([^"]+)"/g)]
              .map(match => (match[1] || match[2]).replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\\//g, '/'));
            row.merchant = { status: merchant.status, finalUrl: merchant.finalUrl, modelCodes: [...new Set(modelCodes)],
              exactVariantConfirmed: merchant.status === 200 && modelCodes.includes(item.model) };
          }
        }
      } catch (error) { row.error = String(error); }
      result.rows.push(row);
      fs.writeFileSync(output, JSON.stringify(result, null, 2));
      console.log(row.model, row.searchStatus, 'Samsung offers:', row.samsungOffers?.length, row.error || '');
    }
    result.completedAt = new Date().toISOString();
    result.summary = { tested: result.rows.length, searchHttp200: result.rows.filter(r => r.searchStatus === 200).length,
      samsungPresent: result.rows.filter(r => r.samsungOffers?.length).length,
      exactMerchantVariantConfirmed: result.rows.filter(r => r.merchant?.exactVariantConfirmed).length,
      errors: result.rows.filter(r => r.error).length };
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result.summary));
  } finally { await browser?.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
