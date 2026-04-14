import { BaseSearchScraper, formatScrapeError } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { getBrowserHeaders } from './user-agents';

const BASE_URL = 'https://www.amazon.sa';

export class AmazonSearchScraper extends BaseSearchScraper {
  constructor() {
    super('amazon', 'Amazon SA');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { query, pages } = options;
    const allProducts: SearchProduct[] = [];

    try {
      for (let page = 1; page <= pages; page++) {
        if (page > 1) await this.delay(500, 1500);

        const url = `${BASE_URL}/s?k=${encodeURIComponent(query)}&page=${page}&ref=sr_pg_${page}`;
        let html: string;
        try {
          html = await this.fetchHtml(url, getBrowserHeaders());
        } catch (err) {
          console.error(`[Amazon] Page ${page} fetch failed:`, formatScrapeError(err));
          break;
        }

        const $ = this.getCheerio(html);
        const items = $("div[data-component-type='s-search-result']");

        if (items.length === 0) break;

        items.each((_, el) => {
          const product = this.parseProduct($, $(el));
          if (product) allProducts.push(product);
        });

        console.log(`[Amazon] Page ${page}: ${items.length} items found`);
      }
    } catch (err) {
      const msg = formatScrapeError(err);
      console.error(`[Amazon] Search error:`, msg);
      if (allProducts.length === 0) return this.errorResult(msg);
    }

    return {
      products: allProducts,
      store: this.storeSlug,
      storeName: this.storeName,
      count: allProducts.length,
    };
  }

  private parseProduct($: ReturnType<typeof this.getCheerio>, el: ReturnType<ReturnType<typeof this.getCheerio>>): SearchProduct | null {
    const asin = el.attr('data-asin');
    if (!asin) return null;

    // Title
    const titleEl = el.find('h2 a span, h2 span').first();
    const title = titleEl.text().trim() || 'No title';

    // URL
    const linkEl = el.find('h2 a, a.a-link-normal.s-no-outline').first();
    const href = linkEl.attr('href');
    const productUrl = href ? `${BASE_URL}${href}` : '';

    // Price — current (sale) price: first non-strikethrough a-price
    let price: number | null = null;
    const currentPriceSelectors = [
      'span.a-price:not([data-a-strike="true"]) span.a-offscreen',
      "span[data-a-color='price'] span.a-offscreen",
      'span.a-price span.a-offscreen',
      'span.a-price-whole',
    ];
    for (const sel of currentPriceSelectors) {
      const priceEl = el.find(sel).first();
      if (priceEl.length) {
        price = this.parsePrice(priceEl.text());
        if (price !== null) break;
      }
    }

    // Original (list/strikethrough) price
    let originalPrice: number | null = null;
    const originalPriceSelectors = [
      'span.a-price[data-a-strike="true"] span.a-offscreen',
      'span.a-text-price span.a-offscreen',
      "span[data-a-color='secondary'] span.a-offscreen",
    ];
    for (const sel of originalPriceSelectors) {
      const origEl = el.find(sel).first();
      if (origEl.length) {
        originalPrice = this.parsePrice(origEl.text());
        if (originalPrice !== null) break;
      }
    }
    // Only keep original if it's actually higher than current
    if (originalPrice !== null && price !== null && originalPrice <= price) {
      originalPrice = null;
    }
    const isDeal = originalPrice !== null && price !== null && originalPrice > price;

    // Rating
    let rating: number | null = null;
    const ratingEl = el.find('span.a-icon-alt').first();
    if (ratingEl.length) {
      const m = ratingEl.text().match(/(\d+\.?\d*)/);
      if (m) rating = parseFloat(m[1]);
    }

    // Review count
    let reviewCount: number | null = null;
    const reviewEl = el.find('span.a-size-base.s-underline-text').first();
    if (reviewEl.length) {
      const cleaned = reviewEl.text().replace(/[^\d]/g, '');
      if (cleaned) reviewCount = parseInt(cleaned, 10);
    }

    // Image
    const imgEl = el.find('img.s-image').first();
    const imageUrl = imgEl.attr('src') || null;

    // Badges
    const isPrime = el.find('i.a-icon-prime').length > 0;
    const brand = 'Unknown';
    const model = this.extractModel(title, null);
    const category = this.determineCategory(title);

    return {
      name_ar: title,
      name_en: title,
      brand,
      model,
      sku: asin,
      current_price: price || 0,
      original_price: originalPrice,
      availability: 'in_stock',
      product_url: productUrl,
      image_urls: imageUrl ? [imageUrl] : [],
      specifications: {},
      category,
      description_ar: null,
      description_en: null,
      is_deal: isDeal,
      is_free_delivery: isPrime,
      store: this.storeSlug,
      store_name: this.storeName,
      rating,
      review_count: reviewCount,
    };
  }
}
