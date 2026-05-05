# Web Scraping Implementation Plan
## Comprehensive Plan for 100% Correct Product Tracking System

**Date:** 2025-01-XX  
**Status:** Planning Phase  
**Approach:** Two-Phase Architecture with Unified Base Scraper

---

## PHASE 0: PREPARATION - Delete Mock Products

### Step 0.1: Create Clean Deletion Script
**File:** `scripts/database/06-delete-mock-products.sql`

**Purpose:** Safely delete all seed/mock products and related data

**SQL Operations:**
1. Delete all entries from `price_history` where product_store_id references mock products
2. Delete all entries from `product_stores` where product_id references mock products
3. Delete all entries from `user_wishlists` where product_id references mock products
4. Delete all entries from `price_alerts` where product_id references mock products
5. Delete all entries from `product_reviews` where product_id references mock products
6. Delete all entries from `notifications` where product_id references mock products
7. Delete all entries from `products` table (all mock products)
8. Update `stores.total_products` to 0 for all stores
9. Add verification query to confirm deletion

**Safety Features:**
- Use transactions (BEGIN/COMMIT)
- Add RAISE NOTICE messages for each step
- Include rollback instructions in comments
- Verify no foreign key violations

**Execution:**
- Add npm script: `"db:clean-mock": "psql $SUPABASE_DB_URL -f scripts/database/06-delete-mock-products.sql"`
- Document in scripts/README.md

---

## PHASE 1: FOUNDATION - Base Architecture & Dependencies

### Step 1.1: Install Required Dependencies
**File:** `package.json`

**Add Dependencies:**
```json
{
  "dependencies": {
    "puppeteer": "^21.0.0",
    "cheerio": "^1.0.0",
    "playwright": "^1.40.0"
  },
  "devDependencies": {
    "@types/cheerio": "^0.22.0"
  }
}
```

**Note:** Choose either Puppeteer OR Playwright (not both). Recommendation: Puppeteer for better Next.js compatibility.

### Step 1.2: Create Scraping Directory Structure
**Directories to Create:**
```
src/lib/scraping/
├── base/
│   ├── base-scraper.ts
│   └── types.ts
├── stores/
│   ├── jarir-scraper.ts
│   ├── extra-scraper.ts
│   ├── noon-scraper.ts
│   ├── amazon-scraper.ts
│   └── almanea-scraper.ts
├── matching/
│   ├── product-matcher.ts
│   └── fuzzy-matcher.ts
├── validation/
│   ├── data-validator.ts
│   └── validation-rules.ts
├── utils/
│   ├── rate-limiter.ts
│   ├── retry-handler.ts
│   ├── url-utils.ts
│   └── price-parser.ts
└── config/
    ├── scraper-config.ts
    └── store-configs/
        ├── jarir.json
        ├── extra.json
        ├── noon.json
        ├── amazon.json
        └── almanea.json
```

### Step 1.3: Create Base Types and Interfaces
**File:** `src/lib/scraping/base/types.ts`

**Interfaces to Define:**
1. `ScrapedProduct` - Raw product data from scraping
   - name_ar: string
   - name_en: string
   - brand: string
   - model: string
   - sku: string | null
   - current_price: number
   - original_price: number | null
   - availability: 'in_stock' | 'out_of_stock' | 'limited_stock' | 'pre_order'
   - product_url: string
   - image_urls: string[]
   - specifications: Record<string, unknown>
   - category: ProductCategory
   - description_ar: string | null
   - description_en: string | null

2. `ScraperConfig` - Configuration for store scrapers
   - store_slug: string
   - base_url: string
   - category_urls: Record<ProductCategory, string[]>
   - selectors: SelectorConfig
   - rate_limit: RateLimitConfig
   - requires_js: boolean
   - user_agents: string[]

3. `SelectorConfig` - CSS/XPath selectors
   - product_list: string
   - product_link: string
   - product_name: string
   - product_price: string
   - product_original_price: string | null
   - product_image: string
   - product_sku: string | null
   - product_specs: string | null
   - product_availability: string

4. `RateLimitConfig`
   - min_delay_ms: number (default: 2000)
   - max_delay_ms: number (default: 5000)
   - requests_per_minute: number (default: 30)

5. `ScrapingResult`
   - success: boolean
   - products: ScrapedProduct[]
   - errors: ScrapingError[]
   - metadata: ScrapingMetadata

