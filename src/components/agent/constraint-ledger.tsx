'use client';

import { X } from 'lucide-react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { parsedConstraintChips, type AdvisorParsed, type Locale } from '@/lib/agent/advisor-api';
import { track } from '@/lib/analytics/track';

/**
 * ConstraintLedger — "فهمنا منك" (Unified Intelligence mission, Section 7 — 2026-08-09).
 *
 * The static "understood-as" chips this replaces (`parsedSummary`, still used elsewhere and
 * still tested — untouched) told the shopper what was understood but gave them nothing to DO
 * about it. Section 7's requirement is a visible, consumer-friendly, TAP-TO-MODIFY ledger: a
 * shopper who sees "تحت 4000 ريال" and did not mean that must be able to remove it in one tap,
 * not retype the whole sentence.
 *
 * Deliberately NOT a free-form editor — every chip here is a field the deterministic parser
 * actually extracted (`parsedConstraintChips`), so there is nothing to invent and nothing that
 * can drift from what the engine is actually reasoning about. `category` is shown but never
 * removable (see `parsedConstraintChips`'s own doc: it is the subject, not a constraint).
 */
export function ConstraintLedger({
  parsed,
  locale,
  onRemove,
}: {
  parsed: AdvisorParsed | undefined;
  locale: Locale;
  /** Removes one constraint and re-runs the request without it. Omit and chips render
   *  read-only (no × button) — the same graceful degradation `onClarify` uses elsewhere. */
  onRemove?: (field: string) => void;
}) {
  const t = useTranslations();
  const chips = parsedConstraintChips(parsed, locale);
  if (!chips.length) return null;

  return (
    <div className="mb-4" data-testid="constraint-ledger">
      <span className="text-xs text-on-surface-variant">{t('agent.understoodAs')}:</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const canRemove = c.removable && !!onRemove;
          return (
            <span
              key={c.field}
              data-testid="constraint-chip"
              data-constraint-field={c.field}
              className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 ps-2.5 pe-1 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
            >
              {c.label}
              {canRemove && (
                <button
                  type="button"
                  aria-label={`${t('agent.removeConstraint')}: ${c.label}`}
                  title={t('agent.removeConstraintHint')}
                  onClick={() => {
                    track('advisor_constraint_removed', { source: 'search', meta: { field: c.field } });
                    onRemove!(c.field);
                  }}
                  className="ms-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-primary-600 transition-colors hover:bg-primary-200 hover:text-primary-900 dark:text-primary-400 dark:hover:bg-primary-900"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
