import type { ScrapedSearchResult } from '../search-types';
import type { SearchProduct, StoreSearchResult } from './types';
import { AmazonSearchScraper } from './amazon-search-scraper';
import { NoonSearchScraper } from './noon-search-scraper';
import { JarirSearchScraper } from './jarir-search-scraper';
import { ExtraSearchScraper } from './extra-search-scraper';
import { AlmaneaSearchScraper } from './almanea-search-scraper';
import { EXTENDED_SEARCH_SCRAPERS } from './extended-merchants-registry';
import { matchesCategory } from '../utils/category-utils';
import type { ProductCategory } from '@/lib/database/types';
import { groupSearchProducts, type GroupedSearchProduct } from './product-grouper';
import { normalizeSearchStores } from './store-registry';
import { rankProducts } from './relevance-scorer';

const SCRAPERS: Record<string, () => { search: (opts: { query: string; pages: number }) => Promise<StoreSearchResult> }> = {
  amazon: () => new AmazonSearchScraper(),
  noon: () => new NoonSearchScraper(),
  jarir: () => new JarirSearchScraper(),
  extra: () => new ExtraSearchScraper(),
  almanea: () => new AlmaneaSearchScraper(),
  ...EXTENDED_SEARCH_SCRAPERS,
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
  console.log(
    `[SearchOrchestrator] Running ${validStores.length} store scrapers in parallel: ${validStores.join(', ')}`,
  );
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
      const warn = error ? ` | note: ${error}` : '';
      console.log(`[SearchOrchestrator] ${store}: ${products.length} products${warn}`);
    } else {
      storeResults[store] = 0;
      errors[store] = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.log(`[SearchOrchestrator] ${store}: FAILED — ${errors[store]}`);
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
 * Sort grouped products. Uses two-tier classification + scoring for relevance.
 * Price sort uses best_price (min price across stores).
 */
export function sortGroupedProducts(
  groups: GroupedSearchProduct[],
  sort: string,
  query?: string,
  storeRankMap?: Map<SearchProduct, number>,
): void {
  switch (sort) {
    case 'relevance':
      if (query) {
        rankProducts(groups, query, storeRankMap || new Map());
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
