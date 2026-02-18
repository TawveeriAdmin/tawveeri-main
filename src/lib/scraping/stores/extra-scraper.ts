import type { ScrapedProduct, ProductCategory } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { normalizeUrl } from '../utils/url-utils';
import { determineCategory } from '../utils/category-utils';

const BASE_URL = 'https://www.extra.com';

/**
 * Extra store scraper.
 * Uses __NEXT_DATA__ JSON extraction + HTML fallback.
 * Reuses patterns from ExtraSearchScraper.
 */
export class ExtraScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('extra'));
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
            console.error(`[Extra] Error scraping page ${page} of ${baseUrl}:`, error);
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

    // Try fetching with JS for __NEXT_DATA__
    if (this.config.requires_js) {
      const pageObj = await this.fetchPageWithJS(url);
      const html = await pageObj.content();
      return this.parsePage(html, category);
    }

    const html = await this.fetchPage(url);
    return this.parsePage(html, category);
  }

  private parsePage(html: string, category: ProductCategory): ScrapedProduct[] {
    const $ = this.getCheerio(html);

    // Strategy 1: __NEXT_DATA__ JSON
    const nextDataEl = $('script#__NEXT_DATA__');
    if (nextDataEl.length) {
      try {
        const data = JSON.parse(nextDataEl.html() || '{}');
        const pageProps = data?.props?.pageProps || {};
        const productList = (
          pageProps.products ||
          pageProps.searchResults?.products ||
          pageProps.initialData?.products ||
          []
        ) as Record<string, unknown>[];

        const products = productList
          .map(item => this.parseJsonProduct(item, category))
          .filter((p): p is ScrapedProduct => p !== null);
        if (products.length > 0) {
          console.log(`[Extra] __NEXT_DATA__: ${products.length} products found`);
          return products;
        }
      } catch { /* fall through */ }
    }

    // Strategy 2: Inline script JSON
    const scripts = $('script');
    for (let i = 0; i < scripts.length; i++) {
      const content = $(scripts[i]).html() || '';
      if (content.includes('"products"') || content.includes('"searchResults"')) {
        try {
          const match = content.match(new RegExp('(\\{.*"products".*\\})', 's'));
          if (match) {
            const data = JSON.parse(match[1]);
            const productList = (data.products || []) as Record<string, unknown>[];
            const products = productList
              .map(item => this.parseJsonProduct(item, category))
              .filter((p): p is ScrapedProduct => p !== null);
            if (products.length > 0) return products;
          }
        } catch { /* fall through */ }
      }
    }

    // Strategy 3: HTML selectors
    return this.parseHtmlProducts($, category);
  }

  private parseJsonProduct(
    item: Record<string, unknown>,
    defaultCategory: ProductCategory,
  ): ScrapedProduct | null {
    try {
      const title = (item.name || item.title || '') as string;
      if (!title || title.length < 3) return null;

      // Price
      const priceInfo = (item.price || {}) as Record<string, unknown>;
      let price = this.toNumber(priceInfo.final_price || priceInfo.current || item.price);
      const originalPrice = this.toNumber(priceInfo.regular_price || priceInfo.was);

      if (price === null && typeof item.price === 'object') {
        price = this.toNumber((item.price as Record<string, unknown>)?.final_price);
      }

      if (!price || price <= 0) return null;

      const sku = String(item.sku || item.id || '');
      const imageUrl = (item.image || item.thumbnail || item.image_url || null) as string | null;
      const brand = (item.brand || 'Unknown') as string;
      const model = this.extractModelFromTitle(title, brand);
      const urlPath = (item.url || item.product_url || '') as string;
      const productUrl = urlPath.startsWith('http') ? urlPath : `${BASE_URL}${urlPath}`;
      const hasDiscount = originalPrice !== null && originalPrice > price;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model,
        sku: sku || null,
        current_price: price,
        original_price: originalPrice,
        availability: (item.in_stock === false || item.is_saleable === false) ? 'out_of_stock' : 'in_stock',
        product_url: productUrl,
        image_urls: imageUrl ? [imageUrl] : [],
        specifications: {},
        category: defaultCategory,
        description_ar: null,
        description_en: null,
        is_deal: hasDiscount,
        is_free_delivery: !!(item.express_delivery),
      };
    } catch (err) {
      console.error('[Extra] Error parsing JSON product:', err);
      return null;
    }
  }

  private parseHtmlProducts(
    $: ReturnType<typeof this.getCheerio>,
    category: ProductCategory,
  ): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];
    const selectors = [
      '.product-item',
      '.product-card',
      '[data-product-id]',
      '.products-grid .item',
      "[class*='ProductCard']",
      "a[href*='/p/']",
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, el) => {
          const product = this.parseHtmlProduct($, $(el), category);
          if (product) products.push(product);
        });
        if (products.length > 0) return products;
      }
    }

    return products;
  }

  private parseHtmlProduct(
    $: ReturnType<typeof this.getCheerio>,
    el: ReturnType<ReturnType<typeof this.getCheerio>>,
    category: ProductCategory,
  ): ScrapedProduct | null {
    try {
      const titleEl = el.find('.product-name a, .product-title a, h2.product-name').first();
      const title = titleEl.text().trim();
      if (!title || title.length < 3) return null;

      const linkEl = el.find("a.product-link, .product-name a, a[href*='/p/']").first();
      const href = linkEl.attr('href') || '';
      const productUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

      const price = this.parsePrice(
        el.find('.special-price .price, .product-price, .price-box .price').first().text()
      );
      if (!price) return null;

      const originalPrice = this.parsePrice(
        el.find('.old-price .price, .was-price').first().text()
      );

      const imgEl = el.find('img.product-image, .product-image img').first();
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;

      const sku = el.attr('data-sku') || el.attr('data-product-id') || null;
      const brand = el.find('.product-brand, .brand-name').first().text().trim() || 'Unknown';
      const model = this.extractModelFromTitle(title, brand);

      return {
        name_ar: title,
        name_en: title,
        brand,
        model,
        sku,
        current_price: price,
        original_price: originalPrice,
        availability: el.find('.out-of-stock').length === 0 ? 'in_stock' : 'out_of_stock',
        product_url: productUrl,
        image_urls: imageUrl ? [imageUrl] : [],
        specifications: {},
        category,
        description_ar: null,
        description_en: null,
        is_deal: originalPrice !== null && price < originalPrice,
        is_free_delivery: false,
      };
    } catch (err) {
      console.error('[Extra] Error parsing HTML product:', err);
      return null;
    }
  }

  private async scrapeProductPage(productUrl: string): Promise<ScrapedProduct | null> {
    const page = await this.fetchPageWithJS(productUrl);
    const html = await page.content();
    const $ = this.getCheerio(html);

    // Try __NEXT_DATA__ first
    const nextDataEl = $('script#__NEXT_DATA__');
    if (nextDataEl.length) {
      try {
        const data = JSON.parse(nextDataEl.html() || '{}');
        const product = data?.props?.pageProps?.product ||
                        data?.props?.pageProps?.initialData?.product;
        if (product) {
          const result = this.parseJsonProduct(product as Record<string, unknown>, 'accessories');
          if (result) {
            result.product_url = productUrl;
            result.category = determineCategory(result.name_en);
            return result;
          }
        }
      } catch { /* fall through */ }
    }

    // HTML fallback for product page
    const title = this.extractText($, 'h1.product-name, h1[data-testid="product-name"], h1') || '';
    if (!title) return null;

    const priceText = this.extractText($, '.product-price .current, .price-current, .special-price') || '';
    const currentPrice = this.parsePrice(priceText);
    if (!currentPrice) return null;

    const origText = this.extractText($, '.product-price .was, .price-was, .old-price') || '';
    const originalPrice = origText ? this.parsePrice(origText) : null;

    const imageUrl = this.extractAttr($, '.product-gallery img, .pdp-image img', 'src');
    const brand = this.extractText($, '.product-brand, .brand-name') || 'Unknown';

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
