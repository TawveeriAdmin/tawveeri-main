import type { ScrapedProduct, ProductCategory } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { normalizeUrl } from '../utils/url-utils';
import { determineCategory } from '../utils/category-utils';

const BASE_URL = 'https://www.almanea.sa';

/**
 * Almanea (المنيع) store scraper.
 * Standard HTML e-commerce scraping.
 */
export class AlmaneaScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('almanea'));
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
        for (let page = 1; page <= maxPages; page++) {
          try {
            const pageProducts = await this.scrapeCategoryPage(baseUrl, page, category);

            if (pageProducts.length === 0) {
              break;
            }

            products.push(...pageProducts);
            await this.delay();
          } catch (error) {
            console.error(`[Almanea] Error scraping page ${page} of ${baseUrl}:`, error);
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
      return await this.scrapeProductPage(productUrl);
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

  private async scrapeCategoryPage(
    baseUrl: string,
    page: number,
    category: ProductCategory,
  ): Promise<ScrapedProduct[]> {
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    const products: ScrapedProduct[] = [];

    if (this.config.requires_js) {
      const pageObj = await this.fetchPageWithJS(url);
      const html = await pageObj.content();
      products.push(...this.parseProductList(html, category));
    } else {
      const html = await this.fetchPage(url);
      products.push(...this.parseProductList(html, category));
    }

    console.log(`[Almanea] Page ${page}: ${products.length} products found`);
    return products;
  }

  private parseProductList(html: string, category: ProductCategory): ScrapedProduct[] {
    const $ = this.getCheerio(html);
    const products: ScrapedProduct[] = [];

    // Try common e-commerce product card selectors
    const selectors = [
      '.product-item',
      '.product-card',
      '[data-product-id]',
      '.products-grid .item',
      '.category-products .item',
      "[class*='ProductCard']",
      "[class*='product-card']",
      'li.product',
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, el) => {
          const product = this.parseProductCard($, $(el), category);
          if (product) products.push(product);
        });
        if (products.length > 0) return products;
      }
    }

    // Fallback: look for structured data
    const jsonLd = $('script[type="application/ld+json"]');
    jsonLd.each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (data['@type'] === 'Product' || data['@type'] === 'ItemList') {
          const items = data.itemListElement || [data];
          for (const item of items) {
            const product = this.parseJsonLdProduct(item, category);
            if (product) products.push(product);
          }
        }
      } catch { /* ignore */ }
    });

    return products;
  }

  private parseProductCard(
    $: ReturnType<typeof this.getCheerio>,
    el: ReturnType<ReturnType<typeof this.getCheerio>>,
    category: ProductCategory,
  ): ScrapedProduct | null {
    try {
      // Title
      const titleEl = el.find('.product-name, .product-title, h2 a, h3 a, .item-title').first();
      const title = titleEl.text().trim();
      if (!title || title.length < 3) return null;

      // URL
      const linkEl = el.find('a.product-link, .product-name a, h2 a, h3 a, a[href*="/product"]').first();
      const href = linkEl.attr('href') || titleEl.closest('a').attr('href') || '';
      const productUrl = href.startsWith('http') ? href : normalizeUrl(href, BASE_URL);
      if (!productUrl) return null;

      // Price
      const priceEl = el.find('.price, .product-price, .special-price, .current-price, [class*="price"]').first();
      const price = this.parsePrice(priceEl.text());
      if (!price || price <= 0) return null;

      // Original price
      const origEl = el.find('.old-price, .was-price, .original-price, .regular-price, del').first();
      const originalPrice = this.parsePrice(origEl.text());

      // Image
      const imgEl = el.find('img').first();
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || null;
      const normalizedImage = imageUrl ? normalizeUrl(imageUrl, BASE_URL) : null;

      // SKU
      const sku = el.attr('data-product-id') || el.attr('data-sku') || el.attr('data-id') || null;

      // Brand
      const brandEl = el.find('.brand, .product-brand, .brand-name').first();
      const brand = brandEl.text().trim() || this.extractBrandFromTitle(title);
      const model = this.extractModelFromTitle(title, brand);

      return {
        name_ar: title,
        name_en: title,
        brand,
        model,
        sku,
        current_price: price,
        original_price: originalPrice,
        availability: el.find('.out-of-stock, .sold-out').length === 0 ? 'in_stock' : 'out_of_stock',
        product_url: productUrl,
        image_urls: normalizedImage ? [normalizedImage] : [],
        specifications: {},
        category,
        description_ar: null,
        description_en: null,
        is_deal: originalPrice !== null && price < originalPrice,
      };
    } catch (err) {
      console.error('[Almanea] Error parsing product card:', err);
      return null;
    }
  }

  private parseJsonLdProduct(
    item: Record<string, unknown>,
    category: ProductCategory,
  ): ScrapedProduct | null {
    try {
      const title = (item.name || '') as string;
      if (!title) return null;

      const offers = (item.offers || {}) as Record<string, unknown>;
      const price = this.toNumber(offers.price || offers.lowPrice);
      if (!price) return null;

      const imageUrl = (typeof item.image === 'string' ? item.image : (item.image as Record<string, unknown>)?.url) as string || null;
      const brand = ((item.brand as Record<string, unknown>)?.name || 'Unknown') as string;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model: this.extractModelFromTitle(title, brand),
        sku: (item.sku || null) as string | null,
        current_price: price,
        original_price: null,
        availability: offers.availability === 'https://schema.org/OutOfStock' ? 'out_of_stock' : 'in_stock',
        product_url: (item.url || '') as string,
        image_urls: imageUrl ? [imageUrl] : [],
        specifications: {},
        category,
        description_ar: null,
        description_en: (item.description || null) as string | null,
      };
    } catch {
      return null;
    }
  }

  private async scrapeProductPage(productUrl: string): Promise<ScrapedProduct | null> {
    const page = await this.fetchPageWithJS(productUrl);
    const html = await page.content();
    const $ = this.getCheerio(html);

    // Try structured data first
    const jsonLd = $('script[type="application/ld+json"]');
    let ldProduct: ScrapedProduct | null = null;
    jsonLd.each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (data['@type'] === 'Product') {
          ldProduct = this.parseJsonLdProduct(data, 'accessories');
        }
      } catch { /* ignore */ }
    });
    if (ldProduct) {
      (ldProduct as ScrapedProduct).product_url = productUrl;
      (ldProduct as ScrapedProduct).category = determineCategory((ldProduct as ScrapedProduct).name_en);
      return ldProduct;
    }

    // HTML fallback
    const title = this.extractText($, 'h1.product-name, h1.product-title, h1') || '';
    if (!title) return null;

    const priceText = this.extractText($, '.product-price .current, .price-current, .special-price, .price') || '';
    const currentPrice = this.parsePrice(priceText);
    if (!currentPrice) return null;

    const origText = this.extractText($, '.product-price .was, .old-price, .regular-price, del') || '';
    const originalPrice = origText ? this.parsePrice(origText) : null;

    const imageUrl = this.extractAttr($, '.product-gallery img, .product-image img, .pdp-image img', 'src');
    const brand = this.extractText($, '.product-brand, .brand') || this.extractBrandFromTitle(title);

    return {
      name_ar: title,
      name_en: title,
      brand,
      model: this.extractModelFromTitle(title, brand),
      sku: null,
      current_price: currentPrice,
      original_price: originalPrice,
      availability: 'in_stock',
      product_url: productUrl,
      image_urls: imageUrl ? [imageUrl] : [],
      specifications: {},
      category: determineCategory(title),
      description_ar: null,
      description_en: this.extractText($, '.product-description'),
    };
  }

  private extractBrandFromTitle(title: string): string {
    const knownBrands = [
      'Samsung', 'LG', 'Sony', 'Hisense', 'TCL', 'Panasonic', 'Sharp',
      'Haier', 'Midea', 'Daikin', 'Carrier', 'Gree', 'Bosch', 'Siemens',
      'Apple', 'HP', 'Dell', 'Lenovo', 'Asus', 'Acer',
    ];

    for (const brand of knownBrands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }
    return 'Unknown';
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