6. `ScrapingError`
   - type: 'network' | 'parse' | 'validation' | 'rate_limit' | 'unknown'
   - message: string
   - url: string | null
   - timestamp: string

7. `ScrapingMetadata`
   - total_products_found: number
   - total_products_scraped: number
   - start_time: string
   - end_time: string
   - duration_ms: number
   - pages_scraped: number

### Step 1.4: Create Base Scraper Class
**File:** `src/lib/scraping/base/base-scraper.ts`

**Class:** `BaseScraper`

**Properties:**
- protected config: ScraperConfig
- protected browser: Browser | null (Puppeteer)
- protected page: Page | null (Puppeteer)
- protected rateLimiter: RateLimiter
- protected retryHandler: RetryHandler

**Methods to Implement:**
1. `constructor(config: ScraperConfig)` - Initialize with config
2. `async initialize()` - Launch browser, set up page
3. `async cleanup()` - Close browser, cleanup resources
4. `async fetchPage(url: string): Promise<string>` - Fetch page HTML with rate limiting
5. `async fetchPageWithJS(url: string): Promise<Page>` - Fetch page with JavaScript rendering
6. `protected async delay(min?: number, max?: number): Promise<void>` - Random delay
7. `protected parsePrice(priceText: string): number | null` - Parse price string to number
8. `protected normalizeBrand(brand: string): string` - Normalize brand names
9. `protected normalizeModel(model: string): string` - Normalize model names
10. `protected generateSlug(name: string): string` - Generate URL-safe slug
11. `async discoverProducts(category: ProductCategory): Promise<ScrapedProduct[]>` - Abstract method
12. `async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null>` - Abstract method
13. `protected validateScrapedProduct(product: ScrapedProduct): ValidationResult` - Validate data
14. `protected logError(error: ScrapingError): void` - Log errors
15. `protected async retry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T>` - Retry logic

**Error Handling:**
- Network errors: Retry with exponential backoff
- Parse errors: Log and continue
- Rate limit errors: Wait and retry
- Validation errors: Flag for review

---

## PHASE 2: CONFIGURATION SYSTEM

### Step 2.1: Create Configuration Loader
**File:** `src/lib/scraping/config/scraper-config.ts`

**Functions:**
1. `loadStoreConfig(storeSlug: string): Promise<ScraperConfig>` - Load config from JSON file
2. `validateConfig(config: unknown): ScraperConfig` - Validate config structure
3. `getAllStoreConfigs(): Promise<ScraperConfig[]>` - Load all store configs
4. `updateStoreConfig(storeSlug: string, updates: Partial<ScraperConfig>): Promise<void>` - Update config

**Config File Structure:**
Each store config JSON file contains:
- Store identification (slug, name, base_url)
- Category URLs mapping
- CSS/XPath selectors
- Rate limiting settings
- JavaScript requirement flag
- User agent strings

### Step 2.2: Create Store Configuration Files
**Files:**
- `src/lib/scraping/config/store-configs/jarir.json`
- `src/lib/scraping/config/store-configs/extra.json`
- `src/lib/scraping/config/store-configs/noon.json`
- `src/lib/scraping/config/store-configs/amazon.json`
- `src/lib/scraping/config/store-configs/almanea.json`

**Each Config Contains:**
```json
{
  "store_slug": "jarir",
  "store_name_ar": "مكتبة جرير",
  "store_name_en": "Jarir Bookstore",
  "base_url": "https://www.jarir.com",
  "requires_js": true,
  "rate_limit": {
    "min_delay_ms": 3000,
    "max_delay_ms": 6000,
    "requests_per_minute": 20
  },
  "user_agents": [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
  ],
  "category_urls": {
    "smartphone": [
      "https://www.jarir.com/sa-en/catalogsearch/result/?q=smartphone"
    ],
    "laptop": [...],
    "tv": [...]
  },
  "selectors": {
    "product_list": ".product-item",
    "product_link": "a.product-item-link",
    "product_name": ".product-item-name",
    "product_price": ".price",
    "product_original_price": ".old-price",
    "product_image": ".product-image img",
    "product_sku": ".sku",
    "product_availability": ".stock-status"
  }
}
```

**Note:** Selectors need to be discovered by inspecting each store's HTML structure.

