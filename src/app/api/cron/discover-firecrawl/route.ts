import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const maxDuration = 900;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || 'no-sha';
const VERSION = 'tawveeri-cron-2026-06-09-v11-stateful';

const ALGOLIA_APP_ID = 'WCK19QC65I';
const ALGOLIA_KEY = 'be7745237f5f94f715b088f48b1708b8';
const AR_INDEX = 'prod_headless_ar_products';
const CATEGORY_IDS = ['7423','7424','7434','7436','522','7426','7364','523','534','536','538','519'];
const BATCH_SIZE = 300;

function json(data: Record<string, any>, status = 200) {
 return NextResponse.json(
   { version: VERSION, build: BUILD_SHA, ...data },
   { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
 );
}

function firstStr(val: unknown): string {
 if (!val) return '';
 if (typeof val === 'string') return val;
 if (typeof val === 'number') return String(val);
 if (Array.isArray(val)) { for (const v of val) { const s = firstStr(v); if (s) return s; } return ''; }
 if (typeof val === 'object') { for (const v of Object.values(val as Record<string, unknown>)) { const s = firstStr(v); if (s) return s; } }
 return '';
}

// ── Sync State ──────────────────────────────────────────────
async function getSyncState(storeName: string) {
 const sb = createServerClient();
 const { data } = await sb
   .from('store_sync_status')
   .select('*')
   .eq('store_name', storeName)
   .maybeSingle();
 return data;
}

async function updateSyncState(storeName: string, updates: Record<string, any>) {
 const sb = createServerClient();
 await sb.from('store_sync_status').upsert({
   store_name: storeName,
   ...updates,
   updated_at: new Date().toISOString(),
 }, { onConflict: 'store_name' });
}

// ── Fetch ────────────────────────────────────────────────────
async function fetchAlmanea(startPage = 0, maxItems = BATCH_SIZE): Promise<{ products: any[]; nextPage: number; done: boolean }> {
 const products: any[] = [];
 const seen = new Set<string>();
 let currentCatIndex = 0;
 let currentPage = startPage;
 let done = false;

 for (let i = currentCatIndex; i < CATEGORY_IDS.length; i++) {
   const catId = CATEGORY_IDS[i];
   const page = i === currentCatIndex ? currentPage : 0;

   for (let p = page; p < 100; p++) {
     if (products.length >= maxItems) {
       return { products, nextPage: p, done: false };
     }
     try {
       const body = JSON.stringify({
         params: `query=&hitsPerPage=100&page=${p}&filters=${encodeURIComponent(`categoryIds:"${catId}"`)}`,
       });
       const res = await fetch(`https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${AR_INDEX}/query`, {
         method: 'POST',
         cache: 'no-store',
         headers: {
           'X-Algolia-API-Key': ALGOLIA_KEY,
           'X-Algolia-Application-Id': ALGOLIA_APP_ID,
           'Content-Type': 'application/json',
         },
         body,
       });
       if (!res.ok) break;
       const data = await res.json();
       const hits = data.hits ?? [];
       if (!hits.length) break;

       for (const hit of hits) {
         if (products.length >= maxItems) return { products, nextPage: p, done: false };
         const sku = firstStr(hit.sku ?? hit.objectID);
         if (!sku || seen.has(sku)) continue;
         seen.add(sku);
         const nameAr = firstStr(hit.name).trim();
         if (!nameAr || nameAr.length < 3) continue;
         const pricing = hit.prices_with_tax || {};
         const price = Number(pricing.price ?? hit.price ?? 0);
         if (!price || price <= 0) continue;
         const originalPrice = Number(pricing.original_price ?? 0);
         const rewriteUrl = firstStr(hit.rewrite_url);
         const productUrl = rewriteUrl
           ? `https://www.almanea.sa/${rewriteUrl}`
           : `https://www.almanea.sa/product/${sku}`;
         const hasStock = hit.stock_region_ids
           ? Object.values(hit.stock_region_ids as Record<string, number>).some(q => q > 0)
           : true;

         products.push({
           name_ar: nameAr,
           name_en: nameAr,
           brand: firstStr(hit.brand) || 'Unknown',
           category: 'accessories',
           current_price: price,
           original_price: originalPrice > price ? originalPrice : null,
           product_url: productUrl,
           availability: hasStock ? 'in_stock' : 'out_of_stock',
         });
       }
       if (p + 1 >= (data.nbPages ?? 0)) break;
       await new Promise(r => setTimeout(r, 100));
     } catch (err) {
       console.error('[Almanea]', err);
       break;
     }
   }
 }

 done = true;
 return { products, nextPage: 0, done };
}

// ── Save ─────────────────────────────────────────────────────
async function saveProducts(products: any[]): Promise<any> {
 const sb = createServerClient();
 const unique = new Map<string, any>();
 for (const p of products) {
   const nameAr = p.name_ar?.trim();
   if (!nameAr) continue;
   unique.set(nameAr, p);
 }

 const rows = Array.from(unique.values());
 let savedProducts = 0;
 let savedStores = 0;
 const errors: any[] = [];

 for (const p of rows) {
   try {
     const nameAr = p.name_ar.trim();
     const { data: existing } = await sb.from('products').select('id').eq('name_ar', nameAr).maybeSingle();
     let productId = existing?.id;

     if (!productId) {
       const { data: inserted, error: insertErr } = await sb
         .from('products')
         .insert({ name_ar: nameAr, name_en: p.name_en || nameAr, brand: p.brand || 'Unknown', category: p.category || 'accessories' })
         .select('id').single();
       if (insertErr || !inserted?.id) { errors.push({ step: 'insert_product', error: insertErr }); continue; }
       productId = inserted.id;
       savedProducts++;
     }

     const { error: storeErr } = await sb.from('product_stores').upsert({
       product_id: productId,
       store_name: 'المنيع',
       current_price: p.current_price,
       original_price: p.original_price || null,
       product_url: p.product_url,
       availability: p.availability || 'in_stock',
       updated_at: new Date().toISOString(),
     }, { onConflict: 'product_id,store_name' });

     if (storeErr) { errors.push({ step: 'upsert_store', error: storeErr }); continue; }
     savedStores++;
   } catch (e: any) {
     errors.push({ step: 'fatal', error: String(e?.message || e) });
   }
 }

 return { saved: savedProducts, savedProducts, savedStores, errors: errors.length ? errors.slice(0, 3) : undefined, totalRows: rows.length };
}

// ── Routes ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
 const url = new URL(request.url);
 const slug = url.searchParams.get('store_slug');
 const sync = url.searchParams.get('sync');
 const pages = Math.min(Number(url.searchParams.get('pages') || 1), 2);
 const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

 if (!slug) {
   const state = await getSyncState('المنيع');
   return json({ status: 'ok', stores: ['almanea-direct'], syncState: state });
 }

 if (slug === 'almanea-direct') {
   const { products } = await fetchAlmanea(0, limit);
   const saveResult = sync ? await saveProducts(products) : { saved: 0, note: 'add &sync=1 to save' };
   return json({
     success: true,
     mode: sync ? 'sync' : 'fetch-only',
     store: 'almanea-direct',
     fetched: products.length,
     saved: saveResult.saved,
     saveResult,
     sampleFetched: products[0] || null,
   });
 }

 return json({ error: 'Store not found', slug }, 404);
}

