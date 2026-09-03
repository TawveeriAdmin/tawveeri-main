// src/lib/intelligence/navigable-categories.ts
//
// WHICH CATEGORIES MAY APPEAR IN NAVIGATION — decided by a constant rule against a live
// query, never by a hardcoded list. See docs/CATEGORY-NAVIGATION-POLICY.md (ADR-150).
//
// THE RULE (constant):
//   A category is navigable if and only if it holds at least MIN_COMPARABLE_FOR_NAVIGATION
//   COMPARABLE products — canonicals carrying live offers from ≥2 distinct approved
//   retailers — measured live from `tps_product_projection`.
//
// WHY COMPARABLE COUNT, and not the two obvious alternatives:
//
//   • Product count is the failure mode we exist to oppose. Measured on production:
//     `vacuum` holds 214 products and 10 comparable (4.7%); `accessories` returns 1,838
//     products and ZERO comparable. A competitor with 70,600 listings shows "من 1 متجر"
//     on nearly every card. Breadth without overlap is not a category — it is a dead end
//     with a big number on it.
//
//   • A comparable RATIO floor was tested and REJECTED, because it changes the answer for
//     the worse. `laptop` is 70 comparable of 742 products = 9.4%; a 10% floor would drop
//     it while keeping `smartwatch` (31 of 73 = 42.5%). But a shopper comparing laptops
//     can compare 70 products — more than twice what smartwatch offers. Ratio measures
//     catalogue composition; it does not measure what the user can do. Penalising a
//     category for ALSO having deep single-store coverage is incoherent.
//
//   • Freshness is deliberately NOT in this gate. 0.1% of projection rows were last
//     observed >30 days ago, and every offer already discloses its observation age at the
//     point of comparison. Putting freshness here would double-count a disclosure we
//     already make, against "one authority per question".
//
// WHY 30 — anchored, not a round number chosen by taste. Sorted comparable counts on
// production 2026-07-30: 118, 106, 85, 78, 70, 56, 54, 41, 40, 31 ‖ 17, 16, 10, 10, 8, 4,
// 4, 3, 3, 3, 1, 0. The largest relative gap in the tail is 31 → 17 (~1.8×). 30 sits in
// that gap, and corresponds to roughly one full browse screen of comparable cards.
// The threshold is a constant; which categories clear it is recomputed on every call.
//
// DESTINATION — categories link to the QUERY path, never `?category=<slug>`. Measured on
// production with correctly-encoded bodies: `?category=laptop` returns 830 products with
// ZERO comparable and a laptop TABLE as the top result, because the category filter is an
// exact-equality match against the storefront layer, whose vocabulary and identity are not
// the TPS layer's. The query path returns the comparable products (`مكيف` → "Lg Split AC
// 30000 BTU", 9 comparable across 6 retailers). Navigation must use the path that works.
//
// SERVER-ONLY. Direct DB read, never an HTTP call to our own API — a self-fetch is what
// got the compare page rate-limited into rendering "no comparison available".

import { createServerClient, fetchAllPaginated } from '@/lib/database';

/** THE RULE. A constant — the derived list below is recomputed live against it. */
export const MIN_COMPARABLE_FOR_NAVIGATION = 30;

export interface NavigableCategory {
  /** TPS category key as stored in production (e.g. `air_conditioner`). */
  key: string;
  /** Comparable products measured at call time. */
  comparable: number;
  labelAr: string;
  labelEn: string;
  /** Search term used as the destination — the query path, not a category filter. */
  query: string;
  emoji: string;
  slug: string;
  aliases: string[];
}

