// Bare /products (no slug) has never had its own listing — permanently sends to the shopping
// tool. permanentRedirect (2026-08-09 crawler truth parity, Section 27): a mapping that never
// reverses should be 308, not 307.
//
// MOVED OUT of (public)/ (2026-08-09): that group's sibling `loading.tsx` raced this page's
// `await params` — Next streamed the group's Suspense fallback shell as a committed 200
// BEFORE the redirect could fire, so a no-JS fetch (any crawler, curl) got a fake 200 page
// that never actually redirected. Same class of defect the (product) and (category) route
// groups were already pulled out of (public) to avoid — this page needed the same fix.
import { permanentRedirect } from 'next/navigation';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/search`);
}
