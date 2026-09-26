// src/app/[locale]/(public)/compare/[key]/page.tsx
// TPS Layer 4 — صفحة مقارنة أسعار النسخة نفسها عبر المتاجر
// تقرأ مباشرة من getComparison() (ADR-135: نفس اشتقاق بطاقة البحث)
// لا تلمس products أو product_stores أو search
//
// ADR-387 redesign (2026-09-26). One job: let a shopper answer, within a screen, four
// questions — is this the same product/version? what is the lowest ELIGIBLE price and when
// did we see it? why this offer, and what differs? where do I click to go to the store? —
// then leave with confidence. Information hierarchy follows that order: identity header →
// decision block (one CTA that names the store) → scannable offer rows (store | price |
// observed | availability | go) with details collapsed → offers outside the comparison,
// each with its reason → one shared disclaimer instead of one per row. Mobile first: rows
// stack, nothing forces a wide table, the tray never has to cover a button.

import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, ShieldCheck, Trophy, ArrowRight, Gift, AlertTriangle, History, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { StoreLogo } from '@/components/ui/store-logo';
import { getComparison, isComparisonError, partitionOffersByEligibility, type CompareOffer, type ComparisonResult } from '@/lib/compare/get-comparison';
import { categoryLabel } from '@/lib/agent/advisor-api';
import { classifyCondition } from '@/lib/campaigns/condition';
import { CONDITION_LABELS } from '@/components/compare/offer-description';
import { PICK_FRESHNESS_MAX_HOURS } from '@/lib/intelligence/evidence-engine';
import { buildAlternates } from '@/lib/seo/metadata';
import { retailerDisplayName, resolveApprovedSlug } from '@/lib/retailers/approved-retailers';
import { CompareStateSync } from '@/components/agent/compare-state-sync';
import { readCategoryAttribution, type CategoryAttribution } from '@/lib/catalog/category-link';
import { CategoryExitLink } from '@/components/catalog/category-exit-link';
import { ExitLink } from '@/components/catalog/exit-link';

type CompareResult = ComparisonResult;

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
    return result;
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

/** Same day-count freshness phrasing for every observation on the page. */
function freshnessLabel(iso: string, isAr: boolean): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return isAr ? 'اليوم' : 'today';
  if (days === 1) return isAr ? 'أمس' : 'yesterday';
  // Arabic number agreement: dual for 2, plural noun for 3–10, singular accusative beyond.
  if (isAr) return days === 2 ? 'قبل يومين' : days <= 10 ? `قبل ${days} أيام` : `قبل ${days} يومًا`;
  return `${days} days ago`;
}

/** «رصدناه اليوم / أمس / قبل N …» — ONE phrasing for every offer, featured or listed. */
function observedLabel(iso: string, isAr: boolean): string {
  return isAr ? `رصدناه ${freshnessLabel(iso, true)}` : `observed ${freshnessLabel(iso, false)}`;
}

/** Customer-facing category name — never the internal slug («air_conditioner»). TPS's own
 *  short codes (`ac`/`mobile`) are mapped first; everything else goes through the shared
 *  advisor label map, which falls back to a de-underscored slug rather than a raw token. */
function categoryBadgeLabel(category: string, isAr: boolean): string {
  if (category === 'ac') return isAr ? 'مكيفات' : 'Air conditioners';
  if (category === 'mobile') return isAr ? 'جوالات' : 'Phones';
  return categoryLabel(category, isAr ? 'ar' : 'en');
}

/** Availability wording is always bound to the observation it came from — «الآن» is never
 *  claimed. Stale evidence says so explicitly. */
