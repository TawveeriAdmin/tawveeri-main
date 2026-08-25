// src/app/[locale]/(category)/categories/[slug]/[facet]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Facet tier, one level below the existing /categories/[slug] page (ADR-226).
// Full derivation: docs/CATEGORY-PAGES-PLAN.md. Summary:
//
// - air_conditioner ONLY, today — the one category whose identity_key is already a clean
//   structured spec key (brand|ac_type|series|BTU|technology|cooling_mode), so a facet
//   slice is provably distinct data, not a template with a swapped token. See
//   getAcFacetOverview.ts for the full facet derivation and the gate (MIN_COMPARABLE_FOR_FACET).
// - Same rendering discipline as the parent page: `force-dynamic` (a conditional
//   redirect/404 driven by a live DB read cannot be statically prerendered — ADR-226 found
//   and fixed the soft-404 defect this exact class of page can produce), CollectionPage +
//   ItemList + BreadcrumbList JSON-LD, NEVER AggregateOffer/Product at this level (that
//   lives on /compare/[key] — ADR-189).
// - No fabrication: a facet whose live count has fallen below the gate 404s rather than
//   rendering a near-empty page — the exact "scaled content abuse" pattern this plan's own
//   research names and rejects.
// ─────────────────────────────────────────────────────────────────────────────

import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { Badge } from '@/components/ui/badge';
import { findNavigableCategory } from '@/lib/intelligence/navigable-categories';
import { getAcFacetOverview } from '@/lib/catalog/getAcFacetOverview';
import { buildAlternates, getBaseUrl } from '@/lib/seo/metadata';
import { getCategoryGuide } from '@/lib/seo/category-guide';
import { CategoryProductGrid } from '@/components/catalog/category-product-grid';
import { CategoryViewTracker } from '@/components/catalog/category-view-tracker';

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
  params: Promise<{ locale: string; slug: string; facet: string }>;
}): Promise<Metadata> {
  const { locale, slug, facet } = await params;
  const isAr = locale !== 'en';
  const cat = await findNavigableCategory(slug);

  if (!cat || cat.key !== 'air_conditioner') {
    return { title: isAr ? 'غير متاح' : 'Unavailable', robots: { index: false, follow: true } };
  }

  const result = await getAcFacetOverview(facet);
  if (!result) {
    return { title: isAr ? 'غير متاح' : 'Unavailable', robots: { index: false, follow: true } };
  }

  const { facet: f, overview } = result;
  const categoryName = isAr ? cat.labelAr : cat.labelEn;
  const facetLabel = isAr ? f.labelAr : f.labelEn;
  const alternates = buildAlternates(`/categories/${cat.slug}/${f.slug}`, locale);

  const description = overview.priceRange
    ? (isAr
        ? `نقارن أسعار ${overview.comparableCount} من ${categoryName} — ${facetLabel} — بين أكثر من متجر سعودي، نطاق سعري مرصود من ${overview.priceRange.min} إلى ${overview.priceRange.max} ريال.`
        : `We compare ${overview.comparableCount} ${categoryName.toLowerCase()} — ${facetLabel} — across more than one Saudi retailer, observed price range ${overview.priceRange.min}–${overview.priceRange.max} SAR.`)
    : (isAr
        ? `قارن أسعار ${categoryName} — ${facetLabel} — بين متاجر سعودية يرصدها توفيري.`
        : `Compare ${categoryName.toLowerCase()} — ${facetLabel} — prices across Saudi retailers tracked by Tawveeri.`);

  return {
    title: isAr ? `${categoryName} ${facetLabel} — قارن الأسعار` : `${categoryName} ${facetLabel} — compare prices`,
    description,
    alternates,
  };
}