---

## PHASE 3: UTILITY FUNCTIONS

### Step 3.1: Rate Limiter
**File:** `src/lib/scraping/utils/rate-limiter.ts`

**Class:** `RateLimiter`

**Methods:**
1. `constructor(config: RateLimitConfig)` - Initialize with config
2. `async wait(): Promise<void>` - Wait for next allowed request
3. `getRemainingRequests(): number` - Get remaining requests in current window
4. `reset(): void` - Reset rate limit window

**Implementation:**
- Token bucket algorithm
- Track requests per minute
- Random delay between min/max

### Step 3.2: Retry Handler
**File:** `src/lib/scraping/utils/retry-handler.ts`

**Class:** `RetryHandler`

**Methods:**
1. `async retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>` - Retry with exponential backoff
2. `shouldRetry(error: Error): boolean` - Determine if error is retryable

**RetryOptions:**
- maxRetries: number (default: 3)
- initialDelayMs: number (default: 1000)
- maxDelayMs: number (default: 30000)
- backoffMultiplier: number (default: 2)

### Step 3.3: URL Utilities
**File:** `src/lib/scraping/utils/url-utils.ts`

**Functions:**
1. `normalizeUrl(url: string, baseUrl: string): string` - Convert relative to absolute
2. `isValidUrl(url: string): boolean` - Validate URL format
3. `extractDomain(url: string): string` - Extract domain from URL
4. `buildCategoryUrl(baseUrl: string, category: ProductCategory, page?: number): string` - Build category URL

### Step 3.4: Price Parser
**File:** `src/lib/scraping/utils/price-parser.ts`

**Functions:**
1. `parsePrice(priceText: string, currency?: string): number | null` - Parse price from text
2. `extractNumber(text: string): number | null` - Extract number from text
3. `normalizePriceText(text: string): string` - Remove currency symbols, spaces
4. `validatePrice(price: number): boolean` - Validate price range (not 0, not negative, reasonable max)

**Price Parsing Logic:**
- Remove currency symbols (ر.س, SAR, ريال, etc.)
- Remove commas and spaces
- Extract decimal number
- Handle Arabic numerals (٠-٩) conversion
- Return null if parsing fails

---

## PHASE 4: DATA VALIDATION

### Step 4.1: Validation Rules
**File:** `src/lib/scraping/validation/validation-rules.ts`

**Interfaces:**
1. `ValidationRule<T>` - Generic validation rule
2. `ValidationResult` - Result of validation
   - isValid: boolean
   - errors: string[]
   - warnings: string[]

**Rules to Implement:**
1. `validatePrice(price: number): ValidationResult` - Price must be > 0 and < 1,000,000 SAR
2. `validateName(name: string, language: 'ar' | 'en'): ValidationResult` - Name must not be empty, min 3 chars
3. `validateBrand(brand: string): ValidationResult` - Brand must not be empty
4. `validateModel(model: string): ValidationResult` - Model must not be empty
5. `validateUrl(url: string): ValidationResult` - URL must be valid and from store domain
6. `validateImages(images: string[]): ValidationResult` - At least one image, all valid URLs
7. `validateSpecifications(specs: Record<string, unknown>): ValidationResult` - Specs must be object
8. `validateCategory(category: ProductCategory): ValidationResult` - Category must be valid enum
9. `validateAvailability(availability: string): ValidationResult` - Must be valid enum value
10. `validateSku(sku: string | null): ValidationResult` - SKU format if provided

**Cross-Validation Rules:**
1. `validatePriceConsistency(current: number, original: number | null): ValidationResult` - Original must be >= current if both exist
2. `validateHistoricalPrice(newPrice: number, historicalPrices: number[]): ValidationResult` - Flag if price change > 50%

### Step 4.2: Data Validator
**File:** `src/lib/scraping/validation/data-validator.ts`

**Class:** `DataValidator`

**Methods:**
1. `validateProduct(product: ScrapedProduct): ValidationResult` - Validate all product fields
2. `validatePriceChange(oldPrice: number, newPrice: number): ValidationResult` - Validate price change
3. `shouldFlagForReview(product: ScrapedProduct, result: ValidationResult): boolean` - Determine if needs manual review
4. `getValidationScore(result: ValidationResult): number` - Score 0-100 for data quality

