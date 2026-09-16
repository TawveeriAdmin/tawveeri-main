/* Actual public comparison API census; two concurrent reads, no outbound clicks. */
const fs = require('fs');
const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) || d;
const snapshotPath = arg('snapshot', 'docs/evidence/samsung-recovery-production-commerce-deployed-2026-09-16.json');
const phase = arg('phase', 'final');
const source = require('../../docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath));
const included = new Set(source.models.filter(m => !m.exclusion && m.identity).map(m => m.model));
const cohort = snapshot.models.filter(m => included.has(m.model) && m.status === 'valid' && +m.price > 0
  && ['in_stock', 'limited_stock', 'pre_order'].includes(m.availability));
const file = `docs/evidence/samsung-recovery-comparison-census-${phase}-2026-09-16.json`;
const result = { startedAt: new Date().toISOString(), snapshotPath, snapshotAt: snapshot.observedAt, rows: [] };
let cursor = 0;
async function worker() {
  while (cursor < cohort.length) {
    const m = cohort[cursor++], row = { model: m.model, expectedPrice: +m.price, observedAt: new Date().toISOString() };
    try {
      const response = await fetch(`https://tawveeri.com/api/compare?key=${encodeURIComponent(`samsung|MODEL:${m.model}`)}&locale=ar`,
        { headers: { 'user-agent': 'TawveeriUIJourney/1.0 headless read-only audit' }, signal: AbortSignal.timeout(60000) });
      row.status = response.status;
      const data = await response.json();
      const offers = data.offers || [];
      row.samsung = offers.filter(o => o.store_slug === 'samsung_ksa');
      row.priceMatchesSnapshot = row.samsung.some(o => +o.price === +m.price);
      row.exactCanonical = data.canonical?.tps_identity_key === `samsung|MODEL:${m.model}`;
      row.validExit = row.samsung.length === 1 && /^\/go\/[0-9a-f-]{36}(?:\?|$)/i.test(row.samsung[0].product_url);
      row.neutralPriceOrder = offers.every((o, i) => i === 0 || +offers[i - 1].price <= +o.price);
    } catch (error) { row.error = String(error); }
    result.rows.push(row); fs.writeFileSync(file, JSON.stringify(result, null, 2));
    if (result.rows.length % 25 === 0) console.log(`${result.rows.length}/${cohort.length}`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}
Promise.all([worker(), worker()]).then(() => {
  result.completedAt = new Date().toISOString();
  result.summary = { tested: result.rows.length, http200: result.rows.filter(r => r.status === 200).length,
    exactCanonical: result.rows.filter(r => r.exactCanonical).length,
    singleSamsungOffer: result.rows.filter(r => r.samsung?.length === 1).length,
    priceMatchesSnapshot: result.rows.filter(r => r.priceMatchesSnapshot).length,
    validExit: result.rows.filter(r => r.validExit).length,
    neutralPriceOrder: result.rows.filter(r => r.neutralPriceOrder).length, errors: result.rows.filter(r => r.error).length };
  fs.writeFileSync(file, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result.summary));
}).catch(error => { console.error(error); process.exitCode = 1; });
