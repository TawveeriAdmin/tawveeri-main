import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { getEnabledAdapters, getAdapterBySlug } from '@/lib/scraping/adapters';
import type { StoreAdapter, NormalizedOffer } from '@/lib/scraping/adapters';
import { startRun, finishRun, hasActiveRun } from '@/lib/scraping/services/run-logger';
import { resolveStoreId } from '@/lib/scraping/store-identity';

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
// Read by canonical store_id. The upsert still conflicts on store_name because
// that is where the unique constraint lives; changing the written label would
// orphan each store's paging state (next_page), so the label is left untouched
// and store_id is written alongside it.
async function getSyncState(storeId: number | null) {
  if (storeId === null) return null;
  const sb = createServerClient();
  const { data } = await (sb as any).from('store_sync_status').select('*').eq('store_id', storeId).maybeSingle();
  return data;
}

async function updateSyncState(storeName: string, storeId: number | null, updates: Record<string, any>) {
  const sb = createServerClient();
  await sb.from('store_sync_status').upsert({
    store_name: storeName, store_id: storeId, ...updates, updated_at: new Date().toISOString(),
  }, { onConflict: 'store_name' });
}

// ── Memory Layer (معزولة) ───────────────────────────────────
/**
 * EVIDENCE GENERATED BUT NOT PROPAGATED — see docs/ENGINEERING-RULES.md.
 *
 * This function used to `.insert(rows)` and return only a COUNT. The evidence was written
 * correctly; the identifiers that prove it were thrown away one stack frame below the code
 * that needed them. `writePriceSnapshot` runs moments later in the same request and had no
 * way to reference the observation it was recording, so `price_history.raw_observation_id` —
 * nullable, already in the schema — was NULL on every discovery row ever written.
 *
 * Measured consequence: 2,321 customer-visible offers whose displayed freshness could not be
 * proven, growing by ~654 rows a day.
 *
 * Now returns the url → id map so provenance survives the hop. Keyed on `raw_url` because
 * that is the listing's natural identity within a run; a row with no URL simply yields no
 * link and behaves exactly as before (NULL), never a guess.
 */
