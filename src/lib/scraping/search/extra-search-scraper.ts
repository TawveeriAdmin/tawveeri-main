import { BaseSearchScraper } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';

const UNBXD_API = 'https://search.unbxd.io';
const UNBXD_API_KEY = '21705619e273429e5767eea44ccb1ad5';
const UNBXD_SITE_KEY = 'ss-unbxd-auk-extra-saudi-en-prod11541714990488';
const RESULTS_PER_PAGE = 50;
const PRODUCT_FIELDS = 'title,uniqueId,price,imageUrl,productUrl,brandEn,sellingPrice,wasPrice,savings';

export class ExtraSearchScraper extends BaseSearchScraper {
  constructor() {
    super('extra', 'Extra');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { query, pages } = options;
    const allProducts: SearchProduct[] = [];
    const seenSkus = new Set<string>();

    try {
      for (let page = 1; page <= pages; page++) {
        if (page > 1) await this.delay(500, 1000);

        const products = await this.searchApi(query, page);
        if (products.length === 0) break;

        for (const p of products) {
          if (p.sku && seenSkus.has(p.sku)) continue;
          if (p.sku) seenSkus.add(p.sku);
          allProducts.push(p);
        }

        console.log(`[Extra] Page ${page}: ${products.length} items found`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Extra] Search error:`, msg);
      if (allProducts.length === 0) return this.errorResult(msg);
    }

    return {
      products: allProducts,
      store: this.storeSlug,
      storeName: this.storeName,
      count: allProducts.length,
    };
  }

  private async searchApi(query: string, page: number): Promise<SearchProduct[]> {
    const start = (page - 1) * RESULTS_PER_PAGE;
    const url = `${UNBXD_API}/${UNBXD_API_KEY}/${UNBXD_SITE_KEY}/search?q=${encodeURIComponent(query)}&rows=${RESULTS_PER_PAGE}&start=${start}&format=json&fields=${PRODUCT_FIELDS}`;

    const data = await this.fetchJson<Record<string, unknown>>(url, {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    });

    const response = data.response as Record<string, unknown> | undefined;
    if (!response) return [];

    const products = (response.products || []) as Record<string, unknown>[];
    return products
      .map(item => this.parseApiProduct(item))
      .filter((p): p is SearchProduct => p !== null);
  }

  private parseApiProduct(item: Record<string, unknown>): SearchProduct | null {
    try {
      const title = (item.title || '') as string;
      if (!title || title.length < 3) return null;

      const sku = String(item.uniqueId || '');

      // Price
      const sellingPrice = this.toNumber(item.sellingPrice) || this.toNumber(item.price);
      if (!sellingPrice || sellingPrice <= 0) return null;

      const wasPrice = this.toNumber(item.wasPrice);
      const originalPrice = wasPrice && wasPrice > sellingPrice ? wasPrice : null;

      // URL
      const productUrl = (item.productUrl || '') as string;

      // Image
      const imageUrls = item.imageUrl as string[] | undefined;
      const imageUrl = imageUrls && imageUrls.length > 0 ? imageUrls[0] : null;

      // Brand
      const brand = (item.brandEn || 'Unknown') as string;

      const isDeal = originalPrice !== null && originalPrice > sellingPrice;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model: this.extractModel(title, brand),
        sku: sku || null,
        current_price: sellingPrice,
        original_price: originalPrice,
        availability: 'in_stock',
        product_url: productUrl,
        image_urls: imageUrl ? [imageUrl] : [],
        specifications: {},
        category: this.determineCategory(title),
        description_ar: null,
        description_en: null,
        is_deal: isDeal,
        is_free_delivery: false,
        store: this.storeSlug,
        store_name: this.storeName,
      };
    } catch (err) {
      console.error('[Extra] Error parsing API product:', err);
      return null;
    }
  }

  private toNumber(val: unknown): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return null;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, ''));
    return isNaN(n) ? null : n;
  }
}
