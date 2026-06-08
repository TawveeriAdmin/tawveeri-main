import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const maxDuration = 900;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || 'no-sha';
const VERSION = 'tawveeri-cron-2026-06-09-v7-correct-schema';

const ALGOLIA_APP_ID = 'WCK19QC65I';
const ALGOLIA_KEY = 'be7745237f5f94f715b088f48b1708b8';
const AR_INDEX = 'prod_headless_ar_products';
const CATEGORY_IDS = ['7423','7424','7434','7436','522','7426','7364','523','534','536','538','519'];

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

async function fetchAlmanea(maxPages = 10): Promise<any[]> {
 const products: any[] = [];
 const seen = new Set<string>();

 for (const catId of CATEGORY_IDS) {
   for (let page = 0; page < maxPages; page++) {
     try {
       const body = JSON.stringify({
         params: `query=&hitsPerPage=100&page=${page}&filters=${encodeURIComponent(`categoryIds:"${catId}"`)}`,
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
           is_available: hasStock,
         });
       }
       if (page + 1 >= (data.nbPages ?? 0)) break;
       await new Promise(r => setTimeout(r, 100));
     } catch (err) {
       console.error('[Almanea]', err);
       break;
     }
   }
 }
 console.log(`[Almanea] Total: ${products.length}`);
 return products;
}

async function saveProducts(products: any[]): Promise<any> {
 const sb = createServerClient();
 const unique = new Map<string, any>();

 for (const p of products) {
   const nameAr = p.name_ar?.trim();
   if (!nameAr) continue;
   unique.set(nameAr, p);
 }

 const rows = Array.from(unique.values());
 let saved = 0;
 const errors: any[] = [];
 const chunkSize = 20;

 for (let i = 0; i < rows.length; i += chunkSize) {
   const chunk = rows.slice(i, i + chunkSize);

   for (const p of chunk) {
     try {
       // ١. أدخل أو احصل على المنتج
       const { data: existing } = await sb
         .from('products')
         .select('id')
         .eq('name_ar', p.name_ar.trim())
         .single();

       let productId: string;

       if (existing) {
         productId = existing.id;
       } else {
         const { data: inserted, error: insertErr } = await sb
           .from('products')
           .insert({
             name_ar: p.name_ar.trim(),
             name_en: p.name_en || p.name_ar.trim(),
             brand: p.brand || 'Unknown',
             category: p.category || 'accessories',
           })
           .select('id')
           .single();

         if (insertErr || !inserted) {
           errors.push(insertErr);
           continue;
         }
         productId = inserted.id;
       }

       // ٢. أدخل أو حدّث في product_stores
       await sb.from('product_stores').upsert({
         product_id: productId,
         store_slug: 'almanea',
         store_name: 'المنيع',
         price: p.current_price,
         old_price: p.original_price || null,
         url: p.product_url,
         is_available: p.is_available ?? true,
       }, { onConflict: 'product_id,store_slug' });

       saved++;
     } catch (e) {
       errors.push(e);
     }
   }
 }

 return { saved, errors: errors.length ? errors.slice(0, 3) : undefined, totalRows: rows.length };
}

const STORES = [{ slug: 'almanea-direct', name: 'المنيع' }];

export async function GET(request: NextRequest) {
 const url = new URL(request.url);
 const slug = url.searchParams.get('store_slug');
 const sync = url.searchParams.get('sync');
 const pages = Number(url.searchParams.get('pages') || 10);

 if (!slug) return json({ status: 'ok', stores: STORES.map(s => s.slug) });

 if (slug === 'almanea-direct') {
   const products = await fetchAlmanea(pages);
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

 const products = await fetchAlmanea(10);
 const saveResult = await saveProducts(products);
 return json({
   success: true,
   total_saved: saveResult.saved,
   results: { almanea: { fetched: products.length, saved: saveResult.saved } },
 });
}
