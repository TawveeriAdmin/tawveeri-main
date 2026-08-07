// CATEGORY DETAIL ROUTE GROUP.
//
// Identical shell to `(public)` — same header, same footer, same URL
// (`/[locale]/categories/[slug]`, route groups do not appear in the path). It exists for the
// SAME reason `(product)` does: it has no `loading.tsx`.
//
// `(public)/loading.tsx` is a Suspense boundary for its whole group. It flushes a shell with
// HTTP 200 the instant rendering starts, so a `notFound()`/`redirect()` raised later in the
// page can still render the right UI but can no longer change a status already on the wire —
// a soft 404 (or a redirect that never redirects). This is the exact defect `(product)` was
// created to avoid (see its own layout.tsx), reproduced here: `/categories/[slug]` gained a
// real conditional `notFound()` (unknown category) and `redirect()` (alias → canonical slug)
// once it stopped being a blind redirect to `/search`, and both silently answered 200 under
// `(public)`. Measured on a local production build: alias slug and unknown slug both 200'd
// under `(public)`; moved here, unknown → real 404, alias → real 307.
//
// Do not add a `loading.tsx` to this group.
import { PublicPageShell } from '@/components/public/public-page-shell';

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <PublicPageShell locale={locale}>{children}</PublicPageShell>;
}
