import type { ScrapedProduct } from '../base/types';
import type { ProductCategory } from '@/lib/database/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { classifyFromTitle, determineCategory } from '../utils/category-utils';

const NOON_API_URL = 'https://www.noon.com/_svc/catalog/api/v3/u/en-sa/search';
const NOON_CDN = 'https://f.nooncdn.com/p';
const BASE_URL = 'https://www.noon.com/saudi-en';

/**
 * Extract Noon's product SKU from a product URL.
 *
 * ADR-149 — this existed inline as `productUrl.match(/\/p\/([A-Z0-9]+)/i)`, which assumes
 * the SKU FOLLOWS the `/p/` marker. Every Noon URL in production has it BEFORE:
 *   https://www.noon.com/saudi-en/<slug>/N70012924V/p/
 *   https://www.noon.com/saudi-en/<slug>/Z50D2FD9D5BEC3416FD27Z/p/
 * `/p/` is terminal, so the old pattern never matched, the keyed API lookup was skipped,
 * and every price refresh fell through to HTML scraping which returns null on Noon.
 * Measured: 120 attempts, 120 failures, 0 products updated — 100% silent failure.
 *
 * Returns the SKU, or null when the URL genuinely does not carry one (an EXPLICIT reject,
 * so the caller can record a reason rather than emitting an unexplained null).
 */
export function extractNoonSku(productUrl: string): string | null {
  const path = (productUrl || '').split('?')[0].split('#')[0];
  const segs = path.split('/').filter(Boolean);
  const pIdx = segs.lastIndexOf('p');
  if (pIdx < 0) return null;                       // no /p/ marker at all
  // A Noon SKU is alphanumeric, at least 6 chars, and contains a digit. The slug segments
  // around it always contain hyphens, so they can never be mistaken for one.
  const looksLikeSku = (s?: string) => !!s && /^[A-Za-z0-9]{6,}$/.test(s) && /\d/.test(s);
  const before = pIdx > 0 ? segs[pIdx - 1] : undefined;   // .../<sku>/p/   ← production form
  if (looksLikeSku(before)) return before!.toUpperCase();
  const after = segs[pIdx + 1];                           // .../p/<sku>   ← legacy form
  if (looksLikeSku(after)) return after!.toUpperCase();
  return null;
}

/**
 * Noon store scraper using Noon's internal JSON API.
 * Reuses patterns from NoonSearchScraper.
 */
