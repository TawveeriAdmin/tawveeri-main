import type { ScrapedProduct } from './base/types';
import type { ProductCardProduct } from '@/components/products/product-card';
import type { AvailabilityStatus } from '@/lib/database/types';
import type { GroupedSearchProduct } from './search/product-grouper';
import { resolveApprovedSlug } from '@/lib/retailers/approved-retailers';

interface ScrapedProductWithStore extends ScrapedProduct {
  store?: string;
  store_name?: string;
}

export const SEARCH_STORE_DISPLAY_NAMES: Record<string, { name_ar: string; name_en: string }> = {
  amazon:      { name_ar: 'أمازون السعودية', name_en: 'Amazon SA' },
  noon:        { name_ar: 'نون',              name_en: 'Noon' },
  jarir:       { name_ar: 'مكتبة جرير',       name_en: 'Jarir' },
  extra:       { name_ar: 'اكسترا',           name_en: 'Extra' },
  almanea:     { name_ar: 'المنيع',           name_en: 'Almanea' },
  samsung_ksa: { name_ar: 'سامسونج السعودية', name_en: 'Samsung KSA' },
  shaker:      { name_ar: 'شاكر',             name_en: 'Shaker' },
  swsg:        { name_ar: 'الشتاء والصيف',    name_en: 'Winter & Summer' },
};

export const SEARCH_STORE_LOGO_BASENAME: Partial<Record<string, string>> = {
  'ibrahim-shaker': 'shaker',
  samsung:          'samsung_ksa',
};

/**
 * Resolve ANY store identifier the UI might hold — canonical slug, Arabic or English display
 * name, or a numeric `stores.id` — to the canonical slug these logo maps are keyed by.
 *
 * REQUIRED, not a convenience. Search-result rows carry the store's Arabic DISPLAY NAME in
 * `stores.id` (see `approved-retailers.ts`), and every card renders `stores.slug ?? stores.id`.
 * Unresolved, "اكسترا" missed `KNOWN_LOGO_FILES` (which is keyed 'extra'), so the real
 * `/logos/extra.png` was never requested and the initials fallback ran instead — where
 * `getStoreInitials` found no Latin letters and fell back to the first two characters of the
 * name itself. The card then printed those initials immediately beside the full name:
 * "اك" + "اكسترا", which reads as the corrupted word «اكاكسترا».
 *
 * An unknown identifier resolves to itself, so nothing that worked before changes.
 */
export function canonicalStoreSlug(identifier: string | number | null | undefined): string {
  const raw = String(identifier ?? '');
  return resolveApprovedSlug(raw) ?? raw;
}

export function getSearchStoreLogoPath(slug: string): string {
  const s = canonicalStoreSlug(slug);
  const base = SEARCH_STORE_LOGO_BASENAME[s] ?? s;
  return `/logos/${base}.png`;
}

// The store logo PNGs that actually ship in /public/logos. Stores outside this set have no file,
// so the UI must render initials directly instead of firing a 404 request for a missing logo.
const KNOWN_LOGO_FILES = new Set(['amazon', 'noon', 'jarir', 'extra', 'almanea', 'samsung_ksa', 'shaker', 'swsg']);
export function hasStoreLogo(slug: string): boolean {
  const s = canonicalStoreSlug(slug);
  return KNOWN_LOGO_FILES.has(SEARCH_STORE_LOGO_BASENAME[s] ?? s);
}

const STORE_NAMES_BILINGUAL = SEARCH_STORE_DISPLAY_NAMES;

