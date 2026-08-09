// Bare /products (no slug) has never had its own listing — permanently sends to the shopping
// tool. permanentRedirect (2026-08-09 crawler truth parity, Section 27): a mapping that never
// reverses should be 308, not 307.
import { permanentRedirect } from 'next/navigation';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/search`);
}
