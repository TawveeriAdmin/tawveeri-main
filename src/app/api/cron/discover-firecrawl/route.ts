import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getEnabledAdapters, getAdapterBySlug } from '@/lib/scraping/adapters';
import type { StoreAdapter, NormalizedOffer } from '@/lib/scraping/adapters';

export const runtime = 'nodejs';
export const maxDuration = 900;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || 'no-sha';
const VERSION = 'tawveeri-cron-2026-06-13-v15-protocol';
const BATCH_SIZE = 300;

function json(data: Record<string, any>, status = 200) {
  return NextResponse.json(
    { version: VERSION, build: BUILD_SHA, ...data },
    { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}

// ── Sync State ───────────────────────────────────────────────
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

// ── Memory Layer (معزولة) ───────────────────────────────────
async function writeRawObservations(offers: NormalizedOffer[], storeName: string): Promise<number> {
  try {
    const sb = createServerClient();
    const rows = offers.map(p => ({
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

async function ensureCanonicalProduct(nameAr: string, p: NormalizedOffer): Promise<string | null> {
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

async function writePriceSnapshot(canonicalId: string, p: NormalizedOffer, storeName: string): Promise<boolean> {
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

// ── Save (لأي متجر) ─────────────────────────────────────────
async function saveProducts(offers: NormalizedOffer[], storeName: string): Promise<any> {
  const sb = createServerClient();
  const unique = new Map<string, NormalizedOffer>();
  for (const p of offers) { const nameAr = p.name_ar?.trim(); if (!nameAr) continue; unique.set(nameAr, p); }
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

// ── Sync runner — يشغّل أي محوّل من البروتوكول ──────────────
async function runAdapterSync(adapter: StoreAdapter) {
  const storeName = adapter.dbName;
  const state = await getSyncState(storeName);
  const start = state?.next_page ?? 0;
  await updateSyncState(storeName, { status: 'syncing', last_started_at: new Date().toISOString() });
  const result = await adapter.fetchBatch(start, BATCH_SIZE);
  const rawWritten = await writeRawObservations(result.offers, storeName);
  const saveResult = await saveProducts(result.offers, storeName);
  await updateSyncState(storeName, {
    status: result.done ? 'completed' : 'syncing', next_page: result.done ? 0 : result.nextState,
    last_finished_at: new Date().toISOString(),
    total_fetched: (state?.total_fetched ?? 0) + result.offers.length,
    total_saved: (state?.total_saved ?? 0) + saveResult.savedProducts, last_error: result.lastError || null,
  });
  return { store: storeName, slug: adapter.slug, fetched: result.offers.length, savedProducts: saveResult.savedProducts, savedStores: saveResult.savedStores, rawWritten, memorySnapshots: saveResult.memorySnapshots, done: result.done };
}

// ── Routes ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slugParam = url.searchParams.get('store_slug');
  const sync = url.searchParams.get('sync');
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

  if (!slugParam) {
    const adapters = getEnabledAdapters();
    const syncState: Record<string, any> = {};
    for (const a of adapters) syncState[a.slug] = await getSyncState(a.dbName);
    return json({ status: 'ok', protocol: 'StoreAdapter v1', stores: adapters.map(a => `${a.slug}-direct`), syncState });
  }

  // يدعم 'almanea-direct' و 'almanea' معاً
  const slug = slugParam.replace(/-direct$/, '');
  const adapter = getAdapterBySlug(slug);
  if (!adapter) return json({ error: 'Store not found', slug: slugParam }, 404);

  const { offers, lastError } = await adapter.fetchBatch(0, limit);
  let rawWritten = 0;
  if (sync) rawWritten = await writeRawObservations(offers, adapter.dbName);
  const saveResult = sync ? await saveProducts(offers, adapter.dbName) : { saved: 0, note: 'add &sync=1' };
  return json({
    success: true, mode: sync ? 'sync' : 'fetch-only', store: `${adapter.slug}-direct`, storeName: adapter.dbName,
    fetched: offers.length, lastError, rawWritten, saveResult,
    sampleFetched: offers[0] ? { ...offers[0], _raw: undefined } : null,
  });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`)
    return json({ error: 'Unauthorized' }, 401);
  const results: any[] = [];
  for (const adapter of getEnabledAdapters()) {
    try { results.push(await runAdapterSync(adapter)); }
    catch (e: any) {
      await updateSyncState(adapter.dbName, { status: 'failed', last_error: String(e?.message || e) });
      results.push({ store: adapter.dbName, slug: adapter.slug, error: String(e?.message || e) });
    }
  }
  const anySuccess = results.some(r => !r.error);
  return json({ success: anySuccess, results }, anySuccess ? 200 : 500);
}
