// Radar 2.0 Phase 2 — Checkpoint 3: Shadow Sample Review.
//
// The ONLY place a human sees Shadow data (architecture doc §M's card,
// §W's explicit exception). Five labels only. Writes propagate to the
// de-identified demand_radar_shadow_outcomes immediately on labeling, so the
// content-bearing queue row can be deleted on schedule without losing the
// label. NO email, NO draft, NO write to any Radar 1 / production table.

import { createServerClient } from '@/lib/database';
import { updateShadowOutcomeReviewLabel, emitShadowFunnelEvent } from './shadow-funnel';
import { SHADOW_REVIEW_LABELS, SHADOW_REVIEW_QUEUE_RETENTION_HOURS, type ShadowReviewLabel } from './types';

export interface PendingReviewRow {
  id: string;
  fingerprint: string;
  source: string;
  source_url: string;
  author_handle: string | null;
  post_text: string;
  category: string | null;
  retrieved_by_radar1: boolean | null;
  is_test: boolean;
  created_at: string;
}

export async function listPendingShadowReview(limit = 20): Promise<PendingReviewRow[]> {
  await sweepExpiredShadowReviewQueue();
  const sb = createServerClient() as any;
  const { data } = await sb
    .from('demand_radar_shadow_review_queue')
    .select('id, fingerprint, source, source_url, author_handle, post_text, category, retrieved_by_radar1, is_test, created_at')
    .is('shadow_review_label', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as PendingReviewRow[];
}

export async function labelShadowReview(id: string, label: ShadowReviewLabel, note?: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!SHADOW_REVIEW_LABELS.includes(label)) return { ok: false, error: 'invalid label' };
  const sb = createServerClient() as any;
  const { data, error } = await sb
    .from('demand_radar_shadow_review_queue')
    .update({ shadow_review_label: label, founder_note: note ?? null, shadow_reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select('fingerprint, category, retrieved_by_radar1, is_test, query_family')
    .single();
  if (error || !data) {
    // Request reached the server but nothing could be found/persisted — no
    // fingerprint is known yet in this branch, so the event is de-identified
    // by construction (fingerprint/category null, a generic family marker).
    await emitShadowFunnelEvent({
      fingerprint: null, source: 'x', domain: null, category: null,
      stage: 'review_label_failed', detail: 'queue_row_not_found',
      opportunityScore: null, answerabilityStatus: null,
      queryFamily: 'UNKNOWN', isTest: false,
    });
    return { ok: false, error: error?.message ?? 'row not found' };
  }

  // Update ONLY the founder-outcome fields on the existing outcome row —
  // never a full-row upsert (measurement-integrity fix, founder decision
  // 2026-08-30: see updateShadowOutcomeReviewLabel()'s own comment). The
  // outcome row always already exists by the time a candidate is
  // reviewable — recordShadowOutcome() writes it during the run, strictly
  // before the review-queue row is ever inserted.
  const outcomeUpdate = await updateShadowOutcomeReviewLabel(data.fingerprint, label);
  await emitShadowFunnelEvent({
    fingerprint: data.fingerprint, source: 'x', domain: null, category: data.category,
    stage: outcomeUpdate.ok ? 'review_label_submitted' : 'review_label_failed',
    detail: outcomeUpdate.ok ? null : 'outcome_update_failed',
    opportunityScore: null, answerabilityStatus: null,
    queryFamily: data.query_family, isTest: data.is_test,
  });
  if (!outcomeUpdate.ok) return { ok: false, error: outcomeUpdate.error };
  return { ok: true };
}

/** §T: bounded 72h lifecycle for the one content-bearing Shadow table — ALL
 *  rows (labeled or not) are deleted past the window; a label, once given,
 *  already survives in demand_radar_shadow_outcomes. Cheap and idempotent —
 *  called at the top of both read and write entry points below, since
 *  Checkpoint 1–4 has no recurring Shadow scheduler tick yet. */
export async function sweepExpiredShadowReviewQueue(): Promise<number> {
  const sb = createServerClient() as any;
  const cutoff = new Date(Date.now() - SHADOW_REVIEW_QUEUE_RETENTION_HOURS * 3600_000).toISOString();
  const { data } = await sb.from('demand_radar_shadow_review_queue').select('id').lt('created_at', cutoff);
  const count = data?.length ?? 0;
  if (count > 0) {
    await sb.from('demand_radar_shadow_review_queue').delete().lt('created_at', cutoff);
  }
  return count;
}
