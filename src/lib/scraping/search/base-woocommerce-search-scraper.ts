import type { ScrapedProduct } from '../base/types';
import { BaseSearchScraper, formatScrapeError } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { getBrowserHeaders } from './user-agents';
import { expandQueriesForRetailSearch } from './search-query-bilingual';
import { parseWooCommerceShopLoop, parseGenericHtmlListing } from '../utils/generic-html-listing';

export interface WooCommerceSiteSearchConfig {
  slug: string;
  displayName: string;
  baseUrl: string;
  maxPages?: number;
  searchUrlBuilders: Array<(q: string, page: number) => string>;
}

/**
 * Dedicated WordPress / WooCommerce search — same pattern as {@link AmazonSearchScraper}
 * but tuned for `ul.products li.product` grids.
 */
export class BaseWooCommerceSearchScraper extends BaseSearchScraper {
  constructor(protected readonly site: WooCommerceSiteSearchConfig) {
    super(site.slug, site.displayName);
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { query, pages } = options;
    const allProducts: SearchProduct[] = [];
    const seen = new Set<string>();
    const queries = expandQueriesForRetailSearch(query);

    const maxPages = this.site.maxPages ? Math.min(pages, this.site.maxPages) : pages;
    try {
      for (const q of queries) {
        if (allProducts.length > 0) break;
        for (let page = 1; page <= maxPages; page++) {
          if (page > 1) await this.delay(600, 1800);

          let pageProducts: ScrapedProduct[] = [];
          let gotAny = false;
          for (const buildUrl of this.site.searchUrlBuilders) {
            const url = buildUrl(q, page);
            try {
              const referer = this.site.baseUrl.endsWith('/')
                ? this.site.baseUrl
                : `${this.site.baseUrl}/`;
              const html = await this.fetchHtml(url, getBrowserHeaders(referer));
              pageProducts = parseWooCommerceShopLoop(html, url, this.site.baseUrl);
              if (pageProducts.length === 0) {
                pageProducts = parseGenericHtmlListing(html, url, this.site.baseUrl);
              }
              if (pageProducts.length > 0) {
                gotAny = true;
                break;
              }
            } catch (e) {
              console.error(
                `[${this.storeSlug}] URL try failed:`,
                e instanceof Error ? e.message : e,
              );
            }
          }

          if (!gotAny || pageProducts.length === 0) {
            console.log(
              `[${this.storeSlug}] Page ${page}: 0 items (no product rows parsed — stopping pagination)`,
            );
            break;
          }

          for (const p of pageProducts) {
            const key = (p.sku || p.product_url || '').trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            allProducts.push({
              ...p,
              store: this.storeSlug,
              store_name: this.storeName,
            });
          }

          console.log(`[${this.storeSlug}] Page ${page}: ${pageProducts.length} items found`);
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
