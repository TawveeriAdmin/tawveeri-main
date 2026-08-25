// src/app/[locale]/(public)/categories/[slug]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A real, indexable category decision page — not a redirect.
//
// BEFORE: this route decoded the slug against a hardcoded dict and immediately
// `redirect()`ed to `/search?q=<query>` — a client-rendered results page with no
// server-side content, no structured data, and nothing a crawler or AI assistant could
// read as "here is what Tawveeri knows about air conditioners." Every category link in
// the header nav and the /categories index pointed at that same dead end (Phase 4 /
// "وش ارخص مكيف" gap — see the SEO mission brief this closes).
//
// NOW: the slug resolves through `findNavigableCategory` — the SAME live-measured gate
// that decides which categories appear in navigation at all (ADR-150,
// MIN_COMPARABLE_FOR_NAVIGATION = 30 comparable canonicals). A category page only exists
// where there is real comparison depth behind it; there is no separate "is this worth
// indexing" decision to get wrong here, because the gate is the same one already trusted
// for navigation.
//
// The page states, truthfully and only from data it also renders: how many products are
// comparable, the observed price range, which brands, and links straight to each
// product's own `/compare/[key]` page — the page that actually carries `AggregateOffer`.
// This page intentionally does NOT assert its own AggregateOffer: a category is not one
// product, and Google's structured-data policy is explicit that AggregateOffer is not for
// grouping unrelated products. An `ItemList` naming the real products (ADR-189's own
// pattern, one level up) is the truthful shape.
// ─────────────────────────────────────────────────────────────────────────────

import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { Badge } from '@/components/ui/badge';
import { findNavigableCategory } from '@/lib/intelligence/navigable-categories';
import { getCategoryOverview } from '@/lib/catalog/getCategoryOverview';
import { getQualifyingAcFacets } from '@/lib/catalog/getAcFacetOverview';
import { buildAlternates, getBaseUrl } from '@/lib/seo/metadata';
import { getCategoryGuide } from '@/lib/seo/category-guide';
import { CategoryProductGrid } from '@/components/catalog/category-product-grid';
import { CategoryViewTracker } from '@/components/catalog/category-view-tracker';

// Rendered on demand, NOT prerendered: `redirect()`/`notFound()` throw their control-flow
// signal at render time, which fails during static generation — this is the exact defect
// the route carried before (comment preserved from the prior version): a static attempt
// silently produced 200s for both the alias-redirect and the unknown-slug 404 case instead
// of an actual redirect/404. `force-dynamic` is required, not optional, for a page whose
// body conditionally redirects or 404s based on a live DB read.
export const dynamic = 'force-dynamic';

function freshnessLabel(iso: string, isAr: boolean): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return isAr ? 'اليوم' : 'today';
  if (days === 1) return isAr ? 'أمس' : 'yesterday';
  return isAr ? `قبل ${days} يومًا` : `${days} days ago`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const isAr = locale !== 'en';
  const cat = await findNavigableCategory(slug);

  if (!cat) {
    return {
      title: isAr ? 'الفئة غير متاحة' : 'Category unavailable',
      robots: { index: false, follow: true },
    };
  }

  const name = isAr ? cat.labelAr : cat.labelEn;
  const alternates = buildAlternates(`/categories/${cat.slug}`, locale);
  const overview = await getCategoryOverview(cat.key);

  const description = overview.priceRange
    ? (isAr
        ? `نقارن أسعار ${overview.comparableCount} من ${name} بين أكثر من متجر سعودي — نطاق سعري مرصود من ${overview.priceRange.min} إلى ${overview.priceRange.max} ريال.`
        : `We compare ${overview.comparableCount} ${name.toLowerCase()} across more than one Saudi retailer — observed price range ${overview.priceRange.min}–${overview.priceRange.max} SAR.`)
    : (isAr
        ? `قارن أسعار ${name} بين متاجر سعودية يرصدها توفيري.`
        : `Compare ${name.toLowerCase()} prices across Saudi retailers tracked by Tawveeri.`);

  return {
    title: isAr ? `${name} — قارن الأسعار` : `${name} — compare prices`,
    description,
    alternates,
  };
}

