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

    await this.rateLimiter.wait();

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.user_agents[0] || 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
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





