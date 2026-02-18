import type { ProductCategory } from '@/lib/database/types';

/**
 * Determines a product's category from its title using keyword matching.
 * Shared between search scrapers and cron scrapers.
 */
export function determineCategory(title: string): ProductCategory {
  const t = title.toLowerCase();

  if (t.includes('laptop') || t.includes('notebook') || t.includes('macbook')) return 'laptop';
  if (t.includes('smartphone') || t.includes('iphone') || t.includes('phone') || t.includes('galaxy')) return 'smartphone';
  if (t.includes('tablet') || t.includes('ipad')) return 'tablet';
  if (t.includes('tv') || t.includes('television')) return 'tv';
  if (t.includes('headphone') || t.includes('earphone') || t.includes('airpod') || t.includes('speaker')) return 'audio';
  if (t.includes('camera')) return 'camera';
  if (t.includes('gaming') || t.includes('playstation') || t.includes('xbox') || t.includes('nintendo')) return 'gaming';
  if (t.includes('watch') || t.includes('smartwatch')) return 'accessories';

  return 'accessories';
}

/**
 * Checks if a product matches a given category filter.
 * Uses the product's category field if set, otherwise determines from title.
 */
export function matchesCategory(
  product: { category?: ProductCategory | string; name_en?: string | null },
  category: ProductCategory,
): boolean {
  if (product.category && product.category !== 'accessories') {
    return product.category === category;
  }
  // Fallback: determine from title
  if (product.name_en) {
    return determineCategory(product.name_en) === category;
  }
  return false;
}
