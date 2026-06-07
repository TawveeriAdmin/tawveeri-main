import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const maxDuration = 900;
export const dynamic = 'force-dynamic';

// ─── Algolia — المنيع ─────────────────────────────────────
const ALGOLIA_APP_ID = 'WCK19QC65I';
const ALGOLIA_KEY = 'be7745237f5f94f715b088f48b1708b8';
const AR_INDEX = 'prod_headless_ar_products';
const ALMANEA_BASE = 'https://www.almanea.sa';
const CATEGORY_IDS = ['7423','7424','7434','7436','522','7426','7364','523','534','536','538','519'];

function firstStr(val: unknown): string {
 if (!val) return '';
 if (typeof val === 'string') return val;
 if (typeof val === 'number') return String(val);
 if (Array.isArray(val)) { for (const v of val) { const s = firstStr(v); if (s) return s; } return ''; }
 if (typeof val === 'object') { for (const v of Object.values(val as Record<string,unknown>)) { const s = firstStr(v); if (s) return s; } return ''; }
 return '';
}

async function fetchAlmanea(maxPages = 3): Promise<any[]> {
 const products: any[] = [];
 const seen = new Set<string>();
 for (const catId of CATEGORY_IDS) {
   for (let page = 0; page < maxPages; page++) {
     try {
       const body = JSON.stringify({ params: `query=&hitsPerPage=100&page=${page}&filters=${encodeURIComponent(`categoryIds:"${catId}"`)}` });
       const res = await fetch(`https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${AR_INDEX}/query`, {
         method: 'POST',
         headers: { 'X-Algolia-API-Key': ALGOLIA_KEY, 'X-Algolia-Application-Id': ALGOLIA_APP_ID, 'Content-Type': 'application/json' },
         body,
       });
       if (!res.ok) break;
       const data = await res.json();
       const hits = data.hits ?? [];
       if (!hits.length) break;
       for (const hit of hits) {
         const sku = firstStr(hit.sku ?? hit.objectID);
         if (!sku || seen.has(sku)) continue;
         seen.add(sku);
         const pricing = hit.prices_with_tax || {};
         const price = Number(pricing.price ?? hit.price ?? 0);
         if (!price || price <= 0) continue;
         const nameAr = firstStr(hit.name).trim();
         if (!nameAr || nameAr.length < 3) continue;
         const rewriteUrl = firstStr(hit.rewrite_url);
         const productUrl = rewriteUrl ? `${ALMANEA_BASE}/${rewriteUrl}` : `${ALMANEA_BASE}/product/${sku}`;
         const originalPrice = Number(pricing.original_price ?? 0);
         const hasStock = hit.stock_region_ids ? Object.values(hit.stock_region_ids as Record<string,number>).some(q => q > 0) : true;
         products.push({
           name_ar: nameAr, name_en: nameAr,
           brand: firstStr(hit.brand) || 'Unknown',
           category: 'accessories',
           current_price: price,
           original_price: originalPrice > price ? originalPrice : null,
           product_url: productUrl,
           availability: hasStock ? 'in_stock' : 'out_of_stock',
         });
       }
       if (page + 1 >= (data.nbPages ?? 0)) break;
       await new Promise(r => setTimeout(r, 150));
     } catch (err) { console.error(`[Almanea] cat ${catId} page ${page}:`, err); break; }
   }
 }
 console.log(`[Almanea] Total: ${products.length}`);
 return products;
}

// ─── نون API ──────────────────────────────────────────────
const NOON_API = 'https://www.noon.com/_svc/catalog/api/v3/u/en-sa/search';
const NOON_CDN = 'https://f.nooncdn.com/p';
const NOON_BASE = 'https://www.noon.com/saudi-en';
const NOON_QUERIES = ['smartphone','laptop','television','headphones','smartwatch','refrigerator'];

async function fetchNoon(maxPages = 2): Promise<any[]> {
 const products: any[] = [];
 const seen = new Set<string>();
 for (const query of NOON_QUERIES) {
   for (let page = 1; page <= maxPages; page++) {
     try {
       const res = await fetch(`${NOON_API}?q=${encodeURIComponent(query)}&page=${page}&limit=50`, {
         headers: { 'x-locale': 'en-sa', 'x-platform': 'web', 'x-content': 'desktop' }
       });
       if (!res.ok) break;
       const data = await res.json();
       const hits = (data.hits || data.results || data.products || data.data?.hits || []) as any[];
       if (!hits.length) break;
       for (const item of hits) {
         const sku = String(item.sku || item.id || '');
         if (!sku || seen.has(sku)) continue;
         seen.add(sku);
         const title = String(item.name || '');
         if (!title || title.length < 3) continue;
         const pd = (item.price || {}) as any;
         const price = Number(pd.now ?? pd.current ?? 0);
         if (!price || price <= 0) continue;
         const slug = item.slug || '';
         const productUrl = slug && sku ? `${NOON_BASE}/${slug}/${sku}/p/` : '';
         if (!productUrl) continue;
         const imageKey = item.image_key as string;
         products.push({
           name_ar: title, name_en: title,
           brand: String(item.brand || 'Unknown'),
           category: 'accessories',
           current_price: price,
           original_price: null,
           product_url: productUrl,
           image_url: imageKey ? `${NOON_CDN}/${imageKey}.jpg` : null,
           availability: item.in_stock === false ? 'out_of_stock' : 'in_stock',
         });
       }
       await new Promise(r => setTimeout(r, 300));
     } catch (err) { console.error(`[Noon] ${query} page ${page}:`, err); break; }
   }
 }
 console.log(`[Noon] Total: ${products.length}`);
 return products;
}

