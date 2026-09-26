import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import ProductDetailClient from './product-detail-client';
import { getProductSeoData, resolveLegacyProductSlug } from '@/lib/seo/product-data';
import { buildAlternates, getBaseUrl } from '@/lib/seo/metadata';
import { JsonLd, buildProductJsonLd } from '@/lib/seo/json-ld';
import { formatPrice } from '@/lib/utils';
import { findSameListingCanonical, hasArabicLetters } from '@/lib/catalog/same-listing-identity';

/**
 * ADR-389 — when the storefront row's Arabic title is not Arabic at all, or it has no image,
 * and the knowledge layer holds a canonical for the SAME merchant listing (proven by listing
 * URL equality, never by name), the page uses that documented title/image. Model codes are
 * never translated; nothing is fabricated when no such canonical exists.
 */
async function enrichFromSameListing<T extends { name_ar: string; image_urls: string[] | null; store_urls?: string[] }>(product: T) {
  const needsName = !hasArabicLetters(product.name_ar);
  const needsImage = !(product.image_urls && product.image_urls.length > 0);
  if (!needsName && !needsImage) return { product, listing: null };
  const listing = await findSameListingCanonical(product.store_urls ?? []);
  if (!listing) return { product, listing: null };
  return {
    product: {
      ...product,
      name_ar: needsName && listing.name_ar ? listing.name_ar : product.name_ar,
      image_urls: needsImage && listing.image_url ? [listing.image_url] : product.image_urls,
    },
    listing,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const raw = await getProductSeoData(slug);
  const product = raw ? (await enrichFromSameListing(raw)).product : raw;

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
    alternates: buildAlternates(path, locale),
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
  const raw = await getProductSeoData(slug);
  const enriched = raw ? await enrichFromSameListing(raw) : null;
  const product = enriched ? enriched.product : raw;

  // ONLY a genuine absence (`null`) may 404. `undefined` means the lookup itself failed, and
  // we fall through to the client rather than telling a shopper that a product which probably
  // exists does not — asserting absence from a fault is the mistake that created this bug.
  //
  // RESOLVED (originally a KNOWN LIMIT measured 2026-07-30): this `notFound()` used to render
  // the not-found UI while the response still carried HTTP 200, because a `loading.tsx`
  // Suspense boundary flushed the status before this component could throw. Fixed by moving
  // this route into its own `(product)` route group with NO `loading.tsx` — see
  // `../layout.tsx` for the full root cause and the standing rule never to add one back here.
  // Re-verified live 2026-09-07 (operational alert closure pass): a genuinely nonexistent
  // product slug now returns a real HTTP 404 on both locales, confirmed on multiple slugs.
  //
  // ADR-387: before 404ing, an OLD title-derived slug (the shape search cards/the compare
  // tray emitted until ADR-386 — e.g. `samsung-split-ac-18000-btu-rotary-compressor-heat-
  // and-cold` for the row stored as `…-bturotary-compressorheat-and-cold`) is resolved to
  // its real slug ONLY when exactly one active product's title re-derives to it, and then
  // 308s there (permanent, same as `/product/[slug]` → `/products/[slug]`). Ambiguous or
  // unmatched → the honest 404 below, never a guess and never the homepage.
  if (product === null) {
    const real = await resolveLegacyProductSlug(slug);
    if (real) permanentRedirect(`/${locale}/products/${real}`);
    notFound();
  }

  return (
    <>
      {product && <JsonLd data={buildProductJsonLd(product, locale)} />}
      <ProductDetailClient
        listingIdentity={enriched?.listing ? {
          name_ar: enriched.listing.name_ar,
          name_en: enriched.listing.name_en,
          image_url: enriched.listing.image_url,
          tps_identity_key: enriched.listing.tps_identity_key,
        } : null}
      />
    </>
  );
}