**Flagging Logic:**
- Flag if price change > 50%
- Flag if validation errors > 2
- Flag if price is 0 or negative
- Flag if required fields missing

---

## PHASE 5: PRODUCT MATCHING

### Step 5.1: Product Matcher
**File:** `src/lib/scraping/matching/product-matcher.ts`

**Class:** `ProductMatcher`

**Methods:**
1. `async findExistingProduct(scrapedProduct: ScrapedProduct): Promise<string | null>` - Find existing product by SKU, brand+model, or fuzzy match
2. `async matchBySku(sku: string): Promise<string | null>` - Exact SKU match
3. `async matchByBrandModel(brand: string, model: string): Promise<string | null>` - Brand + Model match
4. `async fuzzyMatch(scrapedProduct: ScrapedProduct): Promise<{ productId: string; confidence: number } | null>` - Fuzzy string matching
5. `normalizeForMatching(text: string): string` - Normalize text for matching (lowercase, remove special chars)

**Matching Strategy:**
1. First: Try exact SKU match
2. Second: Try normalized brand + model match
3. Third: Try fuzzy matching (Levenshtein distance)
4. Return null if no match found (new product)

### Step 5.2: Fuzzy Matcher
**File:** `src/lib/scraping/matching/fuzzy-matcher.ts`

**Functions:**
1. `calculateSimilarity(str1: string, str2: string): number` - Levenshtein distance similarity (0-1)
2. `normalizeProductName(name: string): string` - Remove common words, normalize
3. `extractKeyFeatures(name: string): string[]` - Extract key features (brand, model, storage, etc.)
4. `matchProducts(product1: ScrapedProduct, product2: ScrapedProduct): number` - Overall similarity score

**Similarity Threshold:**
- High confidence: > 0.9 (auto-match)
- Medium confidence: 0.7-0.9 (flag for review)
- Low confidence: < 0.7 (no match)

---

## PHASE 6: STORE-SPECIFIC SCRAPERS

### Step 6.1: Create Base Store Scraper Template
**Pattern:** All store scrapers extend `BaseScraper`

**File Structure:**
```
src/lib/scraping/stores/{store}-scraper.ts
```

**Each Scraper Implements:**
1. `async discoverProducts(category: ProductCategory, maxPages?: number): Promise<ScrapedProduct[]>` - Discover products from category pages
2. `async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null>` - Update price for existing product
3. `protected parseProductList(html: string): string[]` - Extract product URLs from category page
4. `protected async scrapeProductPage(url: string): Promise<ScrapedProduct>` - Scrape individual product page
5. `protected extractSpecifications(html: string): Record<string, unknown>` - Extract product specifications
6. `protected extractImages(html: string): string[]` - Extract product images

### Step 6.2: Implement Jarir Scraper (Proof of Concept)
**File:** `src/lib/scraping/stores/jarir-scraper.ts`

**Class:** `JarirScraper extends BaseScraper`

**Specific Implementation:**
- Load config from `jarir.json`
- Implement category page parsing
- Implement product page parsing
- Handle JavaScript rendering (requires Puppeteer)
- Extract Arabic and English names
- Parse prices in SAR
- Extract specifications table
- Extract product images

**Testing:**
- Test with one category (smartphones)
- Test with 5-10 products
- Verify data extraction accuracy
- Test error handling

### Step 6.3: Implement Remaining Store Scrapers
**Files:**
- `src/lib/scraping/stores/extra-scraper.ts`
- `src/lib/scraping/stores/noon-scraper.ts`
- `src/lib/scraping/stores/amazon-scraper.ts`
- `src/lib/scraping/stores/almanea-scraper.ts`

**Each follows same pattern as JarirScraper**

---

## PHASE 7: DATABASE INTEGRATION

### Step 7.1: Create Product Service
**File:** `src/lib/scraping/services/product-service.ts`

**Class:** `ProductService`

**Methods:**
1. `async createOrUpdateProduct(scrapedProduct: ScrapedProduct, storeId: string): Promise<{ productId: string; created: boolean }>` - Create product or update existing
2. `async createProduct(product: ScrapedProduct): Promise<string>` - Create new product
3. `async updateProductPrice(productId: string, storeId: string, price: number, availability: string): Promise<void>` - Update price
4. `async linkProductToStore(productId: string, storeId: string, data: ProductStoreData): Promise<void>` - Link product to store
5. `async recordPriceHistory(productStoreId: string, price: number): Promise<void>` - Record in price_history

