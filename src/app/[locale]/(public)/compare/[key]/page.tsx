// src/app/[locale]/(public)/compare/[key]/page.tsx
// TPS Layer 4 — صفحة مقارنة الأسعار
// تقرأ من /api/compare?key=<tps_identity_key>
// لا تلمس products أو product_stores أو search

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, ShieldCheck, Trophy, ArrowRight, Gift, AlertTriangle } from 'lucide-react';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { getComparison, isComparisonError } from '@/lib/compare/get-comparison';
import { buildAlternates } from '@/lib/seo/metadata';
import { retailerDisplayName, resolveApprovedSlug } from '@/lib/retailers/approved-retailers';
import { CompareStateSync } from '@/components/agent/compare-state-sync';
import { readCategoryAttribution } from '@/lib/catalog/category-link';
import { CategoryExitLink } from '@/components/catalog/category-exit-link';

interface CampaignEligibility {
  eligible: true;
  message_ar: string;
  message_en: string;
  official_source_url: string;
  last_verified_at: string;
}

interface CompareOffer {
  store_name:   string;
  raw_name:     string;
  price:        number;
  availability: string | null;
  product_url:  string | null;
  confidence:   number;
  observed_at:  string;
  stale:        boolean;
  is_verified:  boolean;
  campaign_eligibility: CampaignEligibility | null;
}

interface CompareResult {
  canonical: {
    id:                  string;
    name_ar:             string;
    name_en:             string;
    brand:               string;
    category:            string;
    tps_identity_key:    string;
    identity_confidence: number;
    attributes:          Record<string, unknown>;
  };
  summary: {
    cheapest_store: string | null;
    lowest_price:   number | null;
    highest_price:  number | null;
    saving:         number | null;
    store_count:    number;
    cheapest_stale: boolean;
  };
  offers: CompareOffer[];
  // QUALITY PROGRAM P1 §14.1 (2026-08-28): `getComparison()` (get-comparison.ts, §12)
  // already returns this honest-zero message when no offer is fresh enough to back a
  // price claim — this local interface never declared it, so `result as unknown as
  // CompareResult` silently discarded a real runtime field and the summary bar just
  // rendered nothing, reading as a broken page rather than an honest state.
  message?: string;
}

// Reads the database directly. This used to fetch `${SITE_URL}/api/compare` — a
// server-to-server round trip out of Railway and back in through our own edge, which
// passes the rate limiter like any other request. Every server render shares one egress
// identity, so under load the page's own fetch returned HTTP 429, this function returned
// null, and the page rendered "لا تتوفر مقارنة" for a product with two live offers.
// Measured 2026-07-29: 34 rapid calls to /api/compare → 429, data present throughout.
// A page that reads its own database cannot fail that way.
async function fetchCompare(key: string): Promise<CompareResult | null> {
  try {
    const result = await getComparison({ identityKey: key });
    if (isComparisonError(result)) return null;
    return result as unknown as CompareResult;
  } catch {
    return null;
  }
}

