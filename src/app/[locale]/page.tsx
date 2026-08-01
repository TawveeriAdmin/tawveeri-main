import { PublicPageShell } from '@/components/public/public-page-shell';
import { BetaLanding } from '@/components/public/beta-landing';
import { getHomeVerifiedDeals } from '@/lib/intelligence/home-verified-deals';

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

  return (
    <PublicPageShell locale={locale}>
      <BetaLanding locale={locale} deals={deals} />
    </PublicPageShell>
  );
}