export class NoonScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('noon'));
  }

  async discoverProducts(
    category: ProductCategory,
    maxPages: number = 10
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];

    // Noon discovery is keyword-search driven via their internal catalog
    // API, not URL-crawl driven. We only need a search query per category
    // (resolved by extractCategoryQuery). The noon.json config's
    // `category_urls` list is a historical artefact from the HTML-crawl
    // fallback path — ignoring it here lets us cover every enum category
    // (wearable, printer, monitor, smart_home, kitchen, refrigerator, etc.)
    // without having to add dummy URL entries to the config.
    const categoryQuery = this.extractCategoryQuery('', category);
    if (!categoryQuery) return products;

    let lastError: unknown = null;
    try {
      for (let page = 1; page <= maxPages; page++) {
        try {
          const pageProducts = await this.scrapeApiPage(categoryQuery, page, category);
          if (pageProducts.length === 0) break;
          products.push(...pageProducts);
          await this.delay();
        } catch (error) {
          // Same defect as Sharaf DG, different shape: every page error was logged to
          // stdout and then discarded, so a category that fetched NOTHING returned an
          // empty array and the run was recorded as `success`. Measured 2026-08-02:
          // Noon discovery ran for ~229 SECONDS per category (the API stalls from the
          // production egress and every page times out), discovered 0, and reported
          // success — for three days.
          lastError = error;
          console.error(`[Noon] Error scraping page ${page}:`, error);
        }
      }
    } finally {
      await this.cleanup();
    }

    // Errors that produced nothing are a failure. Errors that still produced products
    // are a partial success and are kept.
    if (!products.length && lastError) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`noon discovery produced nothing for "${categoryQuery}": ${msg}`);
    }

    return products;
  }

  async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null> {
    try {
      // ADR-149: the SKU sits BEFORE the terminal `/p/` on Noon. See extractNoonSku.
      const sku = extractNoonSku(productUrl);
      if (!sku) {
        this.logError({
          type: 'parse',
          message: `No Noon SKU in URL (explicit reject, not a silent null): ${productUrl}`,
          url: productUrl,
          timestamp: new Date().toISOString(),
        });
        return this.scrapeProductPageHtml(productUrl);
      }

      const apiUrl = `${NOON_API_URL}?q=${encodeURIComponent(sku)}&limit=1`;

      const data = await this.fetchJson<Record<string, unknown>>(apiUrl, {
        'x-locale': 'en-sa',
        'x-platform': 'web',
        'x-content': 'desktop',
      });

      const hits = this.extractHits(data);
      if (hits.length === 0) {
        return this.scrapeProductPageHtml(productUrl);
      }

      return this.parseApiProduct(hits[0], productUrl);
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

  private extractCategoryQuery(baseUrl: string, category: ProductCategory): string {
    // Map our internal category enum → a Noon-flavoured search query.
    // Keep keywords broad so each category pulls thousands of candidate
    // products from Noon's search index. Multi-word queries (e.g.
    // "headphones speakers") widen the net on purpose — Noon's relevance
    // ranker handles mixed results gracefully and our downstream
    // `determineCategory()` re-classifies each product from its title
    // anyway, so over-broad queries just mean more products, not noisy ones.
    const categoryMap: Record<string, string> = {
      smartphone:    'smartphone',
      laptop:        'laptop',
      tablet:        'tablet',
      tv:            'television',
      audio:         'headphones speakers',
      gaming:        'gaming console',
      camera:        'camera',
      monitor:       'computer monitor',
      printer:       'printer',
      networking:    'router wifi',
      smart_home:    'smart home',
      wearable:      'smartwatch fitness tracker',
      appliance:     'home appliances',
      kitchen:       'kitchen appliances',
      personal_care: 'personal care grooming',
      refrigerator: 'refrigerator fridge',
      accessories:   'electronics accessories',
    };
    return categoryMap[category] || category;
  }

  private async scrapeApiPage(query: string, page: number, category: ProductCategory): Promise<ScrapedProduct[]> {
    const url = `${NOON_API_URL}?q=${encodeURIComponent(query)}&page=${page}&limit=50&sort%5Bby%5D=relevance&sort%5Bdir%5D=desc`;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) await this.delay(3000 * attempt, 5000 * attempt);

        const data = await this.fetchJson<Record<string, unknown>>(url, {
          'x-locale': 'en-sa',
          'x-platform': 'web',
          'x-content': 'desktop',
        });

        const hits = this.extractHits(data);
        console.log(`[Noon] Page ${page}: ${hits.length} products from API`);

        return hits
          .map(item => this.parseApiProduct(item, undefined, category))
          .filter((p): p is ScrapedProduct => p !== null);
      } catch (err) {
        console.error(`[Noon] API attempt ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : err);
        if (attempt === maxRetries - 1) return [];
      }
    }
    return [];
  }

  private extractHits(data: Record<string, unknown>): Record<string, unknown>[] {
    return (
      (data.hits as unknown[]) ||
      (data.results as unknown[]) ||
      (data.products as unknown[]) ||
      ((data.data as Record<string, unknown>)?.hits as unknown[]) ||
      ((data.data as Record<string, unknown>)?.products as unknown[]) ||
      []
    ) as Record<string, unknown>[];
  }

  private parseApiProduct(
    item: Record<string, unknown>,
    overrideUrl?: string,
    defaultCategory?: ProductCategory,
  ): ScrapedProduct | null {
    try {
      const title = (item.name || item.title || '') as string;
      if (!title || title.length < 3) return null;

      const sku = String(item.sku || item.id || item.product_id || '');

      // Price extraction
      const priceData = item.price || item.sale_price || {};
      let price: number | null = null;
      let originalPrice: number | null = null;

      if (typeof priceData === 'object' && priceData !== null) {
        const pd = priceData as Record<string, unknown>;
        price = this.toNumber(pd.now || pd.current || pd.price);
        originalPrice = this.toNumber(pd.was || pd.original);
      } else if (priceData) {
        price = this.toNumber(priceData);
      }

      if (!price && item.sale_price) price = this.toNumber(item.sale_price);
      if (!originalPrice && typeof item.price === 'number' && item.sale_price && item.price !== item.sale_price) {
        originalPrice = this.toNumber(item.price);
      }

      if (!price || price <= 0) return null;

      // URL — Noon format: {BASE_URL}/{slug}/{sku}/p/
      const slug = (item.slug || item.url_key || '') as string;
      let productUrl = overrideUrl || '';
      if (!productUrl) {
        if (slug && sku) {
          productUrl = `${BASE_URL}/${slug}/${sku}/p/`;
        } else if (slug) {
          productUrl = `${BASE_URL}/${slug}/p/`;
        } else if (sku) {
          const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          productUrl = `${BASE_URL}/${titleSlug}/${sku}/p/`;
        }
      }

      // Image
      let imageUrl: string | null = null;
      const imageKey = item.image_key as string | undefined;
      if (imageKey) {
        imageUrl = `${NOON_CDN}/${imageKey}.jpg`;
      } else {
        for (const key of ['image_url', 'image', 'thumbnail']) {
          const val = item[key];
          if (typeof val === 'string' && val) { imageUrl = val; break; }
        }
      }
      if (imageUrl?.startsWith('//')) imageUrl = `https:${imageUrl}`;

      // Brand and model
      const brand = (item.brand || item.brand_name || 'Unknown') as string;
      const model = this.extractModelFromTitle(title, brand);

      // Electronics-only filter. Noon's relevance ranker leaks adjacent
      // non-electronics ("coffee machine" search returns cups/beans too),
      // so every hit is re-classified from its title. A null return means
      // no specific electronics keyword matched → drop it rather than
      // inherit the seed's category intent.
      const category = classifyFromTitle(title);
      if (!category) return null;

      const isExpress = !!(item.is_express || item.express_delivery);
      const hasDiscount = originalPrice !== null && originalPrice > price;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model,
        sku: sku || null,
        current_price: price,
        original_price: originalPrice,
        availability: (item.in_stock === false || item.is_available === false) ? 'out_of_stock' : 'in_stock',
        product_url: productUrl,
        image_urls: imageUrl ? [imageUrl] : [],
        specifications: {},
        category,
        description_ar: null,
        description_en: null,
        is_deal: hasDiscount,
        is_free_delivery: isExpress,
      };
    } catch (err) {
      console.error('[Noon] Error parsing product:', err);
      return null;
    }
  }

  private async scrapeProductPageHtml(productUrl: string): Promise<ScrapedProduct | null> {
    const html = await this.fetchPage(productUrl);
    const $ = this.getCheerio(html);

    const title = this.extractText($, 'h1') || this.extractText($, '[data-qa="pdp-name"]') || '';
    if (!title) return null;

    const priceText = this.extractText($, '[data-qa="pdp-price-final"]') ||
                      this.extractText($, '.priceNow') ||
                      this.extractText($, '.price') || '';
    const currentPrice = this.parsePrice(priceText);
    if (!currentPrice) return null;

    const originalPriceText = this.extractText($, '[data-qa="pdp-price-was"]') ||
                              this.extractText($, '.priceWas') || '';
    const originalPrice = originalPriceText ? this.parsePrice(originalPriceText) : null;

    const imageUrl = this.extractAttr($, '[data-qa="pdp-image"] img, .pdp-image img, img.product-image', 'src');
    const brand = this.extractText($, '[data-qa="pdp-brand"]') || 'Unknown';
    const model = this.extractModelFromTitle(title, brand);

    return {
      name_ar: title,
      name_en: title,
      brand,
      model,
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
