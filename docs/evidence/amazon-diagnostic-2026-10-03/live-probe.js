// Read-only live probe: for each sampled shared identity key, fetch the compare API and the
// TPS search API on production and save raw responses. 1 request / 3 s (middleware allows 30/min).
const fs = require('fs');
const SP = process.argv[2]; const N = Number(process.argv[3] || 60);
const sample = JSON.parse(fs.readFileSync(SP + '/batch2.json')).results.sample_shared;
const seen = new Set(); const keys = [];
for (const r of sample) { if (seen.has(r.identity_key)) continue; seen.add(r.identity_key); keys.push(r); if (keys.length >= N) break; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'https://tawveeri.com';
(async () => {
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]; const rec = { key: k.identity_key, category: k.category, display_name_ar: k.display_name_ar, amz_price: k.amz_price, amz_observed: k.amz_observed, rival_store: k.rival_store, rival_price: k.rival_price, has_comparison: k.has_comparison, compare_url: k.compare_url };
    try { const r = await fetch(`${BASE}/api/compare?key=${encodeURIComponent(k.identity_key)}`, { headers: { 'user-agent': 'tawveeri-diagnostic-readonly/1.0' } }); rec.compare_status = r.status; rec.compare = r.status === 200 ? await r.json() : (await r.text()).slice(0, 200); } catch (e) { rec.compare_error = e.message; }
    await sleep(3000);
    const q = k.display_name_ar || k.amz_name || k.identity_key.split('|').slice(0, 2).join(' ');
    try { const r = await fetch(`${BASE}/api/v1/tps/search?q=${encodeURIComponent(q)}&limit=20`, { headers: { 'user-agent': 'tawveeri-diagnostic-readonly/1.0' } }); rec.search_status = r.status; rec.search_q = q; rec.search = r.status === 200 ? await r.json() : (await r.text()).slice(0, 200); } catch (e) { rec.search_error = e.message; }
    out.push(rec); fs.writeFileSync(SP + '/live-probe.json', JSON.stringify(out));
    console.log(i + 1, k.identity_key, 'compare=' + rec.compare_status, 'search=' + rec.search_status);
    await sleep(3000);
  }
  console.log('done', out.length);
})();
