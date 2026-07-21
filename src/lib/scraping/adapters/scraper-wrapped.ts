/**
 * E12 — StoreAdapter wrappers over the proven per-store search scrapers.
 * Each store's existing `search()` (fetch + normalize to SearchProduct) is wrapped
 * in the unified resumable `fetchBatch` contract. Reuses tested fetch logic rather
 * than reimplementing it. Extra + Almanea keep their bespoke API adapters.
 */
import type { StoreAdapter, FetchResult, NormalizedOffer } from './types';
import type { BaseSearchScraper } from '../search/base-search-scraper';
import type { SearchProduct } from '../search/types';
import { JarirSearchScraper } from '../search/jarir-search-scraper';
import { AmazonSearchScraper } from '../search/amazon-search-scraper';
import { NoonSearchScraper } from '../search/noon-search-scraper';
import { SamsungKsaSearchScraper } from '../search/samsung-ksa-search-scraper';
import { ShakerSearchScraper } from '../search/shaker-search-scraper';
import { SwsgSearchScraper } from '../search/swsg-search-scraper';

// Shared category query set (mirrors the Extra adapter's coverage).
const QUERIES = ['مكيف', 'ثلاجة', 'غسالة', 'جوال', 'تلفزيون', 'لابتوب', 'شاشة', 'سماعة', 'مايكروويف', 'تابلت', 'ساعة ذكية'];

function toOffer(p: SearchProduct, source: string): NormalizedOffer {
  const ext = String(p.sku || p.product_url || '');
  return {
    name_ar: p.name_ar || p.name_en || '',
    name_en: p.name_en || p.name_ar || '',
    brand: p.brand || '',
    category: p.category || '',
    current_price: p.current_price,
    original_price: p.original_price ?? null,
    product_url: p.product_url,
    image_url: p.image_urls?.[0] ?? null,
    availability: p.availability === 'in_stock' ? 'in_stock' : 'out_of_stock',
    barcode: null,
    external_id: ext,
    _raw: p,
    _source: source,
  };
}

/** Wrap a search scraper as a resumable StoreAdapter. nextState = query index. */
function wrap(cfg: { slug: string; dbName: string; nameEn: string; enabled: boolean; source: string }, make: () => BaseSearchScraper): StoreAdapter {
  return {
    slug: cfg.slug, dbName: cfg.dbName, nameEn: cfg.nameEn, sourceType: 'search_api', enabled: cfg.enabled,
    async fetchBatch(startState: number, maxItems: number): Promise<FetchResult> {
      const scraper = make();
      const offers: NormalizedOffer[] = [];
      const seen = new Set<string>();
      let lastError = '';
      for (let i = Math.max(0, startState); i < QUERIES.length; i++) {
        if (offers.length >= maxItems) return { offers, nextState: i, done: false, lastError };
        try {
          const res = await scraper.search({ query: QUERIES[i], pages: 2 });
          if (res.error) lastError = res.error;
          for (const p of res.products || []) {
            if (offers.length >= maxItems) return { offers, nextState: i + 1, done: false, lastError };
            const ext = String(p.sku || p.product_url || '');
            if (!ext || seen.has(ext)) continue;
            if (!p.current_price || p.current_price <= 0) continue;
            seen.add(ext);
            offers.push(toOffer(p, cfg.source));
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          console.error(`[adapter:${cfg.slug}]`, lastError);
        }
      }
      return { offers, nextState: 0, done: true, lastError };
    },
  };
}

// Data-bearing stores — enabled (Jarir: ~50k obs, Amazon: ~2k obs).
export const jarirAdapter = wrap({ slug: 'jarir', dbName: 'جرير', nameEn: 'Jarir', enabled: true, source: 'jarir-search' }, () => new JarirSearchScraper());
export const amazonAdapter = wrap({ slug: 'amazon', dbName: 'أمازون', nameEn: 'Amazon', enabled: true, source: 'amazon-search' }, () => new AmazonSearchScraper());

// No-data stores — registered for contract completeness, disabled pending a
// validated ingestion run (enable after confirming their scrapers return offers).
export const noonAdapter = wrap({ slug: 'noon', dbName: 'نون', nameEn: 'Noon', enabled: false, source: 'noon-search' }, () => new NoonSearchScraper());
export const samsungKsaAdapter = wrap({ slug: 'samsung_ksa', dbName: 'سامسونج السعودية', nameEn: 'Samsung KSA', enabled: false, source: 'samsung-ksa-search' }, () => new SamsungKsaSearchScraper());
export const shakerAdapter = wrap({ slug: 'shaker', dbName: 'شاكر', nameEn: 'Shaker', enabled: false, source: 'shaker-search' }, () => new ShakerSearchScraper());
export const swsgAdapter = wrap({ slug: 'swsg', dbName: 'SWSG', nameEn: 'SWSG', enabled: false, source: 'swsg-search' }, () => new SwsgSearchScraper());
