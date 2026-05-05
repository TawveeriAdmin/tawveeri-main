import type { ScrapedProduct } from '../base/types';
import type { ProductCategory } from '@/lib/database/types';
import { BaseScraper } from '../base/base-scraper';
import { loadStoreConfig } from '../config/scraper-config';
import { classifyFromTitle } from '../utils/category-utils';

const PROD_BASE = 'https://www.almanea.sa';

// Almanea's Next.js consumer site hits Algolia directly for catalog
// browse and search. The raw category URLs only ever render page 1 in
// the SSR HTML — real pagination goes through Algolia's `/queries`
// endpoint. The app ships the search-only API key in its JS bundle, so
// calling Algolia the same way the browser does is fair game.
//
// Discovered by inspecting `_next/static/chunks/pages/_app-*.js`:
//   App ID:  WCK19QC65I
//   Search key: be7745237f5f94f715b088f48b1708b8  (public, search-only)
//   Production indexes:
//     prod_headless_ar_products  (Arabic)
//     prod_headless_en_products  (English)
const ALGOLIA_APP_ID = 'WCK19QC65I';
const ALGOLIA_SEARCH_KEY = 'be7745237f5f94f715b088f48b1708b8';
const ALGOLIA_ENDPOINT = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes`;
const AR_INDEX = 'prod_headless_ar_products';
const EN_INDEX = 'prod_headless_en_products';
const HITS_PER_PAGE = 100;

/**
 * Almanea categorises every product with their own `categoryIds` tree.
 * The facets dump + site nav gave us these top-level category IDs — when
 * `classifyFromTitle` can't infer a category from the product name, we
 * fall back to the store's own tagging so legitimate items like
 * "HP DeskJet 2630" (no "printer" keyword in title) still land in the
 * right bucket. Almanea IS an electronics-only retailer, so we can trust
 * their tags instead of filtering products out on a title miss.
 *
 * Anything not covered by this map gets the `category` field set from
 * the scraper's default; `ProductService` then overrides with the
 * title-based classifier when it's confident, so this is just a safety
 * net rather than a hard authority.
 */
const ALMANEA_CATEGORY_MAP: Record<string, ProductCategory> = {
  // /home-appliances-c-7364 — large home appliances umbrella
  '7364': 'appliance',
  // /small-appliances-c-523 — small appliances (vacuums, irons, etc.)
  '523': 'appliance',
  // /kitchen-appliances-c-534 — kitchen gadgets
  '534': 'kitchen',
  // /computers-c-7434 — laptops, desktops, monitors etc.
  '7434': 'laptop',
  '7436': 'laptop',        // /computers/laptops-c-7436
  // /mobiles-tablets-c-7423 — phones, tablets, audio
  '7423': 'smartphone',
  '7424': 'smartphone',    // /mobiles-tablets/mobiles-20
  '7426': 'audio',         // /mobiles-tablets/portable-audio-c-7426
  // /tvs-audio-c-522 — televisions, soundbars, speakers
  '522': 'tv',
  // /gaming-c-519 — consoles, games, accessories
  '519': 'gaming',
  // /home-appliances subpaths
  '7333': 'refrigerator',  // /home-appliances/refrigerators-c-7333
  '7334': 'appliance',     // /home-appliances/cookers-c-7334
  '7336': 'appliance',     // /home-appliances/washing-machines-c-7336
  '7338': 'appliance',     // /home-appliances/dishwashers-c-7338
  // /kitchen-appliances subpaths
  '536': 'kitchen',        // food-preparation-appliances
  '538': 'kitchen',        // hot-beverage-makers (coffee etc.)
};

interface AlgoliaHit {
  objectID?: string;
  sku?: string | number;
  name?: string;
  brand?: string;
  model?: string;
  image_url?: string;
  thumbnail_url?: string;
  url?: string;
  rewrite_url?: string;
  prices_with_tax?: {
    price?: number;
    original_price?: number;
    discounted_price?: number;
    discounted_percentage?: number;
  };
  price?: number;
  categoryIds?: string[];
  rating_summary?: number;
  stock_region_ids?: Record<string, number>;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  nbPages: number;
  page: number;
}

interface AlgoliaBrowseResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  /** When present the caller should POST back with this cursor for the next page. Absent = last page. */
  cursor?: string;
}

/** Normalize any Algolia field that could be a scalar, array, or object into a clean string. */
function firstString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    for (const v of val) {
      const s = firstString(v);
      if (s) return s;
    }
    return '';
  }
  if (typeof val === 'object') {
    for (const v of Object.values(val as Record<string, unknown>)) {
      const s = firstString(v);
      if (s) return s;
    }
    return '';
  }
  return '';
}

/**
 * Almanea (المنيع) store scraper.
 *
 * Uses Algolia directly for discovery — the consumer site's own front-end
 * does the same, so there's no JS-render or Cloudflare-evasion work needed.
 * A single seed run over ~40 Algolia pages covers the whole ~3.9K-product
 * catalog in Arabic and (optionally) again in English for bilingual titles.
 */
export class AlmaneaScraper extends BaseScraper {
  constructor() {
    super(loadStoreConfig('almanea'));
  }

  /**
   * Discover products via Algolia. `category` is accepted for API-compat
   * with the orchestrator but we fetch the full catalog in one sweep and
   * let `classifyFromTitle` (called downstream in ProductService) assign
   * categories from product titles, same pattern as NoonScraper.
   *
   * Returns the merged AR+EN bilingual set: Arabic titles are primary;
   * each product's English title is filled in from the EN index when the
   * SKU matches.
   */
  async discoverProducts(
    category: ProductCategory,
    maxPages: number = 50,
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    const enBySku = new Map<string, { name: string; brand?: string }>();

    const seenArSkus = new Set<string>();

    try {
      // Pass 1 — English index. Keeping this first so we can look up
      // English titles by SKU when processing AR hits below.
      try {
        for await (const hit of this.iterateAlgolia(EN_INDEX, maxPages, category)) {
          const sku = firstString(hit.sku ?? hit.objectID);
          if (!sku || enBySku.has(sku)) continue;
          enBySku.set(sku, { name: firstString(hit.name), brand: firstString(hit.brand) });
        }
      } catch (err) {
        console.warn(`[Almanea] EN index unreachable — AR-only titles`, err instanceof Error ? err.message : err);
      }

      // Pass 2 — Arabic index drives the product set. Products that
      // belong to multiple categories get yielded multiple times by the
      // category-facet iteration — skip SKUs we've already processed.
      for await (const hit of this.iterateAlgolia(AR_INDEX, maxPages, category)) {
        const sku = firstString(hit.sku ?? hit.objectID);
        if (!sku || seenArSkus.has(sku)) continue;
        seenArSkus.add(sku);
        const parsed = this.hitToScrapedProduct(hit, enBySku);
        if (parsed) products.push(parsed);
      }
    } catch (err) {
      this.logError({
        type: 'network',
        message: `Algolia discovery failed: ${err instanceof Error ? err.message : String(err)}`,
        url: ALGOLIA_ENDPOINT,
        timestamp: new Date().toISOString(),
      });
    }

    return products;
  }

  async updateProductPrice(productUrl: string): Promise<ScrapedProduct | null> {
    // URL pattern: https://www.almanea.sa/.../-p-<numeric-sku>
    const skuMatch = productUrl.match(/-p-(\d+)/);
    if (!skuMatch) return null;
    const sku = skuMatch[1];

    try {
      const body = JSON.stringify({
        params: `query=${encodeURIComponent(sku)}&hitsPerPage=1&page=0`,
      });
      const data = await this.algoliaQuery<AlgoliaResponse>(AR_INDEX, body);
      const hit = data.hits?.[0];
      if (!hit) return null;
      return this.hitToScrapedProduct(hit, new Map());
    } catch (err) {
      this.logError({
        type: 'network',
        message: `Almanea price update failed for ${productUrl}: ${err instanceof Error ? err.message : String(err)}`,
        url: productUrl,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  private async *iterateAlgolia(
    indexName: string,
    maxPagesPerCategory: number,
    category: ProductCategory,
  ): AsyncGenerator<AlgoliaHit> {
    // Algolia's /query endpoint caps pagination at 1000 results regardless
    // of nbHits (paginationLimitedTo). The /browse endpoint is ACL-gated
    // and returns 403 for the public search key. Workaround: fan out by
    // category facet — every top-level+sub category has <1000 products
    // and products belonging to multiple categories get yielded multiple
    // times; the outer discoverProducts() dedupes by SKU.
    const availableCategoryIds = await this.fetchCategoryIds(indexName);
    const targetCategoryIds = this.getCategoryFacetIds(category);
    const categoryIds = targetCategoryIds.length > 0
      ? targetCategoryIds.filter((id) => availableCategoryIds.includes(id))
      : availableCategoryIds;
    console.log(`[Almanea] ${indexName}: ${categoryIds.length} ${category} category facets to iterate`);

    for (let i = 0; i < categoryIds.length; i++) {
      const catId = categoryIds[i];
      let page = 0;
      while (page < maxPagesPerCategory) {
        const body = JSON.stringify({
          params:
            `query=&hitsPerPage=${HITS_PER_PAGE}&page=${page}` +
            `&filters=${encodeURIComponent(`categoryIds:"${catId}"`)}`,
        });
        const data = await this.algoliaQuery<AlgoliaResponse>(indexName, body);
        const hits = data.hits ?? [];
        if (hits.length === 0) break;
        if (page === 0) {
          console.log(`[Almanea] ${indexName} cat ${catId} (${i + 1}/${categoryIds.length}): ${data.nbHits} products`);
        }
        for (const hit of hits) yield hit;
        if (page + 1 >= Math.min(data.nbPages ?? 0, 10)) break;
        page++;
        await this.delay();
      }
      await this.delay();
    }
  }

  private getCategoryFacetIds(category: ProductCategory): string[] {
    return Object.entries(ALMANEA_CATEGORY_MAP)
      .filter(([, mappedCategory]) => mappedCategory === category)
      .map(([categoryId]) => categoryId);
  }

  /** Fetch the list of distinct categoryIds via Algolia facets. One request. */
  private async fetchCategoryIds(indexName: string): Promise<string[]> {
    const body = JSON.stringify({
      params:
        'query=&hitsPerPage=0' +
        '&facets=' + encodeURIComponent('["categoryIds"]') +
        '&maxValuesPerFacet=500',
    });
    const data = await this.algoliaQuery<AlgoliaResponse & { facets?: Record<string, Record<string, number>> }>(indexName, body);
    const facets = data.facets?.categoryIds ?? {};
    return Object.keys(facets);
  }

  private async algoliaQuery<T>(indexName: string, body: string): Promise<T> {
    const url = `${ALGOLIA_ENDPOINT}/${indexName}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Algolia-API-Key': ALGOLIA_SEARCH_KEY,
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`Algolia ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  private hitToScrapedProduct(
    hit: AlgoliaHit,
    enBySku: Map<string, { name: string; brand?: string }>,
  ): ScrapedProduct | null {
    // Almanea's Algolia docs have inconsistent shapes — some fields come
    // back as strings, some as arrays (`["HM90GF-20"]`), some as maps.
    // `firstString` normalises everything to a clean scalar.
    const nameAr = firstString(hit.name).trim();
    const sku = firstString(hit.sku ?? hit.objectID).trim();
    if (!nameAr || nameAr.length < 3 || !sku) return null;

    const pricing = hit.prices_with_tax || {};
    const currentPrice = this.toNumber(pricing.price) ?? this.toNumber(hit.price);
    const originalPrice = this.toNumber(pricing.original_price);
    if (!currentPrice || currentPrice <= 0) return null;

    // Category resolution with graceful fallback. classifyFromTitle is
    // preferred when it's confident (returns a specific enum), but many
    // Almanea titles are terse SKUs ("HP DeskJet 2630", "Dell U2723QE")
    // that no title-keyword list can cover. For those we fall back to
    // Almanea's own categoryIds tree via ALMANEA_CATEGORY_MAP, then
    // finally default to 'accessories' — because Almanea is an
    // electronics-only retailer, every product in their catalog is
    // electronics by definition; dropping rows on a title miss would
    // lose ~40% of the catalog for zero benefit.
    const nameEn = (enBySku.get(sku)?.name || '').trim() || nameAr;
    const titleCategory = classifyFromTitle(nameEn) ?? classifyFromTitle(nameAr);
    let category: ProductCategory | null = titleCategory;
    if (!category && Array.isArray(hit.categoryIds)) {
      for (const catId of hit.categoryIds) {
        const mapped = ALMANEA_CATEGORY_MAP[String(catId)];
        if (mapped) {
          category = mapped;
          break;
        }
      }
    }
    if (!category) category = 'accessories';

    const brand = (firstString(hit.brand) || enBySku.get(sku)?.brand || 'Unknown').trim() || 'Unknown';
    const modelRaw = firstString(hit.model).trim();
    const model = modelRaw || this.extractModelFromTitle(nameEn, brand);

    const rewriteUrl = firstString(hit.rewrite_url).trim();
    const productUrl = rewriteUrl ? `${PROD_BASE}/${rewriteUrl}` : `${PROD_BASE}/product/${sku}`;

    const imageUrl = firstString(hit.image_url).trim() || firstString(hit.thumbnail_url).trim() || null;
    // In-stock if any region has positive inventory. stock_region_ids is
    // {regionId: qty} — empty or all-zero means effectively out of stock.
    const hasStock = hit.stock_region_ids
      ? Object.values(hit.stock_region_ids).some((q) => (q || 0) > 0)
      : true;

    const hasDiscount = !!originalPrice && originalPrice > currentPrice;

    return {
      name_ar: nameAr,
      name_en: nameEn,
      brand,
      model: model || nameEn.slice(0, 80),
      sku,
      current_price: currentPrice,
      original_price: hasDiscount ? originalPrice : null,
      availability: hasStock ? 'in_stock' : 'out_of_stock',
      product_url: productUrl,
      image_urls: imageUrl ? [imageUrl] : [],
      specifications: {},
      category,
      description_ar: null,
      description_en: null,
      is_deal: hasDiscount,
      is_free_delivery: false,
    };
  }

  private extractModelFromTitle(title: string, brand: string): string {
    let model = title;
    if (brand && brand !== 'Unknown') {
      model = model.replace(new RegExp(brand, 'gi'), '').trim();
    }
    return model.split(' ').slice(0, 4).join(' ') || title;
  }

  private toNumber(val: unknown): number | null {
    if (val === null || val === undefined) return null;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(n) ? null : n;
  }
}
