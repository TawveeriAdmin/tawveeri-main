/* Frozen production offer cohort; actual exact-model search, bounded concurrency. */
const fs = require('fs');
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const base = arg('base', 'https://tawveeri.com');
const phase = arg('phase', 'final');
const source = JSON.parse(fs.readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json'));
const snapshotPath = process.argv.find(a => a.startsWith('--snapshot='))?.slice(11)
  || 'docs/evidence/samsung-recovery-production-full-completed-2026-09-16.json';
const snapshot = JSON.parse(fs.readFileSync(snapshotPath));
const included = new Set(source.models.filter(m => !m.exclusion && m.identity).map(m => m.model));
let cohort = snapshot.models.filter(m => included.has(m.model) && m.status === 'valid' && Number(m.price) > 0
  && ['in_stock', 'limited_stock', 'pre_order'].includes(m.availability));
const failureCohort = arg('failure-cohort', null);
if (failureCohort) {
  const failed = new Set(JSON.parse(fs.readFileSync(failureCohort)).rows.filter(r => !r.offers?.length || r.exactCards !== 1).map(r => r.model));
  cohort = cohort.filter(m => failed.has(m.model));
}
const output = `docs/evidence/samsung-recovery-purchasable-search-${phase}-2026-09-16.json`;
const result = { startedAt: new Date().toISOString(), base, snapshotPath, snapshotAt: snapshot.observedAt, failureCohort,
  method: 'Two concurrent actual exact-model API reads; frozen current-offer cohort, not a rendered-UI census.', rows: [] };
let cursor = 0;
async function worker() {
  while (cursor < cohort.length) {
    const item = cohort[cursor++];
    const row = { model: item.model, category: item.category, expectedPrice: Number(item.price), observedAt: new Date().toISOString() };
    try {
      const response = await fetch(`${base}/api/search`, { method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'TawveeriUIJourney/1.0 headless read-only audit' },
        body: JSON.stringify({ query: item.model, pageSize: 20 }), signal: AbortSignal.timeout(60000) });
      row.status = response.status;
      const data = await response.json();
      const exact = (data.products || []).filter(p => p.tps_identity_key === `samsung|MODEL:${item.model}`);
      row.exactCards = exact.length;
      row.offers = exact.flatMap(p => p.stores || [p]).filter(o => o.store === 'samsung_ksa'
        || /Samsung Saudi|Samsung KSA|سامسونج السعودية/i.test(o.store_name || '')).map(o => ({ price: o.current_price,
        availability: o.availability, exit: o.product_url }));
      row.priceMatchesSnapshot = row.offers.some(o => Number(o.price) === row.expectedPrice);
    } catch (error) { row.error = String(error); }
    result.rows.push(row);
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    if (result.rows.length % 25 === 0) console.log(`${result.rows.length}/${cohort.length}`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}
Promise.all([worker(), worker()]).then(() => {
  result.completedAt = new Date().toISOString();
  result.summary = { tested: result.rows.length, http200: result.rows.filter(r => r.status === 200).length,
    samsungPresent: result.rows.filter(r => r.offers?.length).length,
    exactSingleCard: result.rows.filter(r => r.exactCards === 1).length,
    priceMatchesSnapshot: result.rows.filter(r => r.priceMatchesSnapshot).length, errors: result.rows.filter(r => r.error).length };
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result.summary));
}).catch(error => { console.error(error); process.exitCode = 1; });
