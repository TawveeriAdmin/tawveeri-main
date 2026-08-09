// Standalone /mobiles catalog retired as a duplicate entry point (ADR-122). Phone discovery now
// flows through the single search surface, keeping one path per job.
//
// permanentRedirect + /categories/phones (2026-08-09 crawler truth parity, Section 27): this
// used to send crawlers to `/search?category=smartphone`, which is now `noindex` (its results
// are client-fetched, never real content for a crawler) — that would have handed a real,
// permanent identity mapping to a dead end. `/categories/phones` (ADR-226) is the actual live,
// SSR'd, indexable surface for this category, so that's the permanent destination now.
import { permanentRedirect } from 'next/navigation';

export default async function LegacyMobilesRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/categories/phones`);
}
