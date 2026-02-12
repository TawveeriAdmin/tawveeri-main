/**
 * TypeScript interfaces matching Python Flask API response format
 */

export interface PythonProduct {
  store: string;
  store_name: string;
  store_logo: string;
  store_color: string;
  title: string;
  price: number | null;
  price_display: string;
  original_price: number | null;
  discount: string | null;
  currency: string;
  rating: number | null;
  reviews_count: number | null;
  url: string;
  image_url: string | null;
  sku: string | null;
  brand: string | null;
  in_stock: boolean;
  badges: string[];
}

export interface PythonSearchResponse {
  products: PythonProduct[];
  count: number;
  query: string;
  store_results: Record<string, number>;
  price_stats: {
    min: number | null;
    max: number | null;
    avg: number | null;
  };
  search_time: number;
  errors: Record<string, string> | null;
}


