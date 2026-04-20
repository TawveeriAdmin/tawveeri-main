import type { ScrapedProduct, ProductCategory } from '../base/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { normalizeUrl } from '../utils/url-utils';
import { determineCategory } from '../utils/category-utils';
import type * as cheerio from 'cheerio';

/**
 * Jarir Bookstore scraper
 */
export class JarirScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('jarir') as any);
  }

  /**
   * Discover products from category pages.
   *
   * Listing-page extraction: Jarir's category listing already contains every
   * field we need as `data-cnstrc-*` attributes on each `.product-tile__item`.
   * We extract in place instead of visiting per-product detail pages — that
   * drops HTTP request volume from ~2700/run to ~24/run.
   */
  async discoverProducts(
    category: ProductCategory,
    maxPages: number = 10
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    const categoryUrls = this.config.category_urls[category] || [];
    if (categoryUrls.length === 0) return products;

    // SKU dedup spans ALL URLs within a category. For categories like
    // `accessories` (smartphone-accessories + computer-supplies) or
    // `wearable` (smartwatches + health-fitness), a product that appears in
    // both URLs is scraped once instead of twice. Minor but consistent with
    // how Amazon handles the same pattern.
    const seenSkus = new Set<string>();

    try {
      for (const baseUrl of categoryUrls) {
        let consecutiveFailures = 0;
        let consecutiveAllDupPages = 0;
        // Dynamic pagination cap. Jarir exposes the total-results count as a
        // `data-cnstrc-num-results` attribute on page 1 (Constructor.io). We
        // read it once and clamp the loop to `ceil(total / 12)` — so raising
        // maxPages to a generous ceiling (e.g. 500) doesn't waste requests on
        // smaller categories. Falls back to the caller's maxPages if missing.
        let effectiveMaxPages = maxPages;
        for (let page = 1; page <= effectiveMaxPages; page++) {
          try {
            const url = this.buildCategoryUrl(baseUrl, page);
            const html = await this.fetchPage(url);

            if (page === 1) {
              const $ = this.getCheerio(html);
              const totalAttr = $('[data-cnstrc-num-results]').first().attr('data-cnstrc-num-results');
              const total = totalAttr ? Number(totalAttr) : 0;
              if (Number.isFinite(total) && total > 0) {
                const needed = Math.ceil(total / 12);
                effectiveMaxPages = Math.min(maxPages, needed);
                console.log(`  [jarir/${category}] catalog total=${total}, scraping ${effectiveMaxPages}/${maxPages} pages`);
              }
            }

            const pageProducts = this.parseListingPage(html, category);

            if (pageProducts.length === 0) break; // natural stop — no more listings

            // Track products new to THIS run. Jarir returns the first-page
            // fallback when you page past the real end — detect that by
            // watching for consecutive pages with no new SKUs.
            const newOnThisPage = pageProducts.filter((p) => p.sku && !seenSkus.has(p.sku));
            if (newOnThisPage.length === 0) {
              consecutiveAllDupPages++;
              console.log(`  [jarir/${category}] page ${page}: 0 new (${consecutiveAllDupPages} consec. all-dupe)`);
              // Allow 2 consecutive all-dupe pages before stopping — protects
              // against a transient fetch failure causing a false positive.
              if (consecutiveAllDupPages >= 2) {
                console.log(`  [jarir/${category}] stopping pagination (2+ consec. pages of all duplicates)`);
                break;
              }
              await this.delay();
              continue;
            }
            consecutiveAllDupPages = 0;

            for (const p of newOnThisPage) if (p.sku) seenSkus.add(p.sku);
            products.push(...newOnThisPage);
            consecutiveFailures = 0;

            console.log(
              `  [jarir/${category}] page ${page}: +${newOnThisPage.length} new (total: ${products.length})`
            );

            await this.delay();
          } catch (error) {
            consecutiveFailures++;
            console.error(`Error scraping Jarir page ${page} of ${baseUrl}:`, error);
            if (consecutiveFailures >= 3) {
              console.warn(`Jarir ${baseUrl}: ${consecutiveFailures} consecutive failures, stopping pagination`);
              break;
            }
          }
        }
      }
    } finally {
      // cleanup Puppeteer if any page triggered JS mode; no-op otherwise.
      await this.cleanup().catch(() => {});
    }

    return products;
  }

  /**
   * Supplemental discovery — walk non-category pages (brand aggregates, new
   * arrivals, etc.) to catch products that are paginated past a category's
   * cap or only surfaced via brand filter. Each scraped product is tagged
   * with a title-derived category (via `determineCategory`); the product
   * service then re-refines it with the stricter `classifyFromTitle` gate.
   *
   * Runs ONCE per full discovery job (not per-category). SKU-based dedup
   * means products already found in category scrapes just get relinked —
   * no duplicate DB rows.
   */
  async discoverSupplementalProducts(maxPages: number = 100): Promise<ScrapedProduct[]> {
    const supplementalUrls = ((this.config as unknown) as { supplemental_urls?: string[] }).supplemental_urls;
    if (!supplementalUrls || supplementalUrls.length === 0) return [];

    const all: ScrapedProduct[] = [];
    const seenSkus = new Set<string>();

    try {
      for (const baseUrl of supplementalUrls) {
        const label = baseUrl.split('/').pop() || baseUrl;
        let effectiveMaxPages = maxPages;
        let consecutiveFailures = 0;
        let consecutiveAllDupPages = 0;
        let addedFromThisUrl = 0;

        for (let page = 1; page <= effectiveMaxPages; page++) {
          try {
            const url = this.buildCategoryUrl(baseUrl, page);
            const html = await this.fetchPage(url);

            if (page === 1) {
              const $ = this.getCheerio(html);
              const totalAttr = $('[data-cnstrc-num-results]').first().attr('data-cnstrc-num-results');
              const total = totalAttr ? Number(totalAttr) : 0;
              if (Number.isFinite(total) && total > 0) {
                const needed = Math.ceil(total / 12);
                effectiveMaxPages = Math.min(maxPages, needed);
                console.log(`  [jarir/supplemental:${label}] total=${total}, scraping ${effectiveMaxPages} pages`);
              }
            }

            const pageProducts = this.parseListingPageAuto(html);
            if (pageProducts.length === 0) break;

            const newOnThisPage = pageProducts.filter((p) => p.sku && !seenSkus.has(p.sku));
            if (newOnThisPage.length === 0) {
              consecutiveAllDupPages++;
              if (consecutiveAllDupPages >= 2) break;
              await this.delay();
              continue;
            }
            consecutiveAllDupPages = 0;

            for (const p of newOnThisPage) if (p.sku) seenSkus.add(p.sku);
            all.push(...newOnThisPage);
            addedFromThisUrl += newOnThisPage.length;
            consecutiveFailures = 0;

            await this.delay();
          } catch (error) {
            consecutiveFailures++;
            console.error(`  [jarir/supplemental:${label}] error page ${page}:`, error);
            if (consecutiveFailures >= 3) break;
          }
        }

        console.log(`  [jarir/supplemental:${label}] +${addedFromThisUrl} new (running total: ${all.length})`);
      }
    } finally {
      await this.cleanup().catch(() => {});
    }

    return all;
  }

  /**
   * Same extraction as `parseListingPage`, but each product's category is
   * inferred from its title (not a passed-in URL category) because
   * supplemental pages span multiple categories.
   */
  private parseListingPageAuto(html: string): ScrapedProduct[] {
    const $ = this.getCheerio(html);
    const out: ScrapedProduct[] = [];

    $('.product-tile').each((_, el) => {
      const $tile = $(el);
      const name = $tile.attr('data-cnstrc-item-name') || $tile.find('.product-title__title').text().trim();
      const id = $tile.attr('data-cnstrc-item-id') || $tile.find('[data-product-id]').attr('data-product-id') || null;
      const priceAttr = $tile.attr('data-cnstrc-item-price');
      const link = $tile.find('a.product-tile__link').attr('href') || '';
      if (!name || !priceAttr || !link) return;

      const currentPrice = Number(priceAttr);
      if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;

      const productUrl = normalizeUrl(link, this.config.base_url);
      const imgEl = $tile.find('.product-tile__image img').last();
      const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
      const imageUrls = imgSrc && !imgSrc.includes('placeholder') ? [normalizeUrl(imgSrc, this.config.base_url)] : [];
      const { brand, model } = this.extractBrandAndModel(name);

      out.push({
        name_ar: name,
        name_en: name,
        brand,
        model,
        sku: id,
        current_price: currentPrice,
        original_price: null,
        availability: 'in_stock',
        product_url: productUrl,
        image_urls: imageUrls,
        specifications: {},
        // Auto-classify from title; product-service will refine further with
        // the stricter `classifyFromTitle` gate before the DB write.
        category: determineCategory(name),
        description_ar: null,
        description_en: null,
      });
    });

    return out;
  }

  /**
   * Parse every `.product-tile__item` on a listing page into a ScrapedProduct
   * directly — no per-product page visit. All data is in `data-cnstrc-*`
   * attributes and visible CSS classes.
   */
  private parseListingPage(html: string, category: ProductCategory): ScrapedProduct[] {
    const $ = this.getCheerio(html);
    const out: ScrapedProduct[] = [];

    $('.product-tile').each((_, el) => {
      const $tile = $(el);
      const name = $tile.attr('data-cnstrc-item-name') || $tile.find('.product-title__title').text().trim();
      const id = $tile.attr('data-cnstrc-item-id') || $tile.find('[data-product-id]').attr('data-product-id') || null;
      const priceAttr = $tile.attr('data-cnstrc-item-price');
      const link = $tile.find('a.product-tile__link').attr('href') || '';

      if (!name || !priceAttr || !link) return;

      const currentPrice = Number(priceAttr);
      if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;

      const productUrl = normalizeUrl(link, this.config.base_url);
      const imgEl = $tile.find('.product-tile__image img').last();
      const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
      const imageUrls = imgSrc && !imgSrc.includes('placeholder') ? [normalizeUrl(imgSrc, this.config.base_url)] : [];

      const { brand, model } = this.extractBrandAndModel(name);

      out.push({
        name_ar: name,
        name_en: name,
        brand,
        model,
        sku: id,
        current_price: currentPrice,
        original_price: null,
        availability: 'in_stock',
        product_url: productUrl,
        image_urls: imageUrls,
        specifications: {},
        category,
        description_ar: null,
        description_en: null,
      });
    });

    return out;
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
    // Jarir's real pagination param is `page`, not `p`.
    return `${baseUrl}${separator}page=${page}`;
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


