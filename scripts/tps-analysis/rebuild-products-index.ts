// Rebuild the LIVE Algolia "products" index from current storefront data with proper relevance
// settings (Founder product-first directive 2026-07-27). Fixes the stale + popularity-ranked index
// that returned junk (a phone grip) for appliance queries.
//
// Records match the shape src/lib/algolia/search.ts::AlgoliaHit expects (name_ar/name_en/brand/
// stores[]/best_price/in_stock/...). Only APPROVED stores + IN-SCOPE products. Atomic full rebuild.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { algoliasearch } from 'algoliasearch';
import { Client } from 'pg';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
import { isApprovedStore } from '../../src/lib/retailers/approved-retailers';
import { isInScope } from '../../src/lib/scraping/utils/category-scope';

const APP_ID = process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || '';
const INDEX = process.env.ALGOLIA_INDEX_NAME || 'products';

(async () => {
  if (!APP_ID || !ADMIN_KEY) throw new Error('missing ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY');
  const client = algoliasearch(APP_ID, ADMIN_KEY);
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();

  // One row per (product, store-offer) for approved stores + active + in-scope products.
  const rows = (await pg.query(`
    select p.id, p.name_ar, p.name_en, p.brand, p.category, p.image_url,
           ps.store_name, s.name as store_display, ps.current_price, ps.original_price,
           ps.availability, ps.product_url, ps.coupon_code, ps.store_id
    from product_stores ps
    join products p on p.id = ps.product_id
    left join stores s on s.id = ps.store_id
    where p.is_active and ps.current_price > 0
  `)).rows;

  // Group by product; keep only approved-store, in-scope offers.
  const byProduct = new Map<string, any>();
  for (const r of rows) {
    const storeName = (r.store_name || r.store_display || '').trim();
    if (!isApprovedStore(storeName)) continue;
    if (!isInScope(r.name_en || r.name_ar, r.category)) continue;
    let rec = byProduct.get(r.id);
    if (!rec) {
      rec = {
        objectID: r.id, name_ar: r.name_ar, name_en: r.name_en, brand: r.brand || '',
        category: r.category, image_url: r.image_url || null,
        byStore: new Map<string, any>(), // dedup offers to ONE per store (cheapest)
      };
      byProduct.set(r.id, rec);
    }
    const price = Number(r.current_price);
    const existing = rec.byStore.get(storeName);
    if (!existing || price < existing.current_price) {
      rec.byStore.set(storeName, {
        store_name: storeName,
        current_price: price,
        original_price: r.original_price != null ? Number(r.original_price) : null,
        product_url: r.product_url || null,
        availability: r.availability || 'in_stock',
        coupon_code: r.coupon_code ?? null,
      });
    }
  }

  const objects = [...byProduct.values()].map((rec) => {
    rec.stores = [...rec.byStore.values()];
    rec.store_names = new Set(rec.byStore.keys());
    const prices = rec.stores.map((s: any) => s.current_price).filter((n: number) => n > 0);
    const best = prices.length ? Math.min(...prices) : null;
    const maxDisc = Math.max(0, ...rec.stores.map((s: any) => (s.original_price && s.original_price > s.current_price ? Math.round((1 - s.current_price / s.original_price) * 100) : 0)));
    return {
      objectID: rec.objectID, name_ar: rec.name_ar, name_en: rec.name_en, brand: rec.brand,
      category: rec.category, image_url: rec.image_url,
      stores: rec.stores, store_names: [...rec.store_names], store_count: rec.store_names.size,
      best_price: best, in_stock: rec.stores.some((s: any) => s.availability === 'in_stock'),
      has_deal: maxDisc > 0, max_discount_pct: maxDisc,
    };
  });

  // Relevance settings: names/brand searchable (name first), textual relevance dominates; custom
  // ranking breaks ties by in-stock → store-depth → cheapest (NOT popularity). Arabic-aware.
  await client.setSettings({
    indexName: INDEX,
    indexSettings: {
      searchableAttributes: ['name_en', 'name_ar', 'brand'],
      attributesForFaceting: ['searchable(category)', 'searchable(brand)', 'searchable(store_names)', 'in_stock', 'has_deal', 'best_price'],
      customRanking: ['desc(in_stock)', 'desc(store_count)', 'asc(best_price)'],
      queryLanguages: ['ar', 'en'],
      indexLanguages: ['ar', 'en'],
      ignorePlurals: true,
      // 'none' (not 'allOptional'): optionalWords still give recall (a record matching any expansion
      // term returns), but Algolia no longer falls back to "return everything ranked by popularity"
      // when the query matches poorly — which was surfacing earbuds for ثلاجة/غسالة. Non-matching junk
      // is now excluded; a truly empty result then correctly falls through to the DB path.
      removeWordsIfNoResults: 'none',
      typoTolerance: 'min',
    },
  });

  await client.replaceAllObjects({ indexName: INDEX, objects, batchSize: 1000 });
  console.log(JSON.stringify({ index: INDEX, products: objects.length, offers: rows.length }));
  await pg.end();
  process.exit(0);
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
