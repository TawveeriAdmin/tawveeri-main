'use client';

import { Store, ArrowLeft, ArrowRight, CircleAlert } from 'lucide-react';
import { Price } from '@/components/ui/price';

/**
 * ClosestOptions — ADR-270 Fix 4 (2026-08-22). "Tawveeri never shows an empty result": when a
 * stated/inferred budget zeroed retrieval, this lists the 1-3 cheapest still-relevant
 * candidates the founder-approved fallback query found, each with why it missed.
 *
 * Trust contract, same discipline as `SmartPickCard`: these are NEVER the "اختيار توفيري"
 * label or component — that label asserts a confirmed match to the stated need, and an
 * over-budget item is explicitly not one. This renders as a plainer, secondary list.
 */
export interface ClosestOption {
  product_id: string;
  name_ar: string;
  name_en: string;
  best_price: number;
  store_name: string;
  product_url: string;
  miss_reason_ar: string;
  miss_reason_en: string;
}

export function ClosestOptions({ options, locale }: { options: ClosestOption[]; locale: string }) {
  const isRTL = locale === 'ar';
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  if (!options.length) return null;
  return (
    <div className="space-y-3 pt-2" data-testid="closest-options">
      <h3 className="text-headline-sm text-on-surface">
        {isRTL ? 'أقرب خيارات متاحة' : 'Closest available options'}
      </h3>
      <div className="space-y-2">
        {options.map((o) => (
          <div
            key={o.product_id || o.product_url}
            className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-on-surface">{isRTL ? o.name_ar : (o.name_en || o.name_ar)}</p>
              {o.store_name && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-on-surface-variant">
                  <Store className="h-3.5 w-3.5" aria-hidden />{o.store_name}
                </p>
              )}
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-warning-700 dark:text-warning-400">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {isRTL ? o.miss_reason_ar : (o.miss_reason_en || o.miss_reason_ar)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Price amount={o.best_price} className="text-sm font-semibold tabular-nums text-on-surface" />
              <a
                href={o.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-[color:var(--color-outline-variant)] px-3 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
              >
                {isRTL ? 'عرض في المتجر' : 'View at store'}<Arrow className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
