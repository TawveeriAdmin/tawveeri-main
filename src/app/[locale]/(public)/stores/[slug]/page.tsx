import type { Metadata } from 'next';
import StoreDetailClient from './store-detail-client';
import { getStoreSeoData } from '@/lib/seo/store-data';
import { buildAlternates, getBaseUrl } from '@/lib/seo/metadata';
import { JsonLd, buildStoreJsonLd } from '@/lib/seo/json-ld';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const store = await getStoreSeoData(slug);

  if (!store) {
    return {
      title: locale === 'ar' ? 'المتجر غير موجود' : 'Store Not Found',
    };
  }

  const name = locale === 'ar' ? store.name_ar : store.name_en;
  const description = locale === 'ar' ? store.description_ar : store.description_en;
  const baseUrl = getBaseUrl();
  const path = `/stores/${slug}`;

  const metaDescription = description
    || (locale === 'ar'
      ? `${name} - اكتشف المنتجات والأسعار والعروض. ${store.total_products || 0} منتج متاح.`
      : `${name} - Discover products, prices, and deals. ${store.total_products || 0} products available.`);

  return {
    title: name,
    description: metaDescription,
    alternates: buildAlternates(path),
    openGraph: {
      title: name,
      description: metaDescription,
      url: `${baseUrl}/${locale}${path}`,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      type: 'website',
      ...(store.logo_url && {
        images: [{ url: store.logo_url, width: 400, height: 400, alt: name }],
      }),
    },
    twitter: {
      title: name,
      description: metaDescription,
      ...(store.logo_url && { images: [store.logo_url] }),
    },
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const store = await getStoreSeoData(slug);

  return (
    <>
      {store && (
        <JsonLd data={buildStoreJsonLd(store, locale)} />
      )}
      <StoreDetailClient />
    </>
  );
}