**Integration with existing:**
- Use existing `/api/store/sync/[storeId]` endpoint
- Or create direct database functions
- Handle transactions properly

### Step 7.2: Enhance Store Sync API
**File:** `src/app/api/store/sync/[storeId]/route.ts`

**Enhancements:**
1. Add product creation support (currently only accepts product_id)
2. Add batch processing for large product lists
3. Add validation before saving
4. Add product matching integration
5. Add error reporting improvements

**New Interface:**
```typescript
interface SyncProduct {
  // Existing fields...
  // Add:
  name_ar?: string;
  name_en?: string;
  brand?: string;
  model?: string;
  sku?: string;
  // ... other product fields for creation
  create_if_not_exists?: boolean; // Auto-create product if not found
}
```

---

## PHASE 8: SCRAPING JOBS (Two-Phase Architecture)

### Step 8.1: Product Discovery Job
**File:** `src/app/api/cron/discover-products/route.ts`

**Endpoint:** `POST /api/cron/discover-products`

**Functionality:**
1. Accept store slug or "all" stores
2. Accept category or "all" categories
3. Run discovery scraper for specified store/category
4. Match products using ProductMatcher
5. Create new products or link to existing
6. Return discovery results

**Request Body:**
```typescript
{
  store_slug?: string; // Optional, "all" for all stores
  category?: ProductCategory; // Optional, "all" for all categories
  max_pages?: number; // Optional, default 10
  dry_run?: boolean; // Optional, test without saving
}
```

**Response:**
```typescript
{
  success: boolean;
  store: string;
  category: string;
  products_discovered: number;
  products_created: number;
  products_linked: number;
  errors: number;
  duration_ms: number;
}
```

### Step 8.2: Price Update Job
**File:** `src/app/api/cron/update-prices/route.ts`

**Endpoint:** `POST /api/cron/update-prices`

**Functionality:**
1. Get all products that need price updates (based on last_checked_at)
2. Group by store
3. Run price update scraper for each store
4. Update prices in database
5. Record price history
6. Trigger price alerts if needed

**Request Body:**
```typescript
{
  store_slug?: string; // Optional
  max_products?: number; // Optional, default 100
  older_than_hours?: number; // Optional, default 24
}
```

**Response:**
```typescript
{
  success: boolean;
  stores_updated: number;
  products_updated: number;
  price_changes: number;
  errors: number;
  duration_ms: number;
}
```

### Step 8.3: Scraping Orchestrator
**File:** `src/lib/scraping/services/scraping-orchestrator.ts`

**Class:** `ScrapingOrchestrator`

**Methods:**
1. `async runDiscoveryJob(options: DiscoveryOptions): Promise<DiscoveryResult>` - Run discovery for stores/categories
2. `async runPriceUpdateJob(options: PriceUpdateOptions): Promise<PriceUpdateResult>` - Run price updates
3. `async runFullSync(storeSlug: string): Promise<SyncResult>` - Run both discovery and updates
4. `getScraperForStore(storeSlug: string): BaseScraper` - Get appropriate scraper instance

---

## PHASE 9: SCHEDULING

### Step 9.1: Create Cron Job Configuration
**File:** `src/lib/scraping/config/schedule-config.ts`

**Configuration:**
```typescript
{
  discovery: {
    frequency: 'weekly', // 'daily' | 'weekly' | 'monthly'
    day_of_week: 0, // 0 = Sunday
    time: '02:00', // UTC time
    stores: ['all'] // or specific stores
  },
  price_updates: {
    frequency: 'hourly', // 'hourly' | 'daily'
    interval_hours: 6, // For hourly, check every 6 hours
    stores: ['all']
  }
}
```

### Step 9.2: Create Scheduled Job Endpoints
**Files:**
- `src/app/api/cron/discover-products/route.ts` (already created in Phase 8)
- `src/app/api/cron/update-prices/route.ts` (already created in Phase 8)

**Add Authentication:**
- Check for `CRON_SECRET` in environment
- Validate `Authorization: Bearer {CRON_SECRET}` header
- Return 401 if invalid

### Step 9.3: External Cron Setup
**Options:**
1. **Vercel Cron** (if using Vercel)
   - Add `vercel.json` with cron configuration
