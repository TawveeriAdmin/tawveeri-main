// Founder Command Center — FOCUS TODAY (ADR-277). The dashboard's persistent Founder Intelligence
// surface, mirroring the 8AM email's own FOCUS TODAY section exactly — same evidence, same
// ACT/WATCH/INSUFFICIENT_EVIDENCE tiers, same Arabic copy for domain/confidence/action labels.
// Computes NOTHING of its own: computeOpportunities/computeFocusToday are the same functions the
// email calls (src/lib/admin/opportunities.ts, src/lib/admin/focus-today.ts) — this file is
// rendering only. When ENABLE_FOUNDER_AI_BRIEF is off, computeFocusToday() returns
// {enabled:false} and isFounderAIBriefEnabled() lets the page skip the Suspense boundary
// entirely — zero extra cost, section does not exist, matching the email's own OFF behavior.
import { Suspense } from 'react';
import { Lightbulb } from 'lucide-react';
import { computeOpportunities } from '@/lib/admin/opportunities';
import {
  computeFocusToday, isFounderAIBriefEnabled,
  DOMAIN_LABEL_AR, EVIDENCE_CONFIDENCE_LABEL_AR, ACTION_TIER_LABEL_AR,
} from '@/lib/admin/focus-today';
import type { FocusTodayResult } from '@/lib/admin/focus-today';
import type { FocusItem } from '@/lib/admin/founder-intelligence';
import type { CommandCenterData } from '@/lib/admin/command-center-queries';
import { Card } from './page';

const ACTION_TIER_STYLE: Record<FocusItem['actionTier'], string> = {
  ACT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  WATCH: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  INSUFFICIENT_EVIDENCE: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50',
};

function ActionTierBadge({ tier, isRTL }: { tier: FocusItem['actionTier']; isRTL: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${ACTION_TIER_STYLE[tier]}`}>
      {isRTL ? ACTION_TIER_LABEL_AR[tier] : tier}
    </span>
  );
}

function FocusItemCard({ item, isRTL }: { item: FocusItem; isRTL: boolean }) {
  return (
    <div className="border-t border-[#eef6f2] pt-3 first:border-t-0 first:pt-0 dark:border-[#1c261f]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-black text-on-surface dark:text-white">{item.titleAr}</p>
        <ActionTierBadge tier={item.actionTier} isRTL={isRTL} />
        <span className="text-[11px] text-on-surface-variant dark:text-white/40">
          {DOMAIN_LABEL_AR[item.domain]} — {isRTL ? 'ثقة الدليل' : 'evidence confidence'} {EVIDENCE_CONFIDENCE_LABEL_AR[item.evidenceConfidence]}
          {item.earlySignal && (isRTL ? '، إشارة مبكرة' : ', early signal')}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-on-surface-variant dark:text-white/60">{item.whyNowAr}</p>
      <p className="mt-1.5 rounded-xl bg-[#f8fcfa] p-2.5 text-sm font-bold text-[#1f6f59] dark:bg-[#101713] dark:text-[#9fe4d0]">
        {isRTL ? 'الإجراء المقترح: ' : 'Recommended action: '}{item.recommendedActionAr}
      </p>
      <p className="mt-1.5 text-xs text-on-surface-variant dark:text-white/40">
        {isRTL ? 'الدليل' : 'Evidence'}: {item.evidenceAr}
        {item.riskCaveatAr && <> — <span className="text-amber-700 dark:text-amber-300">{item.riskCaveatAr}</span></>}
      </p>
    </div>
  );
}

export function FocusTodayView({ result, isRTL }: { result: FocusTodayResult; isRTL: boolean }) {
  if (!result.enabled) return null;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[#1f6f59] dark:text-[#9fe4d0]" />
        <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">
          {isRTL ? 'ركّز اليوم على' : 'Focus today on'}
        </h2>
      </div>

      {!result.aiAvailable && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {isRTL
            ? `تعذر توليد توصيات الذكاء الاصطناعي اليوم (${result.reason}) — الأرقام أدناه غير متأثرة، هذا القسم فقط غير متاح.`
            : `Could not generate AI recommendations today (${result.reason}) — the numbers below are unaffected, only this section is unavailable.`}
        </p>
      )}

      {result.aiAvailable && result.focusItems.length === 0 && (
        <p className="mt-2 text-sm text-on-surface-variant dark:text-white/60">
          {isRTL
            ? 'لا توجد إشارة قوية بما يكفي لتوصية اليوم — لا حاجة لإنشاء عمل جديد.'
            : 'No signal strong enough for a recommendation today — no new work needed.'}
        </p>
      )}

      {result.aiAvailable && result.focusItems.length > 0 && (
        <div className="mt-3 space-y-3">
          {result.focusItems.map((item) => <FocusItemCard key={item.candidateId} item={item} isRTL={isRTL} />)}
        </div>
      )}
    </Card>
  );
}

function FocusTodaySkeleton({ isRTL }: { isRTL: boolean }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[#1f6f59] dark:text-[#9fe4d0]" />
        <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">
          {isRTL ? 'ركّز اليوم على' : 'Focus today on'}
        </h2>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-[#eef6f2] dark:bg-[#1c261f]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#eef6f2] dark:bg-[#1c261f]" />
      </div>
    </Card>
  );
}

async function FocusTodayLoader({ data, isRTL }: { data: CommandCenterData; isRTL: boolean }) {
  const opportunities = computeOpportunities(data);
  const result = await computeFocusToday(opportunities);
  return <FocusTodayView result={result} isRTL={isRTL} />;
}

/** Entry point for the Command Center page. Renders nothing at all — no Suspense boundary, no
 *  skeleton flash — when the AI brief is off, so the OFF state costs the page exactly zero
 *  (matches the email's own byte-identical-when-off contract). When on, the rest of the
 *  dashboard's existing metrics/sections render immediately; this section streams in separately
 *  once the AI call resolves, so a slow AI response never delays the numbers the founder already
 *  relies on. */
export function FocusTodaySection({ data, isRTL }: { data: CommandCenterData; isRTL: boolean }) {
  if (!isFounderAIBriefEnabled()) return null;
  return (
    <Suspense fallback={<FocusTodaySkeleton isRTL={isRTL} />}>
      <FocusTodayLoader data={data} isRTL={isRTL} />
    </Suspense>
  );
}
