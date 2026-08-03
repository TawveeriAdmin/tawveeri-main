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
          // `/*/compare/` USED TO BE DISALLOWED HERE (ADR-189). The multi-retailer comparison
          // page is the one asset in this product that no competitor in Saudi has, and it was
          // the single page class we forbade every crawler and every AI assistant from reading.
          // The per-product page `/[locale]/compare/[key]` is now indexable: it self-canonicalises,
          // carries a product-specific bilingual title and publishes AggregateOffer structured
          // data; a key with no live comparison returns `robots: noindex` from its own metadata,
          // so thin pages still stay out without a blanket rule.
          //
          // `/compare` WITHOUT a key stays out — it renders whatever is in the visitor's
          // localStorage compare list, which is per-visitor state and not a page.
          '/*/compare$',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}