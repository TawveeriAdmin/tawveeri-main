import type { ScrapedProduct } from '../base/types';
import { BaseSearchScraper } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { getBrowserHeaders } from './user-agents';
import { expandQueriesForRetailSearch } from './search-query-bilingual';
import { qenc } from './retail-search-url';
import {
  parseGenericHtmlListing,
  parseProductItemGrid,
} from '../utils/generic-html-listing';

const BASE_URL = 'https://alsaifgallery.com';

/** Alsaif Gallery — Magento-style search; dedicated fetch + tile grid parsing. */
export class AlsaifGallerySearchScraper extends BaseSearchScraper {
  constructor() {
    super('alsaif_gallery', 'Alsaif Gallery');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { pages } = options;
    const allProducts: SearchProduct[] = [];
    const seen = new Set<string>();
    const queries = expandQueriesForRetailSearch(options.query);

    try {
      for (const q of queries) {
        for (let page = 1; page <= pages; page++) {
          if (page > 1) await this.delay(700, 1900);

          const urls = [
            `https://alsaifgallery.com/SA_en/search?keyword=${qenc(q)}${page > 1 ? `&page=${page}` : ''}`,
            `https://alsaifgallery.com/SA_ar/search?keyword=${qenc(q)}${page > 1 ? `&page=${page}` : ''}`,
          ];

          let scraped: ScrapedProduct[] = [];
          for (const url of urls) {
            try {
              const html = await this.fetchHtml(url, getBrowserHeaders(`${BASE_URL}/`));
              scraped = parseProductItemGrid(html, url, BASE_URL);
              if (scraped.length === 0) {
                scraped = parseGenericHtmlListing(html, url, BASE_URL);
              }
              if (scraped.length > 0) break;
            } catch {
              /* try next locale */
            }
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
