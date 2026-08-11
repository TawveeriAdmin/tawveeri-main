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
import { ArrowRight, ShieldCheck, Store } from 'lucide-react';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { findNavigableCategory } from '@/lib/intelligence/navigable-categories';
import { getCategoryOverview } from '@/lib/catalog/getCategoryOverview';
import { buildAlternates, getBaseUrl } from '@/lib/seo/metadata';
import { getCategoryGuide } from '@/lib/seo/category-guide';

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
      numberOfItems: overview.products.length,
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
              <p className="mt-1 text-sm text-on-surface-variant">
                {isAr
                  ? `نقارن أسعار ${overview.comparableCount} من ${name} بين أكثر من متجر سعودي — لكل منتج نعرض من أي متجر جاء السعر ومتى رصدناه.`
                  : `We compare ${overview.comparableCount} ${name.toLowerCase()} across more than one Saudi retailer — each shows which retailer priced it and when we observed it.`}
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

        {/* ── Product grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {overview.products.map((p) => {
            const displayName = isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr);
            return (
              <Link
                key={p.identityKey}
                href={`/${locale}${p.compareUrl}`}
                className="flex flex-col rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-4 transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)]"
              >
                <div className="flex items-start justify-between gap-2">
                  {p.brand && <Badge variant="outline" className="text-[11px]">{p.brand}</Badge>}
                  <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                    <Store className="h-3 w-3" />
                    {isAr ? `${p.storeCount} متاجر` : `${p.storeCount} stores`}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface line-clamp-2 min-h-[2.5rem]">
                  {displayName}
                </p>
                {p.lowestPrice != null && (
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-[11px] text-on-surface-variant">{isAr ? 'من' : 'from'}</span>
                    <Price amount={p.lowestPrice} className="text-lg font-extrabold text-[var(--brand-green-dark)]" symbolClassName="w-4 h-4" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>

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
