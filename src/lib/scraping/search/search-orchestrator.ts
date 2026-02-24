import type { ScrapedSearchResult } from '../search-types';
import type { SearchProduct, StoreSearchResult } from './types';
import { AmazonSearchScraper } from './amazon-search-scraper';
import { NoonSearchScraper } from './noon-search-scraper';
import { JarirSearchScraper } from './jarir-search-scraper';
import { ExtraSearchScraper } from './extra-search-scraper';
import { AlmaneaSearchScraper } from './almanea-search-scraper';
import { matchesCategory } from '../utils/category-utils';
import type { ProductCategory } from '@/lib/database/types';
import { groupSearchProducts, type GroupedSearchProduct } from './product-grouper';
import { normalizeSearchStores } from './store-registry';

const SCRAPERS: Record<string, () => { search: (opts: { query: string; pages: number }) => Promise<StoreSearchResult> }> = {
  amazon: () => new AmazonSearchScraper(),
  noon: () => new NoonSearchScraper(),
  jarir: () => new JarirSearchScraper(),
  extra: () => new ExtraSearchScraper(),
  almanea: () => new AlmaneaSearchScraper(),
};

const STORE_SEARCH_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, store: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms while searching ${store}`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }) as Promise<T>;
}

export async function searchAllStores(
  query: string,
  stores: string[],
  pages: number,
  sort: string = 'relevance',
  category?: ProductCategory,
): Promise<ScrapedSearchResult> {
  const startTime = Date.now();

  const validStores = normalizeSearchStores(stores).filter(s => s in SCRAPERS);
  if (validStores.length === 0) {
    return {
      products: [],
      count: 0,
      query,
      storeResults: {},
      priceStats: { min: null, max: null, avg: null },
      searchTime: 0,
      errors: { general: 'No valid stores selected' },
    };
  }

  // Run all scrapers in parallel
  const results = await Promise.allSettled(
    validStores.map(store => {
      const scraper = SCRAPERS[store]();
      return withTimeout(
        scraper.search({ query, pages }),
        STORE_SEARCH_TIMEOUT_MS,
        store
      );
    }),
  );

  const allProducts: SearchProduct[] = [];
  const storeResults: Record<string, number> = {};
  const errors: Record<string, string> = {};
  const storeRankMap = new Map<SearchProduct, number>();

  for (let i = 0; i < validStores.length; i++) {
    const store = validStores[i];
    const result = results[i];

    if (result.status === 'fulfilled') {
      const { products, error } = result.value;
      storeResults[store] = products.length;
      // Track each product's position within its store's results
      for (let rank = 0; rank < products.length; rank++) {
        storeRankMap.set(products[rank], rank);
      }
      allProducts.push(...products);
      if (error) errors[store] = error;
    } else {
      storeResults[store] = 0;
      errors[store] = result.reason instanceof Error ? result.reason.message : String(result.reason);
    }
  }

  // Filter by category if specified
  if (category) {
    const beforeCount = allProducts.length;
    const filtered = allProducts.filter(p => matchesCategory(p, category));
    if (filtered.length > 0 || beforeCount > 0) {
      allProducts.length = 0;
      allProducts.push(...filtered);
      console.log(`[SearchOrchestrator] Category filter "${category}": ${beforeCount} -> ${allProducts.length} products`);
    }
  }

  // Filter out completely irrelevant results (no query word overlap at all)
  {
    const queryWords = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 2);
    if (queryWords.length > 0) {
      // Build stems: "laptops" -> ["laptops", "laptop"], "monitors" -> ["monitors", "monitor"]
      const queryStems = queryWords.flatMap(w => {
        const stems = [w];
        if (w.endsWith('s') && w.length > 3) stems.push(w.slice(0, -1));
        if (w.endsWith('es') && w.length > 4) stems.push(w.slice(0, -2));
        return stems;
      });

      // Known prefixes that form valid compound words with the stem
      // e.g. "smart" + "phone" = "smartphone", "i" + "phone" = "iphone"
      // But "ear" + "phone" ≠ a valid match for searching "phones"
      const VALID_COMPOUND_PREFIXES = ['smart', 'i', 'e', 'my'];

      const beforeCount = allProducts.length;
      const relevant = allProducts.filter(p => {
        const title = (p.name_en || p.name_ar || '').toLowerCase();
        const titleWords = title.split(/[\s,/()[\]-]+/).filter(w => w.length > 0);
        return queryStems.some(stem =>
          titleWords.some(word =>
            // Exact word match: "phone" = "phone"
            word === stem ||
            // Word starts with stem: "phones" starts with "phone"
            word.startsWith(stem) ||
            // Valid compound: "smartphone" = "smart" + "phone", "iphone" = "i" + "phone"
            (word.endsWith(stem) && VALID_COMPOUND_PREFIXES.includes(word.slice(0, word.length - stem.length)))
          )
        );
      });
      if (relevant.length > 0) {
        allProducts.length = 0;
        allProducts.push(...relevant);
        if (beforeCount > relevant.length) {
          console.log(`[SearchOrchestrator] Relevance filter: ${beforeCount} -> ${allProducts.length} products`);
        }
      }
    }
  }

  // Group products from different stores that represent the same product
  const grouped = groupSearchProducts(allProducts, query);
  console.log(`[SearchOrchestrator] Grouped ${allProducts.length} products into ${grouped.length} groups`);

  // Sort grouped products
  sortGroupedProducts(grouped, sort, query, storeRankMap);

  // Price stats (based on best prices per group)
  const prices = grouped.map(p => p.best_price).filter(p => p > 0);
  const priceStats = {
    min: prices.length > 0 ? Math.min(...prices) : null,
    max: prices.length > 0 ? Math.max(...prices) : null,
    avg: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
  };

  const searchTime = (Date.now() - startTime) / 1000;

  return {
    products: grouped,
    count: grouped.length,
    query,
    storeResults,
    priceStats,
    searchTime: Math.round(searchTime * 100) / 100,
    errors: Object.keys(errors).length > 0 ? errors : null,
  };
}

/**
 * Accessory keywords — products containing these are deprioritized
 * when the search query itself does NOT contain them.
 */
const ACCESSORY_KEYWORDS = [
  'case', 'cover', 'protector', 'screen protector', 'tempered glass',
  'holder', 'stand', 'mount', 'charger', 'cable', 'adapter', 'hub',
  'sleeve', 'pouch', 'bag', 'skin', 'sticker', 'decal', 'film',
  'lens protector', 'camera protector', 'camera lens', 'back cover', 'bumper',
  'grip', 'ring', 'strap', 'band', 'dock', 'cradle', 'wallet',
  'folio', 'shell', 'armor', 'armour', 'shield', 'guard',
  'magsafe', 'kickstand', 'rugged', 'shockproof', 'tpu', 'silicone',
  'privacy screen', 'privacy glass', 'privacy filter', 'anti-spy',
  '3in1', '3-in-1', '2in1', '2-in-1', 'bundle pack',
  'كفر', 'جراب', 'حافظة', 'حماية', 'شاحن', 'كيبل', 'سلك',
  'لاصق', 'واقي', 'واقي شاشة', 'غطاء', 'حامل', 'ستاند',
  'توصيلة', 'محول', 'قلم', 'ملصق',
];

/**
 * Known accessory/case brands. If the title starts with one of these
 * and the query doesn't mention them, it's almost certainly an accessory.
 */
const ACCESSORY_BRANDS = [
  'tech21', 'spigen', 'otterbox', 'otter box', 'casetify', 'caseology',
  'ringke', 'uag', 'urban armor', 'esr', 'supcase', 'poetic',
  'mous', 'totallee', 'pitaka', 'dbrand', 'zagg', 'belkin',
  'anker', 'baseus', 'nillkin', 'mofi', 'dux ducis', 'torras',
  'rhinoshield', 'catalyst', 'lifeproof', 'incipio', 'moshi',
  'elago', 'vrs design', 'ghostek', 'raptic', 'smartish',
  'xonda', 'panzerglass', 'amazingthing', 'amazing thing',
  'ugreen', 'jsaux', 'benks', 'switcheasy', 'uniq', 'laut',
  'care by', 'green lion', 'devia', 'hoco', 'rock', 'joyroom',
];

/**
 * Patterns that indicate "this product is FOR another product" (i.e. an accessory).
 * Matched against the full title.
 */
const ACCESSORY_PREPOSITION_PATTERNS = [
  /\bfor\s+/i,
  /\bcompatible\s+with\b/i,
  /\bfits\s+/i,
  /\bdesigned\s+for\b/i,
  /\bsuitable\s+for\b/i,
  /\bworks\s+with\b/i,
  /\bمتوافق\s+مع\b/,
  /\bمناسب\s+لـ?\b/,
  /\bيناسب\b/,
  /\bلجهاز\b/,
  /\bلهاتف\b/,
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a word appears as a whole word in text (word-boundary matching).
 * For short words (<=2 chars) or numbers, uses looser matching.
 */
function wordMatch(text: string, word: string): boolean {
  // For very short words or pure numbers, use includes (boundaries are unreliable)
  if (word.length <= 2 || /^\d+$/.test(word)) {
    return text.includes(word);
  }
  const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
  return pattern.test(text);
}

/**
 * Calculate a relevance score for a product against a search query.
 * Higher score = more relevant. Uses multiple signals:
 *
 * 1. Exact phrase match (+100)
 * 2. Word overlap with word-boundary matching (+50 scaled)
 * 3. Consecutive word (bigram) bonus (+20 each)
 * 4. Store ranking position bonus (up to +25)
 * 5. Title brevity bonus (up to +15)
 * 6. Price proximity to median bonus (up to +20)
 * 7. Accessory keyword penalty (-60)
 * 8. "For X" preposition pattern penalty (-40)
 */
function calculateRelevance(
  product: SearchProduct,
  query: string,
  storeRank: number,
  medianPrice: number | null,
): number {
  const title = (product.name_en || product.name_ar || '').toLowerCase();
  const q = query.toLowerCase().trim();
  const queryWords = q.split(/\s+/).filter(w => w.length > 0);

  if (!title || queryWords.length === 0) return 0;

  let score = 0;

  // ── Signal 1: Exact phrase match (strongest signal) ──
  if (title.includes(q)) {
    score += 100;
  }

  // ── Signal 2: Word overlap with word-boundary matching ──
  const matchedWords = queryWords.filter(w => wordMatch(title, w));
  const wordOverlap = matchedWords.length / queryWords.length;
  score += wordOverlap * 50;

  // ── Signal 3: Consecutive word (bigram) match bonus ──
  for (let i = 0; i < queryWords.length - 1; i++) {
    const bigram = queryWords[i] + ' ' + queryWords[i + 1];
    if (title.includes(bigram)) {
      score += 20;
    }
  }

  // ── Signal 4: Store ranking position ──
  // Products ranked higher by the store's own algorithm get a bonus.
  // Top result = +25, decaying as rank increases.
  const rankBonus = Math.max(0, 25 - storeRank * 1.5);
  score += rankBonus;

  // ── Signal 5: Title brevity bonus ──
  // Shorter titles that still match are usually the actual product.
  const titleWords = title.split(/\s+/).length;
  if (titleWords > 0 && wordOverlap > 0.5) {
    const brevityRatio = queryWords.length / titleWords;
    score += Math.min(brevityRatio * 15, 15);
  }

  // ── Signal 6: Price proximity to median ──
  // Products priced near or above the median are likely the main product.
  // Products far below median are likely accessories (case at 89 SAR vs phone at 4000 SAR).
  if (medianPrice && medianPrice > 0 && product.current_price > 0) {
    const priceRatio = product.current_price / medianPrice;
    if (priceRatio >= 0.5) {
      // At or above half the median — likely the real product
      score += Math.min(priceRatio * 15, 25);
    } else if (priceRatio < 0.05) {
      // Less than 5% of median (e.g. 39 SAR vs 4000 SAR) — almost certainly an accessory
      score -= 150;
    } else if (priceRatio < 0.1) {
      // Less than 10% of median (e.g. 89 SAR vs 4000 SAR) — very likely an accessory
      score -= 100;
    } else if (priceRatio < 0.25) {
      // Less than 25% of median — likely an accessory
      score -= 60;
    } else {
      // 25-50% of median — possibly an accessory
      score -= 25;
    }
  }

  // ── Signal 7: Accessory keyword penalty ──
  const queryIsAccessory = ACCESSORY_KEYWORDS.some(kw => q.includes(kw));
  if (!queryIsAccessory) {
    const matchedAccessoryKeywords = ACCESSORY_KEYWORDS.filter(kw => title.includes(kw));
    if (matchedAccessoryKeywords.length > 0) {
      // Strong penalty — accessories should never rank above actual products
      score -= 120 + (matchedAccessoryKeywords.length - 1) * 30;
    }
  }

  // ── Signal 8: "For X" preposition pattern penalty ──
  // "Case for iPhone 15 Pro" or "Compatible with Galaxy S24" = accessory
  if (!queryIsAccessory) {
    const hasAccessoryPreposition = ACCESSORY_PREPOSITION_PATTERNS.some(p => p.test(title));
    if (hasAccessoryPreposition) {
      score -= 80;
    }
  }

  // ── Signal 9: Known accessory brand penalty ──
  // If the title starts with a known case/accessory brand not in the query
  if (!queryIsAccessory) {
    const titleLower = title.toLowerCase();
    const queryLower = q.toLowerCase();
    const isAccessoryBrand = ACCESSORY_BRANDS.some(
      brand => titleLower.startsWith(brand) && !queryLower.includes(brand)
    );
    if (isAccessoryBrand) {
      score -= 100;
    }
  }

  return score;
}

/**
 * Compute the median price from a list of products (ignoring zero/null prices).
 */
function computeMedianPrice(products: SearchProduct[]): number | null {
  const prices = products
    .map(p => p.current_price)
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid];
}

/**
 * Sort grouped products. Uses max relevance score across all store entries in the group.
 * Price sort uses best_price (min price across stores).
 */
function sortGroupedProducts(
  groups: GroupedSearchProduct[],
  sort: string,
  query?: string,
  storeRankMap?: Map<SearchProduct, number>,
): void {
  switch (sort) {
    case 'relevance':
      if (query) {
        // Compute median from all individual store entries for relevance scoring
        const allStoreProducts = groups.flatMap(g => g.stores);
        const medianPrice = computeMedianPrice(allStoreProducts);
        const groupScores = new Map<GroupedSearchProduct, number>();

        for (const group of groups) {
          // Take the max relevance across all store entries in the group
          let maxScore = -Infinity;
          for (const p of group.stores) {
            const storeRank = storeRankMap?.get(p) ?? 50;
            const score = calculateRelevance(p, query, storeRank, medianPrice);
            if (score > maxScore) maxScore = score;
          }
          groupScores.set(group, maxScore);
        }

        groups.sort((a, b) => (groupScores.get(b) || 0) - (groupScores.get(a) || 0));
      }
      break;
    case 'price_asc':
      groups.sort((a, b) => {
        if (!a.best_price && !b.best_price) return 0;
        if (!a.best_price) return 1;
        if (!b.best_price) return -1;
        return a.best_price - b.best_price;
      });
      break;
    case 'price_desc':
      groups.sort((a, b) => {
        if (!a.best_price && !b.best_price) return 0;
        if (!a.best_price) return 1;
        if (!b.best_price) return -1;
        return b.best_price - a.best_price;
      });
      break;
    case 'rating':
      groups.sort((a, b) => (b.is_deal ? 1 : 0) - (a.is_deal ? 1 : 0));
      break;
    case 'name':
      groups.sort((a, b) => (a.name_en || '').toLowerCase().localeCompare((b.name_en || '').toLowerCase()));
      break;
  }
}
