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
};
