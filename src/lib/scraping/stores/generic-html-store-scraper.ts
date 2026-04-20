import type { ProductCategory } from '@/lib/database/types';
import type { ScrapedProduct, ScraperConfig, DiscoveryPaginationStyle } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import {
  parseGenericHtmlListing,
  parseGenericProductDetail,
} from '../utils/generic-html-listing';

function buildDiscoveryUrl(baseUrl: string, page: number, style?: DiscoveryPaginationStyle): string {
  if (page <= 1) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  const s = style || 'query_page';

  switch (s) {
    case 'wordpress_paged':
      return `${baseUrl}${sep}paged=${page}`;
    case 'magento_p':
      return `${baseUrl}${sep}p=${page}`;
    case 'samsung_page':
      return `${baseUrl}${sep}page=${page}`;
    case 'query_page':
    default:
      return `${baseUrl}${sep}page=${page}`;
  }
}

/**
 * Cron/discovery store scraper for HTML merchants (WooCommerce, Magento, Next.js listings).
 * Used by the ten extended merchants; same parsing strategy as GenericHtmlSearchScraper.
 */
export class GenericHtmlStoreScraper extends BaseScraper {
  constructor(config: ScraperConfig) {
    super(config);
  }

  async discoverProducts(
    category: ProductCategory,
    maxPages: number = 10,
  ): Promise<ScrapedProduct[]> {
    // New path: if the store config provides `listing_selectors`, use the
    // fast, selector-driven extraction from BaseScraper (no per-product detail
    // fetches). Falls back to the legacy generic parser otherwise.
    if ((this.config as any).listing_selectors?.tile) {
      return this.discoverByListingConfig(category, maxPages);
    }

    const products: ScrapedProduct[] = [];
    const categoryUrls = this.config.category_urls[category] || [];
    if (categoryUrls.length === 0) return products;

    const pagination = this.config.discovery_pagination;

    try {
      for (const baseUrl of categoryUrls) {
        for (let page = 1; page <= maxPages; page++) {
          try {
            const url = buildDiscoveryUrl(baseUrl, page, pagination);
            const html = this.config.requires_js
              ? await (await this.fetchPageWithJS(url)).content()
              : await this.fetchPage(url);

            const parsed = parseGenericHtmlListing(html, url, this.config.base_url);
            if (parsed.length === 0) break;

            for (const p of parsed) products.push({ ...p, category });

            console.log(
              `[${this.config.store_slug}] discovery ${category} page ${page}: ${parsed.length} items`,
            );
            await this.delay();
          } catch (error) {
            console.error(
              `[${this.config.store_slug}] Error scraping discovery page ${page} of ${baseUrl}:`,
              error,
            );
          }
        }
      }
    } finally {
      await this.cleanup();
    }

    return products;
  }

  async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null> {
    try {
      const html = this.config.requires_js
        ? await (await this.fetchPageWithJS(productUrl)).content()
        : await this.fetchPage(productUrl);

      const product = parseGenericProductDetail(html, productUrl, this.config.base_url);
      if (!product) return null;
      return { ...product, category: product.category };
    } catch (error) {
      this.logError({
        type: 'network',
        message: `Failed to update price for ${productUrl}: ${error instanceof Error ? error.message : String(error)}`,
        url: productUrl,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }
}
