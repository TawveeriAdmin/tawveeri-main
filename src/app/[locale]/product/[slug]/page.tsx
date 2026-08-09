// Legacy singular /product/[slug] consolidated into canonical /products/[slug] (ADR-122).
// Previously 502'd (getProductComparison crash) and duplicated the product surface on a second
// data model — a duplicate entry point. Redirect removes both problems.
//
// permanentRedirect (308, 2026-08-09 crawler truth parity, Section 27): `redirect()` always
// issues a 307 — the correct code for a route that might move back. This one never will; the
// identity mapping (singular slug → plural slug) is permanent by construction, so crawlers
// should consolidate link equity onto /products/ instead of re-checking /product/ forever.
import { permanentRedirect } from 'next/navigation';

export default async function LegacyProductRedirect({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  permanentRedirect(`/${locale}/products/${slug}`);
}
