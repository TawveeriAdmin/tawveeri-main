'use client';

import { useLocale } from '@/lib/simple-intl-provider';

interface ResultsMetaProps {
  count: number;
  /** Latency in milliseconds. Optional — when omitted only the count is shown. */
  latencyMs?: number;
  className?: string;
  /**
   * ADR-400 — the unified surface answers a NEED through Waffar even when the literal
   * catalogue retrieval is empty. The counter used to print «٠ نتيجة» above a real,
   * evidence-backed recommendation (reviewer evidence #2: «العداد قال 0 نتيجة ثم ظهرت
   * ترشيحات») — a false negative on the one line a shopper reads first. When the grid is
   * empty, the counter states what IS on the page: the advisor's recommendation count, or
   * that the advisor is still working. A genuine zero still reads «٠ نتيجة».
   */
  advisorCount?: number | null;
  advisorPending?: boolean;
}

const fmt = (n: number, locale: 'ar' | 'en') =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US').format(n);

/** "245 نتيجة" / "245 results" */
export function ResultsMeta({ count, className, advisorCount, advisorPending }: ResultsMetaProps) {
  const { locale, isRTL } = useLocale();

  if (count === 0 && advisorPending) {
    return (
      <p className={`t-small text-on-surface-variant animate-pulse ${className ?? ''}`} data-testid="results-meta-advisor-pending">
        {isRTL ? 'وفّر يبحث عن أفضل خيار…' : 'Waffar is finding the best match…'}
      </p>
    );
  }
  if (count === 0 && advisorCount != null && advisorCount > 0) {
    return (
      <p className={`t-small text-on-surface-variant ${className ?? ''}`} data-testid="results-meta-advisor-count">
        <span className="font-semibold text-on-surface">{fmt(advisorCount, locale)}</span>{' '}
        {isRTL ? (advisorCount === 1 ? 'ترشيح من وفّر' : 'ترشيحات من وفّر') : (advisorCount === 1 ? 'Waffar recommendation' : 'Waffar recommendations')}
      </p>
    );
  }

  return (
    <p className={`t-small text-on-surface-variant ${className ?? ''}`}>
      <span className="font-semibold text-on-surface">{fmt(count, locale)}</span>{' '}
      {isRTL ? 'نتيجة' : count === 1 ? 'result' : 'results'}
    </p>
  );
}
