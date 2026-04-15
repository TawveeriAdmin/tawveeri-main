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

/** "245 نتيجة في 2.3 ث" / "245 results in 2.3s" — subtle trust signal. */
export function ResultsMeta({ count, latencyMs, className }: ResultsMetaProps) {
  const { locale, isRTL } = useLocale();
  const seconds = latencyMs != null ? Math.max(0.1, latencyMs / 1000).toFixed(2) : null;

  return (
    <p className={`t-small text-on-surface-variant ${className ?? ''}`}>
      <span className="font-semibold text-on-surface">{fmt(count, locale)}</span>{' '}
      {isRTL ? 'نتيجة' : count === 1 ? 'result' : 'results'}
      {seconds != null && (
        <>
          {' '}
          <span className="text-on-surface-variant">·</span>{' '}
          {isRTL ? `في ${seconds} ث` : `in ${seconds}s`}
        </>
      )}
    </p>
  );
}