function availabilityLabel(offer: CompareOffer, isAr: boolean): { text: string; tone: 'ok' | 'muted' | 'bad' } | null {
  if (offer.availability === 'out_of_stock') return { text: isAr ? 'غير متوفر عند آخر رصد' : 'Out of stock at last observation', tone: 'bad' };
  if (offer.availability === 'in_stock' || offer.availability === 'limited_stock') {
    if (offer.stale) return { text: isAr ? 'متوفر بحسب آخر رصد' : 'In stock at last observation', tone: 'muted' };
    return { text: offer.availability === 'limited_stock' ? (isAr ? 'كمية محدودة' : 'Limited stock') : (isAr ? 'متوفر' : 'In stock'), tone: 'ok' };
  }
  return null;
}

/** Why an offer sits outside the comparison — one reason per offer, never a blanket label
 *  (a fresh out-of-stock offer is not "old"; founder review 2026-09-26). */
function exclusionReason(offer: CompareOffer, isAr: boolean): string {
  if (offer.availability === 'out_of_stock') return isAr ? 'غير متوفر عند آخر رصد' : 'Out of stock at last observation';
  const days = Math.max(1, Math.floor((Date.now() - Date.parse(offer.observed_at)) / 86400000));
  return isAr ? `آخر رصد قبل ${days} يومًا — أقدم من ${PICK_FRESHNESS_MAX_HOURS / 24} أيام` : `Last observed ${days} days ago — older than ${PICK_FRESHNESS_MAX_HOURS / 24} days`;
}

/** Model codes the knowledge layer holds for this canonical, if any — a shopper's fastest
 *  "is it the same version?" check. Never derived from the identity key's sentinels. */
