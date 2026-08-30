// Founder Intelligence — Need Signals (integrated review, 2026-08-30).
// Moves the founder-facing view from "what CATEGORY did people search" to
// "what NEED are they trying to solve" — without a parallel NLU system.
// Composes primitives that already exist and are already production-
// validated: parseShoppingTask (the ONE canonical category-derivation
// function), the shared decision-evidence detector (src/lib/language/
// decision-evidence.ts), and Demand Radar's own live-catalog answerability
// check (reused, not re-derived). Every number here traces to one of those
// three sources — this file adds no new ground truth, only aggregation.
//
// A "need cluster" here is CATEGORY-granular, not category×constraint —
// deliberately. Tawveeri's current real volume (a few hundred category-
// bearing events per 30 days across ~15 categories) is too thin to reach a
// usable sample size at a finer cross-product granularity; fragmenting
// further would mostly produce n=1 "clusters," which is exactly the kind of
// unstable indicator this project's own evidence discipline exists to
// avoid. Instead, constraint-shape (budget/use-case/comparison/…) is
// reported as a SHARE within each category — "38% of AC demand this week
// carried a room/budget constraint" — which is the "need, not category"
// texture the objective asks for, at a granularity current volume can
// actually support. Re-evaluate the granularity once volume grows.

import { parseShoppingTask } from '@/lib/agent/task-parser';
import { hasDecisionEvidence } from '@/lib/language/decision-evidence';
import { assessAnswerability } from '@/lib/growth/demand-radar/answerability';
import type { UsageEventRow } from './command-center-queries';

const SEARCH_TYPES = new Set(['search', 'advisor_query']);
const RESULTS_TYPES = new Set(['results', 'advisor_result']);
const DEMAND_TYPES = new Set([...SEARCH_TYPES, ...RESULTS_TYPES]);

/** Minimum category-bearing events before momentum/decision-share are
 *  reported as a number rather than "insufficient volume." Matches the
 *  existing EARLY_SIGNAL_THRESHOLD convention in opportunities.ts. */
export const MIN_SAMPLE_FOR_SIGNAL = 20;

export interface CategoryNeedSignal {
  category: string;
  /** This period's category-bearing demand volume (recorded + derived — the
   *  exact topDemand() logic, category granularity only). */
  volume: number;
  recorded: number;
  derived: number;
  /** Same computation over the comparison baseline period. */
  baselineVolume: number;
  /** (volume - baselineVolume) / baselineVolume, or null if baselineVolume
   *  is 0 (a genuinely new category, not a % — dividing by zero is not a
   *  momentum figure). */
  momentumPct: number | null;
  /** Share of this period's volume for the category contributed by the
   *  single most active session — a concentration guard, never silently
   *  netted out (Data Quality Contract Rule 8 precedent). */
  topSessionShare: number;
  /** Share of this period's demand for the category carrying >=1 genuine
   *  decision-evidence signal (recommendation-request/comparison/budget/
   *  use-case/urgency/replacement/availability), vs. generic lookup or
   *  bare declarative want. */
  decisionEvidenceShare: number;
  decisionEvidenceCount: number;
  /** Live catalog-capability read — the SAME check Demand Radar's real
   *  tier decision uses, never re-derived. */
  answerability: 'yes' | 'partial' | 'no' | 'unknown';
  answerabilityReason: string;
  /** volume — restated on the record itself so a caller never has to look
   *  elsewhere to apply a confidence floor. */
  sampleSize: number;
  belowConfidenceFloor: boolean;
}

/** Derive a category the same way topDemand() does: recorded column first,
 *  else parseShoppingTask on the query text, else null (genuinely
 *  unparseable — surfaced separately by emerging-language.ts, never
 *  silently dropped here). */
function deriveCategory(e: UsageEventRow): string | null {
  if (e.category) return e.category;
  if (!e.query_text) return null;
  try {
    return parseShoppingTask(e.query_text).category || null;
  } catch {
    return null;
  }
}

