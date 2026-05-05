import { cache } from 'react';
import { createServerClient } from '@/lib/database';

export const getStoreSeoData = cache(async (slug: string) => {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('stores')
    .select(`
      name_ar,
      name_en,
      slug,
      description_ar,
      description_en,
      logo_url,
      website_url,
      average_rating,
      total_reviews,
      total_products
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!data) return null;

  return {
    name_ar: data.name_ar,
    name_en: data.name_en,
    slug: data.slug,
    description_ar: data.description_ar,
    description_en: data.description_en,
    logo_url: data.logo_url,
    website_url: data.website_url,
    average_rating: data.average_rating,
    total_reviews: data.total_reviews,
    total_products: data.total_products,
  };
});
