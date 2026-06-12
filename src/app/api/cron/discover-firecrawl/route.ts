import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const maxDuration = 900;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || 'no-sha';
const VERSION = 'tawveeri-cron-2026-06-12-v14-extra';

const ALGOLIA_APP_ID = 'WCK19QC65I';
const ALGOLIA_KEY = 'be7745237f5f94f715b088f48b1708b8';
const AR_INDEX = 'prod_headless_ar_products';
const CATEGORY_IDS = ['7423','7424','7434','7436','522','7426','7364','523','534','536','538','519'];
const BATCH_SIZE = 300;

// Extra — Unbxd API
const UNBXD_API_KEY = '8fb45132f31d81ab46966cc135c24430';
const UNBXD_SITE_KEY = 'ss-unbxd-auk-extra-saudi-ar-prod11541714990564';
const UNBXD_BASE = `https://search.unbxdapi.com/${UNBXD_API_KEY}/${UNBXD_SITE_KEY}/search`;
const EXTRA_QUERIES = [
  'مكيف','ثلاجة','غسالة','جوال','تلفزيون','لابتوب','شاشة',
  'سماعة','مايكروويف','مكنسة','ساعة ذكية','تابلت',
];

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

function toNum(val: unknown): number | null {
 if (val === null || val === undefined) return null;
 const n = typeof val === 'number' ? val : parseFloat(String(val));
 return isNaN(n) ? null : n;
}

// ── Sync State ──────────────────────────────────────────────
async function getSyncState(storeName: string) {
 const sb = createServerClient();
 const { data } = await sb.from('store_sync_status').select('*').eq('store_name', storeName).maybeSingle();
 return data;
}

async function updateSyncState(storeName: string, updates: Record<string, any>) {
 const sb = createServerClient();
 await sb.from('store_sync_status').upsert({
   store_name: storeName, ...updates, updated_at: new Date().toISOString(),
 }, { onConflict: 'store_name' });
}

// ── Memory Layer (معزولة) ──
async function writeRawObservations(products: any[], storeName: string): Promise<number> {
 try {
   const sb = createServerClient();
   const rows = products.map(p => ({
     store_name: storeName, source_method: p._source || 'api',
     raw_name: p.name_ar, raw_url: p.product_url, price: p.current_price,
     original_price: p.original_price, availability: p.availability, payload: p._raw ?? null,
   }));
   if (!rows.length) return 0;
   const { error } = await sb.from('raw_observations').insert(rows);
   if (error) { console.error('[memory:raw]', error.message); return 0; }
   return rows.length;
 } catch (e: any) { console.error('[memory:raw:fatal]', String(e?.message || e)); return 0; }
}

async function ensureCanonicalProduct(nameAr: string, p: any): Promise<string | null> {
 try {
   const sb = createServerClient();
   const { data: existing } = await sb.from('canonical_products').select('id').eq('name_ar', nameAr).maybeSingle();
   if (existing?.id) return existing.id;
   const { data: inserted, error } = await sb.from('canonical_products').insert({
     name_ar: nameAr, name_en: p.name_en || nameAr, brand: p.brand || 'Unknown', category: p.category || 'accessories',
   }).select('id').single();
   if (error || !inserted?.id) { if (error) console.error('[memory:canonical]', error.message); return null; }
   return inserted.id;
 } catch (e: any) { console.error('[memory:canonical:fatal]', String(e?.message || e)); return null; }
}

async function writePriceSnapshot(canonicalId: string, p: any, storeName: string): Promise<boolean> {
 try {
   const sb = createServerClient();
   const { error } = await sb.from('price_history').insert({
     canonical_product_id: canonicalId, store_name: storeName, price: p.current_price,
     original_price: p.original_price || null, effective_price: p.current_price,
     availability: p.availability || 'in_stock',
   });
   if (error) { console.error('[memory:price]', error.message); return false; }
   return true;
 } catch (e: any) { console.error('[memory:price:fatal]', String(e?.message || e)); return false; }
}

