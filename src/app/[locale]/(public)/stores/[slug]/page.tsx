// No per-store detail page exists — every /stores/[slug] permanently consolidates onto the
// /stores index. permanentRedirect (2026-08-09 crawler truth parity, Section 27): the mapping
// never reverses, so 308 tells crawlers to consolidate link equity there instead of
// re-checking each store slug forever.
import { permanentRedirect } from 'next/navigation';

export default async function StorePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/stores`);
}