import { BaseSearchScraper } from './base-search-scraper';
import type { StoreSearchOptions, StoreSearchResult, SearchProduct } from './types';
import { getBrowserHeaders } from './user-agents';

const BASE_URL = 'https://www.jarir.com';

const KNOWN_BRANDS = [
  'Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Sony', 'LG', 'HP', 'Dell',
  'Lenovo', 'Asus', 'Microsoft', 'Google', 'OnePlus', 'OPPO', 'Vivo',
  'Honor', 'Motorola', 'Nokia', 'Realme', 'Acer', 'MSI', 'Razer',
  'Canon', 'Nikon', 'JBL', 'Bose', 'Anker', 'Logitech',
];

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
        if (page > 1) await this.delay(1000, 2000);

        const url = `${BASE_URL}/sa-en/catalogsearch/result/?q=${encodeURIComponent(query)}&p=${page}`;
        let html: string;
        try {
          html = await this.fetchHtml(url, getBrowserHeaders());
        } catch (err) {
          console.error(`[Jarir] Page ${page} fetch failed:`, err instanceof Error ? err.message : err);
          break;
        }

        const products = this.parsePage(html);
        if (products.length === 0) break;

        for (const p of products) {
          if (p.sku && seenSkus.has(p.sku)) continue;
          if (p.sku) seenSkus.add(p.sku);
          allProducts.push(p);
        }

        console.log(`[Jarir] Page ${page}: ${products.length} items found`);
      }

      // Fetch images from product pages (Jarir search results often lack images)
      await this.fetchProductImages(allProducts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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

  private parsePage(html: string): SearchProduct[] {
    const $ = this.getCheerio(html);
    const products: SearchProduct[] = [];

    $('a[data-product-id]').each((_, el) => {
      const card = $(el);
      const product = this.parseProduct($, card);
      if (product && product.current_price > 0) {
        products.push(product);
      }
    });

    return products;
  }

  private parseProduct($: ReturnType<typeof this.getCheerio>, card: ReturnType<ReturnType<typeof this.getCheerio>>): SearchProduct | null {
    try {
      if (card.prop('tagName')?.toLowerCase() !== 'a') return null;

      const sku = card.attr('data-product-id') || null;
      const href = card.attr('href') || '';
      const productUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

      // Title
      const titleEl = card.find('.product-title__title').first();
      let title = titleEl.text().trim() || 'No title';

      // Specs
      const specBoxes = card.find('.product-title__info .product-title__info--box');
      const specs: string[] = [];
      specBoxes.each((_, s) => {
        const text = $(s).text().trim();
        if (text) specs.push(text);
      });
      if (specs.length > 0) title = `${title} - ${specs.join(' | ')}`;

      if (title === 'No title') return null;

      // Brand
      let brand: string | null = null;
      const lowerTitle = title.toLowerCase();
      for (const b of KNOWN_BRANDS) {
        if (lowerTitle.includes(b.toLowerCase())) { brand = b; break; }
      }

      // Image from search results (may be placeholder, will be refetched)
      const imgEl = card.find('img[src]').first();
      let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;
      if (imageUrl) imageUrl = this.cleanJarirImageUrl(imageUrl);

      // Prices
      let price: number | null = null;
      let originalPrice: number | null = null;

      const fullText = card.text();
      const priceBox = card.find('.price-box').first();
      const priceText = priceBox.length ? priceBox.text() : fullText;
      const priceMatches = priceText.match(/SR\s*([\d,]+)/g) || [];

      const numericPrices = priceMatches
        .map(m => parseInt(m.replace(/[^\d]/g, ''), 10))
        .filter(n => !isNaN(n) && n > 0)
        .sort((a, b) => a - b);

      if (numericPrices.length > 0) {
        price = numericPrices[0];
        if (numericPrices.length > 1 && numericPrices[numericPrices.length - 1] > numericPrices[0]) {
          originalPrice = numericPrices[numericPrices.length - 1];
        }
      }

      // Rating
      let rating: number | null = null;
      const ratingEl = card.find('.rating-result').first();
      if (ratingEl.length) {
        const m = ratingEl.text().match(/(\d+\.?\d*)/);
        if (m) {
          const r = parseFloat(m[1]);
          if (r > 0 && r <= 5) rating = r;
        }
      }

      const inStock = !fullText.toLowerCase().includes('out of stock');
      const isDeal = originalPrice !== null && price !== null && originalPrice > price;

      return {
        name_ar: title,
        name_en: title,
        brand: brand || 'Unknown',
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
      console.error('[Jarir] Error parsing product:', err);
      return null;
    }
  }

  private async fetchProductImages(products: SearchProduct[]): Promise<void> {
    // Fetch images from product pages for items without images
    // Batch to avoid overwhelming the server
    for (const product of products) {
      if (product.image_urls.length > 0) continue;
      if (!product.product_url) continue;

      try {
        await this.delay(200, 500);
        const html = await this.fetchHtml(product.product_url, getBrowserHeaders());
        const $ = this.getCheerio(html);

        // Look for product images on the detail page
        const imgs = $('img[src*="cdn-cgi"], img[src*="ak-asset"]');
        for (let i = 0; i < imgs.length; i++) {
          const imgUrl = $(imgs[i]).attr('src') || $(imgs[i]).attr('data-src');
          if (!imgUrl) continue;
          if (imgUrl.startsWith('data:') || imgUrl.includes('placeholder') || imgUrl.endsWith('.svg') || imgUrl.includes('icon')) continue;
          if (imgUrl.includes('catalog') && !imgUrl.includes('asset')) continue;

          const cleaned = this.cleanJarirImageUrl(imgUrl);
          if (cleaned) {
            product.image_urls = [cleaned];
            break;
          }
        }
      } catch {
        // Silently skip image fetch failures
      }
    }
  }

  private cleanJarirImageUrl(imageUrl: string): string | null {
    if (!imageUrl) return null;

    // Handle Cloudflare CDN URLs - extract the actual asset URL
    if (imageUrl.includes('cdn-cgi/image')) {
      const assetMatch = imageUrl.match(/https:\/\/ak-asset\.jarir\.com\/akeneo-prod\/asset\/([^\s?]+)/);
      if (assetMatch) {
        let url = `https://ak-asset.jarir.com/akeneo-prod/asset/${assetMatch[1]}`;
        if (url.includes('?')) url = url.split('?')[0];
        return url;
      }
      const fallbackMatch = imageUrl.match(/\/asset\/([^\s?]+)/);
      if (fallbackMatch) {
        let url = `https://www.jarir.com/asset/${fallbackMatch[1]}`;
        if (url.includes('?')) url = url.split('?')[0];
        return url;
      }
    }

    // Clean query params for Jarir URLs
    if (imageUrl.includes('jarir.com')) {
      const [base, params] = imageUrl.split('?');
      if (params) {
        const widthMatch = params.match(/width=(\d+)/);
        const heightMatch = params.match(/height=(\d+)/);
        const cleanParams: string[] = [];
        if (widthMatch) cleanParams.push(`width=${widthMatch[1]}`);
        if (heightMatch) cleanParams.push(`height=${heightMatch[1]}`);
        imageUrl = cleanParams.length > 0 ? `${base}?${cleanParams.join('&')}` : base;
      }
    }

    // Ensure full URL
    if (!imageUrl.startsWith('http')) {
      if (imageUrl.startsWith('//')) {
        imageUrl = `https:${imageUrl}`;
      } else {
        imageUrl = `${BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }
    }

    // Filter placeholders
    const placeholders = ['placeholder', 'no-image', 'not-available', 'default', 'missing', 'empty', 'spacer', 'blank', 'transparent', 'loading'];
    if (placeholders.some(kw => imageUrl.toLowerCase().includes(kw))) return null;

    // Filter brand logos (catalog PNGs, not asset PNGs)
    if (imageUrl.includes('akeneo-prod/catalog') && imageUrl.toLowerCase().endsWith('.png')) {
      if (!imageUrl.includes('akeneo-prod/asset')) return null;
    }

    if (imageUrl.length < 10) return null;
    return imageUrl;
  }
}