// PRESENTATION ONLY — labels, emoji and the search term a category maps to. This dictionary
// decides NOTHING about whether a category is shown; membership comes from the live query
// below. An Arabic label cannot be auto-generated, so it is authored here for every category
// production currently holds. A category that clears the threshold but has no entry is
// reported by `getUnlabelledQualifyingCategories()` rather than silently dropped.
const PRESENTATION: Record<string, Omit<NavigableCategory, 'key' | 'comparable'>> = {
  air_conditioner: { labelAr: 'مكيفات', labelEn: 'Air conditioners', query: 'مكيف', emoji: '❄️', slug: 'air-conditioners', aliases: ['ac', 'air-conditioner', 'aircon', 'مكيف', 'مكيفات'] },
  mobile:          { labelAr: 'جوالات', labelEn: 'Phones', query: 'جوال', emoji: '📱', slug: 'phones', aliases: ['phone', 'phones', 'mobile', 'mobiles', 'smartphone', 'smartphones', 'جوال', 'جوالات'] },
  washing_machine: { labelAr: 'غسالات', labelEn: 'Washers', query: 'غسالة', emoji: '🧺', slug: 'washers', aliases: ['washer', 'washers', 'washing-machine', 'washing-machines', 'غسالة', 'غسالات'] },
  tv:              { labelAr: 'تلفزيونات', labelEn: 'TVs', query: 'تلفزيون', emoji: '📺', slug: 'tvs', aliases: ['tv', 'tvs', 'television', 'televisions', 'تلفزيون', 'تلفزيونات'] },
  laptop:          { labelAr: 'لابتوب', labelEn: 'Laptops', query: 'لابتوب', emoji: '💻', slug: 'laptops', aliases: ['laptop', 'laptops', 'notebook', 'notebooks', 'لابتوب'] },
  tablet:          { labelAr: 'أجهزة لوحية', labelEn: 'Tablets', query: 'تابلت', emoji: '📲', slug: 'tablets', aliases: ['tablet', 'tablets', 'ipad', 'تابلت'] },
  monitor:         { labelAr: 'شاشات', labelEn: 'Monitors', query: 'شاشة', emoji: '🖥️', slug: 'monitors', aliases: ['monitor', 'monitors', 'display', 'displays', 'شاشة', 'شاشات'] },
  refrigerator:    { labelAr: 'ثلاجات', labelEn: 'Refrigerators', query: 'ثلاجة', emoji: '🧊', slug: 'refrigerators', aliases: ['refrigerator', 'refrigerators', 'fridge', 'fridges', 'ثلاجة', 'ثلاجات'] },
  audio:           { labelAr: 'سماعات', labelEn: 'Audio', query: 'سماعات', emoji: '🎧', slug: 'audio', aliases: ['audio', 'headphones', 'earbuds', 'speakers', 'سماعات'] },
  smartwatch:      { labelAr: 'ساعات ذكية', labelEn: 'Smartwatches', query: 'ساعة ذكية', emoji: '⌚', slug: 'smartwatches', aliases: ['smartwatch', 'smartwatches', 'watch', 'watches', 'ساعة', 'ساعات ذكية'] },
  dishwasher:      { labelAr: 'غسالات صحون', labelEn: 'Dishwashers', query: 'غسالة صحون', emoji: '🍽️', slug: 'dishwashers', aliases: ['dishwasher', 'dishwashers', 'غسالة صحون'] },
  printer:         { labelAr: 'طابعات', labelEn: 'Printers', query: 'طابعة', emoji: '🖨️', slug: 'printers', aliases: ['printer', 'printers', 'طابعة', 'طابعات'] },
  vacuum:          { labelAr: 'مكانس', labelEn: 'Vacuums', query: 'مكنسة', emoji: '🧹', slug: 'vacuums', aliases: ['vacuum', 'vacuums', 'مكنسة', 'مكانس'] },
  air_fryer:       { labelAr: 'قلايات هوائية', labelEn: 'Air fryers', query: 'قلاية هوائية', emoji: '🍟', slug: 'air-fryers', aliases: ['air-fryer', 'airfryer', 'قلاية'] },
  microwave:       { labelAr: 'مايكروويف', labelEn: 'Microwaves', query: 'مايكروويف', emoji: '🍲', slug: 'microwaves', aliases: ['microwave', 'microwaves', 'مايكروويف'] },
  blender:         { labelAr: 'خلاطات', labelEn: 'Blenders', query: 'خلاط', emoji: '🥤', slug: 'blenders', aliases: ['blender', 'blenders', 'خلاط'] },
  kettle:          { labelAr: 'غلايات', labelEn: 'Kettles', query: 'غلاية', emoji: '🫖', slug: 'kettles', aliases: ['kettle', 'kettles', 'غلاية'] },
  oven:            { labelAr: 'أفران', labelEn: 'Ovens', query: 'فرن', emoji: '🔥', slug: 'ovens', aliases: ['oven', 'ovens', 'فرن'] },
  coffee_maker:    { labelAr: 'صانعات قهوة', labelEn: 'Coffee makers', query: 'ماكينة قهوة', emoji: '☕', slug: 'coffee-makers', aliases: ['coffee', 'coffee-maker', 'قهوة'] },
  camera:          { labelAr: 'كاميرات', labelEn: 'Cameras', query: 'كاميرا', emoji: '📷', slug: 'cameras', aliases: ['camera', 'cameras', 'كاميرا', 'كاميرات'] },
  toaster:         { labelAr: 'محامص', labelEn: 'Toasters', query: 'توستر', emoji: '🍞', slug: 'toasters', aliases: ['toaster', 'toasters', 'توستر'] },
  air_purifier:    { labelAr: 'منقيات هواء', labelEn: 'Air purifiers', query: 'منقي هواء', emoji: '🌬️', slug: 'air-purifiers', aliases: ['air-purifier', 'purifier', 'منقي'] },
};

