import * as cheerio from 'cheerio';
import { BaseSearchScraper, formatScrapeError } from './base-search-scraper';
import { fetchSearchHtmlWithPuppeteer } from './puppeteer-search-html';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { expandQueriesForRetailSearch } from './search-query-bilingual';
import { qenc } from './retail-search-url';

const BASE_URL = 'https://aecksa.com';

/** Alesayi (Salla) — search results are rendered client-side; Puppeteer to hydrate. */
export class AlesayiSearchScraper extends BaseSearchScraper {
  constructor() {
    super('alesayi', 'Alesayi Electronics');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const allProducts: SearchProduct[] = [];
    const seen = new Set<string>();
    const queries = expandQueriesForRetailSearch(options.query);
    const pageLimit = Math.min(options.pages, 3);

    try {
      for (const q of queries) {
        if (allProducts.length > 0) break;
        for (let page = 1; page <= pageLimit; page++) {
          const url = `${BASE_URL}/search?keyword=${qenc(q)}${page > 1 ? `&page=${page}` : ''}`;
          const html = await fetchSearchHtmlWithPuppeteer(url, {
            waitForSelector: 'custom-salla-product-card',
            extraWaitMs: 3500,
          });
          const parsed = this.parseCards(html);
          if (parsed.length === 0) break;
          let added = 0;
          for (const p of parsed) {
            const key = p.sku || p.product_url;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            allProducts.push({ ...p, store: this.storeSlug, store_name: this.storeName });
            added++;
          }
          console.log(`[${this.storeSlug}] Page ${page}: ${parsed.length} items found (${added} new)`);
          if (added === 0) break;
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

  private parseCards(html: string): Omit<SearchProduct, 'store' | 'store_name'>[] {
    const $ = cheerio.load(html);
    const out: Omit<SearchProduct, 'store' | 'store_name'>[] = [];
    $('custom-salla-product-card').each((_, el) => {
      const card = $(el);
      const id = (card.attr('id') || '').replace(/^product_/, '').split('-')[0] || null;
      const titleAnchor = card.find('h2.product-entry__title a').first();
      const title = titleAnchor.text().trim() ||
        card.find('a.product-entry__image').attr('aria-label')?.trim() ||
        '';
      const href = titleAnchor.attr('href') ||
        card.find('a.product-entry__image').attr('href') || '';
      if (!title || !href) return;

      const priceText = card.find('h4.sale-price, .product-entry__price h4').first().text();
      const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;
      const origText = card.find('.regular-or-normal-price').first().text();
      const original = parseFloat(origText.replace(/[^\d.]/g, '')) || null;

      const img = card.find('.product-entry__image-main img').first().attr('src') ||
        card.find('img').first().attr('src') || null;

      out.push({
        name_ar: title,
        name_en: title,
        brand: '',
        model: '',
        sku: id,
        current_price: price,
        original_price: original && price && original > price ? original : null,
        availability: 'in_stock',
        product_url: href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`,
        image_urls: img ? [img] : [],
        specifications: {},
        category: this.determineCategory(title),
        description_ar: null,
        description_en: null,
        is_deal: Boolean(original && price && original > price),
      });
    });
    return out;
  }
}