2. **GitHub Actions**
   - Create `.github/workflows/scraping-cron.yml`
   - Schedule with cron syntax
3. **External Service** (cron-job.org, EasyCron)
   - Configure webhook calls to API endpoints
4. **Supabase Edge Functions + pg_cron**
   - Use Supabase's built-in cron if available

**Recommended:** Start with external service (e.g., cron-job.org) for simplicity, migrate to Vercel Cron if on Vercel.

---

## PHASE 10: MONITORING & ALERTS

### Step 10.1: Create Scraping Logs Table
**File:** `scripts/database/07-scraping-logs-schema.sql`

**Table:** `scraping_logs`

**Columns:**
- id: UUID PRIMARY KEY
- store_id: UUID REFERENCES stores(id)
- job_type: 'discovery' | 'price_update'
- status: 'success' | 'failed' | 'partial'
- products_found: INTEGER
- products_processed: INTEGER
- products_created: INTEGER
- products_updated: INTEGER
- errors_count: INTEGER
- error_details: JSONB
- duration_ms: INTEGER
- started_at: TIMESTAMP
- completed_at: TIMESTAMP
- metadata: JSONB

**Indexes:**
- idx_scraping_logs_store ON scraping_logs(store_id)
- idx_scraping_logs_job_type ON scraping_logs(job_type)
- idx_scraping_logs_started_at ON scraping_logs(started_at)

### Step 10.2: Create Logging Service
**File:** `src/lib/scraping/services/scraping-logger.ts`

**Class:** `ScrapingLogger`

**Methods:**
1. `async logJobStart(storeId: string, jobType: string): Promise<string>` - Log job start, return log ID
2. `async logJobComplete(logId: string, result: ScrapingResult): Promise<void>` - Log job completion
3. `async logError(logId: string, error: ScrapingError): Promise<void>` - Log error
4. `async getRecentLogs(storeId?: string, limit?: number): Promise<ScrapingLog[]>` - Get recent logs
5. `async getJobStats(storeId: string, days: number): Promise<JobStats>` - Get statistics

### Step 10.3: Create Alert System
**File:** `src/lib/scraping/services/scraping-alerts.ts`

**Functions:**
1. `async checkScrapingHealth(): Promise<HealthCheck>` - Check health of all scrapers
2. `async sendAlert(type: AlertType, message: string, details: unknown): Promise<void>` - Send alert
3. `async checkForFailures(): Promise<void>` - Check for repeated failures

**Alert Types:**
- 'scraping_failed' - Job failed
- 'repeated_failures' - Multiple failures in a row
- 'data_quality_issue' - Validation issues
- 'rate_limit_hit' - Rate limiting detected
- 'selector_broken' - Selectors not working (site changed)

**Alert Channels:**
- Database (scraping_logs table)
- Email (if configured)
- Admin dashboard notification

### Step 10.4: Create Admin Dashboard for Monitoring
**File:** `src/app/[locale]/admin/scraping/page.tsx`

**Features:**
1. View recent scraping logs
2. View success/failure rates
3. View products discovered/updated
4. View errors and warnings
5. Manual trigger for scraping jobs
6. View scraping statistics (charts)
7. View flagged products for review

**Components:**
- `ScrapingLogsTable` - Table of recent logs
- `ScrapingStats` - Statistics cards
- `ScrapingChart` - Success rate over time
- `ManualTriggerDialog` - Trigger jobs manually

---

## PHASE 11: ERROR HANDLING & RESILIENCE

### Step 11.1: Error Classification
**File:** `src/lib/scraping/base/types.ts` (extend)

**Error Types:**
- `NetworkError` - Connection issues, timeouts
- `ParseError` - HTML parsing failures, selector issues
- `ValidationError` - Data validation failures
- `RateLimitError` - Rate limiting detected
- `SelectorError` - Selectors not found (site changed)
- `UnknownError` - Unclassified errors

### Step 11.2: Retry Strategies
**File:** `src/lib/scraping/utils/retry-handler.ts` (enhance)

