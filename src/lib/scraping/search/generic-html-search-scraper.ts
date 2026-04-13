import type { Browser } from 'puppeteer';
import { BaseSearchScraper } from './base-search-scraper';
import type { SearchProduct, StoreSearchOptions, StoreSearchResult } from './types';
import { getBrowserHeaders } from './user-agents';
import { parseGenericHtmlListing } from '../utils/generic-html-listing';
import { expandQueriesForRetailSearch } from './search-query-bilingual';

export interface GenericHtmlSiteConfig {
  slug: string;
  displayName: string;
  /** Used to resolve relative URLs */
  baseUrl: string;
  /** Try in order until a page returns products */
  searchUrlBuilders: Array<(query: string, page: number) => string>;
  /**
   * Use headless Chromium (Lulu GCC and similar block plain fetch with 403).
   * Slower; reuses one browser for all pages in a search.
   */
  requiresBrowser?: boolean;
  /** After navigation, wait for selector (e.g. Salla storefronts that hydrate product lists). */
  puppeteerWaitForSelector?: string;
  /** Extra delay (ms) after load before reading HTML (hydration). */
  puppeteerWaitMs?: number;
}

/**
 * HTML / JSON-LD / __NEXT_DATA__ search scraper for merchant sites (replaces Firecrawl).
 */
export class GenericHtmlSearchScraper extends BaseSearchScraper {
  constructor(private readonly site: GenericHtmlSiteConfig) {
    super(site.slug, site.displayName);
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    if (this.site.requiresBrowser) {
      return this.searchWithPuppeteer(options);
    }

    const { query, pages } = options;
    const allProducts: SearchProduct[] = [];
    const seenKeys = new Set<string>();
    let lastError: string | null = null;
    const queryVariants = expandQueriesForRetailSearch(query);

    try {
      for (const q of queryVariants) {
        for (let page = 1; page <= pages; page++) {
          if (page > 1) await this.delay(800, 1800);

          const products = await this.searchPage(q, page);
          if (products.length === 0) {
            console.log(
              `[${this.site.slug}] Page ${page}: 0 items (no parseable products this page — stopping pagination)`,
            );
            break;
          }

          for (const product of products) {
            const uniqueKey = product.sku || product.product_url;
            if (!uniqueKey || seenKeys.has(uniqueKey)) continue;
            seenKeys.add(uniqueKey);
            allProducts.push(product);
          }

          console.log(`[${this.site.slug}] Page ${page}: ${products.length} items found`);
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[${this.site.slug}] Search error:`, lastError);
      if (allProducts.length === 0) {
        return this.errorResult(lastError);
      }
    }

    return {
      products: allProducts,
      store: this.storeSlug,
      storeName: this.storeName,
      count: allProducts.length,
      error: lastError || undefined,
    };
  }

  /** One browser session; tries each searchUrlBuilder until a page yields products. */
  private async searchWithPuppeteer(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { query, pages } = options;
    const allProducts: SearchProduct[] = [];
    const seenKeys = new Set<string>();
    let lastError: string | null = null;
    const queryVariants = expandQueriesForRetailSearch(query);

    const puppeteer = await import('puppeteer');
    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const ppage = await browser.newPage();
      await ppage.setViewport({ width: 1365, height: 900 });
      await ppage.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      );

      for (const q of queryVariants) {
        for (let pageNum = 1; pageNum <= pages; pageNum++) {
          if (pageNum > 1) await this.delay(1000, 2200);

          let pageProducts: SearchProduct[] = [];
          let lastPageErr: string | null = null;

          for (const buildUrl of this.site.searchUrlBuilders) {
            const url = buildUrl(q, pageNum);
            try {
              await ppage.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
              if (this.site.puppeteerWaitMs && this.site.puppeteerWaitMs > 0) {
                await new Promise((r) => setTimeout(r, this.site.puppeteerWaitMs));
              }
              if (this.site.puppeteerWaitForSelector) {
                await ppage
                  .waitForSelector(this.site.puppeteerWaitForSelector, { timeout: 25_000 })
                  .catch(() => {});
              }
              const html = await ppage.content();
              pageProducts = this.parsePage(html, url);
              if (pageProducts.length > 0) break;
            } catch (e) {
              lastPageErr = e instanceof Error ? e.message : String(e);
            }
          }

          if (pageProducts.length === 0) {
            console.log(
              `[${this.site.slug}] Page ${pageNum}: 0 items (no parseable products this page — stopping pagination)`,
            );
            if (lastPageErr) lastError = lastPageErr;
            break;
          }

          for (const product of pageProducts) {
            const uniqueKey = product.sku || product.product_url;
            if (!uniqueKey || seenKeys.has(uniqueKey)) continue;
            seenKeys.add(uniqueKey);
            allProducts.push(product);
          }

          console.log(`[${this.site.slug}] Page ${pageNum}: ${pageProducts.length} items found`);
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[${this.site.slug}] Search error:`, lastError);
      if (allProducts.length === 0) {
        return this.errorResult(lastError);
      }
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    return {
      products: allProducts,
      store: this.storeSlug,
      storeName: this.storeName,
      count: allProducts.length,
      error: lastError || undefined,
    };
  }

  private async searchPage(query: string, page: number): Promise<SearchProduct[]> {
    let lastError: string | null = null;
    const refererBase = this.site.baseUrl.endsWith('/')
      ? this.site.baseUrl
      : `${this.site.baseUrl}/`;

    for (const buildUrl of this.site.searchUrlBuilders) {
      const url = buildUrl(query, page);
      try {
        const html = await this.fetchHtml(url, getBrowserHeaders(refererBase));
        const parsed = this.parsePage(html, url);
        if (parsed.length > 0) return parsed;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (lastError) throw new Error(lastError);
    return [];
  }

  private parsePage(html: string, sourceUrl: string): SearchProduct[] {
    return parseGenericHtmlListing(html, sourceUrl, this.site.baseUrl).map((p) => ({
      ...p,
      is_free_delivery: false,
      store: this.storeSlug,
      store_name: this.storeName,
    }));
  }
}
