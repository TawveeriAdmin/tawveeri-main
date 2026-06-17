/**
 * سكربت رفع منتجات Tawveeri إلى Algolia (صياغة v5)
 * يقرأ products + product_stores من Supabase، يبني سجل واحد لكل منتج،
 * ويرفعه إلى index اسمه "products".
 *
 * التشغيل:
 *   npx tsx scripts/algolia-sync.ts
 */
import { algoliasearch } from 'algoliasearch';
import { createClient } from '@supabase/supabase-js';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID!;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY!;
const INDEX_NAME = 'products';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface StoreRow {
  store_name: string | null;
  current_price: number | string | null;
  original_price: number | string | null;
  product_url: string | null;
  availability: string | null;
  coupon_code: string | null;
}

interface ProductRow {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  product_stores: StoreRow[];
}

interface AlgoliaRecord {
  objectID: string;
  name_ar: string;
  name_en: string;
  brand: string;
  image_url: string | null;
  best_price: number | null;
  stores: {
    store_name: string;
    current_price: number | null;
    original_price: number | null;
    product_url: string | null;
    availability: string | null;
    coupon_code: string | null;
  }[];
  store_names: string[];
  store_count: number;
  in_stock: boolean;
  has_deal: boolean;
  max_discount_pct: number;
}

function toNum(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function buildRecord(p: ProductRow): AlgoliaRecord | null {
  const stores = (p.product_stores || [])
    .filter((s) => toNum(s.current_price) !== null)
    .map((s) => {
      const cur = toNum(s.current_price);
      const orig = toNum(s.original_price);
      return {
        store_name: s.store_name || 'unknown',
        current_price: cur,
        original_price: orig,
        product_url: s.product_url,
        availability: s.availability,
        coupon_code: s.coupon_code,
      };
    });

  if (stores.length === 0) return null;

  const prices = stores.map((s) => s.current_price).filter((n): n is number => n !== null);
  const bestPrice = prices.length ? Math.min(...prices) : null;
  const storeNames = [...new Set(stores.map((s) => s.store_name))];
  const inStock = stores.some((s) => s.availability === 'in_stock');
  let maxDiscount = 0;
  let hasDeal = false;
  for (const s of stores) {
    if (s.original_price && s.current_price && s.original_price > s.current_price) {
      hasDeal = true;
      const pct = Math.round(((s.original_price - s.current_price) / s.original_price) * 100);
      if (pct > maxDiscount) maxDiscount = pct;
    }
  }

  return {
    objectID: p.id,
    name_ar: p.name_ar || '',
    name_en: p.name_en || '',
    brand: p.brand || '',
    image_url: p.image_url,
    best_price: bestPrice,
    stores,
    store_names: storeNames,
    store_count: storeNames.length,
    in_stock: inStock,
    has_deal: hasDeal,
    max_discount_pct: maxDiscount,
  };
}

async function main() {
  if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) throw new Error('مفاتيح Algolia مفقودة');
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('مفاتيح Supabase مفقودة');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);

  console.log('⏳ جلب المنتجات من Supabase...');
  const PAGE = 1000;
  let from = 0;
  const records: AlgoliaRecord[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from('products')
      .select('id,name_ar,name_en,brand,category,image_url,product_stores(store_name,current_price,original_price,product_url,availability,coupon_code)')
      .eq('is_active', true)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data || []) as unknown as ProductRow[];
    if (rows.length === 0) break;
    for (const r of rows) {
      const rec = buildRecord(r);
      if (rec) records.push(rec);
    }
    console.log(`  ... جلبنا ${from + rows.length} منتج`);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  console.log(`✅ جاهز للرفع: ${records.length} منتج (له أسعار)`);

  console.log('⏳ ضبط إعدادات الفهرس...');
  await client.setSettings({
    indexName: INDEX_NAME,
    indexSettings: {
      searchableAttributes: ['name_ar', 'name_en', 'brand'],
      attributesForFaceting: ['searchable(brand)', 'searchable(store_names)', 'in_stock', 'has_deal'],
      customRanking: ['desc(store_count)', 'desc(in_stock)', 'asc(best_price)'],
    },
  });

  console.log('⏳ رفع المنتجات إلى Algolia...');
  await client.saveObjects({
    indexName: INDEX_NAME,
    objects: records as unknown as Record<string, unknown>[],
    waitForTasks: true,
    batchSize: 1000,
  });

  console.log(`🎉 تم رفع ${records.length} منتج إلى فهرس "${INDEX_NAME}" بنجاح`);
}

main().catch((e) => {
  console.error('❌ فشل:', e?.message || e);
  process.exit(1);
});
