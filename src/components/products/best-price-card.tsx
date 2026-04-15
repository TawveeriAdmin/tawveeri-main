'use client';

import { ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { StoreLogo } from '@/components/ui/store-logo';
import { useLocale } from '@/lib/simple-intl-provider';
import { savings as savingsCopy, bestPrice as bestPriceCopy } from '@/lib/copy';
import type { AvailabilityStatus } from '@/lib/database/types';

interface StoreSummary {
  id: string;
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
 * Gold-outlined card foregrounding the best price + a one-tap CTA to the winning store.
 * Brand differentiator: in Phase plan §16, "Best price as a brand moment".
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
  const storeName = isRTL ? store.name_ar : store.name_en;
  const savings =
    originalPrice && originalPrice > currentPrice ? originalPrice - currentPrice : 0;
  const isOutOfStock = availability === 'out_of_stock';

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border-2 border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/8 p-5 md:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-12 -top-12 h-32 w-32 rounded-full bg-[var(--brand-gold)]/15 blur-2xl"
      />

      <div className="relative flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-[var(--brand-gold-dark)]" />
        <span className="t-caption text-[var(--brand-gold-dark)]">
          {bestPriceCopy(locale as 'ar' | 'en')}
        </span>
      </div>

      <div className="relative flex items-center gap-3 mb-4">
        <StoreLogo slug={store.id} size="lg" alt={storeName} locale={locale as 'ar' | 'en'} />
        <div className="flex flex-col">
          <span className="t-small text-on-surface-variant">
            {isRTL ? 'أفضل سعر الآن عند' : 'Best price right now at'}
          </span>
          <span className="t-h4 text-on-surface">{storeName}</span>
        </div>
      </div>

      <div className="relative flex items-baseline gap-3 flex-wrap mb-2">
        <Price
          amount={currentPrice}
          className="text-3xl md:text-4xl font-extrabold text-on-surface"
          symbolClassName="w-7 h-7"
        />
        {originalPrice && originalPrice > currentPrice && (
          <Price
            amount={originalPrice}
            className="text-base text-on-surface-variant line-through"
            symbolClassName="w-4 h-4"
          />
        )}
      </div>

      {savings > 0 && (
        <div className="relative mb-5">
          <span className="inline-flex items-center rounded-full bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] px-3 py-1 t-small font-semibold border border-[var(--brand-gold)]/30">
            {savingsCopy(savings, locale as 'ar' | 'en')}
          </span>
        </div>
      )}

      <div className="relative">
        {url && !isOutOfStock ? (
          <Button
            size="lg"
            className="w-full sm:w-auto"
            asChild
          >
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClick}
            >
              {isRTL ? `اشترِ من ${storeName}` : `Buy from ${storeName}`}
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : (
          <Button size="lg" className="w-full sm:w-auto" disabled>
            {isOutOfStock
              ? isRTL
                ? 'غير متوفر'
                : 'Out of stock'
              : isRTL
                ? 'الرابط غير متاح'
                : 'Link unavailable'}
          </Button>
        )}
      </div>
    </div>
  );
}
