import { BaseSearchScraper } from './base-search-scraper';
import type { SearchProduct, StoreSearchOptions, StoreSearchResult } from './types';
import { getBrowserHeaders } from './user-agents';

const BASE_URL = 'https://www.almanea.sa';
const PROD_BASE = 'https://almanea.sa';

/** Rewrite dev/staging Almanea URLs to production format. */
function sanitizeAlmaneaUrl(url: string): string {
  if (!url) return url;
  const devPattern = /^https?:\/\/m\.dev-almanea\.com\/(.+)/;
  const match = url.match(devPattern);
  if (match) return `${PROD_BASE}/product/${match[1]}`;
  return url;
}

const SEARCH_PATH_BUILDERS = [
  (query: string, page: number) =>
    `${BASE_URL}/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`,
  (query: string, page: number) =>
    `${BASE_URL}/en/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`,
  (query: string, page: number) =>
    `${BASE_URL}/ar/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`,
  (query: string, page: number) =>
    `${BASE_URL}/search?text=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`,
  (query: string, page: number) =>
    `${BASE_URL}/catalogsearch/result/?q=${encodeURIComponent(query)}${page > 1 ? `&p=${page}` : ''}`,
];

const KNOWN_BRANDS = [
  'apple', 'samsung', 'lg', 'sony', 'hisense', 'tcl', 'haier', 'midea',
  'huawei', 'xiaomi', 'honor', 'lenovo', 'hp', 'dell', 'asus', 'acer',
  'playstation', 'nintendo', 'xbox', 'bose', 'jbl', 'anker', 'canon', 'nikon',
];

export class AlmaneaSearchScraper extends BaseSearchScraper {
  constructor() {
    super('almanea', 'Almanea');
  }

