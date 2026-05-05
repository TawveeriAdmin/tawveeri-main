import type { GroupedSearchProduct } from './search/product-grouper';

/**
 * Search result type for UI consumption
 */
export interface ScrapedSearchResult {
  products: GroupedSearchProduct[];
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
  /** Total number of stores that were queried */
  totalStores?: number;
  /** Number of stores that returned results successfully */
  successfulStores?: number;
}


