// No per-store detail page exists — every /stores/[slug] permanently consolidates onto the
// /stores index. permanentRedirect (2026-08-09 crawler truth parity, Section 27): the mapping
// never reverses, so 308 tells crawlers to consolidate link equity there instead of
// re-checking each store slug forever.
//
// MOVED OUT of (public)/ (2026-08-09): that group's sibling `loading.tsx` raced this page's
// `await params` — Next streamed the group's Suspense fallback shell as a committed 200
// BEFORE the redirect could fire, so a no-JS fetch (any crawler, curl) got a fake 200 page
// that never actually redirected. Same class of defect the (product) and (category) route
// groups were already pulled out of (public) to avoid — this page needed the same fix.
// `/stores` (the index, real content) stays in (public) — only this dead redirect stub moved.
import { permanentRedirect } from 'next/navigation';

export default async function StorePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/stores`);
}
