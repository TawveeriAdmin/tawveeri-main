import type { ScrapedProduct } from './base/types';

/**
 * Search result type for UI consumption
 */
export interface ScrapedSearchResult {
  products: ScrapedProduct[];
  count: number;
  query: string;
  storeResults: Record<string, number>;
  priceStats: {
    min: number | null;
    max: number | null;
    avg: number | null;
  };
  searchTime: number;
  errors: Record<string, string> | null;
}


