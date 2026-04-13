import type { ScrapedProduct } from '../base/types';
import { BaseSearchScraper } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { expandQueriesForRetailSearch } from './search-query-bilingual';
import { qenc } from './retail-search-url';
import { fetchSearchHtmlWithPuppeteer } from './puppeteer-search-html';
import {
  parseGenericHtmlListing,
  parseProductItemGrid,
} from '../utils/generic-html-listing';

const BASE_URL = 'https://www.samsung.com';

/** Puppeteer search is heavy — cap pages to avoid orchestrator timeouts. */
const MAX_SEARCH_PAGES = 4;

/**
 * Samsung KSA AI search — JS-rendered grid; uses headless Chromium like a dedicated
 * first-party scraper (same idea as {@link AmazonSearchScraper}, but Puppeteer for hydration).
 */
export class SamsungKsaSearchScraper extends BaseSearchScraper {
  constructor() {
    super('samsung_ksa', 'Samsung KSA');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { pages } = options;
    const pageLimit = Math.min(pages, MAX_SEARCH_PAGES);
    const allProducts: SearchProduct[] = [];
    const seen = new Set<string>();
    const queries = expandQueriesForRetailSearch(options.query);

    try {
      for (const q of queries) {
        for (let page = 1; page <= pageLimit; page++) {
          if (page > 1) await this.delay(800, 2000);

          const url = `https://www.samsung.com/sa_en/aisearch/?searchvalue=${qenc(q)}${
            page > 1 ? `&page=${page}` : ''
          }`;

          const html = await fetchSearchHtmlWithPuppeteer(url, {
            waitForSelector: '.product-item, [data-modelcode], .cmp-product-card, a[href*="/sa/"]',
            extraWaitMs: 2800,
          });

          let scraped: ScrapedProduct[] = parseProductItemGrid(html, url, BASE_URL);
          if (scraped.length === 0) {
            scraped = parseGenericHtmlListing(html, url, BASE_URL);
          }

          if (scraped.length === 0) {
            console.log(`[${this.storeSlug}] Page ${page}: 0 items (stopping pagination)`);
            break;
          }

          for (const p of scraped) {
            const key = (p.sku || p.product_url || '').trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            allProducts.push({
              ...p,
              store: this.storeSlug,
              store_name: this.storeName,
            });
          }

          console.log(`[${this.storeSlug}] Page ${page}: ${scraped.length} items found`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${this.storeSlug}] Search error:`, msg);
      if (allProducts.length === 0) return this.errorResult(msg);
    }

    return {
      products: allProducts,
      store: this.storeSlug,
      storeName: this.storeName,
      count: allProducts.length,
    };
  }
}
