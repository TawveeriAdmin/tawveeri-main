const fs = require('fs');
const phase = process.argv.find(a => a.startsWith('--phase='))?.slice(8) || 'before';
const base = process.argv.find(a => a.startsWith('--base='))?.slice(7) || 'https://tawveeri.com';
const queries = ['Samsung washing machine', 'Samsung refrigerator', 'سماعات سامسونج', 'ساعة سامسونج',
  'تابلت سامسونج', 'ثلاجة سامسونج', 'Samsung dryer'];
const result = { startedAt: new Date().toISOString(), phase, base, rows: [] };
(async () => {
  for (const query of queries) {
    const row = { query, observedAt: new Date().toISOString(), pages: [], products: [] };
    for (let page = 1; page <= 5; page++) {
      const response = await fetch(`${base}/api/search`, { method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'TawveeriUIJourney/1.0 read-only audit' },
        body: JSON.stringify({ query, page, pageSize: 100 }), signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      row.pages.push({ page, status: response.status, total: data.total });
      row.products.push(...(data.products || []).map(p => ({ name: p.name_en, key: p.tps_identity_key,
        samsung: (p.stores || [p]).filter(o => o.store === 'samsung_ksa' || /سامسونج السعودية|Samsung Saudi|Samsung KSA/i.test(o.store_name || ''))
          .map(o => ({ price: o.current_price, availability: o.availability })) })));
      if (response.status !== 200 || (data.products || []).length < 100) break;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    row.summary = { returned: row.products.length, samsung: row.products.filter(p => p.samsung.length).length };
    result.rows.push(row);
    fs.writeFileSync(`docs/evidence/samsung-recovery-category-language-${phase}-2026-09-16.json`, JSON.stringify(result, null, 2));
    console.log(query, JSON.stringify(row.summary));
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  result.completedAt = new Date().toISOString();
  fs.writeFileSync(`docs/evidence/samsung-recovery-category-language-${phase}-2026-09-16.json`, JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
