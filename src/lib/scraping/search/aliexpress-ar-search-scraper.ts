import * as cheerio from 'cheerio';
import { BaseSearchScraper } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { expandQueriesForRetailSearch } from './search-query-bilingual';
import { aliexpressWholesaleSlug } from './retail-search-url';
import { fetchSearchHtmlWithPuppeteer } from './puppeteer-search-html';
import { extractAliExpressPricesFromHref } from '../utils/generic-html-listing';

const BASE_URL = 'https://ar.aliexpress.com';

/**
 * AliExpress Arabic wholesale search — item links carry SAR hints in `href`;
 * dedicated parser (same role as {@link AmazonSearchScraper#parseProduct}).
 */
export class AliexpressArSearchScraper extends BaseSearchScraper {
  constructor() {
    super('aliexpress_ar', 'AliExpress');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { pages } = options;
    const allProducts: SearchProduct[] = [];
    const seen = new Set<string>();
    const queries = expandQueriesForRetailSearch(options.query);

    try {
      for (const q of queries) {
        for (let page = 1; page <= pages; page++) {
          if (page > 1) await this.delay(1000, 2400);

          const slug = aliexpressWholesaleSlug(q);
          const base = `${BASE_URL}/w/wholesale-${slug}.html`;
          const url = page > 1 ? `${base}?page=${page}` : base;

          const html = await fetchSearchHtmlWithPuppeteer(url, {
            waitForSelector: 'a[href*="item"], [class*="search-item"]',
            extraWaitMs: 3000,
          });

          const scraped = this.parseSearchResults(html, url);

          if (scraped.length === 0) {
            console.log(`[${this.storeSlug}] Page ${page}: 0 items (stopping pagination)`);
            break;
          }

          for (const p of scraped) {
            const key = (p.sku || p.product_url || '').trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            allProducts.push(p);
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

  private parseSearchResults(html: string, pageUrl: string): SearchProduct[] {
    const $ = cheerio.load(html);
    const out: SearchProduct[] = [];
    const seen = new Set<string>();

    $('a[href*="aliexpress.com/item"], a[href*="/item/"]').each((_, el) => {
      let href = $(el).attr('href')?.trim() || '';
      if (!href) return;
      if (href.startsWith('//')) href = `https:${href}`;
      else if (href.startsWith('/')) {
        try {
          href = new URL(href, pageUrl).href;
        } catch {
          return;
        }
      }
      if (!href.includes('/item/')) return;
      if (seen.has(href)) return;
      seen.add(href);

      const ae = extractAliExpressPricesFromHref(href);
      let title =
        $(el).attr('title')?.trim() ||
        $(el).find('img[alt]').first().attr('alt')?.trim() ||
        $(el).closest('div').find('[class*="title"]').first().text().trim();
      if (!title || title.length < 2) {
        title = $(el).text().trim().slice(0, 200);
      }
      if (!title) title = 'Product';

      const itemId = href.match(/\/item\/(\d+)/)?.[1] || null;
      const price = ae.current ?? 0;
      const original = ae.original ?? null;

      const category = this.determineCategory(title);

      out.push({
        name_ar: title,
        name_en: title,
        brand: 'Unknown',
        model: this.extractModel(title, null),
        sku: itemId,
        current_price: price,
        original_price: original,
        availability: 'in_stock',
        product_url: href,
        image_urls: [],
        specifications: {},
        category,
        description_ar: null,
        description_en: null,
        is_deal: Boolean(original && original > price && price > 0),
        store: this.storeSlug,
        store_name: this.storeName,
      });
    });

    return out;
  }
}
