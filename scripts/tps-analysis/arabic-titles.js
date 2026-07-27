// Compose clean Saudi Arabic titles for English-named appliance/AC products from VERIFIED structured
// identity fields (brand + extracted specs + subtype) — Founder priority 2. Brand transliterated via a
// curated map (unknown brands kept as-is; model codes kept Latin — never mistranslated). Natural
// order: {category} {brand} {capacity} {type} {cooling} {inverter}. Default DRY (prints samples).
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

// Curated brand transliteration (only well-known; keep others Latin to avoid mistranslation).
const BRAND_AR = {
  samsung: 'سامسونج', lg: 'إل جي', 'l g': 'إل جي', toshiba: 'توشيبا', panasonic: 'باناسونيك',
  hitachi: 'هيتاشي', hisense: 'هايسنس', tcl: 'تي سي إل', haier: 'هاير', midea: 'ميديا', aux: 'أوكس',
  gree: 'جري', daikin: 'دايكن', carrier: 'كاريير', fisher: 'فيشر', 'general': 'جنرال', classpro: 'كلاس برو',
  nikai: 'نيكاي', beko: 'بيكو', bosch: 'بوش', whirlpool: 'ويرلبول', sharp: 'شارب', kelvinator: 'كلفيناتور',
  wansa: 'وانسا', dansat: 'دانسات', 'white westinghouse': 'وايت وستنجهاوس', super: 'سوبر جنرال',
  'super general': 'سوبر جنرال', xper: 'إكسبير', mtc: 'إم تي سي', basic: 'بيسك', craft: 'كرافت',
  impex: 'إمبكس', geepas: 'جيباس', braun: 'براون', kenwood: 'كينوود', philips: 'فيليبس', tefal: 'تيفال',
  black: 'بلاك آند ديكر', 'black+decker': 'بلاك آند ديكر', 'black & decker': 'بلاك آند ديكر',
  oscal: 'أوسكال', oscar: 'أوسكار', dots: 'دوتس', royal: 'رويال', shark: 'شارك', karcher: 'كارشر',
};
const CAT_AR = { air_conditioner: 'مكيف', refrigerator: 'ثلاجة' };
const TYPE_AR = { split: 'سبليت', window: 'شباك', portable: 'متنقل', cassette: 'كاسيت' };
const COOL_AR = { cool_only: 'بارد فقط', hot_cold: 'حار/بارد' };

function brandAr(b) {
  if (!b) return null; const k = b.trim().toLowerCase();
  return BRAND_AR[k] || Object.keys(BRAND_AR).find((x) => k.includes(x)) && BRAND_AR[Object.keys(BRAND_AR).find((x) => k.includes(x))] || null;
}
// Subtype for the generic 'appliance' category, from the English title.
function subtypeAr(name) {
  const t = (name || '').toLowerCase();
  if (/refrigerator|fridge/.test(t)) return 'ثلاجة';
  if (/freezer/.test(t)) return 'فريزر';
  if (/washer|washing machine/.test(t)) return 'غسالة';
  if (/dryer/.test(t)) return 'نشافة';
  if (/dishwasher/.test(t)) return 'غسالة صحون';
  if (/vacuum/.test(t)) return 'مكنسة كهربائية';
  if (/water heater|geyser/.test(t)) return 'سخان';
  return null;
}

function compose(cat, name, brand, spec) {
  const s = spec && typeof spec === 'object' ? spec : {};
  const head = cat === 'air_conditioner' ? 'مكيف' : cat === 'refrigerator' ? 'ثلاجة' : subtypeAr(name);
  if (!head) return null; // don't guess a category we can't identify
  const parts = [head];
  if (s.ac_type && TYPE_AR[s.ac_type]) parts.push(TYPE_AR[s.ac_type]);
  const bAr = brandAr(brand) || (brand && !/^[0-9]/.test(brand) ? brand.trim() : null);
  if (bAr) parts.push(bAr);
  if (s.capacity_btu) parts.push(`${s.capacity_btu} وحدة`);
  if (s.capacity_liters) parts.push(`${s.capacity_liters} لتر`);
  if (s.capacity_cuft) parts.push(`${s.capacity_cuft} قدم`);
  if (s.capacity_kg) parts.push(`${s.capacity_kg} كجم`);
  if (s.door_count === 2) parts.push('بابين');
  if (s.cooling && COOL_AR[s.cooling]) parts.push(COOL_AR[s.cooling]);
  if (s.inverter) parts.push('إنفرتر');
  if (parts.length < 3) return null; // too thin to be a useful title
  let title = parts.join(' ');
  // Append the retailer's model code (kept Latin — never translated) so near-identical variants stay
  // distinct (avoids the name_ar unique collision and gives the shopper the exact model).
  const model = (name || '').match(/\b([A-Z][A-Z0-9]{4,}(?:-[A-Z0-9]+)?)\b/);
  if (model && !title.includes(model[1])) title += ` ${model[1]}`;
  return title;
}

(async () => {
  const GO = process.argv.includes('--go');
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  const rows = (await c.query(`
    select p.id, p.name_en, p.name_ar, p.brand, p.category, p.specifications
    from products p join product_stores ps on ps.product_id=p.id
    where ps.store_id in (1,2,3,4,5,23,24) and p.is_active
      and p.category in ('air_conditioner','refrigerator','appliance')
      and (p.name_ar is null or p.name_ar !~ '[؀-ۿ]' or p.name_ar ~ '[A-Za-z]{4,}')`)).rows;
  let composed = 0; const updates = []; const samples = [];
  for (const r of rows) {
    const title = compose(r.category, r.name_en, r.brand, r.specifications);
    if (!title) continue;
    composed++; updates.push({ id: r.id, title });
    if (samples.length < 12) samples.push(`${(r.name_en || '').slice(0, 40)}  →  ${title}`);
  }
  console.log(`candidates (English-named AC/fridge/appliance): ${rows.length} | composed Arabic title: ${composed}`);
  console.log('SAMPLES:'); samples.forEach((s) => console.log('  ' + s));
  if (GO) { let ok = 0; for (const u of updates) { try { await c.query(`update products set name_ar=$1 where id=$2`, [u.title, u.id]); ok++; } catch {} } console.log(`APPLIED ${ok}.`); }
  else if (updates.length) console.log('(dry run — pass --go)');
  await c.end();
})().catch(e => { console.error(e.code || e.message); process.exit(1); });
