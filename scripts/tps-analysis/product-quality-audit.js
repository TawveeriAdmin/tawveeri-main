// READ-ONLY product-quality audit (Founder product-first directive 2026-07-27).
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

const ACTIVE = { 1: 'jarir', 2: 'amazon', 3: 'noon', 4: 'extra', 5: 'almanea', 23: 'lulu', 24: 'sharafdg' };
// Approved Tawveeri categories (electronics + home appliances). personal_care EXCLUDED (consumables risk).
const APPROVED_CATS = new Set(['tv','laptop','smartphone','tablet','audio','camera','gaming','accessories',
  'monitor','printer','networking','smart_home','wearable','appliance','kitchen','refrigerator']);
// Supermarket / non-scope leakage signal (grocery, food, fashion, consumables, toys, furniture).
const JUNK = /\b(rice|sugar|flour|oil|coffee bean|tea|water|juice|milk|snack|chocolate|biscuit|noodle|pasta|sauce|spice|detergent|shampoo|soap|tissue|diaper|perfume|deodorant|lotion|cream|makeup|lipstick|shirt|dress|shoe|sandal|sock|toy|doll|sofa|mattress|pillow|curtain|carpet|grocer|spray|cleaner|wipes|towel|abaya|frozen|fresh |vegetable|fruit|meat|chicken|bread)\b/i;

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = (s, p) => c.query(s, p).then(r => r.rows);

  console.log('=== A. scraping_runs — scheduler evidence (last 10 per store) ===');
  const runs = await q(`select to_regclass('public.scraping_runs') t`);
  if (runs[0].t) {
    console.table(await q(`
      select coalesce(store_name, store_id::text) store, job_type, status, count(*) n,
             sum(products_discovered) disc, sum(products_new) new, sum(products_updated) upd, sum(products_failed) failed,
             max(started_at)::timestamp(0) last_run, max(triggered_by) trig
      from scraping_runs where started_at > now() - interval '3 days'
      group by 1, job_type, status order by 1, job_type`));
  } else console.log('(no scraping_runs table)');

  console.log('\n=== B. product_stores freshness per ACTIVE store ===');
  console.table(await q(`
    select store_id, count(*) offers,
           count(*) filter (where updated_at > now() - interval '24 hours') fresh_24h,
           count(*) filter (where updated_at > now() - interval '7 days') fresh_7d,
           max(updated_at)::timestamp(0) last_update
    from product_stores where store_id = any($1) group by store_id order by store_id`,
    [Object.keys(ACTIVE).map(Number)]));

  console.log('\n=== C. LuLu category breakdown + LEAK detection ===');
  const lulu = await q(`select p.id, p.name_en, p.category from product_stores ps join products p on p.id=ps.product_id where ps.store_id=23`);
  const catCount = {}; const leaks = [];
  for (const r of lulu) {
    catCount[r.category] = (catCount[r.category] || 0) + 1;
    const approved = APPROVED_CATS.has(r.category);
    if (!approved || JUNK.test(r.name_en || '')) leaks.push({ name: (r.name_en || '').slice(0, 50), cat: r.category, reason: !approved ? 'cat-not-approved' : 'junk-keyword' });
  }
  console.log('LuLu total:', lulu.length, '| by category:', JSON.stringify(catCount));
  console.log('LuLu LEAK candidates:', leaks.length);
  leaks.slice(0, 25).forEach(l => console.log('   ⚠️', l.cat, '|', l.reason, '|', l.name));

  console.log('\n=== D. same leak scan for Noon (marketplace) + Sharaf DG ===');
  for (const [sid, slug] of [[3, 'noon'], [24, 'sharafdg']]) {
    const rows = await q(`select p.name_en, p.category from product_stores ps join products p on p.id=ps.product_id where ps.store_id=$1`, [sid]);
    const lk = rows.filter(r => !APPROVED_CATS.has(r.category) || JUNK.test(r.name_en || ''));
    console.log(`${slug}: ${rows.length} products, ${lk.length} leak candidates`);
    lk.slice(0, 8).forEach(l => console.log('   ⚠️', l.category, '|', (l.name_en || '').slice(0, 50)));
  }

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
