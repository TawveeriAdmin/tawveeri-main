// Precise supermarket/non-scope leak scan for hypermarket + marketplace stores. READ-ONLY (unless --purge).
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

// TRUE non-scope signals — food/grocery/fashion/toys/furniture/consumables. Deliberately NOT matching
// legit electrical appliances (vacuum CLEANER, WATER dispenser, steam cleaner, air fryer, etc.).
const NONSCOPE = /\b(chocolate|biscuit|cookie|candy|snack|chips|crisps|wafer|cereal|coffee bean|ground coffee|tea bag|\bmilk\b|yoghurt|yogurt|juice|soda|cola|beverage|sauce|ketchup|mayonnaise|spice|seasoning|\brice\b|\bflour\b|\bsugar\b|cooking oil|olive oil|noodle|\bpasta\b|honey|jam|nutella|nuts\b|almond|cashew|dates\b|\bwater\b bottle|mineral water|shampoo|conditioner|body wash|\bsoap\b|toothpaste|deodorant|perfume|cologne|\blotion\b|face cream|moisturizer|makeup|lipstick|mascara|foundation|nail polish|diaper|\bpads\b|tissue|\bwipes\b|detergent|fabric softener|bleach|dishwash liquid|\bshirt\b|t-shirt|\bdress\b|\bjeans\b|trouser|\bshoe|sneaker|sandal|\bsock|abaya|hijab|\bscarf\b|\bwatch strap only\b|\btoy\b|\bdoll\b|lego|puzzle|board game|\bsofa\b|mattress|\bpillow\b|\bcushion\b|\bcurtain\b|\bcarpet\b|\brug\b|\bbedsheet|\btowel set)\b/i;

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = (s, p) => c.query(s, p).then(r => r.rows);
  const PURGE = process.argv.includes('--purge');
  const stores = { 3: 'noon', 23: 'lulu', 24: 'sharafdg' }; // hypermarket + marketplace risk
  const leakIds = [];
  for (const [sid, slug] of Object.entries(stores)) {
    const rows = await q(`select p.id, p.name_en, p.name_ar, p.category from product_stores ps join products p on p.id=ps.product_id where ps.store_id=$1`, [Number(sid)]);
    const leaks = rows.filter(r => NONSCOPE.test(r.name_en || '') || NONSCOPE.test(r.name_ar || ''));
    console.log(`\n${slug} (${sid}): ${rows.length} products, ${leaks.length} TRUE non-scope leaks`);
    leaks.forEach(l => { console.log('   ⚠️', l.category, '|', (l.name_en || l.name_ar || '').slice(0, 55)); leakIds.push({ id: l.id, sid: Number(sid) }); });
  }
  console.log(`\nTOTAL true leaks: ${leakIds.length}`);
  if (PURGE && leakIds.length) {
    // remove the leaked product_stores offers for these stores (keep the product row if shared)
    for (const { id, sid } of leakIds) {
      await c.query(`delete from product_stores where product_id=$1 and store_id=$2`, [id, sid]);
    }
    console.log(`PURGED ${leakIds.length} leaked offers from product_stores.`);
  } else if (leakIds.length) {
    console.log('(dry run — pass --purge to remove)');
  }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
