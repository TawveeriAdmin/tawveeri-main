import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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

  // The 404 is raised in the PAGE COMPONENT, not here. Raising it from generateMetadata does
  // set the status, but Next then resolves the not-found boundary outside this layout and the
  // customer gets a blank page — measured: 404 with 57 bytes of body. Raised from the page, the
  // boundary renders properly AND the status is correct, now that this route group carries no
  // `loading.tsx` (see ../layout.tsx for why that file was the whole problem).
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

  // ONLY a genuine absence (`null`) may 404. `undefined` means the lookup itself failed, and
  // we fall through to the client rather than telling a shopper that a product which probably
  // exists does not — asserting absence from a fault is the mistake that created this bug.
  //
  // KNOWN LIMIT, measured 2026-07-30 on a production build: notFound() here renders the
  // not-found UI but the response still carries HTTP 200, because Next commits the status
  // before this component throws. A routing miss (/ar/no-such-route) does return 404. Not
  // claimed as fixed; tracked separately.
  if (product === null) notFound();

  return (
    <>
      {product && <JsonLd data={buildProductJsonLd(product, locale)} />}
      <ProductDetailClient />
    </>
  );
}