function modelCodes(attributes: Record<string, unknown> | null | undefined): string | null {
  if (!attributes) return null;
  const v = attributes.model_number ?? attributes.model ?? attributes.mpn;
  return typeof v === 'string' && v.trim() && !/^(NO_|NA$)/.test(v) ? v.trim() : null;
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
 * P0 stale-price safety (2026-08-07): evidence older than STALE_CAVEAT_HOURS must never be
 * presented as freshly verified — shown on the offer that carries it, and only there.
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

/** The store exit — attributed through /go (never a raw store URL), with the same category
 *  attribution the rest of the catalog uses. Names the store on the button. */
function GoButton({ offer, isAr, attribution, canonicalId, surface, primary }: {
  offer: CompareOffer; isAr: boolean; attribution: CategoryAttribution | null; canonicalId: string;
  surface: 'compare_featured' | 'compare_all_offers'; primary: boolean;
}) {
  const label = isAr ? `اذهب إلى ${offer.store_name}` : `Go to ${offer.store_name}`;
  const cls = primary
    ? 'inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-green)] px-5 text-sm font-semibold text-white shadow-[var(--elevation-1)] transition-colors hover:bg-[var(--brand-green-dark)]'
    : 'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-xs font-semibold text-on-surface transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)] sm:w-auto';
  if (!offer.product_url) {
    return (
      <span className={`${primary ? 'inline-flex h-11 w-full items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container)] px-5 text-sm font-medium text-on-surface-variant' : 'text-xs text-on-surface-variant'}`}>
        {isAr ? 'رابط المتجر غير متاح لهذا العرض' : 'No store link available for this offer'}
      </span>
    );
  }
  const inner = (<><span>{label}</span><ExternalLink className={primary ? 'h-4 w-4' : 'h-3 w-3'} /></>);
  return attribution ? (
    <CategoryExitLink href={offer.product_url} className={cls} attribution={attribution} store={offer.store_name} canonicalId={canonicalId}>{inner}</CategoryExitLink>
  ) : (
    <ExitLink href={offer.product_url} className={cls} store={offer.store_name} canonicalId={canonicalId} surface={surface}>{inner}</ExitLink>
  );
}

/** One scannable offer row: store | price | observed · availability | go — details collapsed. */
function OfferRow({ offer, isAr, attribution, canonicalId, isLowest, excluded }: {
  offer: CompareOffer; isAr: boolean; attribution: CategoryAttribution | null; canonicalId: string; isLowest: boolean; excluded: boolean;
}) {
  const avail = availabilityLabel(offer, isAr);
  const condition = classifyCondition(offer.raw_name);
  const conditionLabel = CONDITION_LABELS[condition][isAr ? 'ar' : 'en'];
  return (
    <li className={`px-4 py-3.5 ${excluded ? 'opacity-80' : 'hover:bg-[color:var(--color-surface-container-low)]'} transition-colors`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap">
        {/* store */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 basis-[55%] sm:basis-auto sm:w-44 sm:flex-none">
          <StoreLogo slug={offer.store_slug} size="md" alt={offer.store_name} locale={isAr ? 'ar' : 'en'} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-on-surface">{offer.store_name}</p>
            <p className="text-[11px] text-on-surface-variant">{observedLabel(offer.observed_at, isAr)}</p>
          </div>
        </div>
        {/* price */}
        <div className="shrink-0 text-end sm:w-32">
          <Price amount={offer.price} className={`text-lg font-bold tabular-nums ${isLowest ? 'text-[var(--brand-green-dark)]' : 'text-on-surface'}`} symbolClassName="w-4 h-4" />
          {isLowest && !excluded && (
            <p className="text-[10px] font-semibold text-[var(--brand-green-dark)]">{isAr ? 'الأقل' : 'Lowest'}</p>
          )}
        </div>
        {/* availability / reason */}
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          {excluded ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-container)] px-2 py-0.5 text-[11px] text-on-surface-variant">
              <History className="h-3 w-3" />{exclusionReason(offer, isAr)}
            </span>
          ) : avail ? (
            <span className={`text-xs font-medium ${avail.tone === 'ok' ? 'text-[var(--brand-green)]' : avail.tone === 'bad' ? 'text-[var(--color-error)]' : 'text-on-surface-variant'}`}>● {avail.text}</span>
          ) : null}
        </div>
        {/* go */}
        <div className="basis-full sm:basis-auto sm:shrink-0">
          <GoButton offer={offer} isAr={isAr} attribution={attribution} canonicalId={canonicalId} surface="compare_all_offers" primary={false} />
        </div>
      </div>
      <CampaignEligibilityNote offer={offer} isAr={isAr} />
      {!excluded && <StaleEvidenceNote offer={offer} isAr={isAr} />}
      {/* details — collapsed: the merchant's own listing title and stated condition */}
      <details className="group mt-2">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] text-on-surface-variant hover:text-on-surface [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
          {isAr ? 'وصف العرض عند المتجر' : 'Listing as stated by the store'}
        </summary>
        <div className="mt-1.5 rounded-lg border border-[color:var(--color-outline-variant)]/60 px-3 py-2 text-xs leading-relaxed" data-offer-description>
          <p className="font-semibold text-on-surface">{conditionLabel}</p>
          <p dir="auto" className="mt-1 whitespace-normal break-words [overflow-wrap:anywhere] text-on-surface">
            {offer.raw_name?.trim() || (isAr ? 'لم يتوفر وصف لهذا العرض.' : 'No description available for this offer.')}
          </p>
        </div>
      </details>
    </li>
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

  // No PublicPageShell in this file: `(public)/layout.tsx` already wraps the route group with
  // it (ADR-386 removed the second wrapper that doubled every landmark).
  if (!data || data.offers.length === 0) {
    const nm = data?.canonical ? (isAr ? (data.canonical.name_ar || data.canonical.name_en) : (data.canonical.name_en || data.canonical.name_ar)) : null;
    return (
      <>
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
      </>
    );
  }

  const { canonical, summary, offers, message } = data;
  const name = isAr ? (canonical.name_ar || canonical.name_en) : (canonical.name_en || canonical.name_ar);
  const codes = modelCodes(canonical.attributes);

  // ONE eligibility rule, shared with the summary (get-comparison.ts): an offer backs the
  // comparison only if it is in stock AND observed within PICK_FRESHNESS_MAX_HOURS. Everything
  // else is shown — with its own reason — outside the comparison, never as a competitor.
  const { eligible: eligibleOffers, older: excludedOffers } = partitionOffersByEligibility(offers);
  const featured = offers.find((o) => o.store_name === summary.cheapest_store) ?? eligibleOffers[0] ?? offers[0];
  const featuredIsEligible = eligibleOffers.includes(featured);
  const alternatives = eligibleOffers.filter((o) => o !== featured);

  /**
   * THE OFFERS, IN A FORM A MACHINE CAN READ (ADR-189). Every figure here is one the page
   * renders; the nested offers are the ELIGIBLE set the lowPrice/highPrice came from (ADR-386).
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(canonical.brand ? { brand: { '@type': 'Brand', name: canonical.brand } } : {}),
    ...(canonical.image_url ? { image: canonical.image_url } : {}),
    ...(codes ? { mpn: codes } : {}),
    ...(summary.lowest_price != null ? {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'SAR',
        lowPrice: String(summary.lowest_price),
        ...(summary.highest_price != null ? { highPrice: String(summary.highest_price) } : {}),
        offerCount: eligibleOffers.length,
        offers: eligibleOffers
          .filter((o) => o.price > 0)
          .map((o) => ({
            '@type': 'Offer',
            price: String(o.price),
            priceCurrency: 'SAR',
            ...(o.product_url ? { url: o.product_url } : {}),
            seller: { '@type': 'Organization', name: retailerDisplayName(resolveApprovedSlug(o.store_name), isAr ? 'ar' : 'en') ?? o.store_name },
            availability: o.availability === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          })),
      },
    } : {}),
  };

  const featuredAvail = availabilityLabel(featured, isAr);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CompareStateSync canonicalId={canonical.id} />
      <div className="mx-auto max-w-3xl space-y-5">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Link href={`/${locale}`} className="hover:text-on-surface transition-colors">{isAr ? 'الرئيسية' : 'Home'}</Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <Link href={`/${locale}/search`} className="hover:text-on-surface transition-colors">{isAr ? 'البحث' : 'Search'}</Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <span className="truncate max-w-[200px] font-medium text-on-surface">{name}</span>
        </nav>

        {/* ── 1. Identity: which product, which version ── */}
        {/* a <section>, not a <header>: the page's ONE banner landmark is the shell's (ADR-386) */}
        <section aria-label={isAr ? 'المنتج' : 'Product'} className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-4 md:p-5">
          <div className="flex items-start gap-4">
            {canonical.image_url && (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white md:h-24 md:w-24">
                <Image src={canonical.image_url} alt="" fill sizes="96px" className="object-contain p-1.5" unoptimized />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">{categoryBadgeLabel(canonical.category, isAr)}</Badge>
                {canonical.brand && <Badge variant="outline" className="text-xs capitalize">{canonical.brand}</Badge>}
                {codes && <Badge variant="outline" className="text-xs tabular-nums" dir="ltr">{codes}</Badge>}
              </div>
              <h1 className="text-lg font-bold leading-snug text-on-surface md:text-2xl">{name}</h1>
              {/* `identity_confidence` is an INTERNAL score, never rendered as measured accuracy
                  (ADR-386). What IS true: these offers were grouped on the model's declared
                  specifications; the shopper can confirm the model code at the store. */}
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-on-surface-variant">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-green)]" />
                {isAr
                  ? 'عروض النسخة نفسها — جُمعت على مواصفات الموديل المعلنة'
                  : 'Same-version offers — grouped on the model’s declared specifications'}
              </p>
            </div>
          </div>
        </section>

        {/* ── 2. Decision: the lowest ELIGIBLE offer, when we saw it, and where to go ── */}
        <section
          aria-label={isAr ? 'العرض المقترح' : 'Suggested offer'}
          className={`relative overflow-hidden rounded-2xl border-2 p-4 md:p-6 ${featuredIsEligible ? 'border-[var(--brand-green)]/40' : 'border-[color:var(--color-outline-variant)]'} bg-[color:var(--color-surface-container-low)]`}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${featuredIsEligible ? 'bg-[var(--brand-green)] text-white' : 'bg-[color:var(--color-surface-container-high)] text-on-surface-variant'}`}>
              <Trophy className="h-3 w-3" />
              {featuredIsEligible
                ? (eligibleOffers.length > 1 ? (isAr ? 'أقل سعر مرصود' : 'Lowest observed price') : (isAr ? 'العرض المرصود' : 'Observed offer'))
                : (isAr ? 'آخر سعر رصدناه' : 'Last observed price')}
            </span>
            {eligibleOffers.length > 1 && (
              <span className="text-xs text-on-surface-variant">
                {isAr ? `من ${eligibleOffers.length} متاجر رُصدت خلال ${PICK_FRESHNESS_MAX_HOURS / 24} أيام` : `across ${eligibleOffers.length} stores observed within ${PICK_FRESHNESS_MAX_HOURS / 24} days`}
              </span>
            )}
            {eligibleOffers.length === 1 && excludedOffers.length > 0 && (
              <span className="text-xs text-on-surface-variant">{isAr ? 'متجر واحد مؤهل حاليًا — لا مقارنة سعر حديثة' : 'One eligible store right now — no current price comparison'}</span>
            )}
          </div>

          {!summary.lowest_price && message && (
            <p className="mb-3 rounded-xl border border-[color:var(--color-outline-variant)]/40 bg-[color:var(--color-surface-container)] p-3 text-center text-sm text-on-surface-variant">{message}</p>
          )}

          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <StoreLogo slug={featured.store_slug} size="lg" alt={featured.store_name} locale={isAr ? 'ar' : 'en'} />
              <div className="min-w-0">
                <p className="text-xs text-on-surface-variant">{featuredIsEligible ? (isAr ? 'عند' : 'at') : (isAr ? 'آخر سعر رصدناه عند' : 'Last observed price at')}</p>
                <p className="truncate text-base font-bold text-on-surface">{featured.store_name}</p>
                <p className="text-[11px] text-on-surface-variant">
                  {observedLabel(featured.observed_at, isAr)}
                  {featuredAvail && <span className={featuredAvail.tone === 'ok' ? 'text-[var(--brand-green)]' : featuredAvail.tone === 'bad' ? 'text-[var(--color-error)]' : ''}>{' · '}{featuredAvail.text}</span>}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-end">
              <Price amount={featured.price} className="text-3xl font-extrabold tabular-nums text-[var(--brand-green-dark)] md:text-4xl" symbolClassName="w-6 h-6 md:w-7 md:h-7" />
              {summary.highest_price != null && summary.saving != null && summary.saving > 0 && featuredIsEligible && (
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {isAr ? 'أعلى سعر مؤهل' : 'Highest eligible'} <Price amount={summary.highest_price} className="text-xs font-semibold text-on-surface" symbolClassName="w-3 h-3" />
                  {' · '}
                  <span className="font-semibold text-amber-700 dark:text-amber-400">{isAr ? 'الفرق' : 'spread'} <Price amount={summary.saving} className="text-xs font-semibold" symbolClassName="w-3 h-3" /></span>
                </p>
              )}
            </div>
          </div>

          <CampaignEligibilityNote offer={featured} isAr={isAr} />
          <StaleEvidenceNote offer={featured} isAr={isAr} />
          <div className="mt-3">
            <GoButton offer={featured} isAr={isAr} attribution={attribution} canonicalId={canonical.id} surface="compare_featured" primary />
          </div>
          {alternatives.length > 0 && (
            <p className="mt-2 text-center text-[11px] text-on-surface-variant">
              {isAr
                ? `${alternatives.length} ${alternatives.length === 1 ? 'عرض آخر مؤهل' : 'عروض أخرى مؤهلة'} أدناه — ${alternatives[0].store_name} بـ `
                : `${alternatives.length} other eligible ${alternatives.length === 1 ? 'offer' : 'offers'} below — ${alternatives[0].store_name} at `}
              <Price amount={alternatives[0].price} className="text-[11px] font-semibold" symbolClassName="w-2.5 h-2.5" />
            </p>
          )}
        </section>

        {/* ── 3. All eligible offers, scannable ── */}
        {eligibleOffers.length > 1 && (
          <section className="overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)]">
            <div className="border-b border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container)] px-4 py-3">
              <h2 className="text-sm font-bold text-on-surface">
                {isAr ? `العروض الداخلة في المقارنة (${eligibleOffers.length} متاجر)` : `Offers in this comparison (${eligibleOffers.length} stores)`}
              </h2>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                {isAr
                  ? `رُصدت خلال آخر ${PICK_FRESHNESS_MAX_HOURS / 24} أيام ومتوفرة بحسب آخر رصد — منها يُحسب الأقل والأعلى. الترتيب بالسعر.`
                  : `Observed within ${PICK_FRESHNESS_MAX_HOURS / 24} days and in stock at last observation — lowest/highest come from these. Ordered by price.`}
              </p>
            </div>
            <ul className="divide-y divide-[color:var(--color-outline-variant)]/50">
              {eligibleOffers.map((offer, idx) => (
                <OfferRow key={`${offer.store_slug}-${idx}`} offer={offer} isAr={isAr} attribution={attribution} canonicalId={canonical.id} isLowest={offer.price === summary.lowest_price} excluded={false} />
              ))}
            </ul>
          </section>
        )}

        {/* ── 4. Outside the comparison — each with its reason ── */}
        {excludedOffers.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-dashed border-[color:var(--color-outline-variant)]">
            <div className="border-b border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface-container-low)] px-4 py-3">
              <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-on-surface-variant">
                <History className="h-3.5 w-3.5" />
                {isAr ? `عروض خارج المقارنة (${excludedOffers.length})` : `Offers outside the comparison (${excludedOffers.length})`}
              </h2>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                {isAr
                  ? 'لا تدخل في حساب الأقل والأعلى؛ السبب مذكور عند كل عرض. قد لا تعكس سعر المتجر الحالي.'
                  : 'Not part of the lowest/highest calculation; the reason is stated on each offer. May not reflect the store’s current price.'}
              </p>
            </div>
            <ul className="divide-y divide-[color:var(--color-outline-variant)]/50">
              {excludedOffers.map((offer, idx) => (
                <OfferRow key={`${offer.store_slug}-x-${idx}`} offer={offer} isAr={isAr} attribution={attribution} canonicalId={canonical.id} isLowest={false} excluded />
              ))}
            </ul>
          </section>
        )}

        {/* ── 5. One shared note, instead of one per offer ── */}
        <footer className="space-y-1.5 px-1 py-2 text-center text-[11px] leading-relaxed text-on-surface-variant">
          <p>
            {isAr
              ? 'الأسعار كما رصدناها في وقت الرصد المذكور، دون شحن أو تركيب. تحقق من الحالة واللون والضمان لدى المتجر قبل الشراء؛ قد تختلف شروط العروض.'
              : 'Prices are as observed at the stated time, excluding shipping and installation. Confirm condition, colour and warranty with the retailer before buying; offer terms may differ.'}
          </p>
          <p className="inline-flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-green)]" />
            {isAr
              ? 'جُمعت هذه العروض على مواصفات الموديل المعلنة؛ تحقق من رقم الموديل لدى المتجر • مدعوم بـ TPS'
              : 'These offers were grouped on the model’s declared specifications; confirm the model number with the retailer • Powered by TPS'}
          </p>
        </footer>
      </div>
    </>
  );
}
