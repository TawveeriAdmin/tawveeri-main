import { BaseSearchScraper } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { getApiHeaders, getBrowserHeaders } from './user-agents';

const BASE_URL = 'https://www.noon.com/saudi-en';
const API_URL = 'https://www.noon.com/_svc/catalog/api/v3/u/en-sa/search';
const NOON_CDN = 'https://f.nooncdn.com/p';

export class NoonSearchScraper extends BaseSearchScraper {
  constructor() {
    super('noon', 'Noon');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { query, pages } = options;
    const allProducts: SearchProduct[] = [];
    const seenSkus = new Set<string>();

    try {
      for (let page = 1; page <= pages; page++) {
        if (page > 1) await this.delay(1000, 2000);

        let products = await this.searchApi(query, page);
        if (products.length === 0) {
          products = await this.searchHtml(query, page);
        }
        if (products.length === 0) break;

        for (const p of products) {
          if (p.sku && seenSkus.has(p.sku)) continue;
          if (p.sku) seenSkus.add(p.sku);
          allProducts.push(p);
        }

        console.log(`[Noon] Page ${page}: ${products.length} items found`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Noon] Search error:`, msg);
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
    const url = `${API_URL}?q=${encodeURIComponent(query)}&page=${page}&limit=50&sort%5Bby%5D=relevance&sort%5Bdir%5D=desc`;
    const headers = getApiHeaders('https://www.noon.com', `${BASE_URL}/`);
    (headers as Record<string, string>)['x-locale'] = 'en-sa';
    (headers as Record<string, string>)['x-platform'] = 'web';
    (headers as Record<string, string>)['x-content'] = 'desktop';

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) await this.delay(3000 * attempt, 5000 * attempt);

        const data = await this.fetchJson<Record<string, unknown>>(url, headers);
        const hits = (
          (data.hits as unknown[]) ||
          (data.results as unknown[]) ||
          (data.products as unknown[]) ||
          ((data.data as Record<string, unknown>)?.hits as unknown[]) ||
          ((data.data as Record<string, unknown>)?.products as unknown[]) ||
          []
        ) as Record<string, unknown>[];

        return hits.map(item => this.parseApiProduct(item)).filter((p): p is SearchProduct => p !== null);
      } catch (err) {
        console.error(`[Noon] API attempt ${attempt + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : err);
        if (attempt === maxRetries - 1) return [];
      }
    }
    return [];
  }

  private async searchHtml(query: string, page: number): Promise<SearchProduct[]> {
    const url = `${BASE_URL}/search/?q=${encodeURIComponent(query)}&page=${page}`;
    try {
      const html = await this.fetchHtml(url, getBrowserHeaders());
      const $ = this.getCheerio(html);

      // Try __NEXT_DATA__ first
      const nextDataEl = $('script#__NEXT_DATA__');
      if (nextDataEl.length) {
        try {
          const data = JSON.parse(nextDataEl.html() || '{}');
          const pageProps = data?.props?.pageProps || {};
          const catalog = pageProps.catalog || pageProps.initialState?.catalog || {};
          const hits = (catalog.hits || catalog.products || []) as Record<string, unknown>[];
          const products = hits.map(item => this.parseApiProduct(item)).filter((p): p is SearchProduct => p !== null);
          if (products.length > 0) return products;
        } catch { /* fall through */ }
      }

      return [];
    } catch (err) {
      console.error(`[Noon] HTML fallback failed:`, err instanceof Error ? err.message : err);
      return [];
    }
  }

  private parseApiProduct(item: Record<string, unknown>): SearchProduct | null {
    try {
      const title = (item.name || item.title || 'No title') as string;
      const sku = String(item.sku || item.id || item.product_id || '');

      // Price
      const priceData = item.price || item.sale_price || {};
      let price: number | null = null;
      let originalPrice: number | null = null;
      let discount: string | null = null;

      if (typeof priceData === 'object' && priceData !== null) {
        const pd = priceData as Record<string, unknown>;
        price = this.toNumber(pd.now || pd.current || pd.price);
        originalPrice = this.toNumber(pd.was || pd.original);
        const disc = pd.discount_percent || pd.off;
        if (disc) discount = String(disc);
      } else if (priceData) {
        price = this.toNumber(priceData);
      }

      if (!price && item.sale_price) price = this.toNumber(item.sale_price);
      if (!originalPrice && typeof item.price === 'number' && item.sale_price && item.price !== item.sale_price) {
        originalPrice = this.toNumber(item.price);
      }

      // URL
      const slug = (item.slug || item.url_key || '') as string;
      let productUrl = '';
      if (slug) {
        productUrl = sku ? `${BASE_URL}/${slug}/p/${sku}/` : `${BASE_URL}/${slug}/`;
      }

      // Image
      let imageUrl: string | null = null;
      const imageKey = item.image_key as string | undefined;
      if (imageKey) {
        imageUrl = `${NOON_CDN}/${imageKey}.jpg`;
      } else {
        for (const key of ['image_url', 'image', 'thumbnail', 'img']) {
          const val = item[key];
          if (typeof val === 'string' && val) { imageUrl = val; break; }
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            imageUrl = (val as Record<string, string>).url || (val as Record<string, string>).src || null;
            if (imageUrl) break;
          }
          if (Array.isArray(val) && val.length > 0) {
            imageUrl = typeof val[0] === 'string' ? val[0] : (val[0] as Record<string, string>)?.url || null;
            if (imageUrl) break;
          }
        }
      }
      if (imageUrl?.startsWith('//')) imageUrl = `https:${imageUrl}`;
      else if (imageUrl && !imageUrl.startsWith('http')) imageUrl = `${NOON_CDN}/${imageUrl}`;

      // Rating
      let rating: number | null = null;
      let reviewCount: number | null = null;
      const ratingData = item.rating || item.ratings;
      if (typeof ratingData === 'object' && ratingData !== null) {
        const rd = ratingData as Record<string, unknown>;
        rating = this.toNumber(rd.average || rd.value);
        reviewCount = this.toNumber(rd.count || rd.total) ? Math.round(this.toNumber(rd.count || rd.total)!) : null;
      } else {
        rating = this.toNumber(ratingData);
        reviewCount = this.toNumber(item.review_count || item.reviews_count) ? Math.round(this.toNumber(item.review_count || item.reviews_count)!) : null;
      }

      const brand = (item.brand || item.brand_name || 'Unknown') as string;
      const isExpress = !!(item.is_express || item.express_delivery);
      const isDeal = discount !== null;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model: this.extractModel(title, brand),
        sku: sku || null,
        current_price: price || 0,
        original_price: originalPrice,
        availability: (item.in_stock === false || item.is_available === false) ? 'out_of_stock' : 'in_stock',
        product_url: productUrl,
        image_urls: imageUrl ? [imageUrl] : [],
        specifications: {},
        category: this.determineCategory(title),
        description_ar: null,
        description_en: null,
        is_deal: isDeal,
        is_free_delivery: isExpress,
        store: this.storeSlug,
        store_name: this.storeName,
      };
    } catch (err) {
      console.error('[Noon] Error parsing product:', err);
      return null;
    }
  }

  private toNumber(val: unknown): number | null {
    if (val === null || val === undefined) return null;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(n) ? null : n;
  }
}