async function writeRawObservations(offers: NormalizedOffer[], storeName: string, storeId: number | null, runId: number | null): Promise<{ written: number; idByUrl: Map<string, number> }> {
  const idByUrl = new Map<string, number>();
  try {
    const sb = createServerClient();
    const rows = offers.map(p => ({
      store_id: storeId, store_name: storeName, source_method: p._source || 'api',
      raw_name: p.name_ar, raw_url: p.product_url, price: p.current_price,
      original_price: p.original_price, availability: p.availability, payload: p._raw ?? null,
      scraping_run_id: runId,
    }));
    if (!rows.length) return { written: 0, idByUrl };
    // `.select('id, raw_url')` adds a RETURNING clause to the same statement — one round
    // trip, no extra query. This is the whole fix.
    const { data, error } = await sb.from('raw_observations').insert(rows).select('id, raw_url');
    if (error) { console.error('[memory:raw]', error.message); return { written: 0, idByUrl }; }
    for (const r of (data ?? []) as unknown as { id: number | string; raw_url: string | null }[]) {
      if (r.raw_url) idByUrl.set(r.raw_url, Number(r.id));
    }
    return { written: rows.length, idByUrl };
  } catch (e: any) { console.error('[memory:raw:fatal]', String(e?.message || e)); return { written: 0, idByUrl }; }
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

async function writePriceSnapshot(canonicalId: string, p: NormalizedOffer, storeName: string, storeId: number | null, runId: number | null, rawObservationId: number | null = null): Promise<boolean> {
  try {
    const sb = createServerClient();
    const { error } = await sb.from('price_history').insert({
      canonical_product_id: canonicalId, store_id: storeId, store_name: storeName, price: p.current_price,
      original_price: p.original_price || null, effective_price: p.current_price,
      availability: p.availability || 'in_stock', scraping_run_id: runId,
      // The link that proves this price. NULL only when the observation had no URL to key on,
      // which is the pre-fix behaviour rather than a fabricated reference.
      raw_observation_id: rawObservationId,
    });
    if (error) { console.error('[memory:price]', error.message); return false; }
    return true;
  } catch (e: any) { console.error('[memory:price:fatal]', String(e?.message || e)); return false; }
}

// ── Save (لأي متجر) ─────────────────────────────────────────
/**
 * Persist offers.
 *
 * Counter semantics — deliberately explicit, because the historical `savedProducts`
 * metric was read as a success rate when it only ever counted NEW product inserts:
 *   fetched        offers received from the adapter
 *   skipped        offers discarded before persistence (missing name_ar, or a
 *                  duplicate name within the same batch)
 *   inserted       products created for the first time
 *   updated        product_stores rows written for products that already existed
 *   persisted      inserted + updated — the real success count
 *   failed         offers that errored during persistence
 *   priceRows      price_history rows written
 */
async function saveProducts(offers: NormalizedOffer[], storeName: string, storeId: number | null, runId: number | null, rawIdByUrl: Map<string, number> = new Map()): Promise<any> {
  const sb = createServerClient();
  const unique = new Map<string, NormalizedOffer>();
  let skippedNoName = 0;
  for (const p of offers) {
    const nameAr = p.name_ar?.trim();
    if (!nameAr) { skippedNoName++; continue; }
    unique.set(nameAr, p);
  }
  const rows = Array.from(unique.values());
  const skippedDuplicate = offers.length - skippedNoName - rows.length;
  let savedProducts = 0, savedStores = 0, memorySnapshots = 0, failed = 0;
  // Reported so a future run that silently stops linking is visible immediately, rather than
  // discovered months later by counting NULLs.
  let provenanceLinked = 0;
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
        if (insertErr || !inserted?.id) { failed++; errors.push({ step: 'insert_product', error: insertErr }); continue; }
        productId = inserted.id; savedProducts++;
      }
      const { error: storeErr } = await sb.from('product_stores').upsert({
        product_id: productId, store_id: storeId, store_name: storeName, current_price: p.current_price,
        original_price: p.original_price || null, product_url: p.product_url,
        availability: p.availability || 'in_stock', updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id,store_name' });
      if (storeErr) { failed++; errors.push({ step: 'upsert_store', error: storeErr }); continue; }
      savedStores++;
      try {
        const canonicalId = await ensureCanonicalProduct(nameAr, p);
        // Carry the observation id from the raw write in this same request.
        const rawObsId = p.product_url ? rawIdByUrl.get(p.product_url) ?? null : null;
        if (canonicalId) { const ok = await writePriceSnapshot(canonicalId, p, storeName, storeId, runId, rawObsId); if (ok) { memorySnapshots++; if (rawObsId != null) provenanceLinked++; } }
      } catch (memErr: any) { console.error('[memory:loop]', String(memErr?.message || memErr)); }
    } catch (e: any) { failed++; errors.push({ step: 'fatal', error: String(e?.message || e) }); }
  }
  return {
    fetched: offers.length,
    deduped: rows.length,
    skipped: skippedNoName + skippedDuplicate,
    skippedNoName,
    skippedDuplicate,
    inserted: savedProducts,
    updated: savedStores,
    persisted: savedProducts + savedStores,
    failed,
    priceRows: memorySnapshots,
    // Provenance health, surfaced per run. If this drifts below priceRows the link is
    // breaking, and it shows up in the run record instead of as a NULL count months later.
    provenanceLinked,
    errors: errors.length ? errors.slice(0, 3) : undefined,
    // Legacy aliases — `savedProducts` counts NEW inserts only and must not be
    // read as a success rate. Retained so store_sync_status keeps its meaning.
    savedProducts, savedStores, memorySnapshots, totalRows: rows.length,
  };
}