/**
 * THE COMPARISON PAGE IS THE ONLY THING WE HAVE THAT NOBODY ELSE DOES, AND NOTHING COULD READ IT
 * (ADR-189). Four independent reasons, all fixed here or in the same commit:
 *
 *   1. `generateMetadata` passed the RAW `key` to `fetchCompare` while the page body passed
 *      `decodeURIComponent(key)`. The two disagreed, so the body rendered a real five-retailer
 *      comparison under the generic fallback title «مقارنة الأسعار | توفيري» — on EVERY page.
 *      Measured live before the fix: body contains "iPhone 16", title does not.
 *   2. No `alternates`, so the page inherited the root canonical and declared itself a duplicate
 *      of the HOMEPAGE — it could never be indexed (the ADR-156 failure, in a new place).
 *   3. The title was Arabic-only regardless of locale.
 *   4. No structured data, so a crawler or assistant reading the page saw prose, not offers.
 *
 * `robots.ts` additionally disallowed `/*​/compare/` outright; that is lifted in the same change.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}): Promise<Metadata> {
  const { locale, key } = await params;
  // Decode exactly as the page body does. These two must not drift again.
  const decodedKey = decodeURIComponent(key);
  const isAr = locale !== 'en';
  // MEASURED DEFECT (2026-08-11, Global Shopping Discoverability & AI Commerce mission):
  // Next.js decodes dynamic route segments before handing them to this function, so `key`
  // here already contains real `|` characters (e.g. "samsung|front_load|25|washer") — embedding
  // it directly produced a canonical URL with raw, un-percent-encoded `|` (invalid per RFC 3986;
  // Google explicitly requires a canonical to be a valid, exact URL). The actual page the
  // crawler fetches uses `%7C`, so the declared canonical never matched the fetched URL.
  const alternates = buildAlternates(`/compare/${encodeURIComponent(key)}`, locale);
  const data = await fetchCompare(decodedKey);
  if (!data) {
    return {
      title: isAr ? 'مقارنة الأسعار' : 'Price comparison',
      alternates,
      // Nothing to compare ⇒ nothing worth indexing. Better an explicit noindex than a thin
      // page competing with the real ones.
      robots: { index: false, follow: true },
    };
  }

  const name = (isAr ? data.canonical.name_ar : data.canonical.name_en) || data.canonical.name_ar || data.canonical.name_en;
  const price = data.summary.lowest_price;
  const stores = data.summary.store_count;

  return {
    // The locale layout applies `%s | توفيري` / `%s | Tawveeri`, so the brand must NOT be
    // repeated here — it produced «… | توفيري | توفيري», in the one string search engines and
    // AI assistants show as the headline.
    title: isAr ? `${name} — مقارنة الأسعار` : `${name} — price comparison`,
    description: price
      ? (isAr
        ? `أرخص سعر رصدناه لـ ${name} هو ${price} ر.س، من ${stores} متاجر سعودية.`
        : `The lowest price we observed for ${name} is ${price} SAR, across ${stores} Saudi retailers.`)
      : (isAr
        ? `قارن أسعار ${name} بين متاجر سعودية.`
        : `Compare ${name} prices across Saudi retailers.`),
    alternates,
  };
}

/** Same day-count freshness phrasing already used for `observed_at` below, reused for the
 *  campaign's "last verified" disclosure so the two freshness signals read consistently. */
function freshnessLabel(iso: string, isAr: boolean): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return isAr ? 'اليوم' : 'today';
  if (days === 1) return isAr ? 'أمس' : 'yesterday';
  return isAr ? `قبل ${days} يومًا` : `${days} days ago`;
}

/**
 * Level-2 conditional-campaign notice (e.g. Black Box's "مهرجان الريال" — see
 * blackbox-riyal-festival.ts, ADR-220). Deliberately small and secondary: this states
 * ELIGIBILITY, never a price — the badge must never look like, or sit where a customer
 * would read it as, a second product price. TTL-gated upstream (get-comparison.ts); once
 * `campaign_eligibility` goes null (stale or removed by the retailer) this renders nothing,
 * automatically, with no code change needed here.
 */
