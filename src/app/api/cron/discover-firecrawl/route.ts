import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const maxDuration = 900;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || 'no-sha';
const VERSION = 'tawveeri-cron-2026-06-08-v1';

const ALGOLIA_APP_ID = 'WCK19QC65I';
const ALGOLIA_KEY = 'be7745237f5f94f715b088f48b1708b8';
const AR_INDEX = 'prod_headless_ar_products';
const ALMANEA_BASE = 'https://www.almanea.sa';
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

        if (!res.ok) {
          console.error(`[Almanea] HTTP ${res.status} cat=${catId} page=${page}`);
          break;
        }

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

        if (page + 1 >= (data.nbPages ?? 0)) break;
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        console.error(`[Almanea] cat ${catId} page ${page}:`, err);
        break;
      }
    }
  }

  console.log(`[Almanea] Total: ${products.length}`);
  return products;
}

async function saveProducts(products: any[], storeName: string): Promise<number> {
  const sb = createServerClient();
  let saved = 0;

  for (const p of products) {
    if (!p.name_ar?.trim() || !p.current_price || p.current_price <= 0) continue;
    if (!p.product_url?.startsWith('http')) continue;

    try {
      const nameAr = p.name_ar.trim();

      let productId: string | null = null;

      const { data: existing, error: selectError } = await sb
        .from('products')
        .select('id')
        .eq('name_ar', nameAr)
        .maybeSingle();

      if (selectError) {
        console.error('[Save Select Error]', selectError);
        continue;
      }

      if (existing?.id) {
        productId = existing.id;
      } else {
        const { data: inserted, error: insertError } = await sb
          .from('products')
          .insert({
            name_ar: nameAr,
            name_en: p.name_en || nameAr,
            brand: p.brand || 'Unknown',
            category: p.category || 'accessories',
            is_active: true,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('[Save Insert Error]', insertError, { product: nameAr });
          continue;
        }

        productId = inserted?.id || null;
      }

      if (!productId) {
        console.error('[Save Error] Missing productId', { product: nameAr });
        continue;
      }

      const { error: upsertError } = await sb.from('product_stores').upsert(
        {
          product_id: productId,
          store_name: storeName,
          current_price: p.current_price,
          original_price: p.original_price || null,
          product_url: p.product_url,
          availability: p.availability || 'in_stock',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,store_name' }
      );

      if (upsertError) {
        console.error('[Save Store Upsert Error]', upsertError, { product: nameAr });
        continue;
      }

      saved++;
    } catch (e) {
      console.error('[Save Fatal Error]', e);
    }
  }

  console.log(`[Save] Saved ${saved}/${products.length}`);
  return saved;
}

const STORES = [
  { slug: 'almanea-direct', name: 'المنيع مباشر' },
  { slug: 'noon-direct', name: 'نون مباشر' },
  { slug: 'almanea', name: 'المنيع' },
  { slug: 'extra', name: 'اكسترا' },
  { slug: 'jarir', name: 'جرير' },
  { slug: 'amazon', name: 'أمازون' },
  { slug: 'noon', name: 'نون' },
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
      stores: STORES.map(s => s.slug),
    });
  }

  if (slug === 'almanea-direct') {
    const products = await fetchAlmanea(pages);
    const saved = sync ? await saveProducts(products, 'المنيع') : 0;

    return json({
      success: true,
      mode: sync ? 'sync' : 'fetch-only',
      store: 'almanea-direct',
      fetched: products.length,
      saved,
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
  const almaneaSaved = await saveProducts(almaneaProducts, 'المنيع');

  return json({
    success: true,
    total_saved: almaneaSaved,
    results: {
      almanea: {
        fetched: almaneaProducts.length,
        saved: almaneaSaved,
      },
    },
  });
}