export default async function CategorySlugPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isAr = locale !== 'en';
  const cat = await findNavigableCategory(slug);
  if (!cat) notFound();

  // Aliases (`ac`, `aircon`, …) and case/spacing variants resolve to the SAME category —
  // consolidate onto the one canonical slug rather than letting several URLs serve
  // identical content (the exact duplicate-content failure ADR-156/ADR-189 already found
  // and fixed once, in a different place).
  //
  // permanentRedirect, not redirect (2026-08-09 crawler truth parity, Section 27): this
  // mapping is permanent by construction (an alias never becomes its own canonical slug) —
  // 308 tells crawlers to consolidate link equity onto the canonical URL instead of
  // re-checking the alias forever.
  if (slug !== cat.slug) permanentRedirect(`/${locale}/categories/${cat.slug}`);

  const name = isAr ? cat.labelAr : cat.labelEn;
  const overview = await getCategoryOverview(cat.key);
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/${locale}/categories/${cat.slug}`;

  // Facet tier (2026-08-25, category-facet-pages mission) — AC-only today, per the plan's
  // "single category, don't pad" scope. Reads the SAME live gate the facet pages themselves
  // enforce, so a link never points at a facet that would 404.
  const acFacets = cat.key === 'air_conditioner' ? await getQualifyingAcFacets() : [];

  // The gate that put this category in navigation at all requires ≥30 comparable
  // canonicals; a mid-flight drop below that between the nav computation and this render
  // is the only way `products` is empty. Handle it honestly rather than assume it cannot
  // happen — same posture as the compare page's own empty state.
  if (overview.products.length === 0) {
    return (
      <PublicPageShell locale={locale}>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="mb-4 text-5xl" aria-hidden="true">{cat.emoji}</div>
          <h1 className="text-xl font-bold text-on-surface">{name}</h1>
          <p className="mx-auto mt-2 max-w-sm text-on-surface-variant">
            {isAr
              ? 'لا تتوفر مقارنة أسعار كافية لهذه الفئة حاليًا — ابحث مباشرة أو جرّب لاحقًا.'
              : "There isn't enough price comparison for this category right now — search directly or check back later."}
          </p>
          <Link
            href={`/${locale}/search?q=${encodeURIComponent(cat.query)}`}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[var(--brand-green)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-green-dark)]"
          >
            {isAr ? `ابحث عن ${name}` : `Search ${name}`}
          </Link>
        </div>
      </PublicPageShell>
    );
  }

  /**
   * WHAT A MACHINE CAN READ HERE (same discipline as ADR-189's compare page): a
   * `CollectionPage` naming the category, plus an `ItemList` of the exact products
   * rendered below — same identity keys, same URLs, same order. No price is asserted at
   * the category level; each listed product's own page is where the priced
   * `AggregateOffer` lives. A `BreadcrumbList` mirrors the visible breadcrumb nav.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isAr ? `${name} — مقارنة الأسعار` : `${name} — price comparison`,
    url: canonicalUrl,
    // GEO readiness audit (2026-08-25, docs/CATEGORY-PAGES-PLAN.md): AI answer engines weigh
    // freshness heavily, and structured `dateModified` removes the ambiguity a relative
    // "أحدث رصد اليوم" badge alone leaves for a machine reader. Reuses the SAME
    // `freshestObservedAt` the freshness badge below already renders — no new query, no new
    // claim, just the existing fact stated in the format a crawler/LLM can parse directly.
    ...(overview.freshestObservedAt ? { dateModified: overview.freshestObservedAt } : {}),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: isAr ? 'الرئيسية' : 'Home', item: `${baseUrl}/${locale}` },
        { '@type': 'ListItem', position: 2, name: isAr ? 'الفئات' : 'Categories', item: `${baseUrl}/${locale}/categories` },
        { '@type': 'ListItem', position: 3, name, item: canonicalUrl },
      ],
    },
    mainEntity: {
      '@type': 'ItemList',
      // `comparableCount`, not `products.length` (2026-08-25 fix): `getCategoryOverview`
      // caps `products` at PRODUCTS_LIMIT (60) for a renderable grid, but the page's own
      // visible prose above states the TRUE total (`overview.comparableCount` — 172 for
      // this category today, only 60 of which get a card). Before this fix, numberOfItems
      // silently reported the capped 60 while the h1 subtitle said 172 on the same
      // render — structured data disagreeing with the visible page is exactly what
      // ADR-189 calls "a fabricated claim with a schema wrapper on it". `numberOfItems` is
      // schema.org-valid as the list's TRUE size with `itemListElement` enumerating a
      // ranked subset (the same pattern Google's own paginated-ItemList guidance uses) —
      // each listed item's `position` still reflects its real rank (rows are ordered by
      // `store_count desc` before the cap is applied), so nothing here is invented.
      numberOfItems: overview.comparableCount,
      itemListElement: overview.products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${baseUrl}/${locale}${p.compareUrl}`,
        name: isAr ? p.nameAr : (p.nameEn || p.nameAr),
      })),
    },
  };

  // Category buying-guide content (2026-08-11, Saudi Shopper Language & Demand Discovery
  // mission, search/AI-discovery phase) — every point is grounded in a real priority the
  // decision engine already scores for this category (see category-guide.ts's own header).
  // FAQPage schema is a SEPARATE JSON-LD block from the CollectionPage/ItemList one above —
  // multiple JSON-LD scripts per page is valid schema.org practice, keeping each type's own
  // shape clean rather than overloading one mainEntity.
  const guide = getCategoryGuide(cat.key, locale);
  const guideJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <PublicPageShell locale={locale}>
      <CategoryViewTracker category={cat.key} facet={null} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(guideJsonLd) }}
      />
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Link href={`/${locale}`} className="hover:text-on-surface transition-colors">
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <Link href={`/${locale}/categories`} className="hover:text-on-surface transition-colors">
            {isAr ? 'الفئات' : 'Categories'}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <span className="text-on-surface font-medium">{name}</span>
        </nav>

        {/* ── Header ── */}
        <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden="true">{cat.emoji}</span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-on-surface leading-snug">
                {name}
              </h1>
              {/* GEO readiness audit (2026-08-25): a single, self-contained, dated sentence
                  stating the count + observed price range — quotable verbatim by an AI
                  answer engine, not split across this paragraph and a separate badge below.
                  Same "observed range" framing as the badges/generateMetadata description
                  already use (LAUNCH_VOCABULARY.md — never an absolute "cheapest" claim);
                  every number here is already fetched, nothing new is computed. */}
              <p className="mt-1 text-sm text-on-surface-variant">
                {isAr
                  ? `نقارن أسعار ${overview.comparableCount} من ${name} بين أكثر من متجر سعودي${overview.priceRange ? ` — نطاق سعري مرصود من ${overview.priceRange.min} إلى ${overview.priceRange.max} ريال` : ''}${overview.freshestObservedAt ? `، آخر رصد ${freshnessLabel(overview.freshestObservedAt, true)}` : ''}. لكل منتج نعرض من أي متجر جاء السعر ومتى رصدناه.`
                  : `We compare ${overview.comparableCount} ${name.toLowerCase()} across more than one Saudi retailer${overview.priceRange ? ` — observed price range ${overview.priceRange.min}–${overview.priceRange.max} SAR` : ''}${overview.freshestObservedAt ? `, most recently observed ${freshnessLabel(overview.freshestObservedAt, false)}` : ''}. Each product shows which retailer priced it and when we observed it.`}
              </p>
            </div>
          </div>

          {(overview.priceRange || overview.freshestObservedAt || overview.brands.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color:var(--color-outline-variant)] pt-4">
              {overview.priceRange && (
                <Badge variant="secondary" className="text-xs">
                  {isAr
                    ? `النطاق السعري المرصود: ${overview.priceRange.min}–${overview.priceRange.max} ر.س`
                    : `Observed range: ${overview.priceRange.min}–${overview.priceRange.max} SAR`}
                </Badge>
              )}
              {overview.freshestObservedAt && (
                <Badge variant="outline" className="text-xs">
                  {isAr
                    ? `أحدث رصد ${freshnessLabel(overview.freshestObservedAt, true)}`
                    : `Freshest observation ${freshnessLabel(overview.freshestObservedAt, false)}`}
                </Badge>
              )}
              {overview.brands.slice(0, 6).map((b) => (
                <Badge key={b.name} variant="outline" className="text-xs">{b.name}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* ── Facet links (AC-only today — see docs/CATEGORY-PAGES-PLAN.md §3) ── */}
        {acFacets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-on-surface-variant">
              {isAr ? 'تصفّح حسب:' : 'Browse by:'}
            </span>
            {acFacets.map((f) => (
              <Link
                key={f.slug}
                href={`/${locale}/categories/${cat.slug}/${f.slug}`}
                className="inline-flex items-center rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container)] px-3 py-1 text-xs font-medium text-on-surface transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)]"
              >
                {isAr ? f.labelAr : f.labelEn} ({f.count})
              </Link>
            ))}
          </div>
        )}

        {/* ── Product grid ── */}
        <CategoryProductGrid products={overview.products} locale={locale} isAr={isAr} category={cat.key} />

        {/* ── Fallback to broader search ── */}
        <div className="text-center">
          <Link
            href={`/${locale}/search?q=${encodeURIComponent(cat.query)}`}
            className="text-sm font-semibold text-[var(--brand-green-dark)] hover:underline"
          >
            {isAr ? `تصفّح نتائج بحث أوسع لـ ${name}` : `Browse broader search results for ${name}`}
          </Link>
        </div>

        {/* ── Buying guide (2026-08-11) — native <details>, zero client JS, fully indexable,
             same accessible-accordion pattern already used on the site FAQ page. ── */}
        {guide.length > 0 && (
          <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-on-surface mb-3">
              {isAr ? `كيف تختار ${name}؟` : `How to choose ${name.toLowerCase()}`}
            </h2>
            <div className="flex flex-col gap-2.5">
              {guide.map((item) => (
                <details
                  key={item.q}
                  className="rounded-xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container)] p-3.5"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-on-surface list-none">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-on-surface-variant">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 py-2 text-xs text-on-surface-variant">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-green)]" />
          <span>{isAr ? 'مدعوم بـ TPS — نظام هوية المنتج في توفيري' : "Powered by TPS — Tawveeri's product identity system"}</span>
        </div>
      </div>
    </PublicPageShell>
  );
}
