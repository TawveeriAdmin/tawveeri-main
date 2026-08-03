// src/app/sitemap.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sitemap ديناميكي موحّد — يدمج:
//   1. الصفحات الثابتة الفعلية (مع hreflang alternates)
//   2. كتالوج TPS الجديد: /mobiles + صفحات /product/{slug} من canonical_products
// ملاحظة: أُزيلت مسارات جدول products القديم (بنية Etlaq السابقة) —
// الفهرسة الآن حصرياً من canonical_products (مصدر الحقيقة الجديد).
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from 'next';
import { getAllProductSlugs, getComparableIdentityKeys } from '@/lib/catalog/getProductComparison';

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://tawveeri.com';

const locales = ['ar', 'en'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 1) الصفحات الثابتة (الموجودة فعلاً في الموقع)
  const staticPages = [
    '',
    '/search',
    '/deals',
    '/how-it-works',
    '/privacy',
    '/terms',
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPages.flatMap((path) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? ('daily' as const) : ('weekly' as const),
      priority: path === '' ? 1.0 : 0.7,
      alternates: {
        languages: {
          ar: `${baseUrl}/ar${path}`,
          en: `${baseUrl}/en${path}`,
        },
      },
    }))
  );

  // 2) كتالوج الجوالات
  const catalogEntries: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${baseUrl}/${locale}/mobiles`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.9,
    alternates: {
      languages: {
        ar: `${baseUrl}/ar/mobiles`,
        en: `${baseUrl}/en/mobiles`,
      },
    },
  }));

  // 3) صفحات المنتجات — ADR-189
  //
  // THE PATH WAS `/product/` (SINGULAR) AND THE ROUTE IS `/products/`. Combined with the
  // knowledge-vs-storefront slug mismatch fixed in `getAllProductSlugs`, every one of the 1,190
  // product URLs this file published resolved 307 → 404. Measured on production 2026-08-03.
  // A sitemap of dead links is worse than no sitemap: it spends the crawl budget we have on
  // proving we have nothing.
  let productEntries: MetadataRoute.Sitemap = [];

  try {
    const products = await getAllProductSlugs();

    productEntries = products.flatMap((p) =>
      locales.map((locale) => ({
        url: `${baseUrl}/${locale}/products/${p.slug}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.8,
        alternates: {
          languages: {
            ar: `${baseUrl}/ar/products/${p.slug}`,
            en: `${baseUrl}/en/products/${p.slug}`,
          },
        },
      }))
    );
  } catch {
    // DB unavailable — skip dynamic entries
  }

  // 4) صفحات المقارنة — ADR-189
  //
  // The multi-retailer comparison is the only thing this product has that no competitor in
  // Saudi Arabia has, and it was published nowhere and disallowed in robots.txt. These are the
  // pages worth citing, so these are the pages we offer. Highest priority in the file, on
  // purpose: a comparison page is more valuable to a shopper than a single-retailer listing.
  let compareEntries: MetadataRoute.Sitemap = [];
  try {
    const keys = await getComparableIdentityKeys();
    compareEntries = keys.flatMap((key) => {
      const seg = encodeURIComponent(key);
      return locales.map((locale) => ({
        url: `${baseUrl}/${locale}/compare/${seg}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.9,
        alternates: {
          languages: { ar: `${baseUrl}/ar/compare/${seg}`, en: `${baseUrl}/en/compare/${seg}` },
        },
      }));
    });
  } catch {
    // DB unavailable — skip dynamic entries
  }

  return [
    ...staticEntries,
    ...catalogEntries,
    ...compareEntries,
    ...productEntries,
  ];
}