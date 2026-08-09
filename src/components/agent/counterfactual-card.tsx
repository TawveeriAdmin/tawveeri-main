'use client';

import { ArrowLeftRight, TrendingUp } from 'lucide-react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Price } from '@/components/ui/price';
import type { CounterfactualComparison } from '@/lib/agent/counterfactual';
import type { Locale } from '@/lib/agent/advisor-api';

/**
 * CounterfactualCard — "لو غيّرت الميزانية" (Unified Intelligence mission, Section 12).
 *
 * The North Star's own example: «لو زدت الميزانية 500 وش بيتغير؟». Renders a real
 * before/after comparison built from `compareCounterfactual()` — two REAL decision-engine
 * answers, never a guess. If nothing changed, that is shown too (an honest "no, it doesn't
 * matter" is itself a useful answer, not a failure to render).
 */
export function CounterfactualCard({
  comparison,
  locale,
}: {
  comparison: CounterfactualComparison;
  locale: string;
}) {
  const t = useTranslations();
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  const explanation = loc === 'ar' ? comparison.explanation_ar : comparison.explanation_en;

  return (
    <div
      data-testid="counterfactual-card"
      className="mb-4 rounded-2xl border border-primary-200 bg-primary-50/40 p-4 dark:border-primary-800 dark:bg-primary-950/20"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <ArrowLeftRight className="h-4 w-4 text-primary-600" aria-hidden />
        <span className="text-sm font-bold text-on-surface">{t('agent.counterfactualTitle')}</span>
      </div>
      {comparison.changed && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[color:var(--color-outline-variant)] bg-surface-container-lowest p-3">
            <div className="text-[11px] text-on-surface-variant">{t('agent.counterfactualBefore')}</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-on-surface">
              {loc === 'ar' ? comparison.before.title_ar : comparison.before.title_en ?? comparison.before.title_ar}
            </div>
            {comparison.before.unit_price != null && <Price amount={comparison.before.unit_price} className="mt-1 text-base font-bold text-on-surface-variant" />}
          </div>
          <div className="rounded-xl border border-primary-300 bg-primary-50 p-3 dark:border-primary-700 dark:bg-primary-950/40">
            <div className="flex items-center gap-1 text-[11px] text-primary-700 dark:text-primary-300">
              <TrendingUp className="h-3 w-3" aria-hidden />{t('agent.counterfactualAfter')}
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-on-surface">
              {loc === 'ar' ? comparison.after.title_ar : comparison.after.title_en ?? comparison.after.title_ar}
            </div>
            {comparison.after.unit_price != null && <Price amount={comparison.after.unit_price} className="mt-1 text-base font-bold text-primary-700 dark:text-primary-300" />}
          </div>
        </div>
      )}
      <p className="text-sm leading-relaxed text-on-surface">{explanation}</p>
    </div>
  );
}
