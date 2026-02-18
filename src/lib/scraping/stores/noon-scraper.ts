import type { ScrapedProduct, ProductCategory } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { determineCategory } from '../utils/category-utils';

const NOON_API_URL = 'https://www.noon.com/_svc/catalog/api/v3/u/en-sa/search';
const NOON_CDN = 'https://f.nooncdn.com/p';
const BASE_URL = 'https://www.noon.com/saudi-en';

/**
 * Noon store scraper using Noon's internal JSON API.
 * Reuses patterns from NoonSearchScraper.
 */
export class NoonScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('noon'));
  }

  async discoverProducts(
    category: ProductCategory,
    maxPages: number = 10
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    const categoryUrls = this.config.category_urls[category] || [];

    if (categoryUrls.length === 0) {
      throw new Error(`No category URLs configured for category: ${category}`);
    }

    try {
      for (const baseUrl of categoryUrls) {
        // Extract category path for API query
        const categoryQuery = this.extractCategoryQuery(baseUrl, category);

        for (let page = 1; page <= maxPages; page++) {
          try {
            const pageProducts = await this.scrapeApiPage(categoryQuery, page, category);

            if (pageProducts.length === 0) {
              break;
            }

            products.push(...pageProducts);
            await this.delay();
          } catch (error) {
            console.error(`[Noon] Error scraping page ${page}:`, error);
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
      // Extract SKU from URL pattern: /p/NXXXXXXX/ or /p/<sku>/
      const skuMatch = productUrl.match(/\/p\/([A-Z0-9]+)/i);
      if (!skuMatch) {
        // Fallback to HTML scraping
        return this.scrapeProductPageHtml(productUrl);
      }

      const sku = skuMatch[1];
      const apiUrl = `${NOON_API_URL}?q=${encodeURIComponent(sku)}&limit=1`;

      const data = await this.fetchJson<Record<string, unknown>>(apiUrl, {
        'x-locale': 'en-sa',
        'x-platform': 'web',
        'x-content': 'desktop',
      });

      const hits = this.extractHits(data);
      if (hits.length === 0) {
        return this.scrapeProductPageHtml(productUrl);
      }

      return this.parseApiProduct(hits[0], productUrl);
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

  private extractCategoryQuery(baseUrl: string, category: ProductCategory): string {
    // Map category to search terms for the API
    const categoryMap: Record<string, string> = {
      smartphone: 'smartphone',
      laptop: 'laptop',
      tv: 'television',
      tablet: 'tablet',
      audio: 'headphones speakers',
      camera: 'camera',
      gaming: 'gaming console',
      accessories: 'electronics accessories',
    };
    return categoryMap[category] || category;
  }

  private async scrapeApiPage(query: string, page: number, category: ProductCategory): Promise<ScrapedProduct[]> {
    const url = `${NOON_API_URL}?q=${encodeURIComponent(query)}&page=${page}&limit=50&sort%5Bby%5D=relevance&sort%5Bdir%5D=desc`;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) await this.delay(3000 * attempt, 5000 * attempt);

        const data = await this.fetchJson<Record<string, unknown>>(url, {
          'x-locale': 'en-sa',
          'x-platform': 'web',
          'x-content': 'desktop',
        });

        const hits = this.extractHits(data);
        console.log(`[Noon] Page ${page}: ${hits.length} products from API`);

        return hits
          .map(item => this.parseApiProduct(item, undefined, category))
          .filter((p): p is ScrapedProduct => p !== null);
      } catch (err) {
        console.error(`[Noon] API attempt ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : err);
        if (attempt === maxRetries - 1) return [];
      }
    }
    return [];
  }

  private extractHits(data: Record<string, unknown>): Record<string, unknown>[] {
    return (
      (data.hits as unknown[]) ||
      (data.results as unknown[]) ||
      (data.products as unknown[]) ||
      ((data.data as Record<string, unknown>)?.hits as unknown[]) ||
      ((data.data as Record<string, unknown>)?.products as unknown[]) ||
      []
    ) as Record<string, unknown>[];
  }

  private parseApiProduct(
    item: Record<string, unknown>,
    overrideUrl?: string,
    defaultCategory?: ProductCategory,
  ): ScrapedProduct | null {
    try {
      const title = (item.name || item.title || '') as string;
      if (!title || title.length < 3) return null;

      const sku = String(item.sku || item.id || item.product_id || '');

      // Price extraction
      const priceData = item.price || item.sale_price || {};
      let price: number | null = null;
      let originalPrice: number | null = null;

      if (typeof priceData === 'object' && priceData !== null) {
        const pd = priceData as Record<string, unknown>;
        price = this.toNumber(pd.now || pd.current || pd.price);
        originalPrice = this.toNumber(pd.was || pd.original);
      } else if (priceData) {
        price = this.toNumber(priceData);
      }

      if (!price && item.sale_price) price = this.toNumber(item.sale_price);
      if (!originalPrice && typeof item.price === 'number' && item.sale_price && item.price !== item.sale_price) {
        originalPrice = this.toNumber(item.price);
      }

      if (!price || price <= 0) return null;

      // URL
      const slug = (item.slug || item.url_key || '') as string;
      let productUrl = overrideUrl || '';
      if (!productUrl && slug) {
        productUrl = sku ? `${BASE_URL}/${slug}/p/${sku}/` : `${BASE_URL}/${slug}/`;
      }

      // Image
      let imageUrl: string | null = null;
      const imageKey = item.image_key as string | undefined;
      if (imageKey) {
        imageUrl = `${NOON_CDN}/${imageKey}.jpg`;
      } else {
        for (const key of ['image_url', 'image', 'thumbnail']) {
          const val = item[key];
          if (typeof val === 'string' && val) { imageUrl = val; break; }
        }
      }
      if (imageUrl?.startsWith('//')) imageUrl = `https:${imageUrl}`;

      // Brand and model
      const brand = (item.brand || item.brand_name || 'Unknown') as string;
      const model = this.extractModelFromTitle(title, brand);
      const category = defaultCategory || determineCategory(title);

      const isExpress = !!(item.is_express || item.express_delivery);
      const hasDiscount = originalPrice !== null && originalPrice > price;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model,
        sku: sku || null,
        current_price: price,
        original_price: originalPrice,
        availability: (item.in_stock === false || item.is_available === false) ? 'out_of_stock' : 'in_stock',
        product_url: productUrl,
        image_urls: imageUrl ? [imageUrl] : [],
        specifications: {},
        category,
        description_ar: null,
        description_en: null,
        is_deal: hasDiscount,
        is_free_delivery: isExpress,
      };
    } catch (err) {
      console.error('[Noon] Error parsing product:', err);
      return null;
    }
  }

  private async scrapeProductPageHtml(productUrl: string): Promise<ScrapedProduct | null> {
    const html = await this.fetchPage(productUrl);
    const $ = this.getCheerio(html);

    const title = this.extractText($, 'h1') || this.extractText($, '[data-qa="pdp-name"]') || '';
    if (!title) return null;

    const priceText = this.extractText($, '[data-qa="pdp-price-final"]') ||
                      this.extractText($, '.priceNow') ||
                      this.extractText($, '.price') || '';
    const currentPrice = this.parsePrice(priceText);
    if (!currentPrice) return null;

    const originalPriceText = this.extractText($, '[data-qa="pdp-price-was"]') ||
                              this.extractText($, '.priceWas') || '';
    const originalPrice = originalPriceText ? this.parsePrice(originalPriceText) : null;

    const imageUrl = this.extractAttr($, '[data-qa="pdp-image"] img, .pdp-image img, img.product-image', 'src');
    const brand = this.extractText($, '[data-qa="pdp-brand"]') || 'Unknown';
    const model = this.extractModelFromTitle(title, brand);

    return {
      name_ar: title,
      name_en: title,
      brand,
      model,
      sku: null,
      current_price: currentPrice,
      original_price: originalPrice,
      availability: 'in_stock',
      product_url: productUrl,
      image_urls: imageUrl ? [imageUrl] : [],
      specifications: {},
      category: determineCategory(title),
      description_ar: null,
      description_en: null,
    };
  }

  private extractModelFromTitle(title: string, brand: string): string {
    let model = title;
    if (brand && brand !== 'Unknown') {
      model = model.replace(new RegExp(brand, 'gi'), '').trim();
    }
    const words = model.split(' ').slice(0, 4).join(' ');
    return words || title;
  }

  private toNumber(val: unknown): number | null {
    if (val === null || val === undefined) return null;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(n) ? null : n;
  }
}
