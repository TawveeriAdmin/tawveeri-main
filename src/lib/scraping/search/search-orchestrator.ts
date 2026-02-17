import type { ScrapedSearchResult } from '../search-types';
import type { SearchProduct, StoreSearchResult } from './types';
import { AmazonSearchScraper } from './amazon-search-scraper';
import { NoonSearchScraper } from './noon-search-scraper';
import { JarirSearchScraper } from './jarir-search-scraper';
import { ExtraSearchScraper } from './extra-search-scraper';

const SCRAPERS: Record<string, () => { search: (opts: { query: string; pages: number }) => Promise<StoreSearchResult> }> = {
  amazon: () => new AmazonSearchScraper(),
  noon: () => new NoonSearchScraper(),
  jarir: () => new JarirSearchScraper(),
  extra: () => new ExtraSearchScraper(),
};

export async function searchAllStores(
  query: string,
  stores: string[],
  pages: number,
  sort: string = 'price_asc',
): Promise<ScrapedSearchResult> {
  const startTime = Date.now();

  const validStores = stores.filter(s => s in SCRAPERS);
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
      return scraper.search({ query, pages });
    }),
  );

  const allProducts: SearchProduct[] = [];
  const storeResults: Record<string, number> = {};
  const errors: Record<string, string> = {};

  for (let i = 0; i < validStores.length; i++) {
    const store = validStores[i];
    const result = results[i];

    if (result.status === 'fulfilled') {
      const { products, error } = result.value;
      storeResults[store] = products.length;
      allProducts.push(...products);
      if (error) errors[store] = error;
    } else {
      storeResults[store] = 0;
      errors[store] = result.reason instanceof Error ? result.reason.message : String(result.reason);
    }
  }

  // Sort
  sortProducts(allProducts, sort);

  // Price stats
  const prices = allProducts.map(p => p.current_price).filter(p => p > 0);
  const priceStats = {
    min: prices.length > 0 ? Math.min(...prices) : null,
    max: prices.length > 0 ? Math.max(...prices) : null,
    avg: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
  };

  const searchTime = (Date.now() - startTime) / 1000;

  return {
    products: allProducts,
    count: allProducts.length,
    query,
    storeResults,
    priceStats,
    searchTime: Math.round(searchTime * 100) / 100,
    errors: Object.keys(errors).length > 0 ? errors : null,
  };
}

function sortProducts(products: SearchProduct[], sort: string): void {
  switch (sort) {
    case 'price_asc':
      products.sort((a, b) => {
        if (!a.current_price && !b.current_price) return 0;
        if (!a.current_price) return 1;
        if (!b.current_price) return -1;
        return a.current_price - b.current_price;
      });
      break;
    case 'price_desc':
      products.sort((a, b) => {
        if (!a.current_price && !b.current_price) return 0;
        if (!a.current_price) return 1;
        if (!b.current_price) return -1;
        return b.current_price - a.current_price;
      });
      break;
    case 'rating':
      // No rating field on ScrapedProduct, sort by deal status as proxy
      products.sort((a, b) => (b.is_deal ? 1 : 0) - (a.is_deal ? 1 : 0));
      break;
    case 'name':
      products.sort((a, b) => (a.name_en || '').toLowerCase().localeCompare((b.name_en || '').toLowerCase()));
      break;
  }
}
