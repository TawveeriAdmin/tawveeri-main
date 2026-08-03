// src/app/robots.ts
// ─────────────────────────────────────────────────────────────────────────────
// robots ديناميكي — يسمح بفهرسة صفحات المحتوى، ويمنع:
//   - المسارات التقنية (/api, /go)
//   - الصفحات الخاصة/المحمية (dashboard, profile, auth...)
// /go/ ممنوع عمداً: redirect layer للتتبع والعمولة — ليس محتوى؛
// فهرسته تهدر ميزانية الزحف وتشوش التتبع.
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { isNonCanonicalHost } from '@/lib/seo/canonical-host';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

  /**
   * ADR-190 — this file is served by the Railway preview domain too, and the middleware does
   * NOT run for it (the matcher excludes `robots.txt`), so the host check has to live here.
   *
   * On a non-canonical host we **still allow crawling** and rely on the `X-Robots-Tag: noindex`
   * header the middleware sets. Disallowing instead would be the classic self-defeating move: a
   * crawler that cannot fetch the page never sees the `noindex`, and the URL stays indexed on
   * anchor text alone. What we do withhold is the **sitemap reference** — there is no reason to
   * hand a crawler 17,000 URLs from a host we are asking it to forget.
   */
  const nonCanonical = isNonCanonicalHost((await headers()).get('host'));

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
    ...(nonCanonical ? {} : { sitemap: `${baseUrl}/sitemap.xml` }),
  };
}