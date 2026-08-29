// Funnel observability (Radar 2.0 Phase 1, founder decision 2026-08-29).
// Two content-free, append-only tables:
//   demand_radar_funnel_events — every candidate, every stage transition
//   demand_radar_outcomes      — the founder-outcome ground truth used by
//                                 Founder Acceptance Precision (architecture
//                                 doc §F)
//
// PRIVACY CONTRACT (enforced structurally, not just by convention): both
// writer functions accept ONLY the typed shapes in types.ts (FunnelEvent /
// OutcomeRecord), which do not have post_text / author_handle / source_url /
// tracking_url / raw source_post_id fields AT ALL — there is no field to
// accidentally pass through. A caller cannot leak identifying content here
// even by mistake; TypeScript itself is the first privacy gate. Never throws
// — an observability failure must never break the radar run, mirroring every
// other file in this module (classify.ts, draft.ts, alert.ts).

import { createServerClient } from '@/lib/database';
import type { FunnelEvent, OutcomeRecord } from './types';

/** Phase 1 populates every row with one constant value — forward-compatible
 *  with §6's real query families (Phase 2) without another migration. */
export const DEFAULT_QUERY_FAMILY = 'PRODUCT_DIRECT_PURCHASE_V1';

/** Fields that must NEVER appear in a funnel/outcome row — the privacy
 *  regression test asserts this list against buildFunnelEventRow()'s and
 *  buildOutcomeRow()'s actual output, not just against the TypeScript type. */
export const FORBIDDEN_FIELDS = [
  'post_text', 'author_handle', 'source_url', 'tracking_url', 'source_post_id', 'text',
] as const;

/** Pure, DB-free row builder — exported specifically so the privacy
 *  regression test can assert its output never contains a forbidden key,
 *  independent of whatever the Supabase client does. */
export function buildFunnelEventRow(event: FunnelEvent) {
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

/** Pure, DB-free row builder — see buildFunnelEventRow() above. */
export function buildOutcomeRow(record: OutcomeRecord) {
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
    founder_outcome: record.founderOutcome,
    founder_outcome_at: record.founderOutcome ? new Date().toISOString() : null,
  };
}

export async function emitFunnelEvent(event: FunnelEvent): Promise<void> {
  try {
    const sb = createServerClient() as any;
    await sb.from('demand_radar_funnel_events').insert(buildFunnelEventRow(event));
  } catch {
    /* observability must never break the radar run */
  }
}

export async function recordOutcome(record: OutcomeRecord): Promise<void> {
  try {
    const sb = createServerClient() as any;
    const row = buildOutcomeRow(record);
    if (record.fingerprint) {
      // Upsert keyed on fingerprint: the initial write (at ranking time) and a
      // later write (at founder-action or expiry time) are the SAME logical
      // opportunity and should end up as one row, not two.
      await sb.from('demand_radar_outcomes').upsert(row, { onConflict: 'fingerprint' });
    } else {
      // No secret configured anywhere → fingerprint is null (§ candidateFingerprint
      // in heuristics.ts). Upserting on a null key would collide every
      // unrelated opportunity onto one row — plain-insert instead, an
      // explicit "unlinked, unconfigured" row rather than silently wrong data.
      await sb.from('demand_radar_outcomes').insert(row);
    }
  } catch {
    /* observability must never break the radar run or the founder-action route */
  }
}