// ─── حفظ في Supabase ──────────────────────────────────────
async function saveProducts(products: any[], storeName: string): Promise<number> {
 const sb = createServerClient();
 let saved = 0;
 for (const p of products) {
   if (!p.name_ar?.trim() || !p.current_price || p.current_price <= 0) continue;
   if (!p.product_url?.startsWith('http')) continue;
   try {
     const { data: prod } = await sb.from('products')
       .upsert({ name_ar: p.name_ar.trim(), name_en: p.name_en || p.name_ar, brand: p.brand || 'Unknown', category: p.category || 'accessories', is_active: true }, { onConflict: 'name_ar' })
       .select('id').single();
     if (!prod) continue;
     await sb.from('product_stores').upsert({
       product_id: prod.id, store_name: storeName,
       current_price: p.current_price, original_price: p.original_price || null,
       product_url: p.product_url,
       availability: p.availability || 'in_stock', updated_at: new Date().toISOString(),
     }, { onConflict: 'product_id,store_name' });
     saved++;
   } catch (e) { console.error('[Save]', e); }
 }
 return saved;
}

// ─── MAIN ─────────────────────────────────────────────────
const STORES = [
 { slug: 'almanea', name: 'المنيع', url: 'https://www.almanea.sa/ar/mobiles-tablets', affiliate: (u: string) => u },
 { slug: 'extra', name: 'اكسترا', url: 'https://www.extra.com/ar-sa/c/smartphones', affiliate: (u: string) => u },
 { slug: 'jarir', name: 'جرير', url: 'https://www.jarir.com/sa-ar/computers-tablets', affiliate: (u: string) => u },
 { slug: 'amazon', name: 'أمازون', url: 'https://www.amazon.sa/s?i=electronics&rh=n%3A11995771031', affiliate: (u: string) => u + (u.includes('?') ? '&' : '?') + 'tag=tawveeri-21' },
 { slug: 'noon', name: 'نون', url: 'https://www.noon.com/saudi-ar/mobiles-tablets/', affiliate: (u: string) => u },
];

export async function GET(request: NextRequest) {
 const slug = new URL(request.url).searchParams.get('store_slug');

 // المنيع — Algolia مباشرة
 if (slug === 'almanea-direct') {
   const products = await fetchAlmanea(2);
   const saved = await saveProducts(products, 'المنيع');
   return NextResponse.json({ success: true, store: 'almanea', fetched: products.length, saved });
 }

 // نون — API مباشرة
 if (slug === 'noon-direct') {
   const products = await fetchNoon(2);
   const saved = await saveProducts(products, 'نون');
   return NextResponse.json({ success: true, store: 'noon', fetched: products.length, saved });
 }

 if (!slug) return NextResponse.json({ status: 'ok', stores: STORES.map(s => s.slug) });
 const store = STORES.find(s => s.slug === slug);
 if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

 const products = await scrapeWithSchema(store.url);
 const saved = await saveProducts(products, store.name);
 return NextResponse.json({ success: true, store: store.name, extracted: products.length, saved });
}

export async function POST(request: NextRequest) {
 const auth = request.headers.get('authorization');
 if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`)
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

 const results: Record<string, any> = {};
 let totalSaved = 0;

 // المنيع
 const almaneaProducts = await fetchAlmanea(10);
 const almaneaSaved = await saveProducts(almaneaProducts, 'المنيع');
 results.almanea = { fetched: almaneaProducts.length, saved: almaneaSaved };
 totalSaved += almaneaSaved;

 // نون
 const noonProducts = await fetchNoon(5);
 const noonSaved = await saveProducts(noonProducts, 'نون');
 results.noon = { fetched: noonProducts.length, saved: noonSaved };
 totalSaved += noonSaved;

 return NextResponse.json({ success: true, total_saved: totalSaved, results });
}

async function scrapeWithSchema(url: string): Promise<any[]> {
 const key = process.env.FIRECRAWL_API_KEY;
 if (!key) return [];
 try {
   const res = await fetch('https://api.firecrawl.dev/v1/extract', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
     body: JSON.stringify({
       urls: [url],
       schema: { type: 'object', properties: { products: { type: 'array', items: { type: 'object', properties: { name_ar: { type: 'string' }, current_price: { type: 'number' }, product_url: { type: 'string' } }, required: ['name_ar','current_price','product_url'] } } } },
       prompt: 'استخرج كل المنتجات مع أسمائها وأسعارها وروابطها',
     }),
   });
   if (!res.ok) return [];
   const data = await res.json();
   return data.data?.products || data.products || [];
 } catch { return []; }
}

// Force cache bust to rebuild stores
