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
      return products;
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
    // Plain HTTP fetch — Extra is SAP Hybris (not Next.js) and ships a
    // schema.org Product JSON-LD block in the initial HTML, so Puppeteer is
    // unnecessary. Using fetchPage also inherits the base-scraper 429/503
    // cooldown, UA rotation, and shared rate limiter (same pattern as Amazon).
    const html = await this.fetchPage(productUrl);
    const $ = this.getCheerio(html);

    // Hybris ships two JSON-LD blocks on a PDP: a BreadcrumbList and a
    // Product. We want the Product; iterate and first-match-wins.
    const productLd = this.findProductJsonLd($);

    // Title. Prefer JSON-LD name, fall back to the <h1> selectors seen on
    // Extra PDP templates.
    const title =
      (typeof productLd?.name === 'string' ? productLd.name : '').trim()
      || this.extractText($, 'h1.product-name, h1[data-testid="product-name"], h1')
      || '';
    if (!title || title.length < 3) return null;

    // Price: JSON-LD offers.price is canonical. HTML selectors are a backup
    // for pages where JSON-LD is absent or malformed.
    const offers = (productLd?.offers as Record<string, unknown> | undefined) || {};
    let currentPrice = this.toNumber(offers.price);
    if (!currentPrice) {
      const priceText = this.extractText($, '.product-price .current, .price-current, .special-price, [itemprop=\'price\']') || '';
      currentPrice = this.parsePrice(priceText);
    }
    if (!currentPrice || currentPrice <= 0) return null;

    // Original / strike-through price (optional).
    let originalPrice: number | null = this.toNumber(
      (offers as { highPrice?: unknown; listPrice?: unknown; originalPrice?: unknown }).highPrice
      ?? (offers as { listPrice?: unknown }).listPrice
      ?? (offers as { originalPrice?: unknown }).originalPrice,
    );
    if (originalPrice === null) {
      const origText = this.extractText($, '.product-price .was, .price-was, .old-price') || '';
      originalPrice = origText ? this.parsePrice(origText) : null;
    }

    // Brand / SKU / availability.
    const brandObj = productLd?.brand as Record<string, unknown> | string | undefined;
    const brand =
      (typeof brandObj === 'string' ? brandObj : (typeof brandObj?.name === 'string' ? brandObj.name : '')).trim()
      || this.extractText($, '.product-brand, .brand-name')
      || 'Unknown';

    const sku =
      (typeof productLd?.sku === 'string' ? productLd.sku : '')
      || (typeof productLd?.mpn === 'string' ? productLd.mpn : '')
      || null;

    const availability = this.parseLdAvailability(offers.availability);

    // Extras (gallery / specs / description / rating / review count). Pass
    // productLd as the JSON source; our helpers already try multiple key
    // names so schema.org shapes slot in naturally (image, description,
    // aggregateRating.ratingValue, aggregateRating.reviewCount).
    const extras = this.parseDetailPageExtras(this.flattenProductLd(productLd, offers), $, productUrl);

    return {
      name_ar: title,
      name_en: title,
      brand,
      model: this.extractModelFromTitle(title, brand),
      sku,
      current_price: currentPrice,
      original_price: originalPrice !== null && originalPrice > currentPrice ? originalPrice : null,
      availability,
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
   * Walk every `<script type="application/ld+json">` block and return the
   * first one whose `@type` resolves to "Product". Tolerates single-object
   * payloads, `@graph` arrays, and malformed JSON (Hybris occasionally emits
   * trailing commas — the inner try/catch just skips bad blocks).
   */
  private findProductJsonLd(
    $: ReturnType<typeof this.getCheerio>,
  ): Record<string, unknown> | null {
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      const raw = $(scripts[i]).html();
      if (!raw || !raw.includes('"Product"')) continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        const hit = this.pickProductNode(parsed);
        if (hit) return hit;
      } catch {
        /* skip malformed block, try next */
      }
    }
    return null;
  }

  /** Recursively search a JSON-LD payload for a node with @type === 'Product'. */
  private pickProductNode(node: unknown): Record<string, unknown> | null {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = this.pickProductNode(item);
        if (hit) return hit;
      }
      return null;
    }
    const obj = node as Record<string, unknown>;
    const type = obj['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
      return obj;
    }
    const graph = obj['@graph'];
    if (Array.isArray(graph)) {
      for (const item of graph) {
        const hit = this.pickProductNode(item);
        if (hit) return hit;
      }
    }
    return null;
  }

  /**
   * Shape the JSON-LD Product node into the map-of-fields our
   * parseDetailPageExtras helpers already know how to read. Flattens
   * `offers.aggregateRating` up to `{rating, reviewCount}` and copies the
   * JSON-LD image key through as-is (a string — the helper already tolerates
   * string inputs for image keys).
   */
  private flattenProductLd(
    productLd: Record<string, unknown> | null,
    offers: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!productLd) return {};
    const agg = (offers.aggregateRating
      ?? productLd.aggregateRating) as Record<string, unknown> | undefined;
    return {
      ...productLd,
      rating: agg?.ratingValue ?? productLd.rating,
      reviewCount: agg?.reviewCount ?? productLd.reviewCount,
    };
  }

  /** Map a schema.org availability URL/string to ScrapedProduct.availability. */
  private parseLdAvailability(val: unknown): ScrapedProduct['availability'] {
    if (typeof val !== 'string') return 'in_stock';
    const v = val.toLowerCase();
    if (v.includes('outofstock')) return 'out_of_stock';
    if (v.includes('limitedavailability') || v.includes('limited')) return 'limited_stock';
    if (v.includes('preorder')) return 'pre_order';
    return 'in_stock';
  }

  /**
   * Merges detail-page extras onto a ScrapedProduct produced by
   * parseJsonProduct. Only replaces fields when the extra version is richer
   * (e.g. a full gallery beats the single-image search-card URL).
   */
  private applyDetailExtras(
    target: ScrapedProduct,
    extras: ReturnType<ExtraScraper['parseDetailPageExtras']>,
  ): void {
    if (extras.image_urls.length > target.image_urls.length) {
      target.image_urls = extras.image_urls;
    }
    if (Object.keys(extras.specifications).length > 0) {
      target.specifications = { ...target.specifications, ...extras.specifications };
    }
    if (!target.description_ar && extras.description_ar) {
      target.description_ar = extras.description_ar;
    }
    if (!target.description_en && extras.description_en) {
      target.description_en = extras.description_en;
    }
    if (extras.merchant_rating !== null) {
      target.merchant_rating = extras.merchant_rating;
    }
    if (extras.merchant_review_count !== null) {
      target.merchant_review_count = extras.merchant_review_count;
    }
  }

  /**
   * Walk the Extra detail page — both the __NEXT_DATA__ product JSON (when
   * available) and the rendered DOM — and extract the fields the discovery
   * scraper leaves blank: gallery, specifications, description, merchant
   * rating, merchant review count. Every field is defensive: if a particular
   * key/selector isn't present, the corresponding output is null/empty, never
   * a thrown error.
   *
   * Extra's __NEXT_DATA__ shape is not publicly documented, so the JSON paths
   * below try multiple key names common to PWA/commerce-kit style payloads.
   * When this first runs on live pages and any field comes back empty, sample
   * the raw JSON and add the correct key — the helper structure is already
   * in place.
   */
  private parseDetailPageExtras(
    productJson: Record<string, unknown>,
    $: ReturnType<typeof this.getCheerio>,
    productUrl: string,
  ): {
    merchant_rating: number | null;
    merchant_review_count: number | null;
    image_urls: string[];
    description_ar: string | null;
    description_en: string | null;
    specifications: Record<string, unknown>;
  } {
    return {
      image_urls: this.extractExtraImages(productJson, $),
      specifications: this.extractExtraSpecs(productJson, $),
      ...this.extractExtraRating(productJson, $),
      ...this.extractExtraDescription(productJson, $, productUrl),
    };
  }

  /**
   * Gallery extraction. JSON first (images can be array of strings OR array
   * of objects with url/src keys), then HTML fallback on `.product-gallery`
   * + `[class*='gallery'] img`. Deduped, cap 10.
   */
  private extractExtraImages(
    productJson: Record<string, unknown>,
    $: ReturnType<typeof this.getCheerio>,
  ): string[] {
    const urls = new Set<string>();

    const pushUrl = (raw: unknown): void => {
      if (typeof raw !== 'string') return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      // Skip tracking pixels / placeholders.
      if (/placeholder|transparent-pixel|sprite|data:image/i.test(trimmed)) return;
      // Normalize protocol-relative URLs.
      const full = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
      if (!/^https?:\/\//i.test(full)) return;
      urls.add(full);
    };

    const pushFromArray = (val: unknown): void => {
      if (!Array.isArray(val)) return;
      for (const item of val) {
        if (typeof item === 'string') {
          pushUrl(item);
        } else if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          pushUrl(o.url ?? o.src ?? o.image ?? o.image_url ?? o.imageUrl ?? o.href ?? o.original);
        }
      }
    };

    // JSON strategies — the common image-array keys seen across commerce PWAs.
    pushUrl(productJson.image);
    pushUrl(productJson.thumbnail);
    pushUrl((productJson as Record<string, unknown>).image_url);
    pushFromArray(productJson.images);
    pushFromArray((productJson as Record<string, unknown>).imageGallery);
    pushFromArray(productJson.media);
    pushFromArray(productJson.gallery);
    pushFromArray((productJson as Record<string, unknown>).productImages);
    // Some payloads nest gallery under `media.images` or `image.gallery`.
    const media = productJson.media as Record<string, unknown> | undefined;
    if (media && typeof media === 'object') pushFromArray(media.images);
    const imageObj = productJson.image as Record<string, unknown> | undefined;
    if (imageObj && typeof imageObj === 'object') pushFromArray(imageObj.gallery);

    // HTML fallback — selectors seen across extra.com PDP templates.
    const htmlSelectors = [
      '.product-gallery img',
      '.product-images img',
      '.pdp-gallery img',
      '.pdp-image img',
      "[class*='gallery'] img",
      "[class*='ProductGallery'] img",
      "[class*='product-image'] img",
    ];
    for (const sel of htmlSelectors) {
      $(sel).each((_, el) => {
        pushUrl($(el).attr('src'));
        pushUrl($(el).attr('data-src'));
        pushUrl($(el).attr('data-zoom-image'));
      });
    }

    return Array.from(urls).slice(0, 10);
  }

  /**
   * Specs extraction. Extra's PDP JSON exposes specs under a handful of key
   * names; we try all of them and then fall back to any visible spec table.
   * Output is a flat {label: string} map — spec names are preserved as-is so
   * the page language is retained (Arabic specs on ar-sa URLs, English on
   * en-sa). First writer wins (no overwrites).
   */
  private extractExtraSpecs(
    productJson: Record<string, unknown>,
    $: ReturnType<typeof this.getCheerio>,
  ): Record<string, unknown> {
    const specs: Record<string, string> = {};
    const put = (label: unknown, value: unknown): void => {
      if (typeof label !== 'string') return;
      const l = label.trim().replace(/[\s:]+$/, '');
      if (!l) return;
      if (specs[l] !== undefined) return;
      const v = value === null || value === undefined ? '' : String(value).trim();
      if (!v) return;
      specs[l] = v;
    };

    const walkSpecContainer = (val: unknown): void => {
      if (!val) return;
      if (Array.isArray(val)) {
        for (const row of val) {
          if (!row || typeof row !== 'object') continue;
          const r = row as Record<string, unknown>;
          // Flat row shapes — {name,value}, {label,value}, {key,value}, {title,value}.
          if (r.name !== undefined && r.value !== undefined) { put(r.name, r.value); continue; }
          if (r.label !== undefined && r.value !== undefined) { put(r.label, r.value); continue; }
          if (r.key !== undefined && r.value !== undefined) { put(r.key, r.value); continue; }
          if (r.title !== undefined && r.value !== undefined) { put(r.title, r.value); continue; }
          if (r.attribute !== undefined && r.value !== undefined) { put(r.attribute, r.value); continue; }
          // Grouped row — {groupName, items/attributes: [...]}.
          const items = r.items ?? r.attributes ?? r.specs ?? r.children;
          if (Array.isArray(items)) walkSpecContainer(items);
        }
        return;
      }
      if (typeof val === 'object') {
        // Flat object map of key → value.
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) put(k, v);
      }
    };

    // JSON keys commonly holding specs/attributes on Extra + generic PWAs.
    // additionalProperty is the schema.org standard — arrays of {name, value}
    // PropertyValue nodes — and is what Extra's Hybris ships in the Product
    // JSON-LD block. The other keys are defensive fallbacks for mixed
    // payloads.
    walkSpecContainer((productJson as Record<string, unknown>).additionalProperty);
    walkSpecContainer(productJson.specifications);
    walkSpecContainer(productJson.techSpecs);
    walkSpecContainer((productJson as Record<string, unknown>).productSpecifications);
    walkSpecContainer(productJson.attributes);
    walkSpecContainer((productJson as Record<string, unknown>).productAttributes);
    walkSpecContainer(productJson.features);
    walkSpecContainer((productJson as Record<string, unknown>).keyFeatures);
    walkSpecContainer((productJson as Record<string, unknown>).highlights);

    // HTML fallback — spec tables and definition lists.
    $('table.product-specs tr, table.specifications tr, .specifications-table tr, .specs-table tr, [class*=\'Spec\'] tr').each((_, el) => {
      const label = $(el).find('th, td').first().text().trim();
      const value = $(el).find('td').last().text().trim();
      if (label && value && label !== value) put(label, value);
    });
    $('dl.product-specs dt, dl.specifications dt').each((_, el) => {
      const label = $(el).text().trim();
      const value = $(el).next('dd').text().trim();
      put(label, value);
    });

    return specs;
  }

  /**
   * Rating + review count. JSON paths first (including nested `reviews.*`),
   * then HTML fallback using Schema.org itemprop hooks. Both fields default
   * to null when missing.
   */
  private extractExtraRating(
    productJson: Record<string, unknown>,
    $: ReturnType<typeof this.getCheerio>,
  ): { merchant_rating: number | null; merchant_review_count: number | null } {
    const clampRating = (n: number): number | null =>
      Number.isFinite(n) && n >= 0 && n <= 5 ? Number(n.toFixed(2)) : null;

    const reviews = productJson.reviews as Record<string, unknown> | undefined;
    const ratingCandidates = [
      productJson.rating,
      (productJson as Record<string, unknown>).averageRating,
      (productJson as Record<string, unknown>).reviewsRating,
      (productJson as Record<string, unknown>).ratingValue,
      reviews?.average,
      reviews?.rating,
      reviews?.value,
    ];
    let rating: number | null = null;
    for (const cand of ratingCandidates) {
      const n = this.toNumber(cand);
      if (n !== null) {
        rating = clampRating(n);
        if (rating !== null) break;
      }
    }

    const countCandidates = [
      (productJson as Record<string, unknown>).reviewCount,
      (productJson as Record<string, unknown>).totalReviews,
      (productJson as Record<string, unknown>).reviewsCount,
      (productJson as Record<string, unknown>).ratingCount,
      reviews?.count,
      reviews?.total,
    ];
    let count: number | null = null;
    for (const cand of countCandidates) {
      const n = this.toNumber(cand);
      if (n !== null && n >= 0) {
        count = Math.round(n);
        break;
      }
    }

    // HTML fallbacks.
    if (rating === null) {
      const htmlRating = this.extractAttr($, "[itemprop='ratingValue']", 'content')
        || this.extractText($, "[itemprop='ratingValue']")
        || this.extractText($, "[class*='ratingValue'], [class*='rating-value']");
      if (htmlRating) {
        const n = this.toNumber(htmlRating);
        if (n !== null) rating = clampRating(n);
      }
    }
    if (count === null) {
      const htmlCount = this.extractAttr($, "[itemprop='reviewCount']", 'content')
        || this.extractText($, "[itemprop='reviewCount']")
        || this.extractText($, "[class*='review-count'], [class*='reviewCount']");
      if (htmlCount) {
        const n = parseInt(htmlCount.replace(/[^0-9]/g, ''), 10);
        if (Number.isFinite(n) && n >= 0) count = n;
      }
    }

    // Extra ships "0" / "0" aggregateRating on products with no reviews yet —
    // treat that as "no rating" rather than writing a real-looking zero.
    if (rating === 0 && (count === null || count === 0)) {
      return { merchant_rating: null, merchant_review_count: null };
    }
    return { merchant_rating: rating, merchant_review_count: count };
  }

  /**
   * Description. JSON first (may be plain string or HTML), then HTML
   * selectors. The page locale is inferred from the URL: /ar-sa/* → Arabic,
   * else English. We write the description to the matching locale only;
   * updateEnrichedFields' "fill only if empty" merge lets a follow-up pass
   * on the other locale URL enrich the missing side.
   */
  private extractExtraDescription(
    productJson: Record<string, unknown>,
    $: ReturnType<typeof this.getCheerio>,
    productUrl: string,
  ): { description_ar: string | null; description_en: string | null } {
    const stripHtml = (raw: string): string =>
      raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const candidates = [
      productJson.description,
      (productJson as Record<string, unknown>).longDescription,
      (productJson as Record<string, unknown>).productDescription,
      (productJson as Record<string, unknown>).overview,
      (productJson as Record<string, unknown>).shortDescription,
    ];
    let text: string | null = null;
    for (const cand of candidates) {
      if (typeof cand === 'string' && cand.trim()) {
        text = stripHtml(cand).slice(0, 8000);
        if (text) break;
      }
    }

    if (!text) {
      const htmlDesc = this.extractText($, '.product-description, #product-description, [class*=\'Description\'] p, [class*=\'description\'] p');
      if (htmlDesc) text = htmlDesc.slice(0, 8000);
    }

    if (!text) return { description_ar: null, description_en: null };

    // Route by locale hinted in the URL. Default to English when the URL
    // doesn't carry a locale prefix (so we never drop a description entirely).
    const isArabicUrl = /\/ar(-sa)?\//i.test(productUrl);
    return {
      description_ar: isArabicUrl ? text : null,
      description_en: isArabicUrl ? null : text,
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
