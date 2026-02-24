import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/store/',
          '/*/dashboard/',
          '/*/profile/',
          '/*/wishlist/',
          '/*/notifications/',
          '/*/price-alerts/',
          '/*/settings/',
          '/*/auth/',
          '/*/compare/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
