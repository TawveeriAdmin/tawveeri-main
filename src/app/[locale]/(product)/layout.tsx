// PRODUCT DETAIL ROUTE GROUP.
//
// Identical shell to `(public)` — same header, same footer, same URL (`/[locale]/products/...`,
// because route groups do not appear in the path). It exists for ONE reason: it has no
// `loading.tsx`.
//
// WHY THAT MATTERS. `(public)/loading.tsx` is a Suspense boundary for its whole group. It
// flushes a shell with HTTP 200 the instant rendering starts, so a `notFound()` raised later
// can render the not-found UI but can no longer change a status already on the wire. Measured
// on a production build, decisively: with that file present a missing product answered 200;
// with it removed the same request answered 404, real products unaffected. That is a soft 404 —
// crawlers index «المنتج غير موجود» as a valid product page and link checkers see nothing wrong.
//
// The skeleton was also wrong here on its own merits: it renders a TEN-CARD GRID, which is
// right for `products/page.tsx`, `search`, `deals` and `categories` — all of which keep it —
// and meaningless in front of a single product.
//
// Do not add a `loading.tsx` to this group. Doing so silently reintroduces the soft 404, and
// nothing will fail: the page still renders, the tests still pass, and only the status code is
// wrong. See docs/ENGINEERING-RULES.md.
import { PublicPageShell } from '@/components/public/public-page-shell';

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <PublicPageShell locale={locale}>{children}</PublicPageShell>;
}
