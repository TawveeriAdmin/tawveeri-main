// LOCALE LAYOUT — metadata and locale validation only.
//
// The HTML shell, the fonts and every provider moved to `src/app/layout.tsx` so that
// `app/not-found.tsx` — which is resolved ABOVE this segment — renders inside the real site
// shell, and so that `<html lang>`/`<html dir>` are correct in the SERVED BYTES rather than
// patched by a script after first paint. See the root layout for the full reasoning.
//
// What stays here is what genuinely needs the route param: the locale-aware metadata, and the
// guard that turns an unknown `[locale]` into a 404 instead of a half-translated page.
//
// 2026-09-04 — entity positioning: default title/description are decision-helper /
// observed-price / non-seller. Deal/coupon hero language belongs on /deals only.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildAlternates, getBaseUrl, BRAND_OG_IMAGE } from '@/lib/seo/metadata';

const locales = ['ar', 'en'] as const;

const META = {
  ar: {
    title: 'توفيري | مساعد قرار الشراء ومقارنة أسعار السعودية',
    description:
      'قارن أسعار الإلكترونيات والأجهزة المنزلية المرصودة من متاجر سعودية. ما نبيع — نوجّهك للمتجر. نعرض المصدر وتاريخ الرصد.',
  },
  en: {
    title: 'Tawveeri | Saudi shopping decision helper — compare observed prices',
    description:
      "Compare observed electronics & appliance prices across Saudi stores. We don't sell — we send you to the merchant. Source + observation date on every price.",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = getBaseUrl();
  const copy = locale === 'en' ? META.en : META.ar;

  return {
    title: {
      default: copy.title,
      template: locale === 'ar' ? '%s | توفيري' : '%s | Tawveeri',
    },
    description: copy.description,
    alternates: buildAlternates('', locale),
    openGraph: {
      title: copy.title,
      description: copy.description,
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
      title: copy.title,
      description: copy.description,
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
