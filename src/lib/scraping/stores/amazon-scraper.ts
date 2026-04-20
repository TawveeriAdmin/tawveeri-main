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

  /**
   * Discover products from category search pages.
   *
   * Mirrors the Jarir pattern: SKU-based dedup, dynamic pagination cap via
   * DOM parsing, consecutive-failure + consecutive-all-dupe break signals.
   *
   * Amazon has no equivalent of Jarir's `data-cnstrc-num-results` attribute,
   * so the cap comes from parsing the pagination bar's last page number.
   * If parsing fails (Amazon A/B-tests listing markup) the caller's
   * `maxPages` acts as a safety ceiling.
   *
   * Listings render in static HTML when a real browser UA is sent, so plain
   * cheerio fetch is sufficient for the majority of pages. The one edge case
   * is page 1 occasionally returning a captcha/bot-check shell; if that
   * produces zero tiles we retry page 1 once through Puppeteer. We do NOT
   * apply the Puppeteer fallback beyond page 1 — cost would be too high.
   */
  async discoverProducts(
    category: ProductCategory,
    maxPages: number = 10
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    const categoryUrls = this.config.category_urls[category] || [];
    if (categoryUrls.length === 0) return products;

    // ASIN dedup spans ALL URLs within a category. Broad searches like
    // `headphones` and `wireless earbuds` overlap significantly — without a
    // shared set we'd re-scrape (and re-upsert) the same products multiple
    // times per category. Moving this outside the URL loop cuts redundant
    // DB round-trips by ~30–50% for multi-URL categories.
    const seenAsins = new Set<string>();

    try {
      for (const baseUrl of categoryUrls) {
        let consecutiveFailures = 0;
        let consecutiveAllDupPages = 0;
        let effectiveMaxPages = maxPages;

        for (let page = 1; page <= effectiveMaxPages; page++) {
          try {
            const url = page === 1 ? baseUrl : `${baseUrl}&page=${page}&ref=sr_pg_${page}`;
            let html = await this.fetchPage(url);
            let pageProducts = this.parseListingResults(html, category);

            // Page-1 only Puppeteer fallback. Amazon occasionally serves a
            // bot-check shell to cheerio — a JS render usually recovers.
            if (page === 1 && pageProducts.length === 0) {
              console.log(`  [amazon/${category}] page 1 empty via fetch — retrying with Puppeteer…`);
              try {
                const jsPage = await this.fetchPageWithJS(url);
                html = await jsPage.content();
                pageProducts = this.parseListingResults(html, category);
              } catch (err) {
                console.warn(`  [amazon/${category}] Puppeteer fallback failed:`, err);
              }
            }

            // Read dynamic pagination cap from the page-1 DOM. Amazon shows
            // numbered `.s-pagination-item` elements; the largest numeric
            // text is the last page. Falls back to caller's maxPages on
            // parse failure.
            if (page === 1) {
              const $ = this.getCheerio(html);
              let lastPage = 0;
              $('.s-pagination-item').each((_, el) => {
                const text = $(el).text().trim();
                const n = Number(text);
                if (Number.isFinite(n) && n > lastPage) lastPage = n;
              });
              if (lastPage > 0) {
                effectiveMaxPages = Math.min(maxPages, lastPage);
                console.log(
                  `  [amazon/${category}] pagination last-page=${lastPage}, scraping ${effectiveMaxPages}/${maxPages} pages`,
                );
              }
            }

            if (pageProducts.length === 0) break; // natural stop

            const newOnThisPage = pageProducts.filter((p) => p.sku && !seenAsins.has(p.sku));
            if (newOnThisPage.length === 0) {
              consecutiveAllDupPages++;
              console.log(
                `  [amazon/${category}] page ${page}: 0 new (${consecutiveAllDupPages} consec. all-dupe)`,
              );
              if (consecutiveAllDupPages >= 2) break;
              await this.delay();
              continue;
            }
            consecutiveAllDupPages = 0;

            for (const p of newOnThisPage) if (p.sku) seenAsins.add(p.sku);
            products.push(...newOnThisPage);
            consecutiveFailures = 0;

            console.log(
              `  [amazon/${category}] page ${page}: +${newOnThisPage.length} new (total: ${products.length})`,
            );

            await this.delay();
          } catch (error) {
            consecutiveFailures++;
            console.error(`  [amazon/${category}] error page ${page} of ${baseUrl}:`, error);
            if (consecutiveFailures >= 3) {
              console.warn(`  [amazon/${category}] ${consecutiveFailures} consecutive failures, stopping pagination`);
              break;
            }
          }
        }
      }
    } finally {
      await this.cleanup().catch(() => {});
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

  /**
   * Parse every `data-component-type='s-search-result'` tile on a listing
   * page into a ScrapedProduct. Sponsored tiles are filtered in
   * `parseSearchResult` — the tile still appears in the DOM but the parser
   * returns null so they never reach the DB.
   */
  private parseListingResults(html: string, category: ProductCategory): ScrapedProduct[] {
    const $ = this.getCheerio(html);
    const out: ScrapedProduct[] = [];
    $("div[data-component-type='s-search-result']").each((_, el) => {
      const product = this.parseSearchResult($, $(el), category);
      if (product) out.push(product);
    });
    return out;
  }

  private parseSearchResult(
    $: ReturnType<typeof this.getCheerio>,
    el: ReturnType<ReturnType<typeof this.getCheerio>>,
    category: ProductCategory,
  ): ScrapedProduct | null {
    const asin = el.attr('data-asin');
    if (!asin) return null;

    // Skip sponsored placements — they double-count real products that also
    // appear in organic results, and clutter the SKU dedup set. We keep the
    // tile only when no Sponsored badge is present.
    if (el.find('span[aria-label*="Sponsored"], .puis-sponsored-label-text').length > 0) {
      return null;
    }

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