export async function POST(request: NextRequest) {
 const auth = request.headers.get('authorization');
 if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`)
   return json({ error: 'Unauthorized' }, 401);

 // جلب حالة الـ sync
 const state = await getSyncState('المنيع');
 const nextPage = state?.next_page ?? 0;

 // تحديث الحالة: جاري
 await updateSyncState('المنيع', {
   status: 'syncing',
   last_started_at: new Date().toISOString(),
 });

 try {
   const { products, nextPage: newNextPage, done } = await fetchAlmanea(nextPage, BATCH_SIZE);
   const saveResult = await saveProducts(products);

   // تحديث الحالة بعد الانتهاء
   await updateSyncState('المنيع', {
     status: done ? 'completed' : 'syncing',
     next_page: done ? 0 : newNextPage, // إذا انتهى يرجع من البداية
     last_finished_at: new Date().toISOString(),
     total_fetched: (state?.total_fetched ?? 0) + products.length,
     total_saved: (state?.total_saved ?? 0) + saveResult.savedProducts,
     last_error: null,
   });

   return json({
     success: true,
     batch: { fetched: products.length, savedProducts: saveResult.savedProducts, savedStores: saveResult.savedStores },
     nextPage: done ? 0 : newNextPage,
     done,
     totalFetchedSoFar: (state?.total_fetched ?? 0) + products.length,
   });
 } catch (e: any) {
   await updateSyncState('المنيع', { status: 'failed', last_error: String(e?.message || e) });
   return json({ success: false, error: String(e?.message || e) }, 500);
 }
}
