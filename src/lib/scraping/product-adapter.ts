import type { ScrapedProduct } from './base/types';
import type { ProductCardProduct } from '@/components/products/product-card';
import type { AvailabilityStatus } from '@/lib/database/types';

interface ScrapedProductWithStore extends ScrapedProduct {
  store?: string;
  store_name?: string;
}

/**
 * Map ScrapedProduct to ProductCardProduct format for UI display
 * Note: This function now receives store info from the Python response
 */
export function mapScrapedToProductCard(
  scraped: ScrapedProductWithStore
): ProductCardProduct {
  const storeSlug = scraped.store || 'amazon';
  const storeName = scraped.store_name || getStoreName(storeSlug);
  // Generate a temporary ID from SKU or URL
  const id = scraped.sku || `scraped-${storeSlug}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Generate slug from name
  const slug = scraped.name_en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';

  return {
    id,
    name_ar: scraped.name_ar,
    name_en: scraped.name_en,
    slug,
    category: scraped.category,
    brand: scraped.brand,
    model: scraped.model,
    image_urls: scraped.image_urls.length > 0 ? scraped.image_urls : null,
    product_stores: [
      {
        id: `store-${storeSlug}-${id}`,
        current_price: scraped.current_price,
        original_price: scraped.original_price,
        availability: scraped.availability as AvailabilityStatus,
        currency: 'SAR',
        stock_quantity: null,
        product_url: scraped.product_url,
        affiliate_url: scraped.product_url,
        delivery_time_days: scraped.delivery_time_days || null,
        delivery_cost: scraped.delivery_cost || null,
        is_free_delivery: scraped.is_free_delivery || false,
        is_deal: scraped.is_deal || false,
        deal_expires_at: scraped.deal_expires_at || null,
        coupon_code: scraped.coupon_code || null,
        stores: {
          id: storeSlug,
          name_ar: storeName,
          name_en: storeName,
          logo_url: null, // Can be enhanced later with actual logo URLs
        },
      },
    ],
  };
}

/**
 * Store name mapping
 */
const STORE_NAMES: Record<string, string> = {
  amazon: 'Amazon SA',
  noon: 'Noon',
  jarir: 'Jarir',
  extra: 'Extra',
};

export function getStoreName(storeSlug: string): string {
  return STORE_NAMES[storeSlug] || storeSlug;
}