  async search(options: StoreSearchOptions): Promise<StoreSearchResult> {
    const { query, pages } = options;
    const allProducts: SearchProduct[] = [];
    const seenKeys = new Set<string>();
    let lastError: string | null = null;

    try {
      for (let page = 1; page <= pages; page++) {
        if (page > 1) await this.delay(1200, 2200);

        const products = await this.searchPage(query, page);
        if (products.length === 0) {
          break;
        }

        for (const product of products) {
          const uniqueKey = product.sku || product.product_url;
          if (!uniqueKey || seenKeys.has(uniqueKey)) continue;
          seenKeys.add(uniqueKey);
          allProducts.push(product);
        }

        console.log(`[Almanea] Page ${page}: ${products.length} items found`);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[Almanea] Search error:`, lastError);
      if (allProducts.length === 0) {
        return this.errorResult(lastError);
      }
    }

    return {
      products: allProducts,
      store: this.storeSlug,
      storeName: this.storeName,
      count: allProducts.length,
      error: lastError || undefined,
    };
  }

  private async searchPage(query: string, page: number): Promise<SearchProduct[]> {
    let lastError: string | null = null;

    for (const buildUrl of SEARCH_PATH_BUILDERS) {
      const url = buildUrl(query, page);
      try {
        const html = await this.fetchHtml(url, getBrowserHeaders(BASE_URL));
        const parsed = this.parsePage(html, url);
        if (parsed.length > 0) {
          return parsed;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (lastError) {
      throw new Error(lastError);
    }

    return [];
  }

  private parsePage(html: string, sourceUrl: string): SearchProduct[] {
    const fromNextData = this.parseNextData(html);
    if (fromNextData.length > 0) return fromNextData;

    const fromJsonLd = this.parseJsonLd(html);
    if (fromJsonLd.length > 0) return fromJsonLd;

    return this.parseHtmlProducts(html, sourceUrl);
  }

  private parseNextData(html: string): SearchProduct[] {
    const $ = this.getCheerio(html);
    const nextDataScript = $('script#__NEXT_DATA__').first();
    if (!nextDataScript.length) return [];

    try {
      const payload = JSON.parse(nextDataScript.html() || '{}') as Record<string, unknown>;
      const pageProps = (payload.props as Record<string, unknown>)?.pageProps as Record<string, unknown> | undefined;
      const candidates = [
        pageProps?.products,
        pageProps?.searchResults,
        (pageProps?.searchResults as Record<string, unknown> | undefined)?.products,
        pageProps?.catalog,
        (pageProps?.catalog as Record<string, unknown> | undefined)?.products,
        pageProps?.items,
      ];

      const records = candidates.find(Array.isArray) as Array<Record<string, unknown>> | undefined;
      if (!records || records.length === 0) return [];

      return records
        .map((item) => this.parseObjectProduct(item))
        .filter((item): item is SearchProduct => item !== null);
    } catch {
      return [];
    }
  }

  private parseJsonLd(html: string): SearchProduct[] {
    const $ = this.getCheerio(html);
    const products: SearchProduct[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).html() || '';
      if (!raw) return;

      try {
        const data = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
        const entries = Array.isArray(data) ? data : [data];

        for (const entry of entries) {
          const type = String(entry['@type'] || '');
          if (type === 'Product') {
            const parsed = this.parseObjectProduct(entry);
            if (parsed) products.push(parsed);
            continue;
          }

          if (type === 'ItemList' && Array.isArray(entry.itemListElement)) {
            for (const item of entry.itemListElement as Array<Record<string, unknown>>) {
              const nested = (item.item as Record<string, unknown>) || item;
              const parsed = this.parseObjectProduct(nested);
              if (parsed) products.push(parsed);
            }
          }
        }
      } catch {
        // ignore invalid JSON-LD blocks
      }
    });

    return products;
  }

  private parseHtmlProducts(html: string, sourceUrl: string): SearchProduct[] {
    const $ = this.getCheerio(html);
    const products: SearchProduct[] = [];

    const selectors = [
      '.product-item',
      '.product-card',
      '[data-product-id]',
      '.products-grid li',
      "a[href*='/product/']",
      "a[href*='/p/']",
    ];

    for (const selector of selectors) {
      const cards = $(selector);
      if (!cards.length) continue;

      cards.each((_, el) => {
        const parsed = this.parseHtmlProduct($, $(el), sourceUrl);
        if (parsed) products.push(parsed);
      });

      if (products.length > 0) {
        break;
      }
    }

    return products;
  }

  private parseHtmlProduct(
    $: ReturnType<typeof this.getCheerio>,
    card: ReturnType<ReturnType<typeof this.getCheerio>>,
    sourceUrl: string
  ): SearchProduct | null {
    const title = card
      .find('.product-name, .product-title, h2, h3, [class*="title"]')
      .first()
      .text()
      .trim();

    if (!title) return null;

    const link = card.find("a[href*='/product/'], a[href*='/p/'], a[href]").first().attr('href') || '';
    const productUrl = this.normalizeUrl(link, sourceUrl);

    const priceText = card
      .find('.price, .product-price, .special-price, [class*="price"]')
      .first()
      .text();
    const price = this.parsePrice(priceText);
    if (!price || price <= 0) return null;

    const originalPriceText = card
      .find('.old-price, .original-price, .regular-price, del')
      .first()
      .text();
    const originalPrice = this.parsePrice(originalPriceText);

    const image =
      card.find('img').first().attr('src') ||
      card.find('img').first().attr('data-src') ||
      card.find('img').first().attr('data-lazy-src') ||
      null;

    const sku =
      card.attr('data-product-id') ||
      card.attr('data-sku') ||
      card.find('[data-product-id]').attr('data-product-id') ||
      this.extractSkuFromUrl(productUrl);

    const brandText = card.find('.brand, .product-brand, [class*="brand"]').first().text().trim();
    const brand = this.extractBrand(title, brandText || null);

    const outOfStock = card.text().toLowerCase().includes('out of stock');
    const isDeal = Boolean(originalPrice && originalPrice > price);

    return {
      name_ar: title,
      name_en: title,
      brand,
      model: this.extractModel(title, brand),
      sku,
      current_price: price,
      original_price: originalPrice,
      availability: outOfStock ? 'out_of_stock' : 'in_stock',
      product_url: productUrl,
      image_urls: image ? [this.normalizeUrl(image, BASE_URL)] : [],
      specifications: {},
      category: this.determineCategory(title),
      description_ar: null,
      description_en: null,
      is_deal: isDeal,
      is_free_delivery: false,
      store: this.storeSlug,
      store_name: this.storeName,
    };
  }

  private parseObjectProduct(item: Record<string, unknown>): SearchProduct | null {
    const title = String(item.name || item.title || '').trim();
    if (!title) return null;

    const sku = String(item.sku || item.id || item.product_id || '').trim() || null;
    const pricesWithTax = item.prices_with_tax as Record<string, unknown> | undefined;
    const offers = item.offers as Record<string, unknown> | undefined;
    const priceData = item.price_data as Record<string, unknown> | undefined;

    // Extract regular/base price
    const regularPrice = this.toNumber(
      item.price || pricesWithTax?.price || pricesWithTax?.original_price ||
        offers?.price || priceData?.current
    );

    // Extract discounted/sale price (check dedicated discount fields first)
    const discountedPrice = this.toNumber(
      pricesWithTax?.discounted_price || item.special_price ||
        item.sale_price || item.discounted_price || priceData?.discounted
    );

    // Use discounted price as current if it's a valid discount
    const price = (discountedPrice && regularPrice && discountedPrice < regularPrice)
      ? discountedPrice
      : (regularPrice || discountedPrice);
    if (!price || price <= 0) return null;

    // Original price: use regular price when there's a discount, otherwise check explicit fields
    const originalPrice = (discountedPrice && regularPrice && discountedPrice < regularPrice)
      ? regularPrice
      : this.toNumber(
          item.original_price || pricesWithTax?.original_price ||
            offers?.highPrice || priceData?.original
        );

    const rewriteUrl = this.stringFromUnknown(item.rewrite_url);
    const href = String(item.url || item.product_url || item.link || rewriteUrl || '').trim();
    const productUrl = this.normalizeUrl(href, BASE_URL);

    const image =
      this.stringFromUnknown(item.image) ||
      this.stringFromUnknown(item.image_url) ||
      this.stringFromUnknown(item.thumbnail) ||
      this.stringFromUnknown(item.thumbnail_url);

    const brand = this.extractBrand(
      title,
      this.stringFromUnknown(item.brand) ||
        this.stringFromUnknown((item.brand as Record<string, unknown> | undefined)?.name)
    );

    const availabilityRaw = String(
      item.availability || (item.offers as Record<string, unknown> | undefined)?.availability || 'in_stock'
    ).toLowerCase();
    const stockByRegion = item.stock_region_ids as Record<string, unknown> | undefined;
    const hasAnyStock = stockByRegion
      ? Object.values(stockByRegion).some((stock) => {
          const parsed = this.toNumber(stock);
          return parsed !== null && parsed > 0;
        })
      : true;
    const availability = (
      availabilityRaw.includes('outofstock') ||
      availabilityRaw.includes('out_of_stock') ||
      availabilityRaw.includes('out of stock') ||
      availabilityRaw.includes('sold_out') ||
      availabilityRaw.includes('sold out') ||
      !hasAnyStock
    )
      ? 'out_of_stock'
      : 'in_stock';

    const isDeal = Boolean(originalPrice && originalPrice > price);

    return {
      name_ar: title,
      name_en: title,
      brand,
      model: this.extractModel(title, brand),
      sku,
      current_price: price,
      original_price: originalPrice,
      availability,
      product_url: productUrl,
      image_urls: image ? [this.normalizeUrl(image, BASE_URL)] : [],
      specifications: {},
      category: this.determineCategory(title),
      description_ar: null,
      description_en: null,
      is_deal: isDeal,
      is_free_delivery: false,
      store: this.storeSlug,
      store_name: this.storeName,
    };
  }

  private extractBrand(title: string, brandFromSource: string | null): string {
    const source = (brandFromSource || '').trim();
    if (source && source.toLowerCase() !== 'unknown') {
      return source;
    }

    const lowerTitle = title.toLowerCase();
    const matched = KNOWN_BRANDS.find((brand) => lowerTitle.includes(brand));
    if (!matched) return 'Unknown';
    if (matched === 'lg') return 'LG';
    if (matched === 'hp') return 'HP';
    return matched.charAt(0).toUpperCase() + matched.slice(1);
  }

  private extractSkuFromUrl(url: string): string | null {
    if (!url) return null;

    const matches = [
      url.match(/\/p\/([a-z0-9_-]{4,})/i),
      url.match(/\/product\/([a-z0-9_-]{4,})/i),
      url.match(/[?&](sku|id|pid)=([a-z0-9_-]{4,})/i),
    ];

    for (const match of matches) {
      if (!match) continue;
      return match[2] || match[1] || null;
    }

    return null;
  }

  private normalizeUrl(url: string, base: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return sanitizeAlmaneaUrl(url);
    if (url.startsWith('//')) return sanitizeAlmaneaUrl(`https:${url}`);

    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const normalizedPath = url.startsWith('/') ? url : `/${url}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const normalized = String(value).replace(/[^\d.]/g, '');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private stringFromUnknown(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    if (value && typeof value === 'object' && 'url' in value) {
      const url = (value as Record<string, unknown>).url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
    return null;
  }
}
