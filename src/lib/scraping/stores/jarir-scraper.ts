import type { ScrapedProduct, ProductCategory } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { normalizeUrl } from '../utils/url-utils';
import type * as cheerio from 'cheerio';

/**
 * Jarir Bookstore scraper
 */
export class JarirScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('jarir') as any);
  }

  /**
   * Discover products from category pages
   */
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
            const pageProducts = await this.scrapeCategoryPage(baseUrl, page);
            
            if (pageProducts.length === 0) {
              break; // No more products, stop pagination
            }

            products.push(...pageProducts);
            
            // Rate limiting between pages
            await this.delay();
          } catch (error) {
            console.error(`Error scraping page ${page} of ${baseUrl}:`, error);
            // Continue to next page
          }
        }
      }
    } finally {
      await this.cleanup();
    }

    return products;
  }

  /**
   * Scrape a single category page
   */
  private async scrapeCategoryPage(baseUrl: string, page: number): Promise<ScrapedProduct[]> {
    const url = this.buildCategoryUrl(baseUrl, page);
    const products: ScrapedProduct[] = [];

    if (this.config.requires_js) {
      const pageObj = await this.fetchPageWithJS(url);
      const html = await pageObj.content();
      const productUrls = this.parseProductList(html);

      for (const productUrl of productUrls) {
        try {
          const product = await this.scrapeProductPage(productUrl);
          if (product) {
            products.push(product);
          }
          await this.delay();
        } catch (error) {
          console.error(`Error scraping product ${productUrl}:`, error);
          // Continue to next product
        }
      }
    } else {
      const html = await this.fetchPage(url);
      const productUrls = this.parseProductList(html);

      for (const productUrl of productUrls) {
        try {
          const product = await this.scrapeProductPage(productUrl);
          if (product) {
            products.push(product);
          }
          await this.delay();
        } catch (error) {
          console.error(`Error scraping product ${productUrl}:`, error);
        }
      }
    }

    return products;
  }

  /**
   * Build category URL with pagination
   */
  private buildCategoryUrl(baseUrl: string, page: number): string {
    if (page === 1) return baseUrl;
    
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}p=${page}`;
  }

  /**
   * Parse product list from category page HTML
   */
  private parseProductList(html: string): string[] {
    const $ = this.getCheerio(html);
    const productUrls: string[] = [];
    const selector = this.config.selectors.product_list;

    $(selector).each((_, element) => {
      const linkSelector = $(element).find(this.config.selectors.product_link);
      const href = linkSelector.attr('href');
      
      if (href) {
        const absoluteUrl = normalizeUrl(href, this.config.base_url);
        productUrls.push(absoluteUrl);
      }
    });

    return productUrls;
  }

  /**
   * Scrape individual product page
   */
  async scrapeProductPage(productUrl: string): Promise<ScrapedProduct | null> {
    if (this.config.requires_js) {
      const page = await this.fetchPageWithJS(productUrl);
      const html = await page.content();
      return this.parseProductPage(html, productUrl);
    } else {
      const html = await this.fetchPage(productUrl);
      return this.parseProductPage(html, productUrl);
    }
  }

  /**
   * Parse product page HTML
   */
  private parseProductPage(html: string, productUrl: string): ScrapedProduct | null {
    const $ = this.getCheerio(html);

    // Extract product data using selectors from config
    const nameEn = this.extractText($, this.config.selectors.product_name) || '';
    const nameAr = this.extractText($, this.config.selectors.product_name_ar || this.config.selectors.product_name) || '';
    const priceText = this.extractText($, this.config.selectors.product_price) || '';
    const originalPriceText = this.config.selectors.product_original_price
      ? this.extractText($, this.config.selectors.product_original_price)
      : null;
    const sku = this.config.selectors.product_sku
      ? this.extractText($, this.config.selectors.product_sku)
      : null;
    const availabilityText = this.extractText($, this.config.selectors.product_availability) || 'in_stock';
    
    // Parse price
    const currentPrice = this.parsePrice(priceText);
    if (!currentPrice) {
      throw new Error(`Failed to parse price: ${priceText}`);
    }

    const originalPrice = originalPriceText ? this.parsePrice(originalPriceText) : null;

    // Extract images
    const images = this.extractAttrs($, this.config.selectors.product_image, 'src');
    const imageUrls = images.map(img => normalizeUrl(img, this.config.base_url));

    // Extract specifications (this is store-specific and may need customization)
    const specifications = this.extractSpecifications($);

    // Extract descriptions
    const descriptionEn = this.config.selectors.product_description
      ? this.extractText($, this.config.selectors.product_description)
      : null;
    const descriptionAr = this.config.selectors.product_description_ar
      ? this.extractText($, this.config.selectors.product_description_ar)
      : null;

    // Parse brand and model from name (store-specific logic)
    const { brand, model } = this.extractBrandAndModel(nameEn);

    // Parse availability
    const availability = this.parseAvailability(availabilityText);

    // Determine category from URL or context (may need to be passed)
    const category = this.determineCategory(productUrl);

    return {
      name_ar: nameAr || nameEn,
      name_en: nameEn,
      brand,
      model,
      sku,
      current_price: currentPrice,
      original_price: originalPrice,
      availability,
      product_url: productUrl,
      image_urls: imageUrls,
      specifications,
      category,
      description_ar: descriptionAr,
      description_en: descriptionEn,
    };
  }

  /**
   * Extract specifications from product page
   */
  private extractSpecifications($: cheerio.CheerioAPI): Record<string, unknown> {
    const specs: Record<string, unknown> = {};

    if (this.config.selectors.product_specs) {
      const specsElement = $(this.config.selectors.product_specs);
      
      // Try to parse specification table or list
      specsElement.find('tr, li').each((_, element) => {
        const text = $(element).text().trim();
        const parts = text.split(':');
        if (parts.length === 2) {
          const key = parts[0].trim();
          const value = parts[1].trim();
          specs[key] = value;
        }
      });
    }

    return specs;
  }

  /**
   * Extract brand and model from product name
   * This is a simple implementation - may need to be refined per store
   */
  private extractBrandAndModel(name: string): { brand: string; model: string } {
    const words = name.split(' ');
    
    // Common brands (extend as needed)
    const knownBrands = ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Dell', 'HP', 'Lenovo', 'LG', 'Sony'];
    
    let brand = 'Unknown';
    let model = name;

    for (const knownBrand of knownBrands) {
      if (name.toLowerCase().includes(knownBrand.toLowerCase())) {
        brand = knownBrand;
        // Remove brand from model
        model = name.replace(new RegExp(knownBrand, 'gi'), '').trim();
        break;
      }
    }

    return { brand, model };
  }

  /**
   * Parse availability status from text
   */
  private parseAvailability(text: string): 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order' {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('out') || lowerText.includes('unavailable')) {
      return 'out_of_stock';
    }
    if (lowerText.includes('limited') || lowerText.includes('few')) {
      return 'limited_stock';
    }
    if (lowerText.includes('pre-order') || lowerText.includes('preorder')) {
      return 'pre_order';
    }
    
    return 'in_stock';
  }

  /**
   * Determine category from URL or context
   */
  private determineCategory(url: string): ProductCategory {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('smartphone') || lowerUrl.includes('phone')) return 'smartphone';
    if (lowerUrl.includes('laptop')) return 'laptop';
    if (lowerUrl.includes('tv') || lowerUrl.includes('television')) return 'tv';
    if (lowerUrl.includes('tablet')) return 'tablet';
    if (lowerUrl.includes('audio') || lowerUrl.includes('headphone')) return 'audio';
    if (lowerUrl.includes('camera')) return 'camera';
    if (lowerUrl.includes('gaming') || lowerUrl.includes('game')) return 'gaming';
    
    return 'accessories'; // Default
  }

  /**
   * Update product price from product page
   */
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
}