export function mapScrapedToProductCard(
  scraped: ScrapedProductWithStore
): ProductCardProduct {
  const storeSlug = scraped.store || 'amazon';
  const storeNames = STORE_NAMES_BILINGUAL[storeSlug] || { name_ar: storeSlug, name_en: storeSlug };
  const id = scraped.sku || `scraped-${storeSlug}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const slug = scraped.name_en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';

  return {
    id,
    name_ar:       scraped.name_ar,
    name_en:       scraped.name_en,
    slug,
    category:      scraped.category,
    brand:         scraped.brand,
    model:         scraped.model,
    image_urls:    scraped.image_urls.length > 0 ? scraped.image_urls : null,
    description_ar: scraped.description_ar,
    description_en: scraped.description_en,
    specifications: scraped.specifications,
    product_stores: [
      {
        id:                `store-${storeSlug}-${id}`,
        current_price:     scraped.current_price,
        original_price:    scraped.original_price,
        availability:      scraped.availability as AvailabilityStatus,
        currency:          'SAR',
        stock_quantity:    null,
        product_url:       scraped.product_url,
        affiliate_url:     scraped.product_url,
        delivery_time_days: scraped.delivery_time_days || null,
        delivery_cost:     scraped.delivery_cost || null,
        is_free_delivery:  scraped.is_free_delivery || false,
        is_deal:           scraped.is_deal || false,
        deal_expires_at:   scraped.deal_expires_at || null,
        coupon_code:       scraped.coupon_code || null,
        stores: {
          id:       storeSlug,
          name_ar:  storeNames.name_ar,
          name_en:  storeNames.name_en,
          logo_url: null,
        },
      },
    ],
  };
}

export function mapGroupedToProductCard(
  grouped: GroupedSearchProduct
): ProductCardProduct {
  const firstStore = grouped.stores[0];
  const storeSlug = firstStore?.store || 'amazon';
  const id = grouped.sku || `grouped-${storeSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const slug = grouped.name_en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';

  const productStores = grouped.stores.map((sp) => {
    const names = STORE_NAMES_BILINGUAL[sp.store] || { name_ar: sp.store, name_en: sp.store };
    return {
      id:                `store-${sp.store}-${sp.sku || id}`,
      current_price:     sp.current_price,
      original_price:    sp.original_price,
      availability:      sp.availability as AvailabilityStatus,
      currency:          'SAR',
      stock_quantity:    null as number | null,
      product_url:       sp.product_url,
      affiliate_url:     sp.product_url,
      delivery_time_days: sp.delivery_time_days || null,
      delivery_cost:     sp.delivery_cost || null,
      is_free_delivery:  sp.is_free_delivery || false,
      is_deal:           sp.is_deal || false,
      deal_expires_at:   sp.deal_expires_at || null,
      coupon_code:       sp.coupon_code || null,
      // QUALITY PROGRAM P1 §14.1 (2026-08-28): `searchTPSCanonical` already computes the
      // true per-store observation time (ADR-194) into `sp.observed_at` — this was
      // computed and then dropped here, so no card past the single Smart Pick ever showed
      // it. Threaded through so `ProductCard` can render it and freshness-gate its badges.
      observed_at:       sp.observed_at ?? null,
      stores: {
        id:            sp.store,
        name_ar:       names.name_ar,
        name_en:       names.name_en,
        logo_url:      null as string | null,
        average_rating: sp.rating ?? null,
        total_reviews:  sp.review_count ?? null,
      },
    };
  });

  productStores.sort((a, b) => {
    if (!a.current_price && !b.current_price) return 0;
    if (!a.current_price) return 1;
    if (!b.current_price) return -1;
    return a.current_price - b.current_price;
  });

  return {
    id,
    name_ar:        grouped.name_ar,
    name_en:        grouped.name_en,
    slug,
    category:       grouped.category,
    brand:          grouped.brand,
    model:          grouped.model,
    image_urls:     grouped.image_urls.length > 0 ? grouped.image_urls : null,
    description_ar: grouped.description_ar,
    description_en: grouped.description_en,
    specifications: grouped.specifications,
    product_stores: productStores,
    // ── TPS Enrichment — ينقل الحقول من enrichWithTPS إلى ProductCard ──
    tps_compare_url:    (grouped as any).tps_compare_url    ?? null,
    tps_identity_key:   (grouped as any).tps_identity_key   ?? null,
    has_tps_comparison: (grouped as any).has_tps_comparison ?? false,
  };
}

export function getStoreName(storeSlug: string): string {
  return STORE_NAMES_BILINGUAL[storeSlug]?.name_en || storeSlug;
}
