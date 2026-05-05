/**
 * Single source of truth for store logo paths.
 * Re-exports the canonical maps from `product-adapter.ts` so UI components
 * stop duplicating the slug → filename lookup. Use the `<StoreLogo>` component
 * (`@/components/ui/store-logo`) in rendering code.
 */

export {
  SEARCH_STORE_DISPLAY_NAMES,
  SEARCH_STORE_LOGO_BASENAME,
  getSearchStoreLogoPath,
} from '@/lib/scraping/product-adapter';

import { SEARCH_STORE_DISPLAY_NAMES } from '@/lib/scraping/product-adapter';

/** Returns the store's bilingual display name or falls back to the slug. */
export function getStoreDisplayName(slug: string, locale: 'ar' | 'en' = 'ar'): string {
  const entry = SEARCH_STORE_DISPLAY_NAMES[slug];
  if (!entry) return slug;
  return locale === 'ar' ? entry.name_ar : entry.name_en;
}

/** Two-letter abbreviation used as the logo fallback when the PNG is missing. */
export function getStoreInitials(slug: string): string {
  const display = SEARCH_STORE_DISPLAY_NAMES[slug]?.name_en ?? slug;
  const letters = display.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  return letters || slug.slice(0, 2).toUpperCase();
}
