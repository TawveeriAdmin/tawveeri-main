import { AmazonSearchScraper } from '../search/amazon-search-scraper';
import type { SearchProduct } from '../search/types';
import type { StoreAdapter, NormalizedOffer } from './types';

// Keep the first 11 in their historical order: legacy cursors are query indexes.
export const AMAZON_DISCOVERY_QUERIES = [
  'مكيف', 'ثلاجة', 'غسالة', 'جوال', 'تلفزيون', 'لابتوب', 'شاشة', 'سماعة',
  'مايكروويف', 'تابلت', 'ساعة ذكية',
  'electric oven', 'gas cooker', 'built in oven', 'ipad', 'gaming laptop',
  'macbook', 'chromebook', 'laptop charger', 'laptop docking station',
  'computer keyboard', 'computer mouse', 'vacuum cleaner', 'dishwasher',
  'coffee machine', 'air fryer',
];

// Versioned cursor: query + page + next item. Unlike the old query-only cursor,
// reaching the batch limit does not throw away the rest of a result page.
const CURSOR_VERSION = 1_000_000;
const PAGES_PER_QUERY = 2;
const MAX_PAGES_PER_BATCH = 8;

function encode(query: number, page: number, offset: number): number {
  return CURSOR_VERSION + query * 10_000 + (page - 1) * 1_000 + offset;
}

function decode(state: number) {
  if (!Number.isSafeInteger(state) || state < 0) throw new Error('Invalid Amazon cursor');
  if (state < CURSOR_VERSION) return { query: state, page: 1, offset: 0 };
  const value = state - CURSOR_VERSION;
  return { query: Math.floor(value / 10_000), page: Math.floor(value % 10_000 / 1_000) + 1, offset: value % 1_000 };
}

function toOffer(p: SearchProduct, price: number): NormalizedOffer {
  return {
    name_ar: p.name_ar || p.name_en || '', name_en: p.name_en || p.name_ar || '',
    brand: p.brand || '', category: p.category || '', current_price: price,
    original_price: p.original_price ?? null, product_url: p.product_url,
    image_url: p.image_urls?.[0] ?? null,
    availability: p.availability === 'in_stock' ? 'in_stock' : 'out_of_stock',
    barcode: null, external_id: String(p.sku || p.product_url), _raw: p,
    _source: 'amazon-search',
  };
}

export const amazonAdapter: StoreAdapter = {
  slug: 'amazon', dbName: 'أمازون', nameEn: 'Amazon', sourceType: 'search_api', enabled: true,
  async fetchBatch(startState, maxItems) {
    if (!Number.isSafeInteger(maxItems) || maxItems < 1) throw new Error('Invalid Amazon batch size');
    const start = decode(startState);
    if (start.query > AMAZON_DISCOVERY_QUERIES.length || start.page > PAGES_PER_QUERY) {
      throw new Error('Invalid Amazon cursor range');
    }
    const scraper = new AmazonSearchScraper();
    const offers: NormalizedOffer[] = [];
    const seen = new Set<string>();
    let pagesFetched = 0;
    for (let q = start.query; q < AMAZON_DISCOVERY_QUERIES.length; q++) {
      for (let page = q === start.query ? start.page : 1; page <= PAGES_PER_QUERY; page++) {
        const offset = q === start.query && page === start.page ? start.offset : 0;
        const cursor = encode(q, page, offset);
        if (offers.length >= maxItems || pagesFetched >= MAX_PAGES_PER_BATCH) {
          return { offers, nextState: cursor, done: false };
        }
        if (pagesFetched > 0) await new Promise(resolve => setTimeout(resolve, 1000));
        pagesFetched++;
        const result = await scraper.search({ query: AMAZON_DISCOVERY_QUERIES[q], pages: 1, startPage: page });
        if (result.error) return { offers, nextState: cursor, done: false, lastError: result.error };
        if (!result.products.length) break;
        for (let i = offset; i < result.products.length; i++) {
          if (offers.length >= maxItems) return { offers, nextState: encode(q, page, i), done: false };
          const p = result.products[i];
          const id = String(p.sku || p.product_url || '');
          const price = p.current_price;
          if (!id || !p.product_url || price === null || price <= 0 || !Number.isFinite(price) || seen.has(id)) continue;
          seen.add(id);
          offers.push(toOffer(p, price));
        }
      }
    }
    return { offers, nextState: 0, done: true };
  },
};
