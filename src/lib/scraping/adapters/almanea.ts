import type { StoreAdapter, FetchResult, NormalizedOffer } from './types';
import { firstStr } from './types';

const ALGOLIA_APP_ID = 'WCK19QC65I';
const ALGOLIA_KEY = 'be7745237f5f94f715b088f48b1708b8';
const AR_INDEX = 'prod_headless_ar_products';
const CATEGORY_IDS = ['535','7423','7424','7434','7436','522','7426','7364','523','534','536','538','519'];

export const almaneaAdapter: StoreAdapter = {
  slug: 'almanea',
  dbName: 'المنيع',
  nameEn: 'Almanea',
  sourceType: 'search_api',
  enabled: true,

  async fetchBatch(startState: number, maxItems: number): Promise<FetchResult> {
    const offers: NormalizedOffer[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < CATEGORY_IDS.length; i++) {
      const catId = CATEGORY_IDS[i];
      const page = i === 0 ? startState : 0;
      for (let p = page; p < 100; p++) {
        if (offers.length >= maxItems) return { offers, nextState: p, done: false };
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
            if (offers.length >= maxItems) return { offers, nextState: p, done: false };
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
            offers.push({
              name_ar: nameAr, name_en: nameAr,
              brand: firstStr(hit.brand) || 'Unknown', category: 'accessories',
              current_price: price, original_price: originalPrice > price ? originalPrice : null,
              product_url: productUrl,
              availability: hasStock ? 'in_stock' : 'out_of_stock',
              barcode: null, external_id: sku, _raw: hit, _source: 'algolia',
            });
          }
          if (p + 1 >= (data.nbPages ?? 0)) break;
          await new Promise(r => setTimeout(r, 100));
        } catch (err) { console.error('[adapter:almanea]', err); break; }
      }
    }
    return { offers, nextState: 0, done: true };
  },
};
