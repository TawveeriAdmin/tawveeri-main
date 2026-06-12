import type { StoreAdapter, FetchResult, NormalizedOffer } from './types';
import { pick, pickNum } from './types';

const UNBXD_API_KEY = '8fb45132f31d81ab46966cc135c24430';
const UNBXD_SITE_KEY = 'ss-unbxd-auk-extra-saudi-ar-prod11541714990564';
const UNBXD_BASE = `https://search.unbxdapi.com/${UNBXD_API_KEY}/${UNBXD_SITE_KEY}/search`;
const EXTRA_QUERIES = [
  'مكيف','ثلاجة','غسالة','جوال','تلفزيون','لابتوب','شاشة',
  'سماعة','مايكروويف','مكنسة','ساعة ذكية','تابلت',
];

export const extraAdapter: StoreAdapter = {
  slug: 'extra',
  dbName: 'اكسترا',
  nameEn: 'Extra',
  sourceType: 'search_api',
  enabled: true,

  // ترميز الحالة: nextState = queryIndex * 1000 + page
  async fetchBatch(startState: number, maxItems: number): Promise<FetchResult> {
    const offers: NormalizedOffer[] = [];
    const seen = new Set<string>();
    let lastError = '';
    const qIdx = Math.floor(startState / 1000);
    const startPg = (startState % 1000) || 1;
    const ROWS = 50;

    for (let i = qIdx; i < EXTRA_QUERIES.length; i++) {
      const query = EXTRA_QUERIES[i];
      const firstPage = i === qIdx ? startPg : 1;
      for (let pg = firstPage; pg <= 30; pg++) {
        if (offers.length >= maxItems) return { offers, nextState: i * 1000 + pg, done: false, lastError };
        const start = (pg - 1) * ROWS;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const url = `${UNBXD_BASE}?q=${encodeURIComponent(query)}&rows=${ROWS}&start=${start}&format=json&version=V2`;
          const res = await fetch(url, {
            cache: 'no-store', signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', 'Accept': 'application/json' },
          });
          if (!res.ok) { lastError = `HTTP ${res.status} q=${query} pg=${pg}`; console.error('[adapter:extra]', lastError); break; }
          const data = await res.json();
          const items = (data?.response?.products || data?.products || []) as any[];
          if (!items.length) break;
          for (const item of items) {
            if (offers.length >= maxItems) return { offers, nextState: i * 1000 + pg, done: false, lastError };
            const titleEn = pick(item.title) || pick(item.name);
            const titleAr = pick(item.autosuggest) || titleEn;
            const name = titleAr.trim();
            if (!name || name.length < 3) continue;
            const uniqueId = pick(item.uniqueId) || pick(item.sku) || pick(item._root_) || pick(item.productId);
            if (!uniqueId || seen.has(uniqueId)) continue;
            seen.add(uniqueId);
            const price = pickNum(item.basicPriceValueDiscount) ?? pickNum(item.price) ?? pickNum(item.basicPrimePrice);
            if (!price || price <= 0) continue;
            const wasPrice = pickNum(item.basicPrice) ?? pickNum(item.wasPrice) ?? pickNum(item.mrp);
            const brandAr = pick(item.brandAr) || pick(item.brand) || 'Unknown';
            const barcode = pick(item.barcode);
            let productUrl = pick(item.productUrl) || pick(item.url);
            if (productUrl && productUrl.startsWith('/')) productUrl = `https://www.extra.com${productUrl}`;
            if (!productUrl && uniqueId) productUrl = `https://www.extra.com/ar-sa/p/${uniqueId}`;
            offers.push({
              name_ar: name, name_en: titleEn || name,
              brand: brandAr, category: 'accessories',
              current_price: price,
              original_price: wasPrice && wasPrice > price ? wasPrice : null,
              product_url: productUrl,
              availability: (pick(item.available) === 'false') ? 'out_of_stock' : 'in_stock',
              barcode: barcode || null, external_id: uniqueId,
              _raw: item, _source: 'unbxd_extra',
            });
          }
          await new Promise(r => setTimeout(r, 300));
        } catch (err: any) {
          lastError = String(err?.name === 'AbortError' ? `timeout q=${query} pg=${pg}` : err?.message || err);
          console.error('[adapter:extra]', lastError); break;
        } finally { clearTimeout(timer); }
      }
    }
    return { offers, nextState: 0, done: true, lastError };
  },
};
