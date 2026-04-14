import { BaseSearchScraper, formatScrapeError } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { expandQueriesForRetailSearch } from './search-query-bilingual';
import { qenc } from './retail-search-url';
import { fetchSearchHtmlWithPuppeteer } from './puppeteer-search-html';
import {
  parseGenericHtmlListing,
  parseWooCommerceShopLoop,
} from '../utils/generic-html-listing';

const BASE_URL = 'https://najm.store';

/** Puppeteer search is heavy — cap pages to avoid orchestrator timeouts. */
const MAX_SEARCH_PAGES = 5;

/** Najm (Salla) — SPA storefront; Puppeteer + Woo/Salla-style listing parse. */
export class NajmStoreSearchScraper extends BaseSearchScraper {
  constructor() {
    super('najm_store', 'Najm Al-Ajhezah');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { pages } = options;
    const pageLimit = Math.min(pages, MAX_SEARCH_PAGES);
    const allProducts: SearchProduct[] = [];
    const seen = new Set<string>();
    const queries = expandQueriesForRetailSearch(options.query);

    try {
      for (const q of queries) {
        if (allProducts.length > 0) break;
        for (let page = 1; page <= pageLimit; page++) {
          if (page > 1) await this.delay(900, 2100);

          const url = `https://najm.store/search?q=${qenc(q)}${page > 1 ? `&page=${page}` : ''}`;

          const html = await fetchSearchHtmlWithPuppeteer(url, {
            waitForSelector: 'a[href*="/p/"], salla-products-list, [class*="product-card"]',
            extraWaitMs: 4000,
          });

          let scraped = parseWooCommerceShopLoop(html, url, BASE_URL);
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
      const msg = formatScrapeError(err);
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
