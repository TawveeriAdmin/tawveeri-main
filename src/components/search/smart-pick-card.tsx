'use client';

import Link from 'next/link';
import { Sparkles, Store, ArrowLeft, ArrowRight, BarChart3, Clock, CircleAlert } from 'lucide-react';
import { Price } from '@/components/ui/price';
import { hoursSince, observedAgoLabel } from '@/lib/intelligence/evidence-engine';

/**
 * SmartPickCard — surfaces Tawveeri's decision layer ("Smart Pick") at the top
 * of search results.
 *
 * Trust contract: this component only renders what the decision layer deemed a
 * trustworthy pick. The search API gates the card server-side — it returns null
 * when the best match is an accessory for a product query — so an accessory can
 * never appear here as "the pick". The reason and store count are evidence the
 * engine computed (Constitution: transparency; deterministic engine decides,
 * the surface only renders).
 *
 * ADR-136 — a store count is only shown where a comparison surface honours it.
 * This card used to render "مقارنة موثقة · متوفر في 3 متاجر" with a single link
 * to `/go/<id>` — one store's exit. The customer was told a 3-store comparison
 * existed and given no way to see it. Now: when `compare_url` is present the card
 * leads to the comparison; when it is absent the multi-store claim is not made.
 */

export interface SmartPick {
  title: string;
  best_price: number;
  store_name: string;
  product_url: string;
  store_count: number;
  reason_ar: string;
  is_tps: boolean;
  /** The comparison page that honours `store_count`. Null ⇒ no comparison claim. */
  compare_url?: string | null;
  /** ADR-193 — when the claimed best price was observed. Null ⇒ live-scraped this request. */
  last_observed_at?: string | null;
  /**
   * ONE TAWVEERI BRAIN (2026-08-09): the same evidence-engine trust computation
   * (`productTrust`) Waffar's decide() route cites for its Smart Pick, now also
   * attached here so both surfaces share one trust source instead of this card's
   * "our pick" claim resting only on the private ranking heuristic that chose it.
   * Optional — older cached responses may not carry it. Not yet rendered on this
   * card (the existing is_tps/claimsComparison badges already communicate
   * corroboration); kept as data for now rather than adding a second trust badge
   * without a considered design pass.
   */
  trust?: { score: number; tier: 'high' | 'medium' | 'low' | string } | null;
  /** Decision Card v1, ruling B1 (2026-08-22) — TV only. Present when a requested screen size
   *  doesn't match this pick's own. Disclosure only; never changes which product this is. */
  size_mismatch?: { requested: number; actual: number } | null;
}

export function SmartPickCard({ pick, locale }: { pick: SmartPick; locale: string }) {
  const isRTL = locale === 'ar';
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const mismatch = pick.size_mismatch ?? null;
  // Decision Card v1, ruling B1 — a pick that doesn't match a requested screen size is never
  // labelled "اختيار توفيري" ("Tawveeri's pick"), which asserts a confirmed match.
  const label = mismatch ? (isRTL ? 'أقرب بديل متاح' : 'Closest available match') : (isRTL ? 'اختيار توفيري' : 'Tawveeri Smart Pick');
  const cta = isRTL ? 'اعرض العرض' : 'View offer';
  const compareUrl = pick.compare_url || null;
  // The claim and the surface that backs it are one decision, made here once.
  const claimsComparison = pick.store_count >= 2 && !!compareUrl;
  // ADR-193 / Master Book §31.5 — the observation time renders at the point of the price
  // claim. No timestamp is invented (T2): when there is no stored observation (live-scraped
  // pick), the line does not render.
  const observedAge = hoursSince(pick.last_observed_at);

  return (
    <div
      data-testid="smart-pick"
      data-store-count={claimsComparison ? pick.store_count : 1}
      data-best-price={pick.best_price}
      data-compare-url={compareUrl ?? ''}
      className="group mb-4 block rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-surface-container-lowest p-4 transition-shadow hover:shadow-md dark:border-primary-800 dark:from-primary-950/40 dark:to-surface-container-lowest sm:p-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-2.5 py-1 text-xs font-semibold text-on-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {label}
        </span>
        {pick.is_tps && (
          <span className="rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-medium text-success-700 dark:bg-success-900/40 dark:text-success-300">
            {/* "Comparison" only when >=2 real stores AND a comparison page to show them;
                otherwise it's an honest single-store verified price. */}
            {claimsComparison
              ? (isRTL ? 'مقارنة موثقة' : 'Verified comparison')
              : (isRTL ? 'سعر موثّق' : 'Verified price')}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-on-surface sm:text-lg">
            {pick.title}
          </h3>
          {mismatch && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning-700 dark:text-warning-400" data-testid="size-mismatch-line">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {isRTL
                ? `طلبت ${mismatch.requested} بوصة — هذا المنتج ${mismatch.actual} بوصة`
                : `You asked for ${mismatch.requested}" — this is a ${mismatch.actual}" TV`}
            </p>
          )}
          <p className="mt-0.5 text-sm text-on-surface-variant">{pick.reason_ar}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-on-surface-variant">
            <Store className="h-3.5 w-3.5" aria-hidden />
            {/* `reason_ar` already carries the store count when it can be honoured — saying it
                twice on one card reads as two separate claims. Name the store the price is at. */}
            <span>{isRTL ? `أفضل سعر عند ${pick.store_name}` : `Best price at ${pick.store_name}`}</span>
          </p>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-xs text-on-surface-variant">{isRTL ? 'أفضل سعر' : 'Best price'}</div>
          <Price amount={pick.best_price} className="text-xl font-bold text-primary-700 dark:text-primary-300 tabular-nums" />
          {observedAge != null && (
            <div data-testid="smart-pick-observed" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
              <Clock className="h-3 w-3" aria-hidden />
              <span>{observedAgoLabel(observedAge, isRTL ? 'ar' : 'en')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {claimsComparison && (
          // The claim's own surface. Primary, because the reason the pick is trustworthy is
          // that we compared — so "see the comparison" must be the first thing offered.
          <Link
            href={compareUrl!}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 text-xs font-bold text-on-primary transition-colors hover:bg-primary-700"
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {isRTL ? `قارن الأسعار في ${pick.store_count} متاجر` : `Compare ${pick.store_count} stores`}
          </Link>
        )}
        <Link
          href={pick.product_url}
          className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-primary-300 px-4 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-800 dark:text-primary-300 dark:hover:bg-primary-950/40"
        >
          {claimsComparison ? (isRTL ? `اذهب إلى ${pick.store_name}` : `Go to ${pick.store_name}`) : cta}
          <Arrow className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
