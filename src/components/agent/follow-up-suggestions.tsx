'use client';

import { MessageCircleQuestion, RotateCcw } from 'lucide-react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { buildFollowUpSuggestions } from '@/lib/agent/follow-up-suggestions';
import type { DecisionState } from '@/lib/agent/decision-state';
import type { Locale } from '@/lib/agent/advisor-api';

/**
 * FollowUpSuggestions — Section 9's "continue this decision" surface (2026-08-09, D→E
 * mission). Deliberately NOT a second input box: research across every credible shopping-AI
 * product (OpenAI, Amazon, Google, Perplexity, Klarna — see the mission's final report)
 * converges on ONE continuous input, and Amazon's own published UX review warns that hiding
 * a distinct conversational mode inside/behind the search box means most shoppers never find
 * it. These chips make the SAME box's mutation-handling capability (`mutation-turn.ts`)
 * discoverable — tapping one PRE-FILLS the primary composer, it does not open a new surface
 * and does not auto-submit (Baymard: a refinement should be a deliberate, explicit turn).
 */
export function FollowUpSuggestions({
  state,
  locale,
  onSelect,
  onStartNew,
}: {
  state: DecisionState;
  locale: string;
  onSelect: (text: string) => void;
  /** Explicit "start a new mission" action (Section 10) — clears the active DecisionState. */
  onStartNew: () => void;
}) {
  const t = useTranslations();
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  const suggestions = buildFollowUpSuggestions(state);
  if (!suggestions.length) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5" data-testid="follow-up-suggestions">
      <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" aria-hidden />
      {suggestions.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onSelect(loc === 'ar' ? s.prefill_ar : s.prefill_en)}
          className="inline-flex h-8 items-center rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary-300 hover:text-primary-700 dark:hover:border-primary-700 dark:hover:text-primary-300"
        >
          {loc === 'ar' ? s.label_ar : s.label_en}
        </button>
      ))}
      <button
        type="button"
        onClick={onStartNew}
        data-testid="start-new-mission"
        className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-on-surface-variant underline underline-offset-4 transition-colors hover:text-on-surface"
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
        {t('agent.startNewSearch')}
      </button>
    </div>
  );
}
