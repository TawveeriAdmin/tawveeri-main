// Dedicated "categories only" destination (Founder UX directive). Large, equal, comfortable cards —
// one question per screen: "what type of product?" Server-rendered (just links), no client JS needed.
//
// The tile list is DERIVED LIVE, never hardcoded — see src/lib/intelligence/navigable-categories.ts
// and docs/CATEGORY-NAVIGATION-POLICY.md (ADR-150). The rule is the constant; which categories
// clear it is recomputed on every revalidation, so a category that gains or loses comparable
// depth appears or disappears on its own. A baked-in list would go stale exactly the way the
// hardcoded homepage figures did.
//
// The old hardcoded CATS list promoted `cameras` (3 comparable) and `gaming` (no such category in
// production at all) — tiles that could not deliver a comparison. `./categories.ts` is retained
// only for the /categories/<slug> alias routing it also serves.
import { PublicPageShell } from '@/components/public/public-page-shell';
import Link from 'next/link';

import { getNavigableCategories } from '@/lib/intelligence/navigable-categories';

// Recompute hourly. The measurement is one small indexed read, and the list must track
// production rather than the deploy.
export const revalidate = 3600;

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';
  const cats = await getNavigableCategories();

  return (
    <PublicPageShell locale={locale}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '10px 0 48px', textAlign: isAr ? 'right' : 'left' }}>
        <h1 style={{ fontSize: 'clamp(22px, 4.5vw, 30px)', fontWeight: 900, color: 'var(--color-on-surface)', margin: '6px 0 6px' }}>
          {isAr ? 'تصفّح الفئات' : 'Browse categories'}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--color-on-surface-variant)', margin: '0 0 26px' }}>
          {isAr
            ? 'هذه الفئات نقارن فيها منتجات بين أكثر من متجر. ابحث مباشرة عن أي منتج آخر.'
            : 'These are the categories where we compare products across more than one retailer. Search directly for anything else.'}
        </p>

        {cats.length === 0 ? (
          // No measurement, no tiles. Never a grid of categories we cannot stand behind.
          <p style={{ fontSize: 15, color: 'var(--color-on-surface-variant)' }}>
            {isAr ? 'لا تتوفر فئات للعرض الآن. جرّب البحث مباشرة.' : 'No categories to show right now. Try searching directly.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
            {cats.map((c) => (
              <Link
                key={c.key}
                href={`/${locale}/categories/${c.slug}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                  textDecoration: 'none', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
                  borderRadius: 20, padding: '26px 12px', minHeight: 132,
                }}
              >
                <span style={{ fontSize: 36, lineHeight: 1 }} aria-hidden="true">{c.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface)', textAlign: 'center' }}>
                  {isAr ? c.labelAr : c.labelEn}
                </span>
                {/* Live, defined, and the reason the tile is here at all: products in this
                    category carrying offers from two or more retailers. */}
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                  {isAr ? `${c.comparable} منتج قابل للمقارنة` : `${c.comparable} comparable`}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicPageShell>
  );
}
