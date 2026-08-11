import { getBaseUrl } from './metadata';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JsonLd({ data }: { data: Record<string, any> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function buildWebSiteJsonLd(locale: string) {
  const baseUrl = getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: locale === 'ar' ? 'توفيري' : 'Tawveeri',
    alternateName: locale === 'ar' ? 'Tawveeri' : 'توفيري',
    url: `${baseUrl}/${locale}`,
    description:
      locale === 'ar'
        ? 'منصة مقارنة أسعار الإلكترونيات في السعودية'
        : 'Electronics price comparison platform in Saudi Arabia',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/${locale}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: locale === 'ar' ? 'ar-SA' : 'en',
  };
}

/**
 * Site-level entity identity (2026-08-11, Saudi Shopper Language & Demand Discovery mission —
 * "AI-assistant discovery" phase). MEASURED gap via repo audit: `buildWebSiteJsonLd` existed
 * but was never rendered anywhere (dead code), and no `Organization` schema existed at all —
 * so nothing on the site answered "who is Tawveeri, what does it do, where" at the entity
 * level Google's Knowledge Graph and AI assistants ground brand identity on. Only facts already
 * established elsewhere in the codebase (LAUNCH_VOCABULARY's "compare, don't sell" positioning,
 * the FAQ page's own "does not sell/ship/stock" answer) — no fabricated address, phone, or
 * registration number (CLAUDE.md: "never fabricate... unknown beats incorrect"; the FAQ page's
 * own header comment already documents that no CR/VAT/registered-address exists to publish).
 */
export function buildOrganizationJsonLd(locale: string) {
  const baseUrl = getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Tawveeri',
    alternateName: 'توفيري',
    url: baseUrl,
    logo: `${baseUrl}/logos/Tawveeri.png`,
    description:
      locale === 'ar'
        ? 'توفيري منصة سعودية لمقارنة أسعار الإلكترونيات والأجهزة المنزلية بين متاجر سعودية. لا تبيع أو تشحن أو تخزّن أي منتج — تقارن الأسعار المرصودة فقط.'
        : 'Tawveeri is a Saudi platform comparing electronics and home-appliance prices across Saudi retailers. It does not sell, ship, or stock any product — it compares observed prices only.',
    areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
    knowsLanguage: ['ar', 'en'],
  };
}

export function buildProductJsonLd(product: {
  name_ar: string;
  name_en: string;
  slug: string;
  description_ar: string | null;
  description_en: string | null;
  brand: string;
  image_urls: string[] | null;
  average_rating: number | null;
  total_reviews: number | null;
  min_price: number | null;
  max_price: number | null;
  store_count: number;
}, locale: string) {
  const baseUrl = getBaseUrl();
  const name = locale === 'ar' ? product.name_ar : product.name_en;
  const description = locale === 'ar' ? product.description_ar : product.description_en;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    url: `${baseUrl}/${locale}/products/${product.slug}`,
    ...(description && { description }),
    ...(product.brand && { brand: { '@type': 'Brand', name: product.brand } }),
    ...(product.image_urls?.length && { image: product.image_urls }),
  };

  if (product.average_rating && product.total_reviews && product.total_reviews > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.average_rating,
      reviewCount: product.total_reviews,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (product.min_price && product.store_count > 0) {
    jsonLd.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'SAR',
      lowPrice: product.min_price,
      ...(product.max_price && product.max_price !== product.min_price && { highPrice: product.max_price }),
      offerCount: product.store_count,
      availability: 'https://schema.org/InStock',
    };
  }

  return jsonLd;
}

export function buildStoreJsonLd(store: {
  name_ar: string;
  name_en: string;
  slug: string;
  description_ar: string | null;
  description_en: string | null;
  logo_url: string | null;
  website_url: string;
  average_rating: number;
  total_reviews: number;
}, locale: string) {
  const baseUrl = getBaseUrl();
  const name = locale === 'ar' ? store.name_ar : store.name_en;
  const description = locale === 'ar' ? store.description_ar : store.description_en;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name,
    url: `${baseUrl}/${locale}/stores/${store.slug}`,
    ...(description && { description }),
    ...(store.logo_url && { image: store.logo_url }),
    ...(store.website_url && {
      sameAs: [store.website_url],
    }),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'SA',
    },
  };

  if (store.average_rating > 0 && store.total_reviews > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: store.average_rating,
      reviewCount: store.total_reviews,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return jsonLd;
}
