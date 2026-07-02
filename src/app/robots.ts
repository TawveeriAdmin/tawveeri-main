// src/app/robots.ts
// ─────────────────────────────────────────────────────────────────────────────
// robots ديناميكي — يسمح بفهرسة صفحات المحتوى، ويمنع:
//   - المسارات التقنية (/api, /go)
//   - الصفحات الخاصة/المحمية (dashboard, profile, auth...)
// /go/ ممنوع عمداً: redirect layer للتتبع والعمولة — ليس محتوى؛
// فهرسته تهدر ميزانية الزحف وتشوش التتبع.
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/go/',              // ← الإضافة الوحيدة: redirect layer (تتبع + عمولة)
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