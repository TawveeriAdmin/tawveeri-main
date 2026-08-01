// LOCALE LAYOUT — metadata and locale validation only.
//
// The HTML shell, the fonts and every provider moved to `src/app/layout.tsx` so that
// `app/not-found.tsx` — which is resolved ABOVE this segment — renders inside the real site
// shell, and so that `<html lang>`/`<html dir>` are correct in the SERVED BYTES rather than
// patched by a script after first paint. See the root layout for the full reasoning.
//
// What stays here is what genuinely needs the route param: the locale-aware metadata, and the
// guard that turns an unknown `[locale]` into a 404 instead of a half-translated page.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildAlternates, getBaseUrl, BRAND_OG_IMAGE } from '@/lib/seo/metadata';

const locales = ['ar', 'en'] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = getBaseUrl();

  return {
    title: {
      default: locale === 'ar'
        ? 'توفيري | منصة مقارنة أسعار الإلكترونيات'
        : 'Tawveeri | Electronics Price Comparison',
      template: locale === 'ar' ? '%s | توفيري' : '%s | Tawveeri',
    },
    description: locale === 'ar'
      ? 'قارن أسعار الإلكترونيات من أمازون ونون وجرير واكسترا والمنيع. أفضل العروض والتخفيضات في السعودية.'
      : 'Compare electronics prices from Amazon, Noon, Jarir, Extra & Almanea. Best deals in Saudi Arabia.',
    alternates: buildAlternates(''),
    openGraph: {
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      url: `${baseUrl}/${locale}`,
      // Site-wide default. Without this the homepage — the most-shared URL we have — rendered
      // a blank card everywhere. See BRAND_OG_IMAGE for why the dimensions are stated exactly.
      images: [{
        url: `${baseUrl}${BRAND_OG_IMAGE.path}`,
        width: BRAND_OG_IMAGE.width,
        height: BRAND_OG_IMAGE.height,
        alt: 'Tawveeri',
      }],
    },
    twitter: {
      // `summary`, not `summary_large_image`: the brand mark is square. Declaring the large
      // card for a square image is the mismatch that produced blank previews.
      card: 'summary',
      images: [`${baseUrl}${BRAND_OG_IMAGE.path}`],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  return <>{children}</>;
}