function categoryVolumes(events: UsageEventRow[]): Map<string, { recorded: number; derived: number }> {
  const agg = new Map<string, { recorded: number; derived: number }>();
  for (const e of events) {
    if (!DEMAND_TYPES.has(e.event_type)) continue;
    const cat = e.category ?? deriveCategory(e);
    if (!cat) continue;
    const cur = agg.get(cat) ?? { recorded: 0, derived: 0 };
    if (e.category) cur.recorded++; else cur.derived++;
    agg.set(cat, cur);
  }
  return agg;
}

function topSessionShareForCategory(events: UsageEventRow[], category: string): number {
  const perSession = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    if (!DEMAND_TYPES.has(e.event_type) || !e.session_id) continue;
    if ((e.category ?? deriveCategory(e)) !== category) continue;
    total++;
    perSession.set(e.session_id, (perSession.get(e.session_id) ?? 0) + 1);
  }
  if (total === 0) return 0;
  let max = 0;
  for (const n of perSession.values()) max = Math.max(max, n);
  return max / total;
}

function decisionEvidenceForCategory(events: UsageEventRow[], category: string): { share: number; count: number } {
  let total = 0;
  let withEvidence = 0;
  for (const e of events) {
    if (!DEMAND_TYPES.has(e.event_type) || !e.query_text) continue;
    if ((e.category ?? deriveCategory(e)) !== category) continue;
    total++;
    if (hasDecisionEvidence(e.query_text)) withEvidence++;
  }
  return { share: total > 0 ? withEvidence / total : 0, count: withEvidence };
}

/**
 * Compute one Need Signal per category present in `recentEvents`.
 * `baselineEvents` should be a comparable-length PRIOR period, never
 * overlapping `recentEvents` — the caller owns period selection (this
 * function makes no assumption about calendar boundaries, matching
 * command-center-queries.ts's own `resolvePeriod`/`previousRange` split).
 * Answerability reads live catalog truth — this function is therefore
 * async and does one bounded fan-out (Promise.all) over the categories
 * actually present, not the full category list.
 */
export async function computeNeedSignals(
  recentEvents: UsageEventRow[],
  baselineEvents: UsageEventRow[]
): Promise<CategoryNeedSignal[]> {
  const recentByCategory = categoryVolumes(recentEvents);
  const baselineByCategory = categoryVolumes(baselineEvents);
  const categories = [...recentByCategory.keys()];

  const withAnswerability = await Promise.all(
    categories.map(async (category) => {
      const { answerability, reason } = await assessAnswerability(category);
      return [category, { answerability, reason }] as const;
    })
  );
  const answerabilityByCategory = new Map(withAnswerability);

  return categories.map((category) => {
    const recent = recentByCategory.get(category) ?? { recorded: 0, derived: 0 };
    const baseline = baselineByCategory.get(category) ?? { recorded: 0, derived: 0 };
    const volume = recent.recorded + recent.derived;
    const baselineVolume = baseline.recorded + baseline.derived;
    const momentumPct = baselineVolume > 0 ? ((volume - baselineVolume) / baselineVolume) * 100 : null;
    const decisionEvidence = decisionEvidenceForCategory(recentEvents, category);
    const ans = answerabilityByCategory.get(category) ?? { answerability: 'unknown' as const, reason: 'not computed' };
    return {
      category,
      volume,
      recorded: recent.recorded,
      derived: recent.derived,
      baselineVolume,
      momentumPct,
      topSessionShare: topSessionShareForCategory(recentEvents, category),
      decisionEvidenceShare: decisionEvidence.share,
      decisionEvidenceCount: decisionEvidence.count,
      answerability: ans.answerability,
      answerabilityReason: ans.reason,
      sampleSize: volume,
      belowConfidenceFloor: volume < MIN_SAMPLE_FOR_SIGNAL,
    };
  }).sort((a, b) => b.volume - a.volume);
}
