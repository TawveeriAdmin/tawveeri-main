// Founder Intelligence — FOCUS TODAY shared computation (ADR-277). The ONE place that assembles
// need-signals + emerging-language + opportunities + the AI reasoning layer into a decision for
// what (if anything) deserves the founder's attention today. Both the 8AM email
// (src/lib/admin/daily-report.ts) and the Founder Command Center dashboard
// (src/app/[locale]/admin/command-center/focus-today.tsx) call this SAME function and render its
// result for their own surface (HTML email vs React/Tailwind page) — the computation itself is
// never duplicated, matching this codebase's "trust is one thing, computed one way" discipline.
//
// Extracted from daily-report.ts (ADR-275/276), which used to compute this inline — that logic
// moved here unchanged; daily-report.ts now only renders the result to HTML.
import { fetchUsageEvents } from './command-center-queries';
import { computeNeedBasedOpportunities, type Opportunity } from './opportunities';
import { computeNeedSignals } from './need-signals';
import { clusterEmergingLanguage } from './emerging-language';
import {
  assembleFounderIntelligenceCandidates, generateFounderIntelligenceBrief,
  describeUnavailability, type FocusItem, type FocusDomain,
} from './founder-intelligence';

/** Single source of truth for the kill switch — both surfaces call this (directly or via
 *  computeFocusToday below) rather than each reading process.env themselves. */
export function isFounderAIBriefEnabled(): boolean {
  return process.env.ENABLE_FOUNDER_AI_BRIEF === '1';
}

export type FocusTodayResult =
  | { enabled: false }
  | { enabled: true; aiAvailable: false; reason: string }
  | { enabled: true; aiAvailable: true; focusItems: FocusItem[] };

/**
 * Never throws. Returns `{enabled:false}` immediately (no DB/AI calls at all) when the flag is
 * off — callers must render nothing in that case. On any failure anywhere in the assembly,
 * returns `{enabled:true, aiAvailable:false, reason}` rather than throwing — the caller's own
 * surface (guaranteed-send email; dashboard's existing sections) must never depend on this
 * succeeding (ADR-216 Decision 6, ADR-275).
 */
export async function computeFocusToday(existingOpportunities: Opportunity[]): Promise<FocusTodayResult> {
  if (!isFounderAIBriefEnabled()) return { enabled: false };
  try {
    const recentEnd = new Date();
    const recentStart = new Date(recentEnd.getTime() - 7 * 24 * 3600_000);
    const baselineStart = new Date(recentStart.getTime() - 7 * 24 * 3600_000);
    const [recentEvents, baselineEvents] = await Promise.all([
      fetchUsageEvents(recentStart, recentEnd),
      fetchUsageEvents(baselineStart, recentStart),
    ]);
    const recentReal = recentEvents.filter((e) => !e.is_test);
    const baselineReal = baselineEvents.filter((e) => !e.is_test);

    const needSignals = await computeNeedSignals(recentReal, baselineReal);
    const emergingClusters = clusterEmergingLanguage(recentReal);
    const needOpportunities = computeNeedBasedOpportunities(needSignals, emergingClusters);

    const candidates = assembleFounderIntelligenceCandidates([...existingOpportunities, ...needOpportunities]);
    const brief = await generateFounderIntelligenceBrief(candidates);

    if (!brief.aiAvailable) {
      return { enabled: true, aiAvailable: false, reason: describeUnavailability(brief) ?? 'unknown' };
    }
    return { enabled: true, aiAvailable: true, focusItems: brief.focusItems };
  } catch (e) {
    return { enabled: true, aiAvailable: false, reason: e instanceof Error ? e.message : 'unexpected error' };
  }
}

// ── Shared Arabic copy (ADR-277) — both surfaces show the SAME words for the same evidence
// kind/confidence/action tier, not independently-drifting translations of the same concept.
// Visual styling (colors, HTML-inline vs Tailwind) stays per-surface — that's presentation, not
// intelligence, and each medium needs its own.
export const DOMAIN_LABEL_AR: Record<FocusDomain, string> = {
  marketing_content: 'تسويق ومحتوى', product_engineering: 'منتج وهندسة',
  catalog_coverage: 'تغطية الكتالوج', commercial: 'تجاري', demand_radar: 'مرصد الطلب', home_mission: 'جهّز بيتك',
};
export const EVIDENCE_CONFIDENCE_LABEL_AR: Record<FocusItem['evidenceConfidence'], string> = {
  low: 'منخفضة', medium: 'متوسطة', high: 'عالية',
};
export const ACTION_TIER_LABEL_AR: Record<FocusItem['actionTier'], string> = {
  ACT: 'جاهز للتحرك', WATCH: 'راقب فقط', INSUFFICIENT_EVIDENCE: 'دليل غير كافٍ بعد',
};
