'use client';

import { ExternalLink, Trophy } from 'lucide-react';
import { Price } from '@/components/ui/price';
import { StoreLogo } from '@/components/ui/store-logo';
import { useLocale } from '@/lib/simple-intl-provider';
import { savings as savingsCopy, bestPrice as bestPriceCopy } from '@/lib/copy';
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
}: BestPriceCardProps) {
  const { isRTL, locale } = useLocale();
  const storeName = (isRTL ? store.name_ar : store.name_en) || store.name_en || store.name_ar || '';
  const savings =
    originalPrice && originalPrice > currentPrice ? originalPrice - currentPrice : 0;
  const isOutOfStock = availability === 'out_of_stock';
  const canBuy = Boolean(url) && !isOutOfStock;

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
          {bestPriceCopy(locale as 'ar' | 'en')}
        </span>
      </div>

      {/* Store identity + price in a two-column layout */}
      <div className="flex items-start justify-between gap-4 mb-5">
        {/* Store */}
        <div className="flex items-center gap-3 min-w-0">
          <StoreLogo slug={store.slug || store.id} size="lg" alt={storeName} locale={locale as 'ar' | 'en'} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-on-surface-variant">
              {isRTL ? 'أفضل سعر الآن عند' : 'Best price at'}
            </span>
            <span className="text-base font-bold text-on-surface truncate">
              {storeName || (isRTL ? 'المتجر' : 'Store')}
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="flex flex-col items-end shrink-0">
          <Price
            amount={currentPrice}
            className="text-3xl md:text-4xl font-extrabold text-[var(--brand-green-dark)]"
            symbolClassName="w-6 h-6 md:w-7 md:h-7"
          />
          {originalPrice && originalPrice > currentPrice && (
            <Price
              amount={originalPrice}
              className="text-sm text-on-surface-variant line-through mt-0.5"
              symbolClassName="w-3 h-3"
            />
          )}
        </div>
      </div>

      {savings > 0 && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] px-2.5 py-1 text-xs font-bold border border-[var(--brand-gold)]/30">
            {savingsCopy(savings, locale as 'ar' | 'en')}
          </span>
        </div>
      )}

      {/* Plain anchor — guarantees label visibility regardless of Button internals */}
      {canBuy ? (
        <a
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
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
