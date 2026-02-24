import type { Metadata } from 'next';

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';
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
      ...(image && { images: [{ url: image, width: 1200, height: 630 }] }),
    },
    twitter: {
      title,
      description,
      ...(image && { images: [image] }),
    },
  };
}
