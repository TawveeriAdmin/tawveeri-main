import * as cheerio from 'cheerio';
import { BaseSearchScraper, formatScrapeError } from './base-search-scraper';
import { fetchSearchHtmlWithPuppeteer } from './puppeteer-search-html';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { expandQueriesForRetailSearch } from './search-query-bilingual';
import { qenc } from './retail-search-url';

const BASE_URL = 'https://www.alkhunaizan.sa';

/** Alkhunaizan — Next.js SPA; search results hydrate client-side. */
export class AlkhunaizanSearchScraper extends BaseSearchScraper {
  constructor() {
    super('alkhunaizan', 'Alkhunaizan');
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
          const url = `${BASE_URL}/search?q=${qenc(q)}${page > 1 ? `&page=${page}` : ''}`;
          const html = await fetchSearchHtmlWithPuppeteer(url, {
            waitForSelector: 'a[href*="-p-"]',
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
    $('section.col-span-1').each((_, el) => {
      const card = $(el);
      const titleAnchor = card.find('a.line-clamp-3, a[class*="line-clamp"]').first();
      const href = titleAnchor.attr('href') ||
        card.find('a[href*="-p-"]').first().attr('href') || '';
      const title = titleAnchor.text().trim() ||
        card.find('a[href*="-p-"]').first().text().trim();
      if (!title || !href) return;

      // First anchor inside card contains the main product image (brand logo anchor comes after)
      const img = card.find('a[href*="-p-"]').first().find('img').attr('src') ||
        card.find('img').first().attr('src') || null;

      // Price: .font-bold span next to the riyal icon
      const priceText = card.find('span.font-bold').first().text();
      const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;
      const origText = card.find('span.line-through').first().text();
      const original = parseFloat(origText.replace(/[^\d.]/g, '')) || null;

      // SKU from URL tail after -p-
      const skuMatch = href.match(/-p-([a-z0-9-]+)$/i);
      const sku = skuMatch ? skuMatch[1] : null;

      const productUrl = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;

      out.push({
        name_ar: title,
        name_en: title,
        brand: '',
        model: '',
        sku,
        current_price: price,
        original_price: original && price && original > price ? original : null,
        availability: 'in_stock',
        product_url: productUrl,
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
