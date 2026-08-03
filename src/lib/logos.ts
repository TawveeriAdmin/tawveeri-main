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
  canonicalStoreSlug,
} from '@/lib/scraping/product-adapter';

import { SEARCH_STORE_DISPLAY_NAMES, canonicalStoreSlug } from '@/lib/scraping/product-adapter';

/** Returns the store's bilingual display name or falls back to the slug.
 *  Coerces `slug` to a string — some call sites pass a numeric store id, and a display
 *  helper must never throw (a numeric slug once crashed the whole search page).
 *  Resolves display names and numeric ids to the canonical slug first, so a row that
 *  carries "اكسترا" (or "4") in place of a slug still finds its bilingual entry. */
export function getStoreDisplayName(slug: string, locale: 'ar' | 'en' = 'ar'): string {
  const s = canonicalStoreSlug(slug);
  const entry = SEARCH_STORE_DISPLAY_NAMES[s];
  if (!entry) return s;
  return locale === 'ar' ? entry.name_ar : entry.name_en;
}

/** Two-letter abbreviation used as the logo fallback when the PNG is missing. String-coerced (see above).
 *
 *  The raw-identifier fallback is deliberately LATIN-ONLY. It sits directly beside the store's
 *  full name on a product card, so slicing an Arabic name ("اكسترا" → "اك") produced a badge
 *  that read as a duplicated prefix of the word next to it — «اك» «اكسترا» = «اكاكسترا».
 *  With no Latin letters to abbreviate we return "" and let `<StoreLogo>` render nothing:
 *  the name beside it already identifies the store, and an empty badge is honest where a
 *  wrong one is not. */
export function getStoreInitials(slug: string): string {
  const s = canonicalStoreSlug(slug);
  const display = SEARCH_STORE_DISPLAY_NAMES[s]?.name_en ?? s;
  return display.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
}
