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
  hasStoreLogo,
} from '@/lib/scraping/product-adapter';

import { SEARCH_STORE_DISPLAY_NAMES } from '@/lib/scraping/product-adapter';

/** Returns the store's bilingual display name or falls back to the slug.
 *  Coerces `slug` to a string — some call sites pass a numeric store id, and a display
 *  helper must never throw (a numeric slug once crashed the whole search page). */
export function getStoreDisplayName(slug: string, locale: 'ar' | 'en' = 'ar'): string {
  const s = String(slug ?? '');
  const entry = SEARCH_STORE_DISPLAY_NAMES[s];
  if (!entry) return s;
  return locale === 'ar' ? entry.name_ar : entry.name_en;
}

/** Two-letter abbreviation used as the logo fallback when the PNG is missing. String-coerced (see above). */
export function getStoreInitials(slug: string): string {
  const s = String(slug ?? '');
  const display = SEARCH_STORE_DISPLAY_NAMES[s]?.name_en ?? s;
  const letters = display.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  return letters || s.slice(0, 2).toUpperCase();
}
