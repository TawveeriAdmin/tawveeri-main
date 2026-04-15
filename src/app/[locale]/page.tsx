import type { Metadata } from 'next';
import LandingPageClient from './landing-client';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { JsonLd, buildWebSiteJsonLd } from '@/lib/seo/json-ld';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    titleAr: 'توفيري | قارن أسعار الإلكترونيات في السعودية',
    titleEn: 'Tawveeri | Compare Electronics Prices in Saudi Arabia',
    descriptionAr: 'قارن أسعار الإلكترونيات من أمازون ونون وجرير واكسترا والمنيع. تنبيهات الأسعار، تتبع العروض، وأفضل التخفيضات في السعودية.',
    descriptionEn: 'Compare electronics prices from Amazon, Noon, Jarir, Extra & Almanea. Price alerts, deal tracking, and the best discounts in Saudi Arabia.',
    locale,
    path: '',
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      <JsonLd data={buildWebSiteJsonLd(locale)} />
      <PublicPageShell locale={locale} fullBleed>
        <LandingPageClient />
      </PublicPageShell>
    </>
  );
}