// ── Sync runner — يشغّل أي محوّل من البروتوكول ──────────────
async function runAdapterSync(adapter: StoreAdapter, triggeredBy: 'schedule' | 'manual' | 'api' = 'schedule') {
  const storeName = adapter.dbName;
  // Canonical identity resolved once per run from the stores registry.
  const storeId = await resolveStoreId(adapter.slug);
  if (storeId === null) {
    throw new Error(`store slug '${adapter.slug}' is not in the stores registry — refusing to ingest unidentifiable observations`);
  }

  // Overlap protection: if this store already has a run in progress (e.g. the
  // scheduler fired again before a long run finished), skip rather than double-
  // scrape. Returns a skipped marker so the caller records it without error.
  if (await hasActiveRun(storeId)) {
    return { store: storeName, slug: adapter.slug, skipped: true, reason: 'active run in progress' };
  }

  const state = await getSyncState(storeId);
  const start = state?.next_page ?? 0;

  // Observability: every ingestion run is recorded, so a failure can never be silent.
  // Logging never blocks ingestion — startRun returns null on failure and we continue.
  const runId = await startRun({
    store_name: storeName,
    store_id: storeId,
    job_type: 'discovery',
    triggered_by: triggeredBy,
  });

  await updateSyncState(storeName, storeId, { status: 'syncing', last_started_at: new Date().toISOString() });

  try {
    const result = await adapter.fetchBatch(start, BATCH_SIZE);
    const raw = await writeRawObservations(result.offers, storeName, storeId, runId);
    const rawWritten = raw.written;
    const saveResult = await saveProducts(result.offers, storeName, storeId, runId, raw.idByUrl);
    await updateSyncState(storeName, storeId, {
      status: result.done ? 'completed' : 'syncing', next_page: result.done ? 0 : result.nextState,
      last_finished_at: new Date().toISOString(),
      total_fetched: (state?.total_fetched ?? 0) + result.offers.length,
      total_saved: (state?.total_saved ?? 0) + saveResult.savedProducts, last_error: result.lastError || null,
    });

    // A run that fetched nothing is 'success' only if the adapter says it is
    // finished; otherwise it is a zero-result run and must be visible as such.
    const zeroResult = result.offers.length === 0 && !result.done;
    const status = result.lastError ? 'partial' : zeroResult ? 'partial' : 'success';

    if (runId !== null) {
      await finishRun({
        run_id: runId,
        status,
        products_discovered: result.offers.length,
        products_new: saveResult.inserted,
        products_updated: saveResult.updated,
        products_failed: saveResult.failed,
        price_changes_detected: saveResult.priceRows,
        errors_count: result.lastError ? 1 : 0,
        error_summary: result.lastError
          ? { message: String(result.lastError) }
          : zeroResult
            ? { message: 'zero-result run: adapter returned no offers and did not report completion' }
            : null,
      });
    }

    return {
      store: storeName, slug: adapter.slug, runId, done: result.done, zeroResult,
      fetched: saveResult.fetched, skipped: saveResult.skipped,
      inserted: saveResult.inserted, updated: saveResult.updated,
      persisted: saveResult.persisted, failed: saveResult.failed,
      rawObservationsWritten: rawWritten, priceRowsWritten: saveResult.priceRows,
    };
  } catch (err: any) {
    if (runId !== null) {
      await finishRun({
        run_id: runId,
        status: 'failed',
        errors_count: 1,
        error_summary: { message: String(err?.message || err) },
      });
    }
    throw err;
  }
}

// ── Routes ───────────────────────────────────────────────────
/**
 * Read-only descriptor / preview.
 *
 * SECURITY: this GET previously accepted `?sync=1` and wrote raw_observations,
 * products, product_stores and price_history with no authentication. Ingestion
 * is a production write and must only run through the authenticated POST below
 * (Authorization: Bearer CRON_SECRET). GET performs no database writes; `sync`
 * is rejected here and directed to POST.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slugParam = url.searchParams.get('store_slug');
  const sync = url.searchParams.get('sync');
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

  if (sync) {
    return json({
      error: 'sync writes are not permitted over GET',
      remediation: 'POST /api/cron/discover-firecrawl with Authorization: Bearer <CRON_SECRET>',
    }, 405);
  }

  if (!slugParam) {
    const adapters = getEnabledAdapters();
    const syncState: Record<string, any> = {};
    for (const a of adapters) syncState[a.slug] = await getSyncState(await resolveStoreId(a.slug));
    return json({ status: 'ok', protocol: 'StoreAdapter v1', stores: adapters.map(a => `${a.slug}-direct`), syncState });
  }

  // Fetch-only preview — no database writes. يدعم 'almanea-direct' و 'almanea' معاً
  const slug = slugParam.replace(/-direct$/, '');
  const adapter = getAdapterBySlug(slug);
  if (!adapter) return json({ error: 'Store not found', slug: slugParam }, 404);

  const { offers, lastError } = await adapter.fetchBatch(0, limit);
  return json({
    success: true, mode: 'fetch-only', store: `${adapter.slug}-direct`, storeName: adapter.dbName,
    fetched: offers.length, lastError,
    note: 'GET is read-only. To ingest, POST with CRON_SECRET.',
    sampleFetched: offers[0] ? { ...offers[0], _raw: undefined } : null,
  });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)
    return json({ error: 'Unauthorized' }, 401);
  const results: any[] = [];
  for (const adapter of getEnabledAdapters()) {
    try { results.push(await runAdapterSync(adapter)); }
    catch (e: any) {
      await updateSyncState(adapter.dbName, await resolveStoreId(adapter.slug), { status: 'failed', last_error: String(e?.message || e) });
      results.push({ store: adapter.dbName, slug: adapter.slug, error: String(e?.message || e) });
    }
  }
  const anySuccess = results.some(r => !r.error);
  return json({ success: anySuccess, results }, anySuccess ? 200 : 500);
}
