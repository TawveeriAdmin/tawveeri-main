// src/lib/catalog/getCategoryOverview.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-only category overview for the /categories/<slug> decision page.
//
// Reads `tps_product_projection` DIRECTLY — never our own /api/v1/tps/search. A server
// render that calls its own API shares the in-process rate limiter with every other
// request; that exact mistake is what made the compare page render "لا تتوفر مقارنة"
// under load (see get-comparison.ts / compare/[key]/page.tsx). Same discipline here.
//
// `categoryKey` is the TPS category key (e.g. `air_conditioner`), NOT the URL slug.
// Callers resolve slug → key via `findNavigableCategory` first, which already owns the
// alias table and the MIN_COMPARABLE_FOR_NAVIGATION gate — this function does not
// re-decide whether a category is worth a page, only what to render once it qualifies.
// ─────────────────────────────────────────────────────────────────────────────

import { cache } from 'react';
import { createServerClient } from '@/lib/database';

export interface CategoryProductSummary {
  identityKey: string;
  nameAr: string;
  nameEn: string | null;
  brand: string | null;
  imageUrl: string | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  storeCount: number;
  /** Locale-less path, e.g. `/compare/apple-iphone-16`. Prefix with `/${locale}` to link. */
  compareUrl: string;
  lastObservedAt: string | null;
}

/**
 * MEASURED DEFECT (2026-08-11, Global Shopping Discoverability & AI Commerce mission):
 * `tps_product_projection.compare_url` is stored WITH a hardcoded `/ar/` locale prefix (e.g.
 * `/ar/compare/...`), violating this module's own documented `compareUrl` contract
 * (`CategoryProductSummary.compareUrl`'s own doc comment: "Locale-less path... Prefix with
 * `/${locale}` to link"). Every consumer honours that contract and prepends its own locale —
 * so every category-page product card linked to `/ar/ar/compare/...` (Arabic) or
 * `/en/ar/compare/...` (English), a 404 in BOTH locales, confirmed live. Exported as a pure
 * function (not left inline in the `.map()` below) so it is directly unit-testable without a
 * database round-trip.
 */
export function normalizeCompareUrl(raw: string | null, identityKey: string): string {
  const url = raw || `/compare/${encodeURIComponent(identityKey)}`;
  return url.replace(/^\/(ar|en)(?=\/)/, '');
}

export interface CategoryOverview {
  comparableCount: number;
  priceRange: { min: number; max: number } | null;
  brands: { name: string; count: number }[];
  products: CategoryProductSummary[];
  /** Most recent `last_observed_at` across the category's comparable canonicals. */
  freshestObservedAt: string | null;
}

export interface ProjectionRow {
  tps_identity_key: string | null;
  display_name_ar: string | null;
  display_name_en: string | null;
  brand: string | null;
  image_url: string | null;
  lowest_price: number | null;
  highest_price: number | null;
  store_count: number | null;
  compare_url: string | null;
  last_observed_at: string | null;
}

interface LooseQuery {
  select(cols: string): LooseQuery;
  eq(col: string, val: unknown): LooseQuery;
  order(col: string, opts: { ascending: boolean }): LooseQuery;
  range(from: number, to: number): Promise<{ data: unknown; error: unknown }>;
}

// Cards rendered on the page. The projection itself is bounded (comparable canonicals per
// category are in the tens-to-hundreds range today), so one generous page is enough — this
// is a landing page, not a paginated catalogue.
const PRODUCTS_LIMIT = 60;

/**
 * Exported so `getAcFacetOverview.ts` (2026-08-25, category-facet-pages mission) can filter
 * the SAME rows this page reads — by BTU band / brand — rather than running a second query
 * against `tps_product_projection`. Never call this per-facet in a loop; fetch once, filter
 * client-side (the category's row count is in the low hundreds, well within one page).
 */
export async function fetchProjectionRows(categoryKey: string): Promise<ProjectionRow[]> {
  // `tps_product_projection` is a TPS-layer table, not in the generated storefront types —
  // same narrow loose-view cast used by navigable-categories.ts and home-verified-deals.ts.
  const db = createServerClient() as unknown as { from(table: string): LooseQuery };
  const rows: ProjectionRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('tps_product_projection')
      .select('tps_identity_key, display_name_ar, display_name_en, brand, image_url, lowest_price, highest_price, store_count, compare_url, last_observed_at')
      .eq('category', categoryKey)
      .eq('has_comparison', true)
      .order('store_count', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    const page = data as ProjectionRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

/**
 * Pure aggregation, split out from `getCategoryOverview` (2026-08-25, category-facet-pages
 * mission) so a facet page can produce the identical `CategoryOverview` shape from a filtered
 * subset of the SAME rows — one aggregation implementation, not two. Takes rows, not a
 * category key: has no idea whether it was called for a whole category or one facet slice.
 */
export function summarizeProjectionRows(rows: ProjectionRow[]): CategoryOverview {
  const brandCounts = new Map<string, number>();
  let min: number | null = null;
  let max: number | null = null;
  let freshest: string | null = null;

  for (const r of rows) {
    if (r.brand) brandCounts.set(r.brand, (brandCounts.get(r.brand) ?? 0) + 1);
    if (r.lowest_price != null) min = min === null ? r.lowest_price : Math.min(min, r.lowest_price);
    if (r.highest_price != null) max = max === null ? r.highest_price : Math.max(max, r.highest_price);
    if (r.last_observed_at && (!freshest || r.last_observed_at > freshest)) freshest = r.last_observed_at;
  }

  const brands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const products: CategoryProductSummary[] = rows
    .filter((r): r is ProjectionRow & { tps_identity_key: string } => !!r.tps_identity_key)
    .slice(0, PRODUCTS_LIMIT)
    .map((r) => ({
      identityKey: r.tps_identity_key,
      nameAr: r.display_name_ar || r.display_name_en || '',
      nameEn: r.display_name_en,
      brand: r.brand,
      imageUrl: r.image_url,
      lowestPrice: r.lowest_price,
      highestPrice: r.highest_price,
      storeCount: r.store_count ?? 0,
      compareUrl: normalizeCompareUrl(r.compare_url, r.tps_identity_key),
      lastObservedAt: r.last_observed_at,
    }));

  return {
    comparableCount: rows.length,
    priceRange: min !== null && max !== null ? { min, max } : null,
    brands,
    products,
    freshestObservedAt: freshest,
  };
}

/**
 * Memoized per request (React `cache()`, same pattern as `src/lib/auth/server.ts`) — both
 * `generateMetadata` and the page body call this for the same category, and it must not run
 * the query twice.
 */
export const getCategoryOverview = cache(async (categoryKey: string): Promise<CategoryOverview> => {
  const rows = await fetchProjectionRows(categoryKey);
  return summarizeProjectionRows(rows);
});
