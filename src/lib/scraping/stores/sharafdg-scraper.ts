import type { ScrapedProduct } from '../base/types';
import type { ProductCategory } from '@/lib/database/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { determineCategory } from '../utils/category-utils';

const ORIGIN = 'https://saudi.sharafdg.com';

/**
 * Sharaf DG (KSA) scraper — saudi.sharafdg.com, a WooCommerce/WordPress storefront.
 *
 * Verified 2026-07-27 (all served to plain HTTP — no headless browser, unlike LuLu/Carrefour):
 *  - Discovery: the WordPress search `…/en/?s=<q>&paged=<n>` returns product-page links
 *    (`/en/product/<slug>/`) in the static HTML. (Prices there are Mustache templates filled by
 *    AJAX, so we do NOT trust the search listing for price.)
 *  - Per product: the product page carries clean, TRUSTWORTHY microdata — `itemprop="price"`
 *    (+ `product:price:amount`), `itemprop="availability"`, `itemprop="sku"`, `itemprop="brand"`,
 *    and `og:title`/`og:image`. Verified realistic (Braun blender = 229.00 SAR, sku S300836535).
 *
 * Never fabricates: a product page with no positive price is skipped (unknown beats incorrect).
 */
export class SharafDgScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('sharafdg'));
  }

  /** Decode the common HTML entities that appear in og:title (e.g. &#8211; → –, &amp; → &). */
  private decodeEntities(s: string): string {
    return s
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private categoryQuery(category: ProductCategory): string {
    const map: Record<string, string> = {
      smartphone: 'smartphone',
      laptop: 'laptop',
      tablet: 'tablet',
      tv: 'television',
      audio: 'headphones',
      gaming: 'gaming console',
      camera: 'camera',
      monitor: 'monitor',
      printer: 'printer',
      networking: 'router',
      smart_home: 'smart home',
      wearable: 'smartwatch',
      appliance: 'home appliance',
      kitchen: 'kitchen appliance',
      personal_care: 'personal care',
      refrigerator: 'refrigerator',
      accessories: 'accessories',
    };
    return map[category] || category;
  }

  async discoverProducts(
    category: ProductCategory,
    maxPages: number = 2,
  ): Promise<ScrapedProduct[]> {
    const query = this.categoryQuery(category);
    const out: ScrapedProduct[] = [];
    const seenUrls = new Set<string>();
    // Cap product-page fetches per category (this is an N+1 scrape); the scheduler covers more over time.
    const MAX_PER_CATEGORY = 40;

    for (let page = 1; page <= maxPages && out.length < MAX_PER_CATEGORY; page++) {
      let searchHtml: string;
      try {
        searchHtml = await this.fetchPage(`${ORIGIN}/en/?s=${encodeURIComponent(query)}&paged=${page}`);
      } catch (e) {
        // A FETCH FAILURE WITH NOTHING COLLECTED IS A FAILURE, NOT AN EMPTY RESULT.
        //
        // This used to `break`, returning [] — so the orchestrator saw 0 products and 0
        // errors and recorded the run as `success`. Measured 2026-08-02: every Sharaf DG
        // discovery run for three days was "success, 0 discovered, ~1.3s", because
        // `fetchPage` throws a 4xx immediately and the throw was swallowed here. The
        // store had been dark since 2026-07-30 and every health signal said the run
        // worked. A successful invocation is not successful ingestion.
        //
        // Failing AFTER partial collection still breaks and keeps what was collected —
        // that genuinely is a partial success.
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[SharafDG] search fetch failed p${page}:`, msg);
        if (out.length === 0) throw new Error(`sharafdg discovery fetch failed on page ${page} (${query}): ${msg}`);
        break;
      }
      const urls = this.extractProductUrls(searchHtml).filter((u) => !seenUrls.has(u));
      if (urls.length === 0) break;

      for (const url of urls) {
        if (out.length >= MAX_PER_CATEGORY) break;
        seenUrls.add(url);
        try {
          const product = await this.parseProductPage(url, category);
          if (product) out.push(product);
        } catch {
          /* skip a single bad product page */
        }
        await this.delay();
      }
      console.log(`[SharafDG] ${category} page ${page}: ${out.length} products so far`);
    }
    return out;
  }

  private extractProductUrls(html: string): string[] {
    const re = /https:\/\/saudi\.sharafdg\.com\/en\/product\/[a-z0-9-]+\//gi;
    return [...new Set((html.match(re) || []))];
  }

  async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null> {
    try {
      return await this.parseProductPage(productUrl);
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

  private async parseProductPage(
    productUrl: string,
    fallbackCategory?: ProductCategory,
  ): Promise<ScrapedProduct | null> {
    const html = await this.fetchPage(productUrl);
    const g = (re: RegExp): string | null => {
      const m = html.match(re);
      return m ? (m[1] ?? m[2] ?? null) : null;
    };

    const price = parseFloat(
      g(/itemprop="price"[^>]*content="([\d.]+)"/) ||
        g(/property="product:price:amount"[^>]*content="([\d.]+)"/) ||
        '',
    );
    if (!(price > 0)) return null; // no valid price → do not fabricate

    const name =
      g(/property="og:title"[^>]*content="([^"]+)"/) ||
      g(/<h1[^>]*>([^<]{5,120})<\/h1>/) ||
      '';
    if (!name) return null;

    const availRaw = (
      g(/itemprop="availability"[^>]*(?:href|content)="([^"]+)"/) ||
      g(/property="product:availability"[^>]*content="([^"]+)"/) ||
      ''
    ).toLowerCase();
    const availability: ScrapedProduct['availability'] = availRaw.includes('instock') || availRaw === 'instock'
      ? 'in_stock'
      : availRaw.includes('outofstock')
        ? 'out_of_stock'
        : 'in_stock';

    const sku = g(/itemprop="sku"[^>]*content="([^"]+)"/) || g(/itemprop="sku"[^>]*>([^<]+)</) || null;
    const brand =
      g(/itemprop="brand"[^>]*content="([^"]+)"/) ||
      g(/property="product:brand"[^>]*content="([^"]+)"/) ||
      name.trim().split(/\s+/)[0] ||
      'Unknown';
    const image = g(/property="og:image"[^>]*content="([^"]+)"/);

    const cleanName = this.decodeEntities(name).replace(/\s*[–-]\s*$/, '').trim();

    return {
      name_ar: cleanName,
      name_en: cleanName,
      brand: brand || 'Unknown',
      model: sku || cleanName.split(/\s+/).pop() || 'NA',
      sku,
      current_price: price,
      original_price: null,
      availability,
      product_url: productUrl,
      image_urls: image ? [image] : [],
      specifications: {},
      category: determineCategory(cleanName) || fallbackCategory || ('accessories' as ProductCategory),
      description_ar: null,
      description_en: null,
    };
  }
}
