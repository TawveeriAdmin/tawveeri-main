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

/**
 * `rel=canonical` + `hreflang` for a page. THE ONLY canonical emitter in the app.
 *
 * EACH LOCALE SELF-CANONICALISES. This previously pointed every page — including every `/en`
 * page — at the `/ar` URL. A cross-language canonical is not a preference, it is a statement
 * that the English page is a DUPLICATE of the Arabic one: search engines drop it from the index
 * and fold its signals into `/ar`. The site then ships a full English translation, an
 * `og:locale=en_US`, an `hreflang="en"` alternate and an `<html lang="en">` — and simultaneously
 * tells crawlers not to index any of it. The hreflang pair below is what expresses "these are
 * the same content in two languages"; canonical is not the tool for that, and using it for that
 * cancels the hreflang.
 *
 * `locale` is REQUIRED on purpose. An optional parameter defaulting to `ar` would let a new call
 * site silently reintroduce the exact defect, and this is one of those defects that breaks
 * nothing visible — the page renders, the tag is present and well-formed, and only the index
 * knows.
 */
export function buildAlternates(path: string, locale: string) {
  const baseUrl = getBaseUrl();
  // Remove leading locale segment if present
  const cleanPath = path.replace(/^\/(ar|en)/, '');
  // Anything unrecognised falls back to the default rather than emitting `/xx/…` as a canonical.
  const self = locale === 'en' ? 'en' : 'ar';
  return {
    canonical: `${baseUrl}/${self}${cleanPath}`,
    languages: {
      ar: `${baseUrl}/ar${cleanPath}`,
      en: `${baseUrl}/en${cleanPath}`,
      // `x-default` (2026-08-11, Global Shopping Discoverability & AI Commerce mission) —
      // Google's own hreflang guidance recommends an explicit default for visitors/crawlers
      // whose language doesn't match any listed alternate. Confirmed absent by a technical audit
      // (present-but-optional, not a defect on its own, but a real, free, one-line completeness
      // gain applied here once for every page that already calls this shared builder). Points at
      // Arabic — the app's own documented, already-served default locale.
      'x-default': `${baseUrl}/ar${cleanPath}`,
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
    alternates: buildAlternates(path, locale),
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
