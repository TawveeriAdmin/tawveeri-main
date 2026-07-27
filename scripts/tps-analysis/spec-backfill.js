// Extract comparison specifications for appliances / AC / kitchen from the RETAILER'S OWN product
// title (facts already stated by the retailer — not inferred). Normalized keys suitable for
// side-by-side comparison. Founder priority 1. Default DRY; --go applies. Marks _spec_source:'title'.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

function extractSpecs(name) {
  const t = ' ' + (name || '').toLowerCase().replace(/,/g, ' ') + ' ';
  const s = {};
  let m;
  // Cooling capacity (AC): BTU or Arabic وحدة
  if ((m = t.match(/(\d{4,5})\s*(btu|وحد[ةه])/))) s.capacity_btu = parseInt(m[1]);
  // Volume liters
  if ((m = t.match(/(\d{2,4}(?:\.\d)?)\s*(l\b|ltr|litre|liter|لتر)/))) s.capacity_liters = parseFloat(m[1]);
  // Cubic feet (fridges/freezers)
  if ((m = t.match(/(\d{1,2}(?:\.\d)?)\s*(cu\.?\s*ft|cuft|قدم)/))) s.capacity_cuft = parseFloat(m[1]);
  // Weight kg (washers/dryers)
  if ((m = t.match(/(\d{1,2}(?:\.\d)?)\s*(kg|كجم|كيلو|كغم)/))) s.capacity_kg = parseFloat(m[1]);
  // Power watts
  if ((m = t.match(/(\d{2,4})\s*(w\b|watt|واط|وات)/))) s.power_watts = parseInt(m[1]);
  // AC type
  if (/\bsplit\b|سبليت|جدار[ية]/.test(t)) s.ac_type = 'split';
  else if (/window|شباك/.test(t)) s.ac_type = 'window';
  else if (/portable|متنقل/.test(t)) s.ac_type = 'portable';
  else if (/cassette|كاسيت/.test(t)) s.ac_type = 'cassette';
  // Inverter
  if (/inverter|انفرتر|إنفرتر/.test(t)) s.inverter = true;
  // Washer load type
  if (/front\s*load|أمامي|امامي/.test(t)) s.load_type = 'front_load';
  else if (/top\s*load|علوي/.test(t)) s.load_type = 'top_load';
  // Doors (fridge)
  if (/double\s*door|بابين|باب[ية]ن|2\s*door/.test(t)) s.door_count = 2;
  else if (/single\s*door|باب واحد/.test(t)) s.door_count = 1;
  // Cooling mode
  if (/cool\s*only|بارد فقط|تبريد فقط/.test(t)) s.cooling = 'cool_only';
  else if (/hot\s*(&|and|\/)?\s*cold|حار.?بارد|تبريد.?تدفئة/.test(t)) s.cooling = 'hot_cold';
  return s;
}

(async () => {
  const GO = process.argv.includes('--go');
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  const rows = (await c.query(`
    select p.id, p.name_en, p.name_ar, p.specifications
    from products p join product_stores ps on ps.product_id=p.id
    where ps.store_id in (1,2,3,4,5,23,24) and p.is_active
      and p.category in ('appliance','air_conditioner','kitchen','refrigerator')`)).rows;
  let willUpdate = 0, addedKeys = 0;
  const updates = [];
  for (const r of rows) {
    const fromEn = extractSpecs(r.name_en);
    const fromAr = extractSpecs(r.name_ar);
    const spec = { ...fromAr, ...fromEn }; // English usually richer
    if (Object.keys(spec).length === 0) continue;
    const existing = (r.specifications && typeof r.specifications === 'object') ? r.specifications : {};
    const merged = { ...existing, ...spec, _spec_source: 'title' };
    // only count as an improvement if we added at least one comparison key
    const newKeys = Object.keys(spec).filter((k) => !(k in existing));
    if (newKeys.length === 0) continue;
    willUpdate++; addedKeys += newKeys.length;
    updates.push({ id: r.id, merged });
  }
  console.log(`appliance/AC/kitchen products: ${rows.length} | will enrich: ${willUpdate} | avg new keys: ${(addedKeys / (willUpdate || 1)).toFixed(1)}`);
  if (GO) { let ok = 0; for (const u of updates) { try { await c.query(`update products set specifications=$1 where id=$2`, [JSON.stringify(u.merged), u.id]); ok++; } catch {} } console.log(`APPLIED ${ok}.`); }
  else if (updates.length) console.log('(dry run — pass --go)');
  await c.end();
})().catch(e => { console.error(e.code || e.message); process.exit(1); });