interface LooseQuery {
  select(cols: string): LooseQuery;
  eq(col: string, val: unknown): LooseQuery;
  order(col: string, opts?: { ascending?: boolean }): LooseQuery;
  range(from: number, to: number): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Live comparable count per TPS category.
 *
 * ADR-285: this used to be a single `.limit(10000)` fetch with NO `.order()` — PostgREST
 * silently caps any response at its db-max-rows setting (1000) regardless of the requested
 * limit, and with no deterministic order the 1000 rows returned are an arbitrary, unstable
 * slice that can differ between requests. Measured on production: comparable rows total
 * 1,372 (already past the cap), so this was BOTH under-counting every category AND capable
 * of making a real category (e.g. `laptop`, `tv`) intermittently disappear from the main
 * navigation menu depending on which 1000 rows PostgREST happened to return. Same root
 * cause as ADR-172 and command-center-queries.ts's ADR-285 fix — paginated explicitly here
 * too, ordered by `id` for a stable, complete read every time.
 */
async function measureComparableByCategory(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  // `tps_product_projection` is a TPS-layer table and is not in the generated storefront
  // types, so the typed builder rejects its columns. Narrow, explicit loose view — same
  // spirit as the cast in home-verified-deals.ts, without reaching for `any`.
  const db = createServerClient() as unknown as { from(table: string): LooseQuery };
  let rows: { category: string | null }[];
  try {
    rows = await fetchAllPaginated<{ category: string | null }>((from, to) =>
      db
        .from('tps_product_projection')
        .select('category')
        .eq('has_comparison', true)
        .order('id', { ascending: true })
        .range(from, to) as Promise<{ data: { category: string | null }[] | null; error: { message: string } | null }>
    );
  } catch {
    return counts;
  }
  for (const row of rows) {
    const key = row.category;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * The derived navigation list. Recomputed on every call — nothing about WHICH categories
 * appear is baked into the code. Ordered by comparable depth, so the strongest categories
 * lead. Returns [] if the measurement fails: showing nothing is correct when we cannot
 * prove coverage, and the caller renders its empty state.
 */
export async function getNavigableCategories(): Promise<NavigableCategory[]> {
  try {
    const counts = await measureComparableByCategory();
    const out: NavigableCategory[] = [];
    for (const [key, comparable] of counts) {
      if (comparable < MIN_COMPARABLE_FOR_NAVIGATION) continue;
      const presentation = PRESENTATION[key];
      if (!presentation) continue; // reported by getUnlabelledQualifyingCategories()
      out.push({ key, comparable, ...presentation });
    }
    return out.sort((a, b) => b.comparable - a.comparable);
  } catch {
    return [];
  }
}

/**
 * Categories that clear the rule but have no authored label. Not a customer surface — an
 * operational report, so a newly-deep category is added deliberately rather than appearing
 * with a raw database key as its Arabic name.
 */
export async function getUnlabelledQualifyingCategories(): Promise<string[]> {
  const counts = await measureComparableByCategory();
  return [...counts.entries()]
    .filter(([key, n]) => n >= MIN_COMPARABLE_FOR_NAVIGATION && !PRESENTATION[key])
    .map(([key]) => key);
}

/**
 * Slug/alias → category, restricted to categories that currently clear the rule. A slug for
 * a category that no longer qualifies resolves to null so the caller can fall back to search
 * rather than render a category page that cannot deliver a comparison.
 */
export async function findNavigableCategory(slug: string): Promise<NavigableCategory | null> {
  const key = decodeURIComponent(slug).trim().toLowerCase().replace(/\s+/g, '-');
  const cats = await getNavigableCategories();
  return (
    cats.find((c) => c.slug === key) ??
    cats.find((c) => c.aliases.some((a) => a.toLowerCase() === key)) ??
    null
  );
}
