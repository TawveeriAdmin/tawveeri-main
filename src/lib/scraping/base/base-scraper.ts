import type { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import type {
  ScrapedProduct,
  ScraperConfig,
  ScrapingResult,
  ScrapingError,
  ScrapingMetadata,
  ValidationResult,
  ProductCategory,
  RetryOptions,
} from './types';
import { RateLimiter } from '../utils/rate-limiter';
import { RetryHandler } from '../utils/retry-handler';
import { parsePrice, validatePrice } from '../utils/price-parser';
import { normalizeUrl, isValidUrl } from '../utils/url-utils';
import { getBrowserHeaders } from '../search/user-agents';

/**
 * Base scraper class that all store-specific scrapers extend
 */
export abstract class BaseScraper {
  protected config: ScraperConfig;
  protected browser: Browser | null = null;
  protected page: Page | null = null;
  protected rateLimiter: RateLimiter;
  protected retryHandler: RetryHandler;

  constructor(config: ScraperConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rate_limit);
    this.retryHandler = new RetryHandler();
  }

  /**
   * Initialize browser and page
   */
  async initialize(): Promise<void> {
    if (this.browser) return; // Already initialized

    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.page = await this.browser.newPage();
    
    // Set user agent
    if (this.config.user_agents.length > 0) {
      const userAgent = this.config.user_agents[0];
      await this.page.setUserAgent(userAgent);
    }

    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Fetch page HTML (for static pages)
   */
  async fetchPage(url: string): Promise<string> {
    if (!isValidUrl(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Retry transient failures (timeout, 5xx, socket reset). 6 attempts with
    // exponential backoff absorbs both single-page blips and an entire
    // rate-limit wave: when Amazon starts returning 429/503 we want the
    // scraper to cool off for minutes, not seconds, and keep going.
    const timeoutMs = this.config.timeout_ms ?? 20000;
    const maxAttempts = 6;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt === 1) {
        await this.rateLimiter.wait();
      } else {
        const backoffMs = 2000 * (attempt - 1);
        console.log(`    [${this.config.store_slug}] retry ${attempt}/${maxAttempts} after ${backoffMs}ms backoff: ${shortUrl(url)}`);
        await new Promise((r) => setTimeout(r, backoffMs));
      }

      const fetchStart = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        // Rotate UA + full real-browser header set per attempt. A stale UA
        // pinned for an entire session was one of the signals Amazon flagged
        // during the 200-minute full-coverage run; rotating per attempt is
        // cheap and harmless for stores that don't care.
        //
        // Pass a same-origin referer so Cloudflare-protected stores (e.g.
        // shakersa.com) don't drop the connection. A bare request with no
        // Referer silently times out on their WAF even though the homepage
        // is reachable. Using the URL's own origin mimics an on-site
        // navigation and is strictly more permissive than no referer —
        // stores that don't care continue to ignore it.
        let refererOrigin: string | undefined;
        try { refererOrigin = new URL(url).origin; } catch { /* invalid URL handled above */ }
        const response = await fetch(url, {
          headers: getBrowserHeaders(refererOrigin),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();
        const fetchMs = Date.now() - fetchStart;
        if (fetchMs > 5000) {
          console.log(`    [${this.config.store_slug}] slow fetch: ${fetchMs}ms ${shortUrl(url)}`);
        }
        return text;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        // 4xx is permanent EXCEPT 429 (rate limit) — previously we bailed on
        // 429 after zero retries, which is exactly wrong for an anti-throttle
        // pass. Treat 429 as transient-but-hostile and apply the long
        // cool-off below.
        const isPermanent = /HTTP 4\d\d/.test(msg) && !/HTTP 429/.test(msg);
        if (isPermanent || attempt === maxAttempts) {
          throw err;
        }
        // Rate-limit / service-unavailable: back off HARD and propagate the
        // cool-off to the shared rate limiter so every other in-flight
        // request in this scraper instance also waits it out.
        if (/HTTP (429|503)/.test(msg)) {
          const cool = Math.min(30000 * Math.pow(2, attempt - 1), 480000) + Math.floor(Math.random() * 5000);
          console.log(`    [${this.config.store_slug}] cooldown ${Math.round(cool / 1000)}s after ${msg.match(/HTTP (429|503)/)?.[0]}: ${shortUrl(url)}`);
          this.rateLimiter.setCooldownUntil(Date.now() + cool);
          await new Promise((r) => setTimeout(r, cool));
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * Fetch JSON from URL (for API-based scrapers like Noon)
   */
  async fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
    if (!isValidUrl(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    await this.rateLimiter.wait();

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.user_agents[0] || 'Mozilla/5.0',
        'Accept': 'application/json',
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetch page with JavaScript rendering
   */
  async fetchPageWithJS(url: string): Promise<Page> {
    if (!isValidUrl(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    if (!this.page) {
      await this.initialize();
      if (!this.page) throw new Error('Failed to initialize page');
    }

    await this.rateLimiter.wait();

    const timeout = this.config.timeout_ms || 30000;
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout });

    return this.page;
  }

  /**
   * Random delay between requests
   */
  protected async delay(min?: number, max?: number): Promise<void> {
    const minMs = min || this.config.rate_limit.min_delay_ms;
    const maxMs = max || this.config.rate_limit.max_delay_ms;
    const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Parse price from text
   */
  protected parsePrice(priceText: string): number | null {
    return parsePrice(priceText);
  }

  /**
   * Normalize brand name (remove common variations)
   */
  protected normalizeBrand(brand: string): string {
    return brand
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Normalize model name
   */
  protected normalizeModel(model: string): string {
    return model.trim().replace(/\s+/g, ' ');
  }

  /**
   * Generate URL-safe slug from name
   */
  protected generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Validate scraped product data
   */
  protected validateScrapedProduct(product: ScrapedProduct): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!product.name_en || product.name_en.trim().length < 3) {
      errors.push('English name is required and must be at least 3 characters');
    }

    if (!product.brand || product.brand.trim().length === 0) {
      errors.push('Brand is required');
    }

    if (!product.model || product.model.trim().length === 0) {
      errors.push('Model is required');
    }

    if (!validatePrice(product.current_price)) {
      errors.push(`Invalid price: ${product.current_price}`);
    }

    if (product.original_price !== null && !validatePrice(product.original_price)) {
      errors.push(`Invalid original price: ${product.original_price}`);
    }

    if (product.original_price !== null && product.original_price < product.current_price) {
      warnings.push('Original price is less than current price');
    }

    if (!isValidUrl(product.product_url)) {
      errors.push(`Invalid product URL: ${product.product_url}`);
    }

    if (product.image_urls.length === 0) {
      warnings.push('No product images found');
    }

    // Calculate quality score (0-100)
    let score = 100;
    score -= errors.length * 20;
    score -= warnings.length * 5;
    score = Math.max(0, score);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  /**
   * Log scraping error
   */
  protected logError(error: ScrapingError): void {
    console.error(`[${this.config.store_slug}] ${error.type}: ${error.message}`, {
      url: error.url,
      timestamp: error.timestamp,
    });
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    return this.retryHandler.retry(fn, { maxRetries });
  }

  /**
   * Abstract method: Discover products from category pages
   * Must be implemented by store-specific scrapers
   */
  abstract discoverProducts(
    category: ProductCategory,
    maxPages?: number
  ): Promise<ScrapedProduct[]>;

  /**
   * Config-driven listing extractor. Walks each category URL, paginates, and
   * extracts ScrapedProduct directly from the listing page via
   * `listing_selectors` in the store config — no per-product detail visits.
   *
   * Expected config shape (add `listing_selectors` to any store's JSON):
   *   {
   *     "listing_selectors": {
   *       "tile":  ".product-item",              // repeating product container
   *       "link":  "a.product-link",             // <a> inside tile (href extracted)
   *       "name":  ".product-title",             // product name text
   *       "price": ".price",                     // current price text
   *       "original_price": ".old-price",        // optional strike-through price
   *       "image": "img.product-image",          // optional product image
   *       "sku":   "[data-product-id]",          // optional SKU attribute
   *       "attr_name":  "data-product-name",     // optional: read name from an attr on `tile`
   *       "attr_price": "data-product-price"     // optional: read price from an attr on `tile`
   *     },
   *     "pagination": { "param": "p", "start": 1 }  // ?p=1, ?p=2, ... (optional)
   *   }
   *
   * Usage from a subclass:
   *   async discoverProducts(category, maxPages) {
   *     return this.discoverByListingConfig(category, maxPages);
   *   }
   */
  protected async discoverByListingConfig(
    category: ProductCategory,
    maxPages: number = 10
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    const categoryUrls = this.config.category_urls[category] || [];
    if (categoryUrls.length === 0) return products;

    for (const baseUrl of categoryUrls) {
      let consecutiveFailures = 0;
      let consecutiveAllDupPages = 0;
      const seenKeys = new Set<string>();
      for (let page = 1; page <= maxPages; page++) {
        try {
          const url = this.buildListingUrl(baseUrl, page);
          const html = await this.fetchPage(url);
          const pageProducts = this.parseListingFromConfig(html, category);
          if (pageProducts.length === 0) break; // natural stop

          // Track products new to THIS run. Many stores return first-page
          // fallback when you exceed real page count — detect it via
          // consecutive all-duplicate pages, tolerating transient fetch blips.
          const newProducts: ScrapedProduct[] = [];
          for (const p of pageProducts) {
            const key = p.sku || p.product_url;
            if (!key || seenKeys.has(key)) continue;
            seenKeys.add(key);
            newProducts.push(p);
          }
          if (newProducts.length === 0) {
            consecutiveAllDupPages++;
            console.log(`  [${this.config.store_slug}/${category}] page ${page}: 0 new (${consecutiveAllDupPages} consec. all-dupe)`);
            if (consecutiveAllDupPages >= 2) {
              console.log(`  [${this.config.store_slug}/${category}] stopping (2+ consec. pages of all duplicates)`);
              break;
            }
            await this.delay();
            continue;
          }
          consecutiveAllDupPages = 0;
          products.push(...newProducts);
          consecutiveFailures = 0;
          console.log(
            `  [${this.config.store_slug}/${category}] page ${page}: +${newProducts.length} new (total: ${products.length})`
          );
          await this.delay();
        } catch (err) {
          consecutiveFailures++;
          console.error(`[${this.config.store_slug}] listing fetch failed at page ${page} of ${baseUrl}:`, err);
          if (consecutiveFailures >= 3) {
            console.warn(`[${this.config.store_slug}] 3 consecutive failures at ${baseUrl}, stopping pagination`);
            break;
          }
        }
      }
    }
    return products;
  }

  protected buildListingUrl(baseUrl: string, page: number): string {
    if (page === 1) return baseUrl;
    // WordPress/WooCommerce archives ignore arbitrary query-string page
    // params and instead paginate via `/page/N/` on the path. A config
    // setting `discovery_pagination: "wordpress_paged"` is the switch:
    // when set, append `page/N/` to the pathname so Shaker, SWSG, and any
    // future WooCommerce store works out of the box. `new URL()` preserves
    // existing query strings and fragments.
    const style = (this.config as { discovery_pagination?: string }).discovery_pagination;
    if (style === 'wordpress_paged') {
      const u = new URL(baseUrl);
      const path = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
      u.pathname = `${path}page/${page}/`;
      return u.toString();
    }
    const pagination = (this.config as { pagination?: { param?: string } }).pagination;
    const param = pagination?.param ?? 'page';
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${param}=${page}`;
  }

  protected parseListingFromConfig(html: string, category: ProductCategory): ScrapedProduct[] {
    const selectors = (this.config as any).listing_selectors as Record<string, string> | undefined;
    if (!selectors?.tile) return [];

    const $ = this.getCheerio(html);
    const out: ScrapedProduct[] = [];

    $(selectors.tile).each((_, el) => {
      const $tile = $(el);

      // Name — from attribute (if configured) or text selector
      let name = '';
      if (selectors.attr_name) name = $tile.attr(selectors.attr_name) || '';
      if (!name && selectors.name) name = $tile.find(selectors.name).first().text().trim();
      if (!name) return;

      // Price — from attribute (if configured) or text selector
      let priceText = '';
      if (selectors.attr_price) priceText = $tile.attr(selectors.attr_price) || '';
      if (!priceText && selectors.price) priceText = $tile.find(selectors.price).first().text().trim();
      const currentPrice = parsePrice(priceText);
      if (!currentPrice || currentPrice <= 0) return;

      // URL
      const linkSelector = selectors.link || 'a';
      const href = $tile.find(linkSelector).first().attr('href') || $tile.attr('href');
      if (!href) return;
      const productUrl = normalizeUrl(href, this.config.base_url);

      // Optional fields
      const originalPrice = selectors.original_price
        ? parsePrice($tile.find(selectors.original_price).first().text().trim())
        : null;

      const imgEl = selectors.image ? $tile.find(selectors.image).first() : null;
      const imgSrc = imgEl?.attr('src') || imgEl?.attr('data-src') || '';
      const imageUrls = imgSrc && !imgSrc.includes('placeholder')
        ? [normalizeUrl(imgSrc, this.config.base_url)]
        : [];

      const sku = selectors.sku
        ? $tile.find(selectors.sku).attr('data-product-id')
          ?? $tile.attr(selectors.sku.replace(/[[\]]/g, ''))
          ?? null
        : null;

      const { brand, model } = this.extractBrandAndModelFromName(name);

      out.push({
        name_ar: name,
        name_en: name,
        brand,
        model,
        sku,
        current_price: currentPrice,
        original_price: originalPrice,
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
   * Best-effort brand + model extraction from a product name. Stores can
   * override this if they have a better signal (e.g., a `brand` attribute).
   */
  protected extractBrandAndModelFromName(name: string): { brand: string; model: string } {
    const words = name.trim().split(/\s+/);
    const knownBrands = [
      'Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Honor', 'OnePlus', 'Realme', 'Oppo', 'Vivo',
      'Nothing', 'Motorola', 'Nokia', 'Google', 'Sony', 'LG', 'Panasonic', 'Toshiba',
      'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Razer', 'Microsoft',
      'Canon', 'Nikon', 'Fujifilm', 'GoPro', 'DJI',
      'JBL', 'Bose', 'Sennheiser', 'Beats', 'Anker', 'Philips',
      'TCL', 'Hisense', 'Sharp', 'Haier', 'Midea',
    ];
    for (const b of knownBrands) {
      if (name.toLowerCase().includes(b.toLowerCase())) {
        const model = words.filter((w) => w.toLowerCase() !== b.toLowerCase()).join(' ').trim();
        return { brand: b, model: model || name };
      }
    }
    return { brand: words[0] || 'Unknown', model: words.slice(1).join(' ') || name };
  }

  /**
   * Abstract method: Update product price from product page
   * Must be implemented by store-specific scrapers
   */
  abstract updateProductPrice(
    productUrl: string
  ): Promise<ScrapedProduct | null>;

  /**
   * Get Cheerio instance from HTML
   */
  protected getCheerio(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Extract text from selector or return null
   */
  protected extractText($: cheerio.CheerioAPI, selector: string): string | null {
    const element = $(selector).first();
    return element.text().trim() || null;
  }

  /**
   * Extract attribute from selector
   */
  protected extractAttr(
    $: cheerio.CheerioAPI,
    selector: string,
    attr: string
  ): string | null {
    const element = $(selector).first();
    return element.attr(attr)?.trim() || null;
  }

  /**
   * Extract multiple text values from selector
   */
  protected extractTexts($: cheerio.CheerioAPI, selector: string): string[] {
    const elements = $(selector);
    const texts: string[] = [];
    elements.each((_, el) => {
      const text = $(el).text().trim();
      if (text) texts.push(text);
    });
    return texts;
  }

  /**
   * Extract multiple attribute values
   */
  protected extractAttrs(
    $: cheerio.CheerioAPI,
    selector: string,
    attr: string
  ): string[] {
    const elements = $(selector);
    const attrs: string[] = [];
    elements.each((_, el) => {
      const value = $(el).attr(attr)?.trim();
      if (value) attrs.push(value);
    });
    return attrs;
  }
}

/** Shorten a URL for logging: keep path + query, drop origin. */
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url.slice(0, 80);
  }
}






