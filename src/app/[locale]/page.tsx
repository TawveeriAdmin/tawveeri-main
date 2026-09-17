import { cookies } from 'next/headers';
import Link from 'next/link';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { BetaLanding } from '@/components/public/beta-landing';
import { getHomeVerifiedDeals } from '@/lib/intelligence/home-verified-deals';
import { getEligibleCampaigns } from '@/lib/campaigns/store';

interface PageProps {
  params: Promise<{ locale: string }>;
}

// Private Beta entry experiment (ADR-121): the homepage renders one of two measured entry arms —
// advisor-first (champion) or search-first (control) — chosen per visitor by BetaLanding. This
// replaces the V1 home (which stacked an LLM chat, an advisor link, a finance strip, a hardcoded
// "up to 59% off" deal banner [a fabricated offer — constitution violation, now removed], and a
// partners row with no single primary action). The champion is config-reversible; nothing here
// hardcodes a design decision.
//
// Deals are fetched HERE, on the server: `tps_listing_price_facts` is not readable by `anon`, and
// a server component must never fetch its own API over HTTP (that is how the compare page ended
// up rate-limited into "no comparison available").
export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const deals = await getHomeVerifiedDeals(4, locale);
  // Affiliate Campaign Revenue Layer V1 (Phase 1C) — resolved server-side for the same
  // reason deals are: affiliate_campaigns grants no anon/authenticated access (server
  // role only), and a server component must never fetch its own API over HTTP.
  const cookieStore = await cookies();
  const campaigns = await getEligibleCampaigns('homepage', null, {
    sessionId: cookieStore.get('tw_sid')?.value ?? null,
    isTest: cookieStore.get('tw_test')?.value === '1' || cookieStore.get('tw_admin')?.value === '1',
  });

  return (
    <PublicPageShell locale={locale}>
      {/* ADR-374 (2026-09-17): Check frozen from visible navigation, owner decision.
          Code/page/data untouched — uncomment this block to restore the homepage entry. */}
      {/* <div className="mx-auto max-w-3xl px-4 pt-5">
        <Link href={`/${locale}/check`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">
          <span>{locale === 'ar' ? 'لقيت المنتج؟ حط رابطه وافحصه قبل تدفع.' : 'Found a product? Check its link before paying.'}</span>
          <span className="shrink-0">Check ←</span>
        </Link>
      </div> */}
      <BetaLanding locale={locale} deals={deals} campaigns={campaigns} />
    </PublicPageShell>
  );
}
