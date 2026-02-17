import { BaseSearchScraper } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { getBrowserHeaders } from './user-agents';

const BASE_URL = 'https://www.extra.com';

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
        if (page > 1) await this.delay(1000, 2000);

        const url = `${BASE_URL}/en-sa/search?q=${encodeURIComponent(query)}&page=${page}`;
        let html: string;
        try {
          html = await this.fetchHtml(url, getBrowserHeaders());
        } catch (err) {
          console.error(`[Extra] Page ${page} fetch failed:`, err instanceof Error ? err.message : err);
          break;
        }

        const products = this.parsePage(html);
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

  private parsePage(html: string): SearchProduct[] {
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

        const products = productList.map(item => this.parseApiProduct(item)).filter((p): p is SearchProduct => p !== null);
        if (products.length > 0) return products;
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
            const products = productList.map(item => this.parseApiProduct(item)).filter((p): p is SearchProduct => p !== null);
            if (products.length > 0) return products;
          }
        } catch { /* fall through */ }
      }
    }

    // Strategy 3: HTML selectors
    const selectors = [
      '.product-item',
      '.product-card',
      '[data-product-id]',
      '.products-grid .item',
      "[class*='ProductCard']",
      "[class*='product-card']",
      "a[href*='/p/']",
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        const products: SearchProduct[] = [];
        elements.each((_, el) => {
          const product = this.parseHtmlProduct($, $(el));
          if (product) products.push(product);
        });
        if (products.length > 0) return products;
      }
    }

    return [];
  }

  private parseApiProduct(item: Record<string, unknown>): SearchProduct | null {
    try {
      const title = (item.name || item.title || 'No title') as string;
      if (title === 'No title') return null;

      // Price
      const priceInfo = (item.price || {}) as Record<string, unknown>;
      let price = this.toNumber(priceInfo.final_price || priceInfo.current || item.price);
      const originalPrice = this.toNumber(priceInfo.regular_price || priceInfo.was);

      // Handle case where price is a nested object
      if (price === null && typeof item.price === 'object') {
        price = this.toNumber((item.price as Record<string, unknown>)?.final_price);
      }

      // Discount
      let discount: string | null = null;
      if (priceInfo.discount_percent) {
        discount = `${priceInfo.discount_percent}%`;
      } else if (price && originalPrice && originalPrice > price) {
        discount = `${Math.round((1 - price / originalPrice) * 100)}%`;
      }

      const sku = String(item.sku || item.id || '');
      const imageUrl = (item.image || item.thumbnail || item.image_url || null) as string | null;
      const brand = (item.brand || 'Unknown') as string;
      const isDeal = discount !== null;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model: this.extractModel(title, brand),
        sku: sku || null,
        current_price: price || 0,
        original_price: originalPrice,
        availability: (item.in_stock === false || item.is_saleable === false) ? 'out_of_stock' : 'in_stock',
        product_url: (item.url || item.product_url || '') as string,
        image_urls: imageUrl ? [imageUrl] : [],
        specifications: {},
        category: this.determineCategory(title),
        description_ar: null,
        description_en: null,
        is_deal: isDeal,
        is_free_delivery: !!(item.express_delivery),
        store: this.storeSlug,
        store_name: this.storeName,
      };
    } catch (err) {
      console.error('[Extra] Error parsing API product:', err);
      return null;
    }
  }

  private parseHtmlProduct($: ReturnType<typeof this.getCheerio>, el: ReturnType<ReturnType<typeof this.getCheerio>>): SearchProduct | null {
    try {
      const titleEl = el.find('.product-name a, .product-title a, h2.product-name').first();
      const title = titleEl.text().trim() || 'No title';
      if (title === 'No title') return null;

      const linkEl = el.find("a.product-link, .product-name a, a[href*='/p/']").first();
      const href = linkEl.attr('href') || '';
      const productUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

      const price = this.parsePrice(el.find('.special-price .price, .product-price, .price-box .price').first().text());
      const originalPrice = this.parsePrice(el.find('.old-price .price, .was-price').first().text());

      const imgEl = el.find('img.product-image, .product-image img').first();
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;

      const sku = el.attr('data-sku') || el.attr('data-product-id') || null;
      const brandEl = el.find('.product-brand, .brand-name').first();
      const brand = brandEl.text().trim() || 'Unknown';

      const inStock = el.find('.out-of-stock').length === 0;
      const isDeal = originalPrice !== null && price !== null && originalPrice > price;

      return {
        name_ar: title,
        name_en: title,
        brand,
        model: this.extractModel(title, brand),
        sku,
        current_price: price || 0,
        original_price: originalPrice,
        availability: inStock ? 'in_stock' : 'out_of_stock',
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
      console.error('[Extra] Error parsing HTML product:', err);
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
