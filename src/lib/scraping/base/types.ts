import type { ProductCategory } from '@/lib/database/types';

/**
 * Raw product data extracted from scraping
 */
export interface ScrapedProduct {
  name_ar: string;
  name_en: string;
  brand: string;
  model: string;
  sku: string | null;
  current_price: number;
  original_price: number | null;
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order';
  product_url: string;
  image_urls: string[];
  specifications: Record<string, unknown>;
  category: ProductCategory;
  description_ar: string | null;
  description_en: string | null;
  stock_quantity?: number | null;
  delivery_time_days?: number | null;
  delivery_cost?: number;
  is_free_delivery?: boolean;
  is_deal?: boolean;
  deal_expires_at?: string | null;
  coupon_code?: string | null;
  /**
   * Retailer-reported star rating (e.g. Amazon "4.3 out of 5"). Populated by
   * the detail-page enrichment pass, not search-card scrapes. Stored in
   * products.merchant_rating — kept separate from products.average_rating
   * (which aggregates Tawveeri users' own reviews).
   */
  merchant_rating?: number | null;
  /** Retailer-reported review/rating count. See merchant_rating. */
  merchant_review_count?: number | null;
}

/**
 * Configuration for CSS/XPath selectors
 */
export interface SelectorConfig {
  product_list: string;
  product_link: string;
  product_name: string;
  product_name_ar?: string;
  product_price: string;
  product_original_price: string | null;
  product_image: string;
  product_sku: string | null;
  product_specs: string | null;
  product_availability: string;
  product_description?: string | null;
  product_description_ar?: string | null;
  pagination?: string | null;
  next_page?: string | null;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  min_delay_ms: number;
  max_delay_ms: number;
  requests_per_minute: number;
}

/**
 * Complete scraper configuration for a store
 */
/** How to append page index when crawling discovery URLs (page 1 = base URL only). */
export type DiscoveryPaginationStyle =
  | 'wordpress_paged'
  | 'query_page'
  | 'magento_p'
  | 'samsung_page';

export interface ScraperConfig {
  store_slug: string;
  store_name_ar: string;
  store_name_en: string;
  base_url: string;
  category_urls: Record<ProductCategory, string[]>;
  selectors: SelectorConfig;
  rate_limit: RateLimitConfig;
  requires_js: boolean;
  user_agents: string[];
  timeout_ms?: number;
  /** Discovery listing pagination (default: query_page). */
  discovery_pagination?: DiscoveryPaginationStyle;
}

/**
 * Result of a scraping operation
 */
export interface ScrapingResult {
  success: boolean;
  products: ScrapedProduct[];
  errors: ScrapingError[];
  metadata: ScrapingMetadata;
}

/**
 * Scraping error details
 */
export interface ScrapingError {
  type: 'network' | 'parse' | 'validation' | 'rate_limit' | 'selector' | 'unknown';
  message: string;
  url: string | null;
  timestamp: string;
  details?: unknown;
}

/**
 * Metadata about scraping operation
 */
export interface ScrapingMetadata {
  total_products_found: number;
  total_products_scraped: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  pages_scraped: number;
  store_slug: string;
  category?: ProductCategory;
}

/**
 * Result of data validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100 data quality score
}

/**
 * Options for retry operations
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Options for product discovery
 */
export interface DiscoveryOptions {
  store_slug: string;
  /** Single category to scrape. Ignored if `categories` is provided. */
  category?: ProductCategory;
  /** Whitelist of categories to iterate. If omitted/empty, iterates ALL categories. */
  categories?: ProductCategory[];
  max_pages?: number;
  dry_run?: boolean;
  /**
   * If true, skip the supplemental-URL (brand aggregate) pass that normally
   * runs after all categories complete. Set this when the caller is running
   * categories one-at-a-time (e.g. the seed-direct worker pool) — otherwise
   * the supplemental pass fires once per category, multiplying wall-clock
   * by the category count. The caller should make one final call with
   * `only_supplemental: true` after all categories finish.
   */
  skip_supplemental?: boolean;
  /**
   * If true, skip the category scrape entirely and run ONLY the
   * supplemental-URL pass. Used by the seed-direct worker pool to run
   * supplemental exactly once after all per-category calls complete.
   */
  only_supplemental?: boolean;
  /**
   * When true, after discovery finishes, store offers in the covered
   * categories that were not seen in this run have consecutive_misses
   * incremented. Keep false for partial/page-limited discovery jobs.
   */
  mark_missing?: boolean;
  /** Miss count threshold before marking scrape_status='stale'. Default 3. */
  stale_after_misses?: number;
  /** Miss count threshold before marking availability='out_of_stock'. Default 5. */
  out_of_stock_after_misses?: number;
}

/**
 * Options for price updates
 */
export interface PriceUpdateOptions {
  store_slug?: string;
  max_products?: number;
  older_than_hours?: number;
}

/**
 * Result of discovery job
 */
export interface DiscoveryResult {
  success: boolean;
  store: string;
  category: string;
  products_discovered: number;
  products_created: number;
  products_linked: number;
  products_marked_missing?: number;
  products_marked_out_of_stock?: number;
  errors: number;
  duration_ms: number;
}

/**
 * Result of price update job
 */
export interface PriceUpdateResult {
  success: boolean;
  stores_updated: number;
  products_updated: number;
  price_changes: number;
  errors: number;
  duration_ms: number;
}





