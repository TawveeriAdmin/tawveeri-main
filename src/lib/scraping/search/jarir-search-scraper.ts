import { BaseSearchScraper, formatScrapeError } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';

const BASE_URL = 'https://www.jarir.com';
const CONSTRUCTOR_API = 'https://ac.cnstrc.com/search';
const CONSTRUCTOR_KEY = 'key_KcSYfmQTEwRpBnd9'; // Jarir's public Constructor.io English key
const RESULTS_PER_PAGE = 50;

export class JarirSearchScraper extends BaseSearchScraper {
  constructor() {
    super('jarir', 'Jarir');
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

        console.log(`[Jarir] Page ${page}: ${products.length} items found`);
      }
    } catch (err) {
      const msg = formatScrapeError(err);
      console.error(`[Jarir] Search error:`, msg);
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
    const url = `${CONSTRUCTOR_API}/${encodeURIComponent(query)}?key=${CONSTRUCTOR_KEY}&page=${page}&num_results_per_page=${RESULTS_PER_PAGE}&section=Products`;

    const data = await this.fetchJson<Record<string, unknown>>(url, {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    });

    const response = data.response as Record<string, unknown> | undefined;
    if (!response) return [];

    const results = (response.results || []) as Record<string, unknown>[];
    return results
      .map(item => this.parseApiProduct(item))
      .filter((p): p is SearchProduct => p !== null);
  }

  private parseApiProduct(item: Record<string, unknown>): SearchProduct | null {
    try {
      const data = (item.data || {}) as Record<string, unknown>;
      const metadata = (data.metadata || {}) as Record<string, unknown>;

      // Title — prefer metadata.name (full structured title) over item.value
      const title = (metadata.name || item.value || '') as string;
      if (!title || title.length < 3) return null;

      const sku = String(data.sku || data.id || '');

      // Price
      const price = typeof data.price === 'number' ? data.price : parseFloat(String(data.price || '0'));
      if (!price || price <= 0) return null;

      // Original price — from GTM additional data
      let originalPrice: number | null = null;
      const gtmRaw = (metadata.additionalDataToReturn || '') as string;
      if (gtmRaw) {
        try {
          const gtm = JSON.parse(gtmRaw) as Record<string, unknown>;
          const save = parseFloat(String(gtm.GTM_product_save || '0'));
          if (save > 0) originalPrice = price + save;
        } catch { /* ignore */ }
      }

      // URL
      const urlPath = (data.url || '') as string;
      const productUrl = urlPath ? `${BASE_URL}/sa-en/${urlPath}` : '';

      // Image
      const imageUrl = (data.image_url || '') as string;

      // Brand and model from metadata
      const brand = (metadata.brand || 'Unknown') as string;
      const model = (metadata.model || this.extractModel(title, brand)) as string;

      const isDeal = originalPrice !== null && originalPrice > price;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model,
        sku: sku || null,
        current_price: price,
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
      console.error('[Jarir] Error parsing API product:', err);
      return null;
    }
  }
}
