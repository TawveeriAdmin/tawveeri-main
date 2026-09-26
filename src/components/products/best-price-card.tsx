'use client';

import { ExternalLink, Trophy } from 'lucide-react';
import { Price, SavingsLabel } from '@/components/ui/price';
import { ReferencePrice } from '@/components/ui/reference-price';
import { StoreLogo } from '@/components/ui/store-logo';
import { useLocale } from '@/lib/simple-intl-provider';
import { bestPrice as bestPriceCopy } from '@/lib/copy';
import type { AvailabilityStatus } from '@/lib/database/types';

interface StoreSummary {
  id: string;
  slug?: string | null;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
}

interface BestPriceCardProps {
  store: StoreSummary;
  currentPrice: number;
  originalPrice?: number | null;
  availability: AvailabilityStatus;
  url?: string | null;
  /** Affiliate-tracked link click — call BEFORE navigation. */
  onClick?: () => void;
  /** ISO time of the last CREDIBLE price confirmation for this offer (`product_stores.updated_at`,
   *  ADR-380). Rendered as «رصدناه …»; absent → no time claim is made. */
  observedAt?: string | null;
  /** True when the evidence is older than the comparison eligibility window. */
  stale?: boolean;
  /** How many stores this product has — with ONE store there is nothing to be "best" against. */
  storeCount?: number;
}

/** «رصدناه اليوم/أمس/قبل يومين/قبل N أيام/قبل N يومًا» — the same phrasing the compare page uses. */
function observedLabel(iso: string, isRTL: boolean): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (!Number.isFinite(days)) return '';
  if (days <= 0) return isRTL ? 'رصدناه اليوم' : 'observed today';
  if (days === 1) return isRTL ? 'رصدناه أمس' : 'observed yesterday';
  if (isRTL) return days === 2 ? 'رصدناه قبل يومين' : days <= 10 ? `رصدناه قبل ${days} أيام` : `رصدناه قبل ${days} يومًا`;
  return `observed ${days} days ago`;
}

/**
 * Compact green-on-surface card: big price, store logo, one obvious CTA.
 * Deliberately avoids `<Button asChild>` so no wrapping issue can hide the label.
 */
export function BestPriceCard({
  store,
  currentPrice,
  originalPrice,
  availability,
  url,
  onClick,
  observedAt = null,
  stale = false,
  storeCount,
}: BestPriceCardProps) {
  const { isRTL, locale } = useLocale();
  const storeName = (isRTL ? store.name_ar : store.name_en) || store.name_en || store.name_ar || '';
  const savings =
    originalPrice && originalPrice > currentPrice ? originalPrice - currentPrice : 0;
  const isOutOfStock = availability === 'out_of_stock';
  const canBuy = Boolean(url) && !isOutOfStock;
  // ADR-387 — the SAME claim policy as the compare page: "best" only exists against ≥2 stores;
  // «الآن» is never claimed (the observation time is shown instead); stale evidence says so.
  const singleStore = typeof storeCount === 'number' && storeCount <= 1;
  const eyebrow = singleStore
    ? (isRTL ? 'السعر المرصود' : 'Observed price')
    : stale
      ? (isRTL ? 'آخر سعر رصدناه' : 'Last observed price')
      : bestPriceCopy(locale as 'ar' | 'en');
  const atLabel = singleStore
    ? (isRTL ? 'متوفر عند' : 'Available at')
    : stale
      ? (isRTL ? 'آخر سعر رصدناه عند' : 'Last observed price at')
      : (isRTL ? 'أفضل سعر مرصود عند' : 'Best observed price at');

  const ctaLabel = canBuy
    ? storeName
      ? isRTL
        ? `اشترِ من ${storeName}`
        : `Buy from ${storeName}`
      : isRTL
        ? 'اذهب إلى المتجر'
        : 'Go to store'
    : isOutOfStock
      ? isRTL
        ? 'غير متوفر'
        : 'Out of stock'
      : isRTL
        ? 'الرابط غير متاح'
        : 'Link unavailable';

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--brand-green)]/40 bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
      {/* Best-price eyebrow */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-green)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          <Trophy className="h-3 w-3" />
          {eyebrow}
        </span>
        {/* ADR-389: the single-store statement lives ONCE on the page (the chip beside the title,
            «متجر واحد — لا مقارنة بعد»); the eyebrow «السعر المرصود» + «متوفر عند» already say
            what this card claims, so the sentence is not repeated here. */}
      </div>

      {/* Store identity + price in a two-column layout */}
      <div className="flex items-start justify-between gap-4 mb-5">
        {/* Store */}
        <div className="flex items-center gap-3 min-w-0">
          <StoreLogo slug={store.slug || store.id} size="lg" alt={storeName} locale={locale as 'ar' | 'en'} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-on-surface-variant">
              {atLabel}
            </span>
            <span className="text-base font-bold text-on-surface truncate">
              {storeName || (isRTL ? 'المتجر' : 'Store')}
            </span>
            {observedAt && (
              <span className="text-[11px] text-on-surface-variant">
                {observedLabel(observedAt, isRTL)}
                {isOutOfStock
                  ? (isRTL ? ' · غير متوفر عند آخر رصد' : ' · out of stock at last observation')
                  : stale
                    ? (isRTL ? ' · متوفر بحسب آخر رصد' : ' · in stock at last observation')
                    : (isRTL ? ' · متوفر' : ' · in stock')}
              </span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="flex flex-col items-end shrink-0">
          <Price
            amount={currentPrice}
            className="text-3xl md:text-4xl font-extrabold text-[var(--brand-green-dark)]"
            symbolClassName="w-6 h-6 md:w-7 md:h-7"
          />
          <ReferencePrice amount={originalPrice} currentPrice={currentPrice} locale={locale} compact priceClassName="text-sm" symbolClassName="w-3 h-3" className="mt-0.5" />
        </div>
      </div>

      {/* Savings chip temporarily hidden — restore when copy is finalized.
      {savings > 0 && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] px-2.5 py-1 text-xs font-bold border border-[var(--brand-gold)]/30">
            <SavingsLabel amount={savings} locale={locale as 'ar' | 'en'} />
          </span>
        </div>
      )}
      */}

      {/* Plain anchor — guarantees label visibility regardless of Button internals.
          When the parent supplies onClick (affiliate tracking), cancel the default
          navigation so only the tracked URL opens — no race, no duplicate tabs. */}
      {canBuy ? (
        <a
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (onClick) {
              e.preventDefault();
              onClick();
            }
          }}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-green)] px-5 text-sm font-semibold text-white shadow-[var(--elevation-1)] transition-colors hover:bg-[var(--brand-green-dark)]"
        >
          <span>{ctaLabel}</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : (
        <div className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[color:var(--color-surface-container-high)] px-5 text-sm font-semibold text-on-surface-variant">
          {ctaLabel}
        </div>
      )}
    </div>
  );
}
