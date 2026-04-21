'use client';

import { useLocale } from '@/lib/simple-intl-provider';

interface ResultsMetaProps {
  count: number;
  /** Latency in milliseconds. Optional — when omitted only the count is shown. */
  latencyMs?: number;
  className?: string;
}

const fmt = (n: number, locale: 'ar' | 'en') =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US').format(n);

/** "245 نتيجة" / "245 results" */
export function ResultsMeta({ count, className }: ResultsMetaProps) {
  const { locale, isRTL } = useLocale();

  return (
    <p className={`t-small text-on-surface-variant ${className ?? ''}`}>
      <span className="font-semibold text-on-surface">{fmt(count, locale)}</span>{' '}
      {isRTL ? 'نتيجة' : count === 1 ? 'result' : 'results'}
    </p>
  );
}
