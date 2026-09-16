const fs = require('fs');
async function main() {
  const sample = JSON.parse(fs.readFileSync('docs/evidence/samsung-coverage-before-2026-09-16.json')).queries.sample.rows;
  const result = { measured_at: new Date().toISOString(), rows: [] };
  for (const row of sample) {
    const query = row.name.match(/\(([^()]*)\)\s*$/)?.[1] || row.name;
    const r = await fetch('https://tawveeri.com/api/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, pageSize: 10 }), signal: AbortSignal.timeout(45000) });
    const body = await r.json();
    result.rows.push({ source_url: row.url, query, http_status: r.status, response: body });
    console.log(query, r.status, Object.keys(body), body.products?.length);
    fs.writeFileSync(process.argv[2] || 'docs/evidence/samsung-search-before-2026-09-16.json', JSON.stringify(result, null, 2) + '\n');
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