**Strategies:**
1. Network errors: Retry 3 times with exponential backoff
2. Parse errors: Log and skip (don't retry)
3. Rate limit errors: Wait and retry once
4. Selector errors: Alert admin, don't retry
5. Validation errors: Flag for review, don't retry

### Step 11.3: Graceful Degradation
**Implementation:**
- If one store fails, continue with others
- If one product fails, continue with others
- If price update fails, keep old price
- Log all failures for review

---

## PHASE 12: TESTING & VALIDATION

### Step 12.1: Unit Tests
**Files:**
- `tests/scraping/base-scraper.test.ts`
- `tests/scraping/product-matcher.test.ts`
- `tests/scraping/data-validator.test.ts`
- `tests/scraping/utils/price-parser.test.ts`
- `tests/scraping/utils/rate-limiter.test.ts`

### Step 12.2: Integration Tests
**Files:**
- `tests/scraping/integration/jarir-scraper.test.ts`
- `tests/scraping/integration/product-service.test.ts`

### Step 12.3: End-to-End Tests
**Files:**
- `tests/scraping/e2e/discovery-job.test.ts`
- `tests/scraping/e2e/price-update-job.test.ts`

**Test Scenarios:**
1. Discover products from one category
2. Match products correctly
3. Update prices correctly
4. Handle errors gracefully
5. Validate data quality

---

## PHASE 13: DOCUMENTATION

### Step 13.1: Code Documentation
- Add JSDoc comments to all public methods
- Document configuration format
- Document error handling
- Document retry strategies

### Step 13.2: User Documentation
**File:** `md/SCRAPING_GUIDE.md`

**Contents:**
1. Overview of scraping system
2. How to add a new store
3. How to update selectors
4. How to monitor scraping
5. Troubleshooting guide
6. Configuration reference

### Step 13.3: Admin Guide
**File:** `md/ADMIN_SCRAPING_GUIDE.md`

**Contents:**
1. How to trigger manual scraping
2. How to review flagged products
3. How to update configurations
4. How to monitor health
5. How to handle errors

---

## IMPLEMENTATION CHECKLIST

### Phase 0: Preparation
1. [ ] Create `scripts/database/06-delete-mock-products.sql` with safe deletion script
2. [ ] Add `db:clean-mock` npm script to package.json
3. [ ] Test deletion script on development database
4. [ ] Document deletion process in scripts/README.md
5. [ ] Execute deletion script to remove all mock products

### Phase 1: Foundation
6. [ ] Install puppeteer and cheerio dependencies
7. [ ] Create `src/lib/scraping/` directory structure
8. [ ] Create `src/lib/scraping/base/types.ts` with all interfaces
9. [ ] Create `src/lib/scraping/base/base-scraper.ts` with BaseScraper class
10. [ ] Implement all BaseScraper methods
11. [ ] Add error handling to BaseScraper
12. [ ] Add retry logic to BaseScraper

### Phase 2: Configuration
13. [ ] Create `src/lib/scraping/config/scraper-config.ts` with config loader
14. [ ] Create `src/lib/scraping/config/store-configs/jarir.json`
15. [ ] Create `src/lib/scraping/config/store-configs/extra.json`
16. [ ] Create `src/lib/scraping/config/store-configs/noon.json`
17. [ ] Create `src/lib/scraping/config/store-configs/amazon.json`
18. [ ] Create `src/lib/scraping/config/store-configs/almanea.json`
19. [ ] Inspect each store's HTML to determine selectors
20. [ ] Populate selector configurations for each store

### Phase 3: Utilities
21. [ ] Create `src/lib/scraping/utils/rate-limiter.ts` with RateLimiter class
22. [ ] Create `src/lib/scraping/utils/retry-handler.ts` with RetryHandler class
23. [ ] Create `src/lib/scraping/utils/url-utils.ts` with URL utility functions
24. [ ] Create `src/lib/scraping/utils/price-parser.ts` with price parsing functions
25. [ ] Test all utility functions

### Phase 4: Validation
26. [ ] Create `src/lib/scraping/validation/validation-rules.ts` with all validation rules
27. [ ] Create `src/lib/scraping/validation/data-validator.ts` with DataValidator class
28. [ ] Implement all validation rules
29. [ ] Implement flagging logic for manual review
30. [ ] Test validation with sample data

### Phase 5: Matching
31. [ ] Create `src/lib/scraping/matching/product-matcher.ts` with ProductMatcher class
32. [ ] Create `src/lib/scraping/matching/fuzzy-matcher.ts` with fuzzy matching functions
33. [ ] Implement SKU matching
34. [ ] Implement brand+model matching
35. [ ] Implement fuzzy matching
36. [ ] Test matching with sample products

### Phase 6: Store Scrapers
37. [ ] Create `src/lib/scraping/stores/jarir-scraper.ts` extending BaseScraper
38. [ ] Implement JarirScraper.discoverProducts()
39. [ ] Implement JarirScraper.updateProductPrice()
40. [ ] Test JarirScraper with real website (smartphones category)
41. [ ] Create `src/lib/scraping/stores/extra-scraper.ts`
42. [ ] Create `src/lib/scraping/stores/noon-scraper.ts`
43. [ ] Create `src/lib/scraping/stores/amazon-scraper.ts`
44. [ ] Create `src/lib/scraping/stores/almanea-scraper.ts`
45. [ ] Test all store scrapers

### Phase 7: Database Integration
46. [ ] Create `src/lib/scraping/services/product-service.ts` with ProductService class
47. [ ] Implement product creation
48. [ ] Implement product matching integration
49. [ ] Implement price updates
50. [ ] Enhance `src/app/api/store/sync/[storeId]/route.ts` to support product creation
51. [ ] Test database integration

### Phase 8: Scraping Jobs
52. [ ] Create `src/app/api/cron/discover-products/route.ts` with discovery job
53. [ ] Create `src/app/api/cron/update-prices/route.ts` with price update job
54. [ ] Create `src/lib/scraping/services/scraping-orchestrator.ts` with ScrapingOrchestrator
55. [ ] Add authentication to cron endpoints (CRON_SECRET)
56. [ ] Test discovery job manually
57. [ ] Test price update job manually

### Phase 9: Scheduling
58. [ ] Create `src/lib/scraping/config/schedule-config.ts` with schedule configuration
59. [ ] Set up external cron service (cron-job.org or similar)
60. [ ] Configure discovery job to run weekly
61. [ ] Configure price update job to run every 6 hours
62. [ ] Test scheduled jobs

### Phase 10: Monitoring
63. [ ] Create `scripts/database/07-scraping-logs-schema.sql` with scraping_logs table
64. [ ] Run migration to create scraping_logs table
65. [ ] Create `src/lib/scraping/services/scraping-logger.ts` with ScrapingLogger class
66. [ ] Create `src/lib/scraping/services/scraping-alerts.ts` with alert functions
67. [ ] Integrate logging into all scrapers
68. [ ] Create `src/app/[locale]/admin/scraping/page.tsx` admin dashboard
69. [ ] Add scraping statistics components
70. [ ] Test monitoring and alerts

### Phase 11: Error Handling
71. [ ] Classify all error types
72. [ ] Implement retry strategies for each error type
73. [ ] Implement graceful degradation
74. [ ] Test error scenarios

### Phase 12: Testing
75. [ ] Write unit tests for BaseScraper
76. [ ] Write unit tests for ProductMatcher
77. [ ] Write unit tests for DataValidator
78. [ ] Write unit tests for utilities
79. [ ] Write integration tests for JarirScraper
80. [ ] Write E2E tests for discovery job
81. [ ] Write E2E tests for price update job

### Phase 13: Documentation
82. [ ] Add JSDoc comments to all public methods
83. [ ] Create `md/SCRAPING_GUIDE.md` user guide
84. [ ] Create `md/ADMIN_SCRAPING_GUIDE.md` admin guide
85. [ ] Document configuration format
86. [ ] Document troubleshooting steps

---

## NOTES

1. **Selector Discovery:** Each store's selectors need to be discovered by inspecting HTML. Use browser DevTools to find CSS selectors or XPath.

2. **Rate Limiting:** Start conservative (3-5 second delays). Monitor for blocks and adjust.

3. **Legal Considerations:** Document that scraping is for price comparison only. Consider reaching out to stores for partnerships.

4. **Testing:** Test with small batches first (5-10 products) before scaling up.

5. **Monitoring:** Set up alerts for repeated failures - may indicate site structure changes.

6. **Configuration Updates:** When sites change, update JSON configs rather than code.

7. **Product Matching:** Start with exact matches (SKU), then fuzzy. Manual review for uncertain matches.

8. **Data Quality:** Flag suspicious data for manual review rather than auto-rejecting.

---

**END OF PLAN**

