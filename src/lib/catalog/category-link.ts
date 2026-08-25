// src/lib/catalog/category-link.ts
// Category-facet-pages mission (2026-08-25). Pure, testable core of the category → compare
// attribution link: a product card on /categories/[slug] or /categories/[slug]/[facet] must
// carry enough on its own URL for the compare page to know a click there is category-driven
// and, if so, WHICH category/facet — without a server-side session or a new table, and
// without changing the compare page's canonical URL (query params are not part of it).

/**
 * Appends `?src=category&category=<key>[&facet=<slug>]` to a compare-page path.
 * `compareUrl` is the locale-less path already produced by `getCategoryOverview` (e.g.
 * `/compare/lg%7Csplit%7C...`) — this only ever adds a query string, never touches the path.
 */
export function withCategoryAttribution(compareUrl: string, category: string, facet: string | null): string {
  const params = new URLSearchParams({ src: 'category', category });
  if (facet) params.set('facet', facet);
  const sep = compareUrl.includes('?') ? '&' : '?';
  return `${compareUrl}${sep}${params.toString()}`;
}

export interface CategoryAttribution {
  category: string;
  facet: string | null;
}

/**
 * The compare page's own read side: given its resolved searchParams, is this visit
 * attributable to a category/facet page? `category` must be present and non-empty — `src`
 * alone (e.g. a stray or malformed link) is not enough to claim an attribution we can't name.
 */
export function readCategoryAttribution(searchParams: {
  src?: string | string[];
  category?: string | string[];
  facet?: string | string[];
}): CategoryAttribution | null {
  const src = Array.isArray(searchParams.src) ? searchParams.src[0] : searchParams.src;
  const category = Array.isArray(searchParams.category) ? searchParams.category[0] : searchParams.category;
  const facet = Array.isArray(searchParams.facet) ? searchParams.facet[0] : searchParams.facet;
  if (src !== 'category' || !category) return null;
  return { category, facet: facet || null };
}
