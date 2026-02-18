import type { ScrapedProduct, ProductCategory } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { normalizeUrl } from '../utils/url-utils';
import { determineCategory } from '../utils/category-utils';

const BASE_URL = 'https://www.amazon.sa';

/**
 * Amazon.sa store scraper.
 * Uses cheerio for search/category pages + Puppeteer for product pages.
 * Reuses selectors from AmazonSearchScraper.
 */
export class AmazonScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('amazon'));
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
            console.error(`[Amazon] Error scraping page ${page} of ${baseUrl}:`, error);
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
    const url = page === 1 ? baseUrl : `${baseUrl}&page=${page}&ref=sr_pg_${page}`;
    const products: ScrapedProduct[] = [];

    // Use fetch for listing pages (no JS rendering needed for basic data)
    const html = await this.fetchPage(url);
    const $ = this.getCheerio(html);

    const items = $("div[data-component-type='s-search-result']");
    if (items.length === 0) return [];

    console.log(`[Amazon] Page ${page}: ${items.length} items found`);

    items.each((_, el) => {
      const product = this.parseSearchResult($, $(el), category);
      if (product) products.push(product);
    });

    return products;
  }

  private parseSearchResult(
    $: ReturnType<typeof this.getCheerio>,
    el: ReturnType<ReturnType<typeof this.getCheerio>>,
    category: ProductCategory,
  ): ScrapedProduct | null {
    const asin = el.attr('data-asin');
    if (!asin) return null;

    // Title
    const titleEl = el.find('h2 a span, h2 span').first();
    const title = titleEl.text().trim();
    if (!title || title.length < 3) return null;

    // URL
    const linkEl = el.find('h2 a, a.a-link-normal.s-no-outline').first();
    const href = linkEl.attr('href');
    const productUrl = href ? normalizeUrl(href, BASE_URL) : '';
    if (!productUrl) return null;

    // Price
    let price: number | null = null;
    const priceSelectors = [
      'span.a-price span.a-offscreen',
      'span.a-price-whole',
      "span[data-a-color='price'] span.a-offscreen",
    ];
    for (const sel of priceSelectors) {
      const priceEl = el.find(sel).first();
      if (priceEl.length) {
        price = this.parsePrice(priceEl.text());
        if (price !== null) break;
      }
    }
    if (!price || price <= 0) return null;

    // Original price
    let originalPrice: number | null = null;
    const origEl = el.find('.a-price.a-text-price .a-offscreen').first();
    if (origEl.length) {
      originalPrice = this.parsePrice(origEl.text());
    }

    // Image
    const imgEl = el.find('img.s-image').first();
    const imageUrl = imgEl.attr('src') || null;

    // Brand extraction
    const { brand, model } = this.extractBrandAndModel(title);
    const isPrime = el.find('i.a-icon-prime').length > 0;
    const hasDiscount = originalPrice !== null && originalPrice > price;

    return {
      name_ar: title,
      name_en: title,
      brand,
      model,
      sku: asin,
      current_price: price,
      original_price: originalPrice,
      availability: 'in_stock',
      product_url: productUrl,
      image_urls: imageUrl ? [imageUrl] : [],
      specifications: {},
      category,
      description_ar: null,
      description_en: null,
      is_deal: hasDiscount,
      is_free_delivery: isPrime,
    };
  }

  private async scrapeProductPage(productUrl: string): Promise<ScrapedProduct | null> {
    // Use Puppeteer for product pages (they need JS)
    const page = await this.fetchPageWithJS(productUrl);
    const html = await page.content();
    const $ = this.getCheerio(html);

    const title = this.extractText($, '#productTitle') || '';
    if (!title) return null;

    // Price selectors
    let price: number | null = null;
    const priceSelectors = [
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price .a-offscreen',
      '#corePrice_feature_div .a-offscreen',
      '#tp_price_block_total_price_ww .a-offscreen',
    ];
    for (const sel of priceSelectors) {
      const priceText = this.extractText($, sel);
      if (priceText) {
        price = this.parsePrice(priceText);
        if (price) break;
      }
    }
    if (!price) return null;

    // Original price
    let originalPrice: number | null = null;
    const origText = this.extractText($, '.a-price.a-text-price .a-offscreen') ||
                     this.extractText($, '#listPrice') ||
                     this.extractText($, '.basisPrice .a-offscreen');
    if (origText) originalPrice = this.parsePrice(origText);

    // Image
    const imageUrl = this.extractAttr($, '#imgTagWrapperId img, #landingImage', 'src');

    // ASIN
    const asin = this.extractAttr($, 'input[name="ASIN"]', 'value') ||
                 productUrl.match(/\/dp\/([A-Z0-9]+)/i)?.[1] || null;

    // Availability
    const availText = this.extractText($, '#availability span') || 'in_stock';

    const { brand, model } = this.extractBrandAndModel(title);

    return {
      name_ar: title,
      name_en: title,
      brand,
      model,
      sku: asin,
      current_price: price,
      original_price: originalPrice,
      availability: this.parseAvailability(availText),
      product_url: productUrl,
      image_urls: imageUrl ? [imageUrl] : [],
      specifications: this.extractSpecs($),
      category: determineCategory(title),
      description_ar: null,
      description_en: this.extractText($, '#feature-bullets'),
    };
  }

  private extractSpecs($: ReturnType<typeof this.getCheerio>): Record<string, unknown> {
    const specs: Record<string, unknown> = {};
    $('#productDetails_techSpec_section_1 tr, #detailBullets_feature_div li').each((_, el) => {
      const label = $(el).find('th, span.a-text-bold').first().text().trim().replace(/[\s:]+$/, '');
      const value = $(el).find('td, span:not(.a-text-bold)').first().text().trim();
      if (label && value) specs[label] = value;
    });
    return specs;
  }

  private extractBrandAndModel(name: string): { brand: string; model: string } {
    const knownBrands = [
      'Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Dell', 'HP', 'Lenovo',
      'LG', 'Sony', 'Asus', 'Acer', 'MSI', 'Nokia', 'Oppo', 'Vivo',
      'OnePlus', 'Google', 'Microsoft', 'Anker', 'JBL', 'Bose',
    ];

    let brand = 'Unknown';
    let model = name;

    for (const knownBrand of knownBrands) {
      if (name.toLowerCase().includes(knownBrand.toLowerCase())) {
        brand = knownBrand;
        model = name.replace(new RegExp(knownBrand, 'gi'), '').trim();
        break;
      }
    }

    return { brand, model };
  }

  private parseAvailability(text: string): 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order' {
    const t = text.toLowerCase();
    if (t.includes('out of stock') || t.includes('unavailable') || t.includes('currently unavailable')) return 'out_of_stock';
    if (t.includes('only') && t.includes('left')) return 'limited_stock';
    if (t.includes('pre-order') || t.includes('preorder')) return 'pre_order';
    return 'in_stock';
  }
}
