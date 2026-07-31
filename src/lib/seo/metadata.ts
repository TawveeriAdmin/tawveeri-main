import type { Metadata } from 'next';

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';
}

/**
 * The brand mark used when a page has no image of its own. Real asset, real dimensions —
 * `public/logos/Tawveeri.png` is 434×429.
 *
 * WHY THIS EXISTS: measured 2026-07-31, no page emitted `og:image` or `twitter:image` at all,
 * so every link shared to WhatsApp, X or Slack rendered a blank card — while simultaneously
 * declaring `twitter:card=summary_large_image`, i.e. promising a large image and supplying none.
 *
 * WHY THE DIMENSIONS ARE DECLARED HONESTLY: the previous code asserted `width: 1200,
 * height: 630` for ANY image passed in, including product photos that are nothing like that
 * shape. Scrapers use those numbers to lay the card out before fetching the file, so a false
 * dimension is a rendering bug and a small untruth in our own metadata. We now assert
 * dimensions only for the asset we control, and omit them for images we do not measure.
 */
export const BRAND_OG_IMAGE = { path: '/logos/Tawveeri.png', width: 434, height: 429 } as const;

function ogImageFor(image: string | undefined, baseUrl: string) {
  if (image) return { url: image };            // caller-supplied: dimensions unknown, so unstated
  return {
    url: `${baseUrl}${BRAND_OG_IMAGE.path}`,
    width: BRAND_OG_IMAGE.width,
    height: BRAND_OG_IMAGE.height,
    alt: 'Tawveeri',
  };
}

export function buildAlternates(path: string) {
  const baseUrl = getBaseUrl();
  // Remove leading locale segment if present
  const cleanPath = path.replace(/^\/(ar|en)/, '');
  return {
    canonical: `${baseUrl}/ar${cleanPath}`,
    languages: {
      ar: `${baseUrl}/ar${cleanPath}`,
      en: `${baseUrl}/en${cleanPath}`,
    },
  };
}

export function buildPageMetadata({
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  locale,
  path,
  image,
}: {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  locale: string;
  path: string;
  image?: string;
}): Metadata {
  const title = locale === 'ar' ? titleAr : titleEn;
  const description = locale === 'ar' ? descriptionAr : descriptionEn;
  const baseUrl = getBaseUrl();

  return {
    title,
    description,
    alternates: buildAlternates(path),
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}${path.replace(/^\/(ar|en)/, '')}`,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      images: [ogImageFor(image, baseUrl)],
    },
    twitter: {
      // The card type must MATCH the image we actually have. Every page previously declared
      // `summary_large_image` while supplying NO image at all, so every share rendered a blank
      // card. A page with a real wide product image gets the large card; otherwise the square
      // brand mark gets the small card, which is what a square image is for.
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: [ogImageFor(image, baseUrl).url],
    },
  };
}
