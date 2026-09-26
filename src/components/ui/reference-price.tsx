'use client';
// src/components/ui/reference-price.tsx — ADR-389.
// The merchant's struck-through «was» price, shown ONLY with its meaning stated: it is a
// reference figure the STORE lists, not a price Tawveeri observed, and no saving is computed
// from it (ADR-134: 71% of advertised reference prices were never observed). A bare
// strikethrough reads as "it used to cost this" — a claim we cannot back.
import { Price } from '@/components/ui/price';
import { cn } from '@/lib/utils';

export function referencePriceLabel(locale: string): string {
  return locale === 'ar' ? 'سعر مرجعي يعلنه المتجر' : "Store's listed reference price";
}

export function referencePriceTitle(locale: string): string {
  return locale === 'ar'
    ? 'رقم يعرضه المتجر كسعر سابق أو مرجعي. لم نرصده نحن، ولا نحسب منه توفيرًا.'
    : 'A figure the store lists as a previous or reference price. Tawveeri did not observe it and computes no saving from it.';
}

export function ReferencePrice({
  amount,
  currentPrice,
  locale,
  className,
  priceClassName = 'text-xs',
  symbolClassName = 'w-3 h-3',
  compact = false,
}: {
  amount: number | null | undefined;
  currentPrice: number;
  locale: string;
  className?: string;
  priceClassName?: string;
  symbolClassName?: string;
  /** compact: label as a short prefix («مرجعي:») for tight rows; full label otherwise. */
  compact?: boolean;
}) {
  if (!amount || !(amount > currentPrice)) return null;
  const label = compact ? (locale === 'ar' ? 'مرجعي (المتجر):' : 'Store ref.:') : referencePriceLabel(locale);
  return (
    <span
      className={cn('inline-flex flex-wrap items-baseline gap-1 text-on-surface-variant', className)}
      title={referencePriceTitle(locale)}
      data-reference-price={amount}
    >
      <span className="text-[10px] leading-none">{label}</span>
      <Price amount={amount} className={cn('line-through', priceClassName)} symbolClassName={symbolClassName} />
    </span>
  );
}
