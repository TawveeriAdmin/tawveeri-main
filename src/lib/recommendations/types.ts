import type { ProductCategory } from '@/lib/database/types';

export interface RecommendedProduct {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  category: ProductCategory;
  brand: string;
  model: string;
  image_urls: string[] | null;
  score: number;
  source: 'embedding' | 'collaborative' | 'personalized' | 'popularity';
}

export interface RecommendationOptions {
  type?: 'auto' | 'similar' | 'collaborative' | 'personalized';
  productId?: string;
  limit?: number;
}
