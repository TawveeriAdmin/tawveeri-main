import type { ScrapedProduct } from '../base/types';
import type { ProductCategory } from '@/lib/database/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { determineCategory } from '../utils/category-utils';

const ORIGIN = 'https://gcc.luluhypermarket.com';
const LIST_URL = 'https://gcc.luluhypermarket.com/en-sa/list/';

/**
 * LuLu Hypermarket (KSA) scraper.
 *
 * LuLu runs the Akinon commerce platform (Next.js). Two clean, credential-free surfaces
 * (verified 2026-07-27):
 *  - Discovery: the search/list page `…/en-sa/list/?search_text=<q>&page=<n>` server-renders
 *    the product records into the RSC (`self.__next_f`) payload. Each record carries a tight,
 *    consistent field cluster — `price, in_stock, currency_type, retail_price … absolute_url`
 *    (`/<slug>/p/<sku>/`) — which we extract in ONE fetch. The human-readable product name is
 *    the URL slug (LuLu's SEO name). No headless browser needed; plain HTTP works.
 *  - Price refresh: the product page ships a trustworthy schema.org Product JSON-LD
 *    (`offers.price` in SAR, availability, sku) — verified realistic (unlike Carrefour, whose
 *    JSON-LD price is garbage and which is therefore NOT scraped).
 *
 * Never fabricates: a record with no positive price is skipped (unknown beats incorrect).
 */
