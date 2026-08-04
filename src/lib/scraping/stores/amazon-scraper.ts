import type { ScrapedProduct } from '../base/types';
import type { ProductCategory } from '@/lib/database/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { normalizeUrl } from '../utils/url-utils';
import { determineCategory } from '../utils/category-utils';
import { isTechProduct } from '../product-filter';

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
    if (!isTechProduct(title, brand, category)) {
      return null;
    }

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
    // Amazon PDP renders in static HTML (server-side) — every selector we
    // use (#productTitle, #acrPopover, #feature-bullets, #detailBullets_*)
    // is in the initial response, so a plain fetch is sufficient AND avoids
    // the Puppeteer ECONNRESET failures we hit during the long discovery
    // run. Using fetchPage also inherits the 429/503 cooldown, UA rotation,
    // and shared rate limiter we added in base-scraper — Puppeteer fallback
    // is left in place only for discovery's page-1-captcha recovery path.
    const html = await this.fetchPage(productUrl);
    const $ = this.getCheerio(html);

    const title = this.extractText($, '#productTitle') || '';
    if (!title) return null;

    // Price selectors — BUYBOX-SCOPED ONLY (ADR-204). The old list ended with a
    // page-GLOBAL `.a-price .a-offscreen`, and measured on a live PDP variant with no
    // buybox at all, the first global match sits inside `sims-simsContainer` — the
    // "similar items" carousel — i.e. a DIFFERENT product's price. That is how a
    // 1,609-SAR split AC was recorded at 59.99 and took down the projection chain
    // (ADR-200). A page without a buybox has no price for THIS product: return null
    // (unknown beats incorrect) and let the reobserve classifier handle the page.
    let price: number | null = null;
    const priceSelectors = [
      '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#apex_desktop .a-price .a-offscreen',
      '#centerCol .a-price .a-offscreen',
      '#tp_price_block_total_price_ww .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
    ];
    for (const sel of priceSelectors) {
      const priceText = this.extractText($, sel);
      if (priceText) {
        price = this.parsePrice(priceText);
        if (price) break;
      }
    }
    if (!price) return null;

    // Original price — same scoping rule: a strike-through price from a carousel is a
    // different product's "was". Buybox column only.
    let originalPrice: number | null = null;
    const origText = this.extractText($, '#centerCol .a-price.a-text-price .a-offscreen') ||
                     this.extractText($, '#corePriceDisplay_desktop_feature_div .a-price.a-text-price .a-offscreen') ||
                     this.extractText($, '#listPrice') ||
                     this.extractText($, '#centerCol .basisPrice .a-offscreen');
    if (origText) originalPrice = this.parsePrice(origText);

    // ASIN
    const asin = this.extractAttr($, 'input[name="ASIN"]', 'value') ||
                 productUrl.match(/\/dp\/([A-Z0-9]+)/i)?.[1] || null;

    // Availability
    const availText = this.extractText($, '#availability span') || 'in_stock';

    const { brand, model } = this.extractBrandAndModel(title);

    // Detail-page extras (rating, review count, full gallery, description,
    // extended specs). Separated from the core price/availability extraction
    // above so the existing price-update callers still work even if an extras
    // field blows up — parseDetailPageExtras catches internally.
    const extras = this.parseDetailPageExtras($);

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
      image_urls: extras.image_urls,
      specifications: extras.specifications,
      category: determineCategory(title),
      description_ar: extras.description_ar,
      description_en: extras.description_en,
      merchant_rating: extras.merchant_rating,
      merchant_review_count: extras.merchant_review_count,
    };
  }

  /**
   * Walk the known Amazon detail-page widgets and extract everything a search
   * card leaves blank: merchant star rating, review count, full gallery,
   * description, and an extended spec sheet. Every lookup is defensive — any
   * single selector failing just leaves the corresponding field null/empty.
   */
  private parseDetailPageExtras($: ReturnType<typeof this.getCheerio>): {
    merchant_rating: number | null;
    merchant_review_count: number;
    image_urls: string[];
    description_ar: string | null;
    description_en: string | null;
    specifications: Record<string, unknown>;
  } {
    // --- Rating -------------------------------------------------------------
    // Primary source: the `#acrPopover` element's `title` attr, which Amazon
    // renders as e.g. "4.3 out of 5 stars". Fallback: the first
    // `span.a-icon-alt` text (used on some variants of the PDP template).
    let merchantRating: number | null = null;
    const ratingCandidates = [
      $('#acrPopover').attr('title'),
      $('span.a-icon-alt').first().text(),
      $('i.a-icon-star span.a-icon-alt').first().text(),
    ];
    for (const candidate of ratingCandidates) {
      if (!candidate) continue;
      const match = candidate.match(/([\d.]+)\s*out of\s*5/i);
      if (match) {
        const n = parseFloat(match[1]);
        if (!Number.isNaN(n) && n >= 0 && n <= 5) {
          merchantRating = Number(n.toFixed(2));
          break;
        }
      }
    }

    // --- Review count -------------------------------------------------------
    const reviewText = $('#acrCustomerReviewText').first().text().trim();
    const reviewCount = reviewText
      ? parseInt(reviewText.replace(/[^0-9]/g, ''), 10) || 0
      : 0;

    // --- Gallery ------------------------------------------------------------
    // Strategy: collect thumbnail URLs from #altImages, then extract the
    // higher-res variants from #imageBlock's `data-a-dynamic-image` JSON (a
    // `{url: [w, h]}` map Amazon uses for responsive <img>). Upscale all
    // URLs by stripping `_SY75_` / `_AC_US40_` style size hints. Cap at 10
    // and dedupe. Main `#landingImage` goes first so existing UI that assumes
    // image_urls[0] is the primary stays correct.
    const galleryUrls = new Set<string>();
    const upscale = (url: string): string =>
      url.replace(/\._[A-Z0-9,_]+_\./g, '.').replace(/\?.*$/, '');
    const isValid = (url: string | undefined | null): url is string => {
      if (!url || typeof url !== 'string') return false;
      if (!/^https?:\/\//i.test(url)) return false;
      if (/sprite|play-button|transparent-pixel|grey-pixel/i.test(url)) return false;
      return true;
    };

    const landing = $('#landingImage').attr('src') || $('#imgTagWrapperId img').attr('src');
    if (isValid(landing)) galleryUrls.add(upscale(landing));

    $('#altImages img, #imageBlockThumbs img').each((_, el) => {
      const src = $(el).attr('src');
      if (isValid(src)) galleryUrls.add(upscale(src));
    });

    // data-a-dynamic-image is a JSON-encoded map of URLs → [w,h]. The keys
    // are the per-resolution image URLs; we take all of them and upscale.
    $('#imageBlock img[data-a-dynamic-image], #landingImage[data-a-dynamic-image]').each((_, el) => {
      const raw = $(el).attr('data-a-dynamic-image');
      if (!raw) return;
      try {
        const map = JSON.parse(raw) as Record<string, unknown>;
        for (const key of Object.keys(map)) {
          if (isValid(key)) galleryUrls.add(upscale(key));
        }
      } catch {
        // Amazon occasionally ships malformed JSON — skip silently.
      }
    });

    const imageUrls = Array.from(galleryUrls).slice(0, 10);

    // --- Description -------------------------------------------------------
    // Compose from the most reliable PDP sections, in order of preference:
    //   1. Feature bullets — short, always present on most PDPs.
    //   2. #productDescription — longer prose.
    //   3. A+ content block (#aplus_feature_div) as a last resort.
    // We join with newlines so downstream markdown-ish rendering stays sane.
    const descParts: string[] = [];
    const bullets = $('#feature-bullets ul li span.a-list-item')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    if (bullets.length > 0) descParts.push(bullets.join('\n'));

    const productDescription = $('#productDescription').text().trim();
    if (productDescription) descParts.push(productDescription);

    if (descParts.length === 0) {
      const aplus = $('#aplus_feature_div').text().trim();
      if (aplus) descParts.push(aplus);
    }

    const description = descParts.length > 0 ? descParts.join('\n\n').slice(0, 8000) : null;

    // --- Specs -------------------------------------------------------------
    // extractSpecs already covers the classic tech-spec table + detailBullets.
    // We also walk productDetails_detailBullets_sections1, the product
    // overview feature div, and the detailBulletsWrapper list to pick up the
    // extra rows Amazon renders on newer PDP templates. Keys already present
    // take precedence (first-match wins) so we don't overwrite the primary
    // spec table with noisier bullet text.
    const specs = this.extractSpecs($);

    $('#productDetails_detailBullets_sections1 tr').each((_, el) => {
      const label = $(el).find('th').first().text().trim().replace(/[\s:]+$/, '');
      const value = $(el).find('td').first().text().trim();
      if (label && value && specs[label] === undefined) specs[label] = value;
    });

    $('#productOverview_feature_div tr').each((_, el) => {
      const cells = $(el).find('td');
      if (cells.length < 2) return;
      const label = $(cells.get(0)).text().trim().replace(/[\s:]+$/, '');
      const value = $(cells.get(1)).text().trim();
      if (label && value && specs[label] === undefined) specs[label] = value;
    });

    $('#detailBulletsWrapper_feature_div li span.a-list-item').each((_, el) => {
      const text = $(el).text().trim();
      if (!text || !text.includes(':')) return;
      const [labelRaw, ...rest] = text.split(':');
      const label = labelRaw.trim().replace(/[\s:]+$/, '');
      const value = rest.join(':').trim();
      if (label && value && specs[label] === undefined) specs[label] = value;
    });

    return {
      merchant_rating: merchantRating,
      merchant_review_count: reviewCount,
      image_urls: imageUrls,
      description_ar: description,
      description_en: description,
      specifications: specs,
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
