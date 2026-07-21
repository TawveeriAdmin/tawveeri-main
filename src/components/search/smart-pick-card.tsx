'use client';

import Link from 'next/link';
import { Sparkles, Store, ArrowLeft, ArrowRight } from 'lucide-react';
import { Price } from '@/components/ui/price';

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
 */

export interface SmartPick {
  title: string;
  best_price: number;
  store_name: string;
  product_url: string;
  store_count: number;
  reason_ar: string;
  is_tps: boolean;
}

export function SmartPickCard({ pick, locale }: { pick: SmartPick; locale: string }) {
  const isRTL = locale === 'ar';
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const label = isRTL ? 'اختيار توفيري' : 'Tawveeri Smart Pick';
  const cta = isRTL ? 'اعرض العرض' : 'View offer';
  const acrossStores = isRTL
    ? `متوفر في ${pick.store_count} ${pick.store_count === 1 ? 'متجر' : 'متاجر'}`
    : `across ${pick.store_count} store${pick.store_count === 1 ? '' : 's'}`;

  return (
    <Link
      href={pick.product_url}
      className="group mb-4 block rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-surface-container-lowest p-4 transition-shadow hover:shadow-md dark:border-primary-800 dark:from-primary-950/40 dark:to-surface-container-lowest sm:p-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-2.5 py-1 text-xs font-semibold text-on-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {label}
        </span>
        {pick.is_tps && (
          <span className="rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-medium text-success-700 dark:bg-success-900/40 dark:text-success-300">
            {isRTL ? 'مقارنة موثقة' : 'Verified comparison'}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-on-surface sm:text-lg">
            {pick.title}
          </h3>
          <p className="mt-0.5 text-sm text-on-surface-variant">{pick.reason_ar}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-on-surface-variant">
            <Store className="h-3.5 w-3.5" aria-hidden />
            <span>{pick.store_name}</span>
            {pick.store_count > 1 && <span className="opacity-70">· {acrossStores}</span>}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-xs text-on-surface-variant">{isRTL ? 'أفضل سعر' : 'Best price'}</div>
          <Price amount={pick.best_price} className="text-xl font-bold text-primary-700 dark:text-primary-300 tabular-nums" />
          <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-600 group-hover:underline dark:text-primary-400">
            {cta}
            <Arrow className="h-3.5 w-3.5" aria-hidden />
          </div>
        </div>
      </div>
    </Link>
  );
}
