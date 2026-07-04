// src/app/sitemap.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sitemap ديناميكي موحّد — يدمج:
//   1. الصفحات الثابتة الفعلية (مع hreflang alternates)
//   2. كتالوج TPS الجديد: /mobiles + صفحات /product/{slug} من canonical_products
// ملاحظة: أُزيلت مسارات جدول products القديم (بنية Etlaq السابقة) —
// الفهرسة الآن حصرياً من canonical_products (مصدر الحقيقة الجديد).
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from 'next';
import { getAllProductSlugs } from '@/lib/catalog/getProductComparison';

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

  // 3) صفحات المنتجات — من canonical_products (كتالوج TPS)
  let productEntries: MetadataRoute.Sitemap = [];

  try {
    const products = await getAllProductSlugs();

    productEntries = products.flatMap((p) =>
      locales.map((locale) => ({
        url: `${baseUrl}/${locale}/product/${p.slug}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.8,
        alternates: {
          languages: {
            ar: `${baseUrl}/ar/product/${p.slug}`,
            en: `${baseUrl}/en/product/${p.slug}`,
          },
        },
      }))
    );
  } catch {
    // DB unavailable — skip dynamic entries
  }

  return [
    ...staticEntries,
    ...catalogEntries,
    ...productEntries,
  ];
}