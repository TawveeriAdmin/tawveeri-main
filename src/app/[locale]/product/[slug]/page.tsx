// Legacy singular /product/[slug] consolidated into canonical /products/[slug] (ADR-122).
// Previously 502'd (getProductComparison crash) and duplicated the product surface on a second
// data model — a duplicate entry point. Redirect removes both problems.
import { redirect } from 'next/navigation';

export default async function LegacyProductRedirect({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  redirect(`/${locale}/products/${slug}`);
}
