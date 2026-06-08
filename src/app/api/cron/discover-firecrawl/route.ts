import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const maxDuration = 900;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || 'no-sha';
const VERSION = 'tawveeri-cron-2026-06-08-v3-debug-save';

const ALGOLIA_APP_ID = 'WCK19QC65I';
const ALGOLIA_KEY = 'be7745237f5f94f715b088f48b1708b8';
const AR_INDEX = 'prod_headless_ar_products';
const CATEGORY_IDS = ['7423','7424','7434','7436','522','7426','7364','523','534','536','538','519'];

function json(data: Record<string, any>, status = 200) {
  return NextResponse.json(
    { version: VERSION, build: BUILD_SHA, ...data },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}

function firstStr(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    for (const v of val) {
      const s = firstStr(v);
      if (s) return s;
    }
    return '';
  }
  if (typeof val === 'object') {
    for (const v of Object.values(val as Record<string, unknown>)) {
      const s = firstStr(v);
      if (s) return s;
    }
  }
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

          products.push({
            name_ar: nameAr,
            name_en: nameAr,
            brand: firstStr(hit.brand) || 'Unknown',
            category: 'accessories',
            image_url: firstStr(hit.image_url ?? hit.image ?? hit.thumbnail) || null,
            current_price: price,
          });
        }

        if (page + 1 >= (data.nbPages ?? 0)) break;
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error('[Almanea Fetch Error]', err);
        break;
      }
    }
  }

  console.log(`[Almanea] Total: ${products.length}`);
  return products;
}

async function saveProducts(products: any[]): Promise<any> {
  const sb = createServerClient();

  const rows = products
    .filter(p => p.name_ar?.trim())
    .slice(0, 5)
    .map(p => ({
      name_ar: p.name_ar.trim(),
      name_en: p.name_en || p.name_ar.trim(),
      brand: p.brand || 'Unknown',
      category: p.category || 'accessories',
      image_url: p.image_url || null,
      is_active: true,
    }));

  console.log('[DEBUG SAVE ROWS]', rows.length, rows[0]);

  if (!rows.length) {
    return {
      saved: 0,
      error: 'No valid rows after filtering',
      sampleProduct: products[0] || null,
    };
  }

  const { data, error } = await sb
    .from('products')
    .upsert(rows, { onConflict: 'name_ar' })
    .select('id, name_ar');

  if (error) {
    console.error('[DEBUG SAVE ERROR]', error);
    return {
      saved: 0,
      error,
      sampleRow: rows[0],
    };
  }

  return {
    saved: data?.length || 0,
    data,
  };
}

const STORES = [
  { slug: 'almanea-direct', name: 'المنيع مباشر' },
  { slug: 'almanea', name: 'المنيع' },
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('store_slug');
  const sync = url.searchParams.get('sync');
  const pages = Number(url.searchParams.get('pages') || 10);

  console.log('[Cron GET]', { version: VERSION, build: BUILD_SHA, slug, sync, pages });

  if (!slug) {
    return json({
      status: 'ok',
      mode: 'debug-save',
      stores: STORES.map(s => s.slug),
    });
  }

  if (slug === 'almanea-direct') {
    const products = await fetchAlmanea(pages);
    const saveResult = sync ? await saveProducts(products) : { saved: 0 };

    return json({
      success: true,
      mode: sync ? 'sync-debug-save' : 'fetch-only',
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

  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const almaneaProducts = await fetchAlmanea(10);
  const saveResult = await saveProducts(almaneaProducts);

  return json({
    success: true,
    mode: 'debug-save',
    total_saved: saveResult.saved,
    saveResult,
    results: {
      almanea: {
        fetched: almaneaProducts.length,
        saved: saveResult.saved,
      },
    },
  });
}
