// Generic, category-scoped projection recompute (pattern proven on tablet).
// Same derivation logic as scripts/build-tps-projection.ts (ADR-067 v3), but every
// read/write/prune is filtered to one category so no other category's
// tps_product_projection row is touched (not even updated_at).
// Usage: node scripts/_tmp-recompute-projection.js --category=<cat> [--dry]
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { toPoolerDbUrl } = require('./tps-core/pooler-url');

const DRY = process.argv.includes('--dry');
const catArg = process.argv.find(a => a.startsWith('--category='));
if (!catArg) { console.error('missing --category=<cat>'); process.exit(1); }
const CATEGORY = catArg.split('=')[1];

const TPS_STORES = [
  { id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" },
  { id: 5, name: "المنيع" }, { id: 3, name: "نون" }, { id: 8, name: "الشتاء والصيف" },
  { id: 6, name: "سامسونج السعودية" }, { id: 7, name: "شاكر" },
  { id: 9, name: "نجم الأجهزة" },
  { id: 11, name: "اتش دي اف" }, { id: 12, name: "جولدن ستور" }, { id: 13, name: "محزم" },
  { id: 14, name: "التاوية" }, { id: 15, name: "بي سي بالاس" },
  { id: 16, name: "سوني وورلد" },
  { id: 17, name: "امن كوم" },
  { id: 18, name: "متجر النخيل" }, { id: 19, name: "السفير زون" },
  { id: 20, name: "الهويش للأجهزة" }, { id: 21, name: "الضوء البارق" },
  { id: 22, name: "إيزي وورلد" },
  { id: 23, name: "لولو هايبر ماركت" }, { id: 24, name: "شرف دي جي" },
  { id: 10, name: "الصندوق الأسود" },
];
const STORE_NAME_CASE = `case ph.store_name ${TPS_STORES.map(s => `when '${s.id}' then '${s.name}'`).join(' ')} else ph.store_name end`;

function attrText(attrs) {
  attrs = attrs || {};
  return [
    attrs.capacity_btu ? `${attrs.capacity_btu} BTU` : null,
    attrs.technology,
    attrs.cooling_mode === 'hot_cold' ? 'حار وبارد hot and cold' : null,
    attrs.cooling_mode === 'cool_only' ? 'بارد فقط cool only' : null,
    attrs.ac_type,
    attrs.series_or_platform,
    attrs.storage_gb ? `${attrs.storage_gb}GB` : null,
    attrs.family,
    attrs.generation,
    attrs.variant,
  ].filter(Boolean).join(' ');
}

function deriveProjection(r) {
  const pairs = (r.stores ?? []).map((store, i) => ({ store, price: Number((r.prices ?? [])[i]) }))
    .filter(s => Number.isFinite(s.price) && s.price > 0)
    .sort((a, b) => a.price - b.price || a.store.localeCompare(b.store));

  const lowestPrice = pairs[0]?.price ?? null;
  const highestPrice = pairs.length ? pairs[pairs.length - 1].price : null;
  const cheapestStore = pairs[0]?.store ?? null;
  const storeCount = pairs.length;

  const saving = lowestPrice && highestPrice && highestPrice > lowestPrice
    ? parseFloat((highestPrice - lowestPrice).toFixed(2)) : null;
  const priceSpreadPct = lowestPrice && highestPrice && lowestPrice > 0
    ? Math.min(999.99, parseFloat((((highestPrice - lowestPrice) / lowestPrice) * 100).toFixed(2))) : null;

  const textForSearch = [
    r.name_ar, r.name_en, r.brand, r.category, cheapestStore,
    lowestPrice ? `${lowestPrice} ريال` : null,
    attrText(r.attributes ?? {}),
  ].filter(Boolean).join(' ');

  return {
    canonical_id: r.canonical_id,
    tps_identity_key: r.tps_identity_key,
    display_name_ar: r.name_ar,
    display_name_en: r.name_en,
    brand: r.brand,
    category: r.category,
    lowest_price: lowestPrice,
    highest_price: highestPrice,
    saving,
    price_spread_pct: priceSpreadPct,
    cheapest_store: cheapestStore,
    store_count: storeCount,
    has_comparison: storeCount >= 2,
    compare_url: r.tps_identity_key ? `/ar/compare/${encodeURIComponent(r.tps_identity_key)}` : null,
    identity_confidence: r.identity_confidence,
    text_for_search: textForSearch,
    last_observed_at: r.last_observed_at,
  };
}

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL);
  if (!url) throw new Error('SUPABASE_DB_URL missing');
  if (!url.includes('vyceqrzttspyycdpojtn') || url.includes('ffpsjjazsluolysgithg')) {
    throw new Error('refusing: not production');
  }

  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query('set statement_timeout = 0');

  const t0 = Date.now();
  const { rows } = await pg.query(`
    with latest as (
      select distinct on (ph.canonical_product_id, ${STORE_NAME_CASE})
             ph.canonical_product_id, ${STORE_NAME_CASE} as store_name, ph.price, ph.observed_at
      from price_history ph
      where ph.tps_observation_id is not null
        and ph.canonical_product_id in (select id from canonical_products where category = $1)
        and not exists (
          select 1 from tps_offer_delist_signals d
          where d.canonical_product_id = ph.canonical_product_id
            and d.store_display_name = ${STORE_NAME_CASE}
        )
      order by ph.canonical_product_id, ${STORE_NAME_CASE}, ph.observed_at desc
    ),
    agg as (
      select canonical_product_id,
             array_agg(store_name order by price asc, store_name asc) as stores,
             array_agg(price::text order by price asc, store_name asc) as prices,
             max(observed_at) as last_price_change_at
      from latest where price > 0
      group by canonical_product_id
    ),
    obs as (
      select canonical_product_id, max(observed_at) as last_observed_at
      from normalized_product_observations
      where canonical_product_id is not null
        and canonical_product_id in (select id from canonical_products where category = $1)
      group by canonical_product_id
    )
    select c.id::text as canonical_id, c.tps_identity_key, c.name_ar, c.name_en,
           c.brand, c.category, c.identity_confidence, c.attributes,
           a.stores, a.prices,
           coalesce(o.last_observed_at, a.last_price_change_at) as last_observed_at
    from canonical_products c
    left join agg a on a.canonical_product_id = c.id
    left join obs o on o.canonical_product_id = c.id
    where c.tps_identity_key is not null
      and c.is_active
      and c.category = $1
    order by c.id
  `, [CATEGORY]);
  const readMs = Date.now() - t0;

  const projected = rows.map(deriveProjection);
  const comparable = projected.filter(p => p.has_comparison).length;
  const stillNullLowest = projected.filter(p => p.lowest_price == null).length;

  console.log(`category=${CATEGORY}  canonicals read: ${rows.length}  (${readMs}ms)`);
  console.log(`comparable (>=2 stores): ${comparable}`);
  console.log(`still lowest_price NULL after recompute: ${stillNullLowest}`);

  if (DRY) {
    console.log('\n--dry: not writing.');
    await pg.end();
    return;
  }

  const COLS = [
    'canonical_id', 'tps_identity_key', 'display_name_ar', 'display_name_en', 'brand', 'category',
    'lowest_price', 'highest_price', 'saving', 'price_spread_pct', 'cheapest_store', 'store_count',
    'has_comparison', 'compare_url', 'identity_confidence', 'text_for_search', 'last_observed_at',
  ];
  const CHUNK = 500;
  let written = 0;
  const t2 = Date.now();
  for (let i = 0; i < projected.length; i += CHUNK) {
    const chunk = projected.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    chunk.forEach((p, j) => {
      const b = j * COLS.length;
      values.push(`(${COLS.map((_, k) => `$${b + k + 1}`).join(',')}, now())`);
      params.push(...COLS.map(c => p[c]));
    });
    const res = await pg.query(
      `insert into tps_product_projection (${COLS.join(',')}, updated_at)
       values ${values.join(',')}
       on conflict (tps_identity_key) do update set
         canonical_id = excluded.canonical_id,
         display_name_ar = excluded.display_name_ar,
         display_name_en = excluded.display_name_en,
         brand = excluded.brand,
         category = excluded.category,
         lowest_price = excluded.lowest_price,
         highest_price = excluded.highest_price,
         saving = excluded.saving,
         price_spread_pct = excluded.price_spread_pct,
         cheapest_store = excluded.cheapest_store,
         store_count = excluded.store_count,
         has_comparison = excluded.has_comparison,
         compare_url = excluded.compare_url,
         identity_confidence = excluded.identity_confidence,
         text_for_search = excluded.text_for_search,
         last_observed_at = excluded.last_observed_at,
         updated_at = now()`,
      params
    );
    written += res.rowCount ?? 0;
  }
  const writeMs = Date.now() - t2;

  const pruned = await pg.query(
    `delete from tps_product_projection p
      where p.category = $1
        and not exists (
          select 1 from canonical_products c
           where c.tps_identity_key = p.tps_identity_key and c.is_active)`,
    [CATEGORY]
  );

  console.log(`\nrows written: ${written} (${writeMs}ms)`);
  console.log(`rows pruned (${CATEGORY}, inactive/gone canonical): ${pruned.rowCount ?? 0}`);
  await pg.end();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
