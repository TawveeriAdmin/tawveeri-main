// Dedicated "categories only" destination (Founder UX directive). Large, equal, comfortable cards —
// one question per screen: "what type of product?" Server-rendered (just links), no client JS needed.
import { PublicPageShell } from '@/components/public/public-page-shell';
import Link from 'next/link';

import { CATS } from './categories';

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';

  return (
    <PublicPageShell locale={locale}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '10px 0 48px', textAlign: isAr ? 'right' : 'left' }}>
        <h1 style={{ fontSize: 'clamp(22px, 4.5vw, 30px)', fontWeight: 900, color: 'var(--color-on-surface)', margin: '6px 0 6px' }}>
          {isAr ? 'تصفّح الفئات' : 'Browse categories'}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--color-on-surface-variant)', margin: '0 0 26px' }}>
          {isAr ? 'اختر فئة وقارن الأسعار عبر متاجر السعودية.' : 'Pick a category and compare prices across Saudi stores.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
          {CATS.map((c) => (
            <Link
              key={c.q}
              href={`/${locale}/search?q=${encodeURIComponent(c.q)}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                textDecoration: 'none', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
                borderRadius: 20, padding: '28px 12px', minHeight: 132,
              }}
            >
              <span style={{ fontSize: 38, lineHeight: 1 }}>{c.e}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface)' }}>{isAr ? c.ar : c.en}</span>
            </Link>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
