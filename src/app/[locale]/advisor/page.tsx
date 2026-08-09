import { redirect, permanentRedirect } from 'next/navigation';

/**
 * P2-8 · UNIFIED SEARCH — `/advisor` is no longer an entry point.
 *
 * The Constitution allows exactly one: "Customers never choose between search · AI search ·
 * assistant. There is one search experience. The system determines internally which
 * capabilities are required." A second labelled destination IS that choice, so this route
 * stops being a place to arrive and becomes a redirect into the unified surface.
 *
 * The CAPABILITY is untouched. `/search` routes need-based queries to the same
 * deterministic decision engine (`routeQuery` → `/api/v1/agent/decide`) and renders the
 * same `<AdvisorAnswer>` component this page used to render — with the AI disclosure
 * inside it, which is the migration's hard condition.
 *
 * `?q=` is carried across, so every published or bookmarked وفّر link still answers the
 * question it was asking rather than landing on an empty box. A 308 is used for the
 * query-carrying case because the destination is permanent and the meaning is preserved;
 * the bare case sends the customer to the search entry point.
 *
 * The page component that used to live here is deleted, not disabled. A dormant second
 * implementation of the same answer is how two surfaces drift apart.
 *
 * MOVED OUT of (public)/ (2026-08-09 crawler truth parity, Section 27): that group's
 * sibling `loading.tsx` raced this page's redirects — measured live on production, BOTH
 * the bare `/advisor` and the query-carrying `/advisor?q=...` case returned a fake 200 to
 * a no-JS fetch (any crawler, curl) instead of ever redirecting, silently breaking every
 * published وفّر link for search engines and AI agents. Same class of defect the
 * (product) and (category) route groups were already pulled out of (public) to avoid.
 */
export default async function AdvisorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const raw = sp?.q;
  const q = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';

  if (q.trim()) permanentRedirect(`/${locale}/search?q=${encodeURIComponent(q.trim())}`);
  redirect(`/${locale}/search`);
}
