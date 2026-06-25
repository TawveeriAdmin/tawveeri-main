import { cache } from 'react';
import { createServerClient } from '@/lib/database';

export const getStoreSeoData = cache(async (slug: string) => {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('stores')
    .select('id, name, slug, offer, coupon_code, link, category')
    .eq('slug', slug)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    name_ar: data.name,
    name_en: data.name,
    slug: data.slug,
    description_ar: data.offer || '',
    description_en: data.offer || '',
    logo_url: null,
    website_url: data.link,
    average_rating: null,
    total_reviews: null,
    total_products: null,
    offer: data.offer,
    coupon_code: data.coupon_code,
    category: data.category,
  };
});