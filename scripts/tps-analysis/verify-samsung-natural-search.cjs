/* Read-only live category-language retrieval; excludes outbound clicks. */
const fs = require('fs');
const queries = ['Samsung Galaxy Watch', 'Samsung Galaxy Buds', 'Samsung Galaxy Ring',
  'Samsung charger', 'Samsung refrigerator', 'Samsung washing machine',
  'جوال سامسونج', 'ثلاجة سامسونج', 'غسالة سامسونج', 'شاحن سامسونج',
  'HAF-QIN/EXP', 'HAFEX/EXP', 'SKK-ALE/SC'];
async function main() {
  const phase = process.argv.find(a => a.startsWith('--phase='))?.slice(8) || 'after';
  const result = { startedAt: new Date().toISOString(), phase, rows: [] };
  for (const query of queries) {
    const row = { query, observedAt: new Date().toISOString() };
    try {
      const response = await fetch('https://tawveeri.com/api/search', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, pageSize: 20 }),
        signal: AbortSignal.timeout(60000) });
      row.status = response.status;
      const data = await response.json();
      row.products = (data.products || []).map(p => ({ name: p.name_en, key: p.tps_identity_key,
        price: p.current_price, stores: (p.stores || [p]).map(o => ({ store: o.store, name: o.store_name,
          price: o.current_price, availability: o.availability })) }));
    } catch (error) { row.error = String(error); }
    result.rows.push(row);
    console.log(query, row.status, row.products?.length, row.error || '');
  }
  result.completedAt = new Date().toISOString();
  fs.writeFileSync(`docs/evidence/samsung-recovery-natural-search-${phase}-2026-09-16.json`, JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
