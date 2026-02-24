import type { Metadata } from 'next';
import ProductDetailClient from './product-detail-client';
import { getProductSeoData } from '@/lib/seo/product-data';
import { buildAlternates, getBaseUrl } from '@/lib/seo/metadata';
import { JsonLd, buildProductJsonLd } from '@/lib/seo/json-ld';
import { formatPrice } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProductSeoData(slug);

  if (!product) {
    return {
      title: locale === 'ar' ? 'المنتج غير موجود' : 'Product Not Found',
    };
  }

  const name = locale === 'ar' ? product.name_ar : product.name_en;
  const description = locale === 'ar' ? product.description_ar : product.description_en;
  const baseUrl = getBaseUrl();
  const path = `/products/${slug}`;

  const priceText = product.min_price
    ? `${formatPrice(product.min_price)} SAR`
    : '';
  const storeText = product.store_count > 0
    ? locale === 'ar'
      ? `من ${product.store_count} متاجر`
      : `from ${product.store_count} stores`
    : '';

  const metaDescription = description
    || (locale === 'ar'
      ? `${name} - ${product.brand}. ${priceText} ${storeText}. قارن الأسعار واحصل على أفضل عرض.`
      : `${name} - ${product.brand}. ${priceText} ${storeText}. Compare prices and get the best deal.`);

  return {
    title: name,
    description: metaDescription,
    alternates: buildAlternates(path),
    openGraph: {
      title: `${name} | ${priceText}`,
      description: metaDescription,
      url: `${baseUrl}/${locale}${path}`,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      type: 'website',
      ...(product.image_urls?.[0] && {
        images: [{ url: product.image_urls[0], width: 800, height: 800, alt: name }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description: metaDescription,
      ...(product.image_urls?.[0] && { images: [product.image_urls[0]] }),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = await getProductSeoData(slug);

  return (
    <>
      {product && (
        <JsonLd data={buildProductJsonLd(product, locale)} />
      )}
      <ProductDetailClient />
    </>
  );
}
