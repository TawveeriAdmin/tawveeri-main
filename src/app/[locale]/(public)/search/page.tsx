import type { Metadata } from 'next';
import SearchClient from './search-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

/**
 * NOINDEX (2026-08-09, Unified Intelligence mission, Phase 1 — crawler truth parity).
 *
 * MEASURED live against production with a Googlebot user-agent, no JS executed (what a
 * crawler's INITIAL fetch sees before/without hydration — some crawlers never execute JS at
 * all): `/ar/search?q=لابتوب` — a query that returns 497 results to a real client — served an
 * empty "لم نعثر على نتائج" shell, ZERO product markup, ZERO JSON-LD, while the root layout's
 * default `robots: {index:true, follow:true}` was never overridden here, so this page was
 * explicitly telling crawlers "please index this" while showing them nothing real. This is
 * the exact "search pages as zero-result/static shells" defect the mission named — database
 * truth, human-browser truth (results fetch client-side after hydration), and crawler truth
 * had diverged.
 *
 * The fix is NOT to make this page server-render every possible query's results (an
 * unbounded, thin-content surface — exactly what the mission says not to index). ADR-226
 * (2026-08-07) already built the correct indexable surface: `/categories/[slug]` — real,
 * stable, SSR'd, ItemList/BreadcrumbList JSON-LD, and both the header nav and the
 * `/categories` index already link there instead of here. `/search` is now purely a
 * client-side shopping TOOL (free-text query, live results, Waffar) — never the thing a
 * crawler should treat as a content page. `follow: true` is kept so a crawler that lands
 * here via a stray external link still reaches the real category/product/compare pages
 * linked from the results.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...buildPageMetadata({
      titleAr: 'البحث عن المنتجات',
      titleEn: 'Search Products',
      descriptionAr: 'ابحث وقارن أسعار الإلكترونيات من أمازون ونون وجرير واكسترا والمنيع في السعودية.',
      descriptionEn: 'Search and compare electronics prices from Amazon, Noon, Jarir, Extra & Almanea in Saudi Arabia.',
      locale,
      path: '/search',
    }),
    robots: { index: false, follow: true },
  };
}

export default function SearchPage() {
  return <SearchClient />;
}
