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
/**
 * The title-derived slug shape old links carried (`[^a-z0-9]+ → '-'`) — see ADR-386/387: search
 * cards and the compare tray used to re-derive slugs this way, while `products.slug` is written
 * by `generateSlug()`, which strips punctuation instead. Pure; exported for tests.
 */
export function legacyTitleSlug(nameEn: string): string {
  return nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Given a requested slug that matched no row, pick the ONE active product whose title
 * re-derives to exactly that legacy slug — or null when zero or several do. Never a
 * similarity match: exact equality of the deterministic derivation, uniquely, or nothing.
 */
export function pickLegacySlugMatch(
  requested: string,
  candidates: { slug: string; name_en: string | null }[],
): string | null {
  const exact = candidates.filter((c) => c.name_en && legacyTitleSlug(c.name_en) === requested && c.slug && c.slug !== requested);
  const distinct = [...new Set(exact.map((c) => c.slug))];
  return distinct.length === 1 ? distinct[0] : null;
}

/**
 * ADR-387 — resolves an old title-derived product URL to the real `products.slug` so a saved
 * link, a cached compare-tray item or an indexed page can 308 to the right product instead of
 * dead-ending at 404. Candidate rows are pre-filtered with a LIKE pattern built from the
 * requested slug (every '-' may stand for any punctuation `generateSlug()` dropped), then the
 * derivation is recomputed on each candidate's own title and must match EXACTLY and UNIQUELY.
 * Returns null on any doubt — the caller then 404s honestly. Never redirects to a
 * similar-looking product.
 */
export const resolveLegacyProductSlug = cache(async (requested: string): Promise<string | null> => {
  if (!requested || UUID_RE.test(requested) || !requested.includes('-') || requested.length > 300) return null;
  const supabase = createServerClient();
  const pattern = requested.split('-').filter(Boolean).join('%');
  const { data, error } = await supabase
    .from('products')
    .select('slug, name_en')
    .eq('is_active', true)
    .like('slug', pattern)
    .limit(25);
  if (error || !data) return null;
  return pickLegacySlugMatch(requested, data as { slug: string; name_en: string | null }[]);
});

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
    // Service-role query bypasses the RLS policy that hides quarantined offers from
    // anon/browser reads — filter explicitly so a quarantined price never seeds the
    // page's meta description. See price-truth-gate.ts / P0 incident 2026-08-05.
    .is('product_stores.price_quarantined_at', null)
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
