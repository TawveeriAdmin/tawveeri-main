// Radar 2.0 Phase 2 — Shadow write path (Checkpoint 1). ISOLATION CONTRACT:
// this file writes ONLY to the two Shadow-prefixed tables below. It must
// never reference either Phase 1 control table as a write target — enforced
// by the static isolation test (tests/growth/shadow-isolation.test.ts,
// Checkpoint 2), which is why this comment deliberately does not spell out
// their names. Never throws — same discipline as funnel.ts.

import { createServerClient } from '@/lib/database';
import type { ShadowFunnelEvent, ShadowOutcomeRecord, ShadowReviewLabel } from './types';

/** Fields that must NEVER appear in a Shadow funnel/outcome row — mirrors
 *  funnel.ts's FORBIDDEN_FIELDS exactly. */
export const SHADOW_FORBIDDEN_FIELDS = [
  'post_text', 'author_handle', 'source_url', 'tracking_url', 'source_post_id', 'text',
] as const;

export function buildShadowFunnelEventRow(event: ShadowFunnelEvent) {
  return {
    fingerprint: event.fingerprint,
    source: event.source,
    domain: event.domain,
    category: event.category,
    stage: event.stage,
    detail: event.detail,
    opportunity_score: event.opportunityScore,
    answerability_status: event.answerabilityStatus,
    query_family: event.queryFamily,
    is_test: event.isTest,
  };
}

export function buildShadowOutcomeRow(record: ShadowOutcomeRecord) {
  return {
    fingerprint: record.fingerprint,
    tier: record.tier,
    domain: record.domain,
    category: record.category,
    intent_type: record.intentType,
    buying_stage: record.buyingStage,
    exclusion: record.exclusion,
    opportunity_score: record.opportunityScore,
    answerability_status: record.answerabilityStatus,
    query_family: record.queryFamily,
    is_test: record.isTest,
    retrieved_by_radar1: record.retrievedByRadar1,
    shadow_review_label: record.shadowReviewLabel,
    shadow_reviewed_at: record.shadowReviewLabel ? new Date().toISOString() : null,
  };
}

export async function emitShadowFunnelEvent(event: ShadowFunnelEvent): Promise<void> {
  try {
    const sb = createServerClient() as any;
    const { error } = await sb.from('demand_radar_shadow_funnel_events').insert(buildShadowFunnelEventRow(event));
    // Engineering-debt fix (2026-08-30): a PostgREST-level error resolves
    // normally (no thrown exception), so the try/catch below never saw it —
    // funnel writes could fail silently with zero trace anywhere. Still never
    // fatal to the run (same discipline as before); now at least observable
    // in server logs instead of vanishing.
    if (error) console.error('[demand-radar/shadow] emitShadowFunnelEvent insert failed:', error.message, 'stage:', event.stage);
  } catch (e) {
    console.error('[demand-radar/shadow] emitShadowFunnelEvent threw:', e instanceof Error ? e.message : e);
    /* observability must never break the shadow run */
  }
}

export async function recordShadowOutcome(record: ShadowOutcomeRecord): Promise<void> {
  try {
    const sb = createServerClient() as any;
    const row = buildShadowOutcomeRow(record);
    const { error } = record.fingerprint
      ? await sb.from('demand_radar_shadow_outcomes').upsert(row, { onConflict: 'fingerprint' })
      : await sb.from('demand_radar_shadow_outcomes').insert(row);
    // Same debt fix as emitShadowFunnelEvent above — make a returned {error}
    // observable; still never throws or blocks the run.
    if (error) console.error('[demand-radar/shadow] recordShadowOutcome write failed:', error.message, 'queryFamily:', record.queryFamily);
  } catch (e) {
    console.error('[demand-radar/shadow] recordShadowOutcome threw:', e instanceof Error ? e.message : e);
    /* observability must never break the shadow run */
  }
}

/** Measurement-integrity fix (founder decision 2026-08-30): the founder-label
 *  write path must touch ONLY the founder-outcome fields on an existing
 *  outcome row — never recordShadowOutcome()'s full-row upsert above, which
 *  would null out the analytical fields (exclusion/opportunity_score/
 *  answerability_status/tier/intent_type/buying_stage) already recorded at
 *  run time. A plain UPDATE on the two intended columns, scoped by
 *  fingerprint, cannot touch any other column regardless of what it
 *  currently holds. Unlike recordShadowOutcome(), this does NOT swallow
 *  errors — a human is waiting on the result (see labelShadowReview()). */
export async function updateShadowOutcomeReviewLabel(
  fingerprint: string,
  label: ShadowReviewLabel
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServerClient() as any;
  // Engineering-debt fix (2026-08-30): an UPDATE matching zero rows is not a
  // PostgREST error — `error` stays null and this used to report ok:true even
  // when no outcome row existed under this fingerprint, silently discarding
  // the founder's label with no trace. `.select()` after the update forces
  // PostgREST to return the affected row(s); an empty array is the only
  // reliable signal that nothing was actually updated.
  const { data, error } = await sb
    .from('demand_radar_shadow_outcomes')
    .update({ shadow_review_label: label, shadow_reviewed_at: new Date().toISOString() })
    .eq('fingerprint', fingerprint)
    .select('fingerprint');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'no matching outcome row for fingerprint — label was not persisted' };
  return { ok: true };
}