export default async function CategoryFacetPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; facet: string }>;
}) {
  const { locale, slug, facet } = await params;
  const isAr = locale !== 'en';
  const cat = await findNavigableCategory(slug);
  if (!cat) notFound();

  // Same alias/canonical-slug consolidation the parent page does — a facet URL under an
  // alias slug (e.g. /categories/ac/lg) must not exist as a second, duplicate-content path.
  if (slug !== cat.slug) permanentRedirect(`/${locale}/categories/${cat.slug}/${facet}`);

  // Facets exist for air_conditioner only today (docs/CATEGORY-PAGES-PLAN.md §1/§3) — any
  // other category's facet URL is simply not a real page, not a thin one.
  if (cat.key !== 'air_conditioner') notFound();

  const result = await getAcFacetOverview(facet);
  if (!result) notFound();
  const { facet: f, overview } = result;

  const categoryName = isAr ? cat.labelAr : cat.labelEn;
  const facetLabel = isAr ? f.labelAr : f.labelEn;
  const baseUrl = getBaseUrl();
  const categoryPath = `/${locale}/categories/${cat.slug}`;
  const canonicalUrl = `${baseUrl}/${locale}/categories/${cat.slug}/${f.slug}`;
  const categoryUrl = `${baseUrl}${categoryPath}`;

  /**
   * Same discipline as the parent page and ADR-189: CollectionPage + ItemList naming the
   * exact products rendered below, a 4-level BreadcrumbList mirroring the visible nav. No
   * AggregateOffer/Product here — this lists many different products, not one product with
   * many sellers (docs/CATEGORY-PAGES-PLAN.md §4/§5).
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isAr ? `${categoryName} ${facetLabel} — مقارنة الأسعار` : `${categoryName} ${facetLabel} — price comparison`,
    url: canonicalUrl,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: isAr ? 'الرئيسية' : 'Home', item: `${baseUrl}/${locale}` },
        { '@type': 'ListItem', position: 2, name: isAr ? 'الفئات' : 'Categories', item: `${baseUrl}/${locale}/categories` },
        { '@type': 'ListItem', position: 3, name: categoryName, item: categoryUrl },
        { '@type': 'ListItem', position: 4, name: facetLabel, item: canonicalUrl },
      ],
    },
    mainEntity: {
      '@type': 'ItemList',
      // comparableCount, not products.length — same numberOfItems-vs-cap fix as the parent
      // category page (2026-08-25), so the two never disagree with each other's convention.
      // See that page's own comment for the full rationale.
      numberOfItems: overview.comparableCount,
      itemListElement: overview.products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${baseUrl}/${locale}${p.compareUrl}`,
        name: isAr ? p.nameAr : (p.nameEn || p.nameAr),
      })),
    },
  };

  // Facet-scoped FAQ: the BTU-band pages specialize AC's existing "right BTU capacity"
  // question from category-guide.ts for this facet's own band — never a fabricated
  // question, reusing the same real Q&A already grounded in a decision-engine priority.
  // Brand facets get no FAQPage block (no genuine, non-generic brand-specific question
  // exists in category-guide.ts today — better to omit than to invent one).
  const baseGuide = getCategoryGuide(cat.key, locale);
  const btuQuestion = f.type === 'btu' ? baseGuide.find((qa) => /BTU|وحدة حرارية/i.test(qa.q)) : null;
  const guide = btuQuestion
    ? [{
        q: isAr ? `${btuQuestion.q} (${facetLabel})` : `${btuQuestion.q} (${facetLabel})`,
        a: btuQuestion.a,
      }]
    : [];
  const guideJsonLd = guide.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  } : null;

  return (
    <PublicPageShell locale={locale}>
      <CategoryViewTracker category={cat.key} facet={f.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {guideJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(guideJsonLd) }}
        />
      )}
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-on-surface-variant flex-wrap">
          <Link href={`/${locale}`} className="hover:text-on-surface transition-colors">
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <Link href={`/${locale}/categories`} className="hover:text-on-surface transition-colors">
            {isAr ? 'الفئات' : 'Categories'}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <Link href={categoryPath} className="hover:text-on-surface transition-colors">
            {categoryName}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <span className="text-on-surface font-medium">{facetLabel}</span>
        </nav>

        {/* ── Header ── */}
        <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden="true">{cat.emoji}</span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-on-surface leading-snug">
                {categoryName} — {facetLabel}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                {isAr
                  ? `نقارن أسعار ${overview.comparableCount} من ${categoryName} — ${facetLabel} — بين أكثر من متجر سعودي.`
                  : `We compare ${overview.comparableCount} ${categoryName.toLowerCase()} — ${facetLabel} — across more than one Saudi retailer.`}
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
        <CategoryProductGrid products={overview.products} locale={locale} isAr={isAr} category={cat.key} facet={f.slug} />

        {/* ── Fallback to parent category ── */}
        <div className="text-center">
          <Link
            href={categoryPath}
            className="text-sm font-semibold text-[var(--brand-green-dark)] hover:underline"
          >
            {isAr ? `اعرض كل ${categoryName}` : `See all ${categoryName.toLowerCase()}`}
          </Link>
        </div>

        {/* ── Facet-specialized buying guide, only where a genuine question exists ── */}
        {guide.length > 0 && (
          <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-on-surface mb-3">
              {isAr ? `${facetLabel} — ما تحتاج معرفته` : `${facetLabel} — what to know`}
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
