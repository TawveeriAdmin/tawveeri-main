import * as cheerio from 'cheerio';
import { BaseSearchScraper, formatScrapeError } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { expandQueriesForRetailSearch } from './search-query-bilingual';
import { qenc } from './retail-search-url';

const BASE_URL = 'https://zagzoog.com';

export class ZagzoogSearchScraper extends BaseSearchScraper {
  constructor() {
    super('zagzoog', 'Zagzoog');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const allProducts: SearchProduct[] = [];
    const seen = new Set<string>();
    const queries = expandQueriesForRetailSearch(options.query);

    try {
      for (const q of queries) {
        if (allProducts.length > 0) break;
        const url = `${BASE_URL}/?s=${qenc(q)}`;
        const html = await this.fetchHtml(url);
        const parsed = this.parseCards(html);
        for (const p of parsed) {
          const key = p.sku || p.product_url;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          allProducts.push({ ...p, store: this.storeSlug, store_name: this.storeName });
        }
        console.log(`[${this.storeSlug}] Page 1: ${parsed.length} items found`);
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
    $('.product-block').each((_, el) => {
      const card = $(el);
      const anchor = card.find('a.product-image, a[href*="details?id="]').first();
      const href = anchor.attr('href');
      if (!href) return;
      const productUrl = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\.\.\//, '').replace(/^\//, '')}`;

      const title = (anchor.attr('title') || anchor.find('img').attr('alt') || '').trim();
      if (!title) return;

      const sku = (card.find('input[id^="productsid"]').attr('value') || '').trim() || null;

      let price = 0;
      const onclick = anchor.attr('onclick') || '';
      const m = onclick.match(/datlayer\s*\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'\s*([\d.,]+)\s*'/);
      if (m) {
        const v = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(v) && v > 0) price = v;
      }

      let image: string | null = null;
      const imgSrc = anchor.find('img').attr('src');
      if (imgSrc) {
        image = imgSrc.startsWith('http')
          ? imgSrc
          : `${BASE_URL}/${imgSrc.replace(/^\.\.\//, '').replace(/^\//, '')}`;
      }

      out.push({
        name_ar: title,
        name_en: title,
        brand: '',
        model: '',
        sku,
        current_price: price,
        original_price: null,
        availability: 'in_stock',
        product_url: productUrl,
        image_urls: image ? [image] : [],
        specifications: {},
        category: this.determineCategory(title),
        description_ar: null,
        description_en: null,
        is_deal: false,
      });
    });
    return out;
  }
}
