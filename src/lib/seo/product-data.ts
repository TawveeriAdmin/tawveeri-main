import { cache } from 'react';
import { createServerClient } from '@/lib/database';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves by `slug`, and falls back to `id` when the parameter is a UUID.
 *
 * WHY THE FALLBACK EXISTS (measured 2026-07-30): search emitted the product's UUID as its
 * `product_slug`, so every such card linked to a page that resolved to nothing and rendered
 * the "not found" state at HTTP 200 — for the shopper AND the crawler. The emitting side is
 * fixed for the storefront path, but the Algolia index stores only `objectID` (the id) and
 * carries no slug, and UUID links are already published. Accepting either keeps every
 * existing link working instead of trading one broken set for another.
 */
export const getProductSeoData = cache(async (slugOrId: string) => {
  const supabase = createServerClient();
  const column = UUID_RE.test(slugOrId) ? 'id' : 'slug';
  // `average_rating` / `total_reviews` DO NOT EXIST on `products` — they are `merchant_rating`
  // and `merchant_review_count`. PostgREST rejected the whole select, and because the `error`
  // was discarded this function returned null for EVERY product, always. That is why the page
  // emitted «المنتج غير موجود» as its title and no product JSON-LD at all: not a missing
  // product, a malformed query. Measured 2026-07-30 against a row proven to exist and be
  // active. The error is now surfaced rather than swallowed.
  const { data, error } = await supabase
    .from('products')
    .select(`
      name_ar,
      name_en,
      slug,
      description_ar,
      description_en,
      brand,
      image_urls,
      merchant_rating,
      merchant_review_count,
      product_stores(current_price, store_id)
    `)
    .eq(column, slugOrId)
    .eq('is_active', true)
    .maybeSingle();

  // `undefined` = the lookup FAILED (never assert absence from a fault — that is exactly what
  // turned a malformed select into a site-wide soft 404). `null` = the product genuinely does
  // not exist. Callers must treat these differently: only `null` may become a 404.
  if (error) {
    console.error('[getProductSeoData]', column, slugOrId, error.message);
    return undefined;
  }
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
    // Consumer shape keeps its names; only the source columns were wrong.
    average_rating: (data as { merchant_rating?: number | null }).merchant_rating ?? null,
    total_reviews: (data as { merchant_review_count?: number | null }).merchant_review_count ?? null,
    min_price: prices.length > 0 ? Math.min(...prices) : null,
    max_price: prices.length > 0 ? Math.max(...prices) : null,
    store_count: prices.length,
  };
});