export class LuluScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('lulu'));
  }

  // LuLu sits behind Cloudflare, which fingerprints and 403s node fetch (undici) even with full
  // browser headers — but a real Chrome passes. So render with Puppeteer and read the RSC HTML.
  // We wait for `domcontentloaded` (NOT networkidle2 — LuLu's ads/tracking never let the network
  // go idle) because the product data is server-rendered inline in the initial HTML (`__next_f`).
  private async fetchRendered(url: string): Promise<string> {
    if (!this.page) {
      await this.initialize();
    }
    if (!this.page) throw new Error('LuLu: failed to initialize browser page');
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout_ms || 45000 });
    await this.delay(500, 900); // let the SSR payload settle in the DOM
    return this.page.content();
  }

  private categoryQuery(category: ProductCategory): string {
    const map: Record<string, string> = {
      smartphone: 'mobile phone',
      laptop: 'laptop',
      tablet: 'tablet',
      tv: 'television',
      audio: 'headphones speakers',
      gaming: 'gaming console',
      camera: 'camera',
      monitor: 'computer monitor',
      printer: 'printer',
      networking: 'router wifi',
      smart_home: 'smart home',
      wearable: 'smartwatch',
      appliance: 'home appliance',
      kitchen: 'kitchen appliance',
      personal_care: 'personal care',
      refrigerator: 'refrigerator',
      accessories: 'electronics accessories',
    };
    return map[category] || category;
  }

  /** Brand from a product name: known brand if present, else the leading token. Never empty. */
  private deriveBrand(name: string): string {
    const KNOWN = ['samsung', 'apple', 'lg', 'sony', 'huawei', 'xiaomi', 'lenovo', 'hp', 'dell', 'asus',
      'acer', 'braun', 'philips', 'panasonic', 'toshiba', 'nikai', 'kenwood', 'black & decker', 'tefal',
      'bosch', 'daewoo', 'hisense', 'tcl', 'realme', 'oppo', 'vivo', 'nokia', 'honor', 'jbl', 'anker',
      'microsoft', 'canon', 'nikon', 'beko', 'midea', 'haier', 'geepas', 'nintendo', 'logitech'];
    const lower = name.toLowerCase();
    const hit = KNOWN.find((b) => lower.includes(b));
    if (hit) return hit.replace(/\b\w/g, (c) => c.toUpperCase());
    const first = name.trim().split(/\s+/)[0];
    return first && first.length > 1 ? first : 'Unknown';
  }

  /** Slug ("golden-wheat-foldable-laptop-table-40x60x28-cm-black") → readable name. */
  private slugToName(slug: string): string {
    return slug
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async discoverProducts(
    category: ProductCategory,
    maxPages: number = 5,
  ): Promise<ScrapedProduct[]> {
    const query = this.categoryQuery(category);
    const out: ScrapedProduct[] = [];
    const seen = new Set<string>();

    try {
      for (let page = 1; page <= maxPages; page++) {
        const url = `${LIST_URL}?search_text=${encodeURIComponent(query)}&page=${page}`;
        let html: string;
        try {
          html = await this.fetchRendered(url);
        } catch (e) {
          console.error(`[LuLu] fetch failed p${page}:`, e instanceof Error ? e.message : e);
          break;
        }
        const products = this.parseListPage(html, category, seen);
        console.log(`[LuLu] ${category} page ${page}: ${products.length} products`);
        if (products.length === 0) break;
        out.push(...products);
        await this.delay();
      }
    } catch (e) {
      console.error('[LuLu] discover error:', e instanceof Error ? e.message : e);
    } finally {
      await this.cleanup();
    }
    return out;
  }

  private parseListPage(
    html: string,
    fallbackCategory: ProductCategory,
    seen: Set<string>,
  ): ScrapedProduct[] {
    // Unescape the RSC payload so the embedded JSON is scannable.
    const u = html.replace(/\\"/g, '"').replace(/\\u002F/gi, '/');
    // Tight, consistent product cluster (verified): price, in_stock, currency, retail_price, …, absolute_url.
    const re =
      /"price":"([\d.]+)","in_stock":(true|false),"currency_type":"(\w+)","retail_price":"([\d.]+)"[^}]*?"absolute_url":"(\/[^"]+\/p\/(\d+)\/)"/g;
    const products: ScrapedProduct[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(u)) !== null) {
      const price = parseFloat(m[1]);
      const inStock = m[2] === 'true';
      const currency = m[3];
      const retail = parseFloat(m[4]);
      const rel = m[5];
      const sku = m[6];
      if (seen.has(sku)) continue;
      // Never emit a fabricated/zero price. SAR only.
      if (!(price > 0) || (currency && currency.toLowerCase() !== 'sar')) continue;
      seen.add(sku);

      const slug = rel.split('/p/')[0].replace(/^\//, '');
      const name = this.slugToName(slug);
      const productUrl = `${ORIGIN}/en-sa${rel}`;
      const hasDiscount = retail > price;

      products.push({
        name_ar: name,
        name_en: name,
        brand: this.deriveBrand(name),
        model: sku, // LuLu list carries no model number; SKU is the stable per-store identifier
        sku,
        current_price: price,
        original_price: hasDiscount ? retail : null,
        availability: inStock ? 'in_stock' : 'out_of_stock',
        product_url: productUrl,
        image_urls: [],
        specifications: {},
        category: determineCategory(name) || fallbackCategory,
        description_ar: null,
        description_en: null,
        is_deal: hasDiscount,
      });
    }
    return products;
  }

  async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null> {
    try {
      const html = await this.fetchRendered(productUrl);
      const $ = this.getCheerio(html);
      let product: ScrapedProduct | null = null;

      $('script[type="application/ld+json"]').each((_, el) => {
        if (product) return;
        const raw = $(el).contents().text();
        if (!raw) return;
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return;
        }
        const node = Array.isArray(json)
          ? (json as Record<string, unknown>[]).find((n) => n['@type'] === 'Product')
          : (json as Record<string, unknown>);
        if (!node || node['@type'] !== 'Product') return;

        const offers = (Array.isArray(node.offers) ? node.offers[0] : node.offers) as
          | Record<string, unknown>
          | undefined;
        const price = offers ? parseFloat(String(offers.price)) : NaN;
        if (!(price > 0)) return; // no valid price → do not fabricate

        const availRaw = String(offers?.availability || '').toLowerCase();
        const availability: ScrapedProduct['availability'] = availRaw.includes('instock')
          ? 'in_stock'
          : availRaw.includes('outofstock')
            ? 'out_of_stock'
            : 'in_stock';
        const name = String(node.name || this.slugToName(productUrl.split('/p/')[0].split('/').pop() || ''));
        const brandNode = node.brand as Record<string, unknown> | string | undefined;
        const brand =
          typeof brandNode === 'string' ? brandNode : String((brandNode as Record<string, unknown>)?.name || '');

        const skuStr = String(node.sku || '');
        product = {
          name_ar: name,
          name_en: name,
          brand: brand || this.deriveBrand(name),
          model: skuStr || this.deriveBrand(name),
          sku: skuStr,
          current_price: price,
          original_price: null,
          availability,
          product_url: productUrl,
          image_urls: Array.isArray(node.image) ? (node.image as string[]).slice(0, 5) : node.image ? [String(node.image)] : [],
          specifications: {},
          category: determineCategory(name) || ('accessories' as ProductCategory),
          description_ar: null,
          description_en: null,
        };
      });

      return product;
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
}