function CampaignEligibilityNote({ offer, isAr }: { offer: CompareOffer; isAr: boolean }) {
  const c = offer.campaign_eligibility;
  if (!c) return null;
  return (
    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 px-2.5 py-1.5">
      <Gift className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
      <div className="min-w-0 text-[11px] leading-snug text-amber-900 dark:text-amber-300">
        <p>{isAr ? c.message_ar : c.message_en}</p>
        <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/70">
          {isAr ? `آخر تحقق: ${freshnessLabel(c.last_verified_at, true)}` : `Last verified: ${freshnessLabel(c.last_verified_at, false)}`}
          {' · '}
          <a href={c.official_source_url} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
            {isAr ? 'تحقق من الشروط لدى المتجر' : "Confirm terms with the retailer"}
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * P0 stale-price safety (2026-08-07): a price built from evidence older than
 * STALE_CAVEAT_HOURS (evidence-engine.ts) must never be presented as freshly
 * verified, especially when it is winning "cheapest". Disclosure, not exclusion —
 * `offer.stale`/`get-comparison.ts` compute this from the SAME observed_at already
 * rendered per offer below; this just makes it impossible to miss on the offer that
 * actually determines the page's headline claim. Renders nothing once re-observed.
 */
function StaleEvidenceNote({ offer, isAr }: { offer: CompareOffer; isAr: boolean }) {
  if (!offer.stale) return null;
  return (
    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 px-2.5 py-1.5">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-700 dark:text-orange-400" />
      <p className="min-w-0 text-[11px] leading-snug text-orange-900 dark:text-orange-300">
        {isAr
          ? 'هذا السعر مبني على آخر رصد لدينا وقد لا يعكس السعر الحالي لدى المتجر — تحقق منه قبل الشراء.'
          : "This price is based on our last observation and may not reflect the retailer's current price — verify before buying."}
      </p>
    </div>
  );
}

export default async function TpsComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; key: string }>;
  searchParams: Promise<{ src?: string; category?: string; facet?: string }>;
}) {
  const { locale, key } = await params;
  const isAr = locale === 'ar';
  const decodedKey = decodeURIComponent(key);
  const data = await fetchCompare(decodedKey);
  // Category-facet-pages analytics mission (2026-08-25): if this visit came from a category
  // or facet page's product card (withCategoryAttribution, category-product-grid.tsx), the
  // merchant-exit links below fire `category_go_click` instead of rendering a plain,
  // untracked `<a>`. Every other visitor's experience is byte-identical to before this.
  const attribution = readCategoryAttribution(await searchParams);

  // No multi-store comparison for this product yet → a helpful state with a search fallback,
  // NEVER a 404/error (the compare button used to dead-end here). This is honest empty-state
  // handling, not a cosmetic mask: many products are single-store while coverage grows.
  if (!data || data.offers.length === 0) {
    const nm = data?.canonical ? (isAr ? (data.canonical.name_ar || data.canonical.name_en) : (data.canonical.name_en || data.canonical.name_ar)) : null;
    return (
      <PublicPageShell locale={locale}>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="mb-4 text-5xl">🔍</div>
          <h1 className="text-xl font-bold text-on-surface">{nm ?? (isAr ? 'مقارنة الأسعار' : 'Price comparison')}</h1>
          <p className="mx-auto mt-2 max-w-sm text-on-surface-variant">
            {isAr
              ? 'لا تتوفر مقارنة أسعار متعددة المتاجر لهذا المنتج حالياً — نضيف المتاجر والمقارنات باستمرار.'
              : "A multi-store comparison isn't available for this product yet — we keep adding stores and comparisons."}
          </p>
          <a
            href={`/${locale}/search${nm ? `?q=${encodeURIComponent(nm)}` : ''}`}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[var(--brand-green)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-green-dark)]"
          >
            {isAr ? 'ابحث عن هذا المنتج' : 'Search for this product'}
          </a>
        </div>
      </PublicPageShell>
    );
  }

  const { canonical, summary, offers, message } = data;
  const name = isAr ? (canonical.name_ar || canonical.name_en) : (canonical.name_en || canonical.name_ar);

  const cheapestOffer = offers.find(o => o.store_name === summary.cheapest_store) ?? offers[0];

  /**
   * THE OFFERS, IN A FORM A MACHINE CAN READ (ADR-189).
   *
   * A crawler or an AI assistant reading this page saw prose and had to infer that it was a
   * price comparison. `AggregateOffer` states it: this many retailers, this low price, this
   * high price, this currency. That is the whole reason to publish a comparison page at all.
   *
   * EVERY FIGURE HERE IS ONE THE PAGE ALREADY RENDERS, taken from the same `summary`/`offers`
   * the body reads — never recomputed, never rounded differently, never a figure the customer
   * cannot see. Structured data that disagrees with the visible page is a fabricated claim
   * with a schema wrapper on it, and it is also what gets a site penalised.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(canonical.brand ? { brand: { '@type': 'Brand', name: canonical.brand } } : {}),
    ...(summary.lowest_price != null ? {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'SAR',
        lowPrice: String(summary.lowest_price),
        ...(summary.highest_price != null ? { highPrice: String(summary.highest_price) } : {}),
        offerCount: summary.store_count,
        // Named sellers, so the comparison is checkable rather than asserted.
        offers: offers
          .filter((o) => o.price > 0)
          .map((o) => ({
            '@type': 'Offer',
            price: String(o.price),
            priceCurrency: 'SAR',
            ...(o.product_url ? { url: o.product_url } : {}),
            // Name the retailer in the page's own language. The comparison loader returns the
            // Arabic display name regardless of locale, so an English citation would otherwise
            // list «مكتبة جرير» to an English reader. Falls back to what the page renders —
            // a retailer we cannot resolve is still named exactly as the page names it, never
            // dropped and never guessed.
            seller: {
              '@type': 'Organization',
              name: retailerDisplayName(resolveApprovedSlug(o.store_name), isAr ? 'ar' : 'en') ?? o.store_name,
            },
            availability: o.availability === 'out_of_stock'
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/InStock',
          })),
      },
    } : {}),
  };

  return (
    <PublicPageShell locale={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CompareStateSync canonicalId={canonical.id} />
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Link href={`/${locale}`} className="hover:text-on-surface transition-colors">
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <Link href={`/${locale}/search`} className="hover:text-on-surface transition-colors">
            {isAr ? 'البحث' : 'Search'}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <span className="text-on-surface font-medium truncate max-w-[200px]">{name}</span>
        </nav>

        {/* ── Product Header ── */}
        <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs capitalize">
                {isAr
                  ? (canonical.category === 'ac' ? 'مكيفات' : canonical.category === 'mobile' ? 'جوالات' : canonical.category)
                  : canonical.category
                }
              </Badge>
              {canonical.brand && (
                <Badge variant="outline" className="text-xs">{canonical.brand}</Badge>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-green)]" />
                {isAr ? `ثقة ${canonical.identity_confidence}%` : `${canonical.identity_confidence}% confidence`}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-on-surface leading-snug mt-1">
              {name}
            </h1>
          </div>

          {/* Summary Bar */}
          {summary.lowest_price && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[var(--brand-bg-green)] border border-[var(--brand-green)]/20 p-3 text-center">
                <p className="text-xs text-on-surface-variant mb-1">{isAr ? 'أرخص سعر' : 'Lowest Price'}</p>
                <Price
                  amount={summary.lowest_price}
                  className="text-lg font-extrabold text-[var(--brand-green-dark)]"
                  symbolClassName="w-4 h-4"
                />
              </div>
              {summary.highest_price && summary.highest_price !== summary.lowest_price && (
                <div className="rounded-xl bg-[color:var(--color-surface-container)] p-3 text-center">
                  <p className="text-xs text-on-surface-variant mb-1">{isAr ? 'أعلى سعر' : 'Highest Price'}</p>
                  <Price
                    amount={summary.highest_price}
                    className="text-lg font-bold text-on-surface"
                    symbolClassName="w-4 h-4"
                  />
                </div>
              )}
              {summary.saving && summary.saving > 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 p-3 text-center">
                  <p className="text-xs text-on-surface-variant mb-1">{isAr ? 'توفّر' : 'You Save'}</p>
                  <Price
                    amount={summary.saving}
                    className="text-lg font-bold text-amber-700 dark:text-amber-400"
                    symbolClassName="w-4 h-4"
                  />
                </div>
              )}
            </div>
          )}
          {/* QUALITY PROGRAM P1 §14.1 (2026-08-28): the honest-zero counterpart to the
              Summary Bar above — when no offer is fresh enough to back a price claim,
              this renders instead of nothing, so the page reads as "we checked and have
              no current price" rather than as broken. `offers` below still lists every
              known price with its own stale disclosure; only the crowned summary is
              withheld. */}
          {!summary.lowest_price && message && (
            <div className="rounded-xl bg-[color:var(--color-surface-container)] border border-[color:var(--color-outline-variant)]/40 p-3 text-center">
              <p className="text-sm text-on-surface-variant">{message}</p>
            </div>
          )}
        </div>

        {/* ── Cheapest Offer (featured) ── */}
        {cheapestOffer && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--brand-green)]/40 bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
            {/* With a single offer there is no "best" — claiming one would be a false
                comparison (ADR-135). The badge appears only when something was compared.
                P0 claim-safety (2026-08-07): «أفضل سعر الآن» ("best price NOW") is the same
                overclaim §10 of docs/LAUNCH_VOCABULARY.md already retired («أفضل سعر حالياً» /
                "Current best price") — a superiority-plus-currency claim this evidence cannot
                back once it is stale (measured: 86.7% of comparable canonicals currently have a
                stale offer sitting at the numeric minimum). When `cheapestOffer.stale`, this
                switches to the ALREADY-GOVERNED replacement text (§10: «آخر سعر رصدناه» /
                "Last Observed Price" — reused verbatim, not new copy) instead of the superiority
                badge. Still the numerically lowest offer, still shown, still fully priced — only
                the claim of verified currentness is withdrawn. Fresh offers are unaffected. */}
            {offers.length > 1 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-green)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  <Trophy className="h-3 w-3" />
                  {cheapestOffer.stale
                    ? (isAr ? 'آخر سعر رصدناه' : 'Last Observed Price')
                    : (isAr ? 'أفضل سعر' : 'Best Price')}
                </span>
              </div>
            )}

            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-on-surface-variant mb-1">
                  {offers.length > 1
                    ? (cheapestOffer.stale
                        ? (isAr ? 'آخر سعر رصدناه عند' : 'Last observed price at')
                        : (isAr ? 'أفضل سعر الآن عند' : 'Best price at'))
                    : (isAr ? 'متوفر عند' : 'Available at')}
                </span>
                <span className="text-base font-bold text-on-surface">
                  {cheapestOffer.store_name}
                </span>
                {cheapestOffer.availability === 'in_stock' && (
                  <span className="text-xs text-[var(--brand-green)] font-medium mt-0.5">
                    {isAr ? '● متوفر الآن' : '● In Stock'}
                  </span>
                )}
                {/* QUALITY PROGRAM P1 §14.1 (2026-08-28): `availability` already carries
                    'out_of_stock' (price_history.availability, populated) but only the
                    in-stock branch ever rendered — directly relevant to §11's own finding
                    that a stale offer usually manifests as a live page with a soft
                    out-of-stock badge, not a 404; this is exactly the signal that catches
                    that pattern for a shopper, already in the payload, unused until now. */}
                {cheapestOffer.availability === 'out_of_stock' && (
                  <span className="text-xs text-[var(--color-error)] font-medium mt-0.5">
                    {isAr ? '● غير متوفر حالياً' : '● Out of Stock'}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-end shrink-0">
                <Price
                  amount={cheapestOffer.price}
                  className="text-3xl md:text-4xl font-extrabold text-[var(--brand-green-dark)]"
                  symbolClassName="w-6 h-6 md:w-7 md:h-7"
                />
              </div>
            </div>

            <CampaignEligibilityNote offer={cheapestOffer} isAr={isAr} />
            <StaleEvidenceNote offer={cheapestOffer} isAr={isAr} />

            {cheapestOffer.product_url ? (
              attribution ? (
                <CategoryExitLink
                  href={cheapestOffer.product_url}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-green)] px-5 text-sm font-semibold text-white shadow-[var(--elevation-1)] transition-colors hover:bg-[var(--brand-green-dark)]"
                  attribution={attribution}
                  store={cheapestOffer.store_name}
                  canonicalId={canonical.id}
                >
                  <span>{isAr ? `اذهب إلى ${cheapestOffer.store_name}` : `Go to ${cheapestOffer.store_name}`}</span>
                  <ExternalLink className="h-4 w-4" />
                </CategoryExitLink>
              ) : (
                <a
                  href={cheapestOffer.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-green)] px-5 text-sm font-semibold text-white shadow-[var(--elevation-1)] transition-colors hover:bg-[var(--brand-green-dark)]"
                >
                  <span>{isAr ? `اذهب إلى ${cheapestOffer.store_name}` : `Go to ${cheapestOffer.store_name}`}</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )
            ) : (
              // No exit URL for this listing. Say exactly that — the old copy read
              // "شوف في المتاجر" but ran another search, doing the opposite of what it said.
              <div className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container)] px-5 text-sm font-medium text-on-surface-variant">
                {isAr ? 'رابط المتجر غير متاح لهذا العرض' : 'No store link available for this offer'}
              </div>
            )}
          </div>
        )}

        {/* ── All Offers ── */}
        {offers.length > 1 && (
          <div className="rounded-2xl border border-[color:var(--color-outline-variant)] overflow-hidden">
            <div className="bg-[color:var(--color-surface-container)] px-4 py-3 border-b border-[color:var(--color-outline-variant)]">
              <h2 className="text-sm font-bold text-on-surface">
                {isAr ? `جميع العروض (${offers.length} متاجر)` : `All Offers (${offers.length} stores)`}
              </h2>
            </div>

            <div className="divide-y divide-[color:var(--color-outline-variant)]/50">
              {offers.map((offer, idx) => (
                <div
                  key={`${offer.store_name}-${idx}`}
                  className="px-4 py-4 hover:bg-[color:var(--color-surface-container-low)] transition-colors"
                >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-on-surface">{offer.store_name}</span>
                    <span className="text-xs text-on-surface-variant truncate max-w-[200px] mt-0.5">
                      {offer.raw_name}
                    </span>
                    {offer.availability === 'in_stock' && (
                      <span className="text-xs text-[var(--brand-green)] font-medium mt-0.5">
                        {isAr ? '● متوفر' : '● In Stock'}
                      </span>
                    )}
                    {/* QUALITY PROGRAM P1 §14.1 (2026-08-28): same gap as the featured
                        offer above — availability already carries 'out_of_stock', it just
                        never rendered anywhere in this list. */}
                    {offer.availability === 'out_of_stock' && (
                      <span className="text-xs text-[var(--color-error)] font-medium mt-0.5">
                        {isAr ? '● غير متوفر' : '● Out of Stock'}
                      </span>
                    )}
                    {/* WHEN we saw this price. Measured 2026-07-31: 13.6% of served offers
                        were last observed more than 30 days ago, and the page showed them
                        as if current — a price presented without its date is a marketing
                        number, which is the one thing `بالأدلة، لا أرقام مسوّقة` forbids.
                        Disclosed rather than suppressed: an old price is still evidence,
                        provided we say how old. */}
                    {offer.observed_at && (
                      <span className="text-[11px] text-on-surface-variant mt-0.5">
                        {(() => {
                          const days = Math.floor((Date.now() - new Date(offer.observed_at).getTime()) / 86400000);
                          if (days <= 0) return isAr ? 'رصدناه اليوم' : 'observed today';
                          if (days === 1) return isAr ? 'رصدناه أمس' : 'observed yesterday';
                          return isAr ? `رصدناه قبل ${days} يومًا` : `observed ${days} days ago`;
                        })()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Price
                      amount={offer.price}
                      className={`text-lg font-bold ${offer.price === summary.lowest_price ? 'text-[var(--brand-green-dark)]' : 'text-on-surface'}`}
                      symbolClassName="w-4 h-4"
                    />
                    {offer.product_url ? (
                      attribution ? (
                        <CategoryExitLink
                          href={offer.product_url}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-xs font-semibold text-on-surface transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)]"
                          attribution={attribution}
                          store={offer.store_name}
                          canonicalId={canonical.id}
                        >
                          {isAr ? `اذهب إلى ${offer.store_name}` : `Go to ${offer.store_name}`}
                          <ExternalLink className="h-3 w-3" />
                        </CategoryExitLink>
                      ) : (
                        <a
                          href={offer.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-xs font-semibold text-on-surface transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)]"
                        >
                          {isAr ? `اذهب إلى ${offer.store_name}` : `Go to ${offer.store_name}`}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )
                    ) : (
                      // "في المتاجر" looked like a link and ran a search. If we have no exit
                      // URL, show plain text — never a control that pretends to reach the store.
                      <span className="text-xs text-on-surface-variant">
                        {isAr ? 'لا يوجد رابط' : 'No link'}
                      </span>
                    )}
                  </div>
                </div>
                <CampaignEligibilityNote offer={offer} isAr={isAr} />
                <StaleEvidenceNote offer={offer} isAr={isAr} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TPS Badge ── */}
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-on-surface-variant">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-green)]" />
          <span>
            {isAr
              ? `تم التحقق من المطابقة بدقة ${canonical.identity_confidence}% • مدعوم بـ TPS`
              : `Verified match at ${canonical.identity_confidence}% confidence • Powered by TPS`
            }
          </span>
        </div>

      </div>
    </PublicPageShell>
  );
}