// ── Fetch: Almanea (Algolia) ─────────────────────────────────
async function fetchAlmanea(startPage = 0, maxItems = BATCH_SIZE): Promise<{ products: any[]; nextPage: number; done: boolean }> {
 const products: any[] = [];
 const seen = new Set<string>();
 let currentPage = startPage;

 for (let i = 0; i < CATEGORY_IDS.length; i++) {
   const catId = CATEGORY_IDS[i];
   const page = i === 0 ? currentPage : 0;
   for (let p = page; p < 100; p++) {
     if (products.length >= maxItems) return { products, nextPage: p, done: false };
     try {
       const body = JSON.stringify({ params: `query=&hitsPerPage=100&page=${p}&filters=${encodeURIComponent(`categoryIds:"${catId}"`)}` });
       const res = await fetch(`https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${AR_INDEX}/query`, {
         method: 'POST', cache: 'no-store',
         headers: { 'X-Algolia-API-Key': ALGOLIA_KEY, 'X-Algolia-Application-Id': ALGOLIA_APP_ID, 'Content-Type': 'application/json' },
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
         const productUrl = rewriteUrl ? `https://www.almanea.sa/${rewriteUrl}` : `https://www.almanea.sa/product/${sku}`;
         const hasStock = hit.stock_region_ids ? Object.values(hit.stock_region_ids as Record<string, number>).some(q => q > 0) : true;
         products.push({
           name_ar: nameAr, name_en: nameAr, brand: firstStr(hit.brand) || 'Unknown', category: 'accessories',
           current_price: price, original_price: originalPrice > price ? originalPrice : null,
           product_url: productUrl, availability: hasStock ? 'in_stock' : 'out_of_stock', _raw: hit, _source: 'algolia',
         });
       }
       if (p + 1 >= (data.nbPages ?? 0)) break;
       await new Promise(r => setTimeout(r, 100));
     } catch (err) { console.error('[Almanea]', err); break; }
   }
 }
 return { products, nextPage: 0, done: true };
}

// ── Fetch: Extra (Unbxd API) ─────────────────────────────────
// state encoding: next_page = queryIndex * 1000 + page
async function fetchExtra(startState = 0, maxItems = BATCH_SIZE): Promise<{ products: any[]; nextState: number; done: boolean; lastError?: string }> {
 const products: any[] = [];
 const seen = new Set<string>();
 let lastError = '';
 let qIdx = Math.floor(startState / 1000);
 let startPg = (startState % 1000) || 1;
 const ROWS = 50;

 for (let i = qIdx; i < EXTRA_QUERIES.length; i++) {
   const query = EXTRA_QUERIES[i];
   const firstPage = i === qIdx ? startPg : 1;
   for (let pg = firstPage; pg <= 30; pg++) {
     if (products.length >= maxItems) return { products, nextState: i * 1000 + pg, done: false, lastError };
     const start = (pg - 1) * ROWS;
     const controller = new AbortController();
     const timer = setTimeout(() => controller.abort(), 15000);
     try {
       const url = `${UNBXD_BASE}?q=${encodeURIComponent(query)}&rows=${ROWS}&start=${start}&format=json&version=V2`;
       const res = await fetch(url, {
         cache: 'no-store', signal: controller.signal,
         headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', 'Accept': 'application/json' },
       });
       if (!res.ok) { lastError = `HTTP ${res.status} q=${query} pg=${pg}`; console.error('[Extra]', lastError); break; }
       const data = await res.json();
       const items = (data?.response?.products || data?.products || []) as any[];
       if (!items.length) break;
       for (const item of items) {
         if (products.length >= maxItems) return { products, nextState: i * 1000 + pg, done: false, lastError };
         const title = String(item.title || item.nameAr || item.name || '').trim();
         if (!title || title.length < 3) continue;
         const uniqueId = String(item.uniqueId || item.sku || item.productId || item.id || '');
         if (!uniqueId || seen.has(uniqueId)) continue;
         seen.add(uniqueId);
         const price = toNum(item.price ?? item.minPrice ?? item.sellingPrice);
         if (!price || price <= 0) continue;
         const wasPrice = toNum(item.wasPrice ?? item.mrp ?? item.listPrice);
         const brand = String(item.brand || item.brandAr || item.manufacturer || 'Unknown');
         let productUrl = String(item.productUrl || item.url || '');
         if (productUrl && productUrl.startsWith('/')) productUrl = `https://www.extra.com${productUrl}`;
         if (!productUrl && uniqueId) productUrl = `https://www.extra.com/ar-sa/p/${uniqueId}`;
         products.push({
           name_ar: title, name_en: String(item.title_en || item.nameEn || title),
           brand, category: 'accessories', current_price: price,
           original_price: wasPrice && wasPrice > price ? wasPrice : null,
           product_url: productUrl,
           availability: (item.availability === 'false' || item.inStock === false) ? 'out_of_stock' : 'in_stock',
           _raw: item, _source: 'unbxd_extra',
         });
       }
       await new Promise(r => setTimeout(r, 300));
     } catch (err: any) {
       lastError = String(err?.name === 'AbortError' ? `timeout q=${query} pg=${pg}` : err?.message || err);
       console.error('[Extra]', lastError); break;
     } finally { clearTimeout(timer); }
   }
 }
 return { products, nextState: 0, done: true, lastError };
}

// ── Save (لأي متجر) ──────────────────────────────────────────
async function saveProducts(products: any[], storeName: string): Promise<any> {
 const sb = createServerClient();
 const unique = new Map<string, any>();
 for (const p of products) { const nameAr = p.name_ar?.trim(); if (!nameAr) continue; unique.set(nameAr, p); }
 const rows = Array.from(unique.values());
 let savedProducts = 0, savedStores = 0, memorySnapshots = 0;
 const errors: any[] = [];
 for (const p of rows) {
   try {
     const nameAr = p.name_ar.trim();
     const { data: existing } = await sb.from('products').select('id').eq('name_ar', nameAr).maybeSingle();
     let productId = existing?.id;
     if (!productId) {
       const { data: inserted, error: insertErr } = await sb.from('products')
         .insert({ name_ar: nameAr, name_en: p.name_en || nameAr, brand: p.brand || 'Unknown', category: p.category || 'accessories' })
         .select('id').single();
       if (insertErr || !inserted?.id) { errors.push({ step: 'insert_product', error: insertErr }); continue; }
       productId = inserted.id; savedProducts++;
     }
     const { error: storeErr } = await sb.from('product_stores').upsert({
       product_id: productId, store_name: storeName, current_price: p.current_price,
       original_price: p.original_price || null, product_url: p.product_url,
       availability: p.availability || 'in_stock', updated_at: new Date().toISOString(),
     }, { onConflict: 'product_id,store_name' });
     if (storeErr) { errors.push({ step: 'upsert_store', error: storeErr }); continue; }
     savedStores++;
     try {
       const canonicalId = await ensureCanonicalProduct(nameAr, p);
       if (canonicalId) { const ok = await writePriceSnapshot(canonicalId, p, storeName); if (ok) memorySnapshots++; }
     } catch (memErr: any) { console.error('[memory:loop]', String(memErr?.message || memErr)); }
   } catch (e: any) { errors.push({ step: 'fatal', error: String(e?.message || e) }); }
 }
 return { saved: savedProducts, savedProducts, savedStores, memorySnapshots, errors: errors.length ? errors.slice(0, 3) : undefined, totalRows: rows.length };
}

// ── Sync runner ──────────────────────────────────────────────
async function runStoreSync(storeName: string, fetcher: (start: number, max: number) => Promise<{ products: any[]; nextState?: number; nextPage?: number; done: boolean }>) {
 const state = await getSyncState(storeName);
 const start = state?.next_page ?? 0;
 await updateSyncState(storeName, { status: 'syncing', last_started_at: new Date().toISOString() });
 const result = await fetcher(start, BATCH_SIZE);
 const next = (result as any).nextState ?? (result as any).nextPage ?? 0;
 const rawWritten = await writeRawObservations(result.products, storeName);
 const saveResult = await saveProducts(result.products, storeName);
 await updateSyncState(storeName, {
   status: result.done ? 'completed' : 'syncing', next_page: result.done ? 0 : next,
   last_finished_at: new Date().toISOString(),
   total_fetched: (state?.total_fetched ?? 0) + result.products.length,
   total_saved: (state?.total_saved ?? 0) + saveResult.savedProducts, last_error: null,
 });
 return { store: storeName, fetched: result.products.length, savedProducts: saveResult.savedProducts, savedStores: saveResult.savedStores, rawWritten, memorySnapshots: saveResult.memorySnapshots, done: result.done };
}

// ── Routes ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
 const url = new URL(request.url);
 const slug = url.searchParams.get('store_slug');
 const sync = url.searchParams.get('sync');
 const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

 if (!slug) {
   const almanea = await getSyncState('المنيع');
   const extra = await getSyncState('اكسترا');
   return json({ status: 'ok', stores: ['almanea-direct', 'extra-direct'], syncState: { almanea, extra } });
 }
 if (slug === 'almanea-direct') {
   const { products } = await fetchAlmanea(0, limit);
   let rawWritten = 0;
   if (sync) rawWritten = await writeRawObservations(products, 'المنيع');
   const saveResult = sync ? await saveProducts(products, 'المنيع') : { saved: 0, note: 'add &sync=1' };
   return json({ success: true, mode: sync ? 'sync' : 'fetch-only', store: 'almanea-direct', fetched: products.length, rawWritten, saveResult, sampleFetched: products[0] ? { ...products[0], _raw: undefined } : null });
 }
 if (slug === 'extra-direct') {
   const { products, lastError } = await fetchExtra(0, limit);
   let rawWritten = 0;
   if (sync) rawWritten = await writeRawObservations(products, 'اكسترا');
   const saveResult = sync ? await saveProducts(products, 'اكسترا') : { saved: 0, note: 'add &sync=1' };
   return json({ success: true, mode: sync ? 'sync' : 'fetch-only', store: 'extra-direct', fetched: products.length, lastError, rawWritten, saveResult, sampleFetched: products[0] ? { ...products[0], _raw: undefined } : null });
 }
 return json({ error: 'Store not found', slug }, 404);
}

export async function POST(request: NextRequest) {
 const auth = request.headers.get('authorization');
 if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`)
   return json({ error: 'Unauthorized' }, 401);
 const results: any[] = [];
 try { results.push(await runStoreSync('المنيع', (s, m) => fetchAlmanea(s, m))); }
 catch (e: any) { await updateSyncState('المنيع', { status: 'failed', last_error: String(e?.message || e) }); results.push({ store: 'المنيع', error: String(e?.message || e) }); }
 try { results.push(await runStoreSync('اكسترا', (s, m) => fetchExtra(s, m))); }
 catch (e: any) { await updateSyncState('اكسترا', { status: 'failed', last_error: String(e?.message || e) }); results.push({ store: 'اكسترا', error: String(e?.message || e) }); }
 const anySuccess = results.some(r => !r.error);
 return json({ success: anySuccess, results }, anySuccess ? 200 : 500);
}
