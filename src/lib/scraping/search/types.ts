import type { ScrapedProduct } from '../base/types';

export interface StoreSearchOptions {
  query: string;
  pages: number;
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'name';
}

export interface StoreSearchResult {
  products: SearchProduct[];
  store: string;
  storeName: string;
  count: number;
  error?: string;
}

export type SearchProduct = ScrapedProduct & {
  store: string;
  store_name: string;
  rating?: number | null;
  review_count?: number | null;
  /** ISO time this price was observed (TPS `price_history` rows). Absent on live-scraped
   *  entries, whose observation is the request itself. */
  observed_at?: string | null;
};
