/* Recheck every eligibility/price change against the frozen full API census. */
const fs = require('fs');
const before = require('../../docs/evidence/samsung-recovery-production-commerce-deployed-2026-09-16.json');
const after = JSON.parse(fs.readFileSync('docs/evidence/samsung-recovery-production-final-after-2026-09-16.json'));
const prior = new Map(before.models.map(m => [m.model, m]));
const purchasable = m => m?.status === 'valid' && +m.price > 0 && ['in_stock', 'limited_stock', 'pre_order'].includes(m.availability);
const changes = after.models.filter(m => {
  const b = prior.get(m.model);
  return purchasable(b) !== purchasable(m) || ((purchasable(b) || purchasable(m)) && +b?.price !== +m.price);
});
const items = changes.map(m => ({ model: m.model, key: `samsung|MODEL:${m.model}`, expected: purchasable(m), price: +m.price }));
items.push({ model: 'HW-T400/ZN', key: 'samsung|HW-T400/ZN', expected: false },
  { model: 'QA55LS03DAUXSA', key: 'samsung|MODEL:QA55LS03DAUXSA', expected: false });
const result = { startedAt: new Date().toISOString(), beforeAt: before.observedAt, afterAt: after.observedAt,
  changedCurrentModels: changes.length, legacyRedirectControls: 2, rows: [] };
const file = 'docs/evidence/samsung-recovery-refresh-delta-verification-2026-09-16.json';
const isSamsung = o => o.store === 'samsung_ksa' || o.store_slug === 'samsung_ksa' || /سامسونج السعودية|Samsung Saudi|Samsung KSA/i.test(o.store_name || '');
async function get(url, init) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { ...init, headers: { ...init?.headers, 'user-agent': 'TawveeriUIJourney/1.0 headless read-only audit' }, signal: AbortSignal.timeout(60000) });
    if (response.status !== 429) return { status: response.status, data: await response.json() };
    await response.text();
    await new Promise(resolve => setTimeout(resolve, Math.max(1, +response.headers.get('retry-after') || 60) * 1000));
  }
  throw new Error('Rate-limited after measured retries');
}
(async () => {
  for (const item of items) {
    const row = { ...item, observedAt: new Date().toISOString() };
    try {
      const search = await get('https://tawveeri.com/api/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: item.model, pageSize: 20 }) });
      const comparison = await get(`https://tawveeri.com/api/compare?key=${encodeURIComponent(item.key)}&locale=ar`);
      row.searchStatus = search.status; row.compareStatus = comparison.status;
      row.searchOffers = (search.data.products || []).filter(p => p.tps_identity_key === item.key || p.name_en?.includes(item.model))
        .flatMap(p => p.stores || [p]).filter(isSamsung).map(o => ({ price: o.current_price, url: o.product_url }));
      row.compareOffers = (comparison.data.offers || []).filter(isSamsung).map(o => ({ price: o.price, url: o.product_url }));
      const correct = offers => item.expected ? offers.length === 1 && +offers[0].price === item.price && !!offers[0].url : offers.length === 0;
      row.correct = search.status === 200 && (comparison.status === 200 || (!item.expected && comparison.status === 404))
        && correct(row.searchOffers) && correct(row.compareOffers);
    } catch (error) { row.error = String(error); }
    result.rows.push(row); fs.writeFileSync(file, JSON.stringify(result, null, 2));
    console.log(row.model, row.correct, row.error || '');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  result.completedAt = new Date().toISOString();
  result.summary = { tested: result.rows.length, correct: result.rows.filter(r => r.correct).length, errors: result.rows.filter(r => r.error).length };
  fs.writeFileSync(file, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result.summary));
})().catch(error => { console.error(error); process.exitCode = 1; });
