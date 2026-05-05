import { cache } from 'react';
import { createServerClient } from '@/lib/database';

export const getProductSeoData = cache(async (slug: string) => {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('products')
    .select(`
      name_ar,
      name_en,
      slug,
      description_ar,
      description_en,
      brand,
      image_urls,
      average_rating,
      total_reviews,
      product_stores(current_price, store_id)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!data) return null;

  const stores = (data as any).product_stores as Array<{ current_price: number; store_id: string }> | undefined;
  const prices = (stores || []).map((ps) => ps.current_price).filter((p): p is number => p > 0);

  return {
    name_ar: data.name_ar,
    name_en: data.name_en,
    slug: data.slug,
    description_ar: data.description_ar,
    description_en: data.description_en,
    brand: data.brand,
    image_urls: data.image_urls,
    average_rating: data.average_rating,
    total_reviews: data.total_reviews,
    min_price: prices.length > 0 ? Math.min(...prices) : null,
    max_price: prices.length > 0 ? Math.max(...prices) : null,
    store_count: prices.length,
  };
});
