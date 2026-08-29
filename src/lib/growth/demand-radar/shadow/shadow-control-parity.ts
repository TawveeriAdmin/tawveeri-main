// Radar 2.0 Phase 2 — Checkpoint 4: Control Parity.
//
// Polls X using the EXACT SAME adapter Radar 1 uses (getAdapter('x') from
// '../adapters' — a read-only import, not a write-path reference) with NO
// new vocabulary and NO widened queries. This is deliberate: since every
// candidate X returns here matched one of Radar 1's own current phrase
// groups (that's the only reason X returned it), wouldRadar1Retrieve()
// should report matched=true for ~100% of them — the point of this
// checkpoint is proving the replay function itself is correct BEFORE it is
// ever trusted on genuinely widened, non-overlapping text (a future
// checkpoint, not this one).
//
// ISOLATION CONTRACT: own demand_radar_state row ('x-shadow-control-parity'),
// never reads or writes the 'x' row Radar 1 owns. Never inserts into
// demand_opportunities. Never calls draftReply() or
// sendHighOpportunityAlert(). No email path exists in this file at all.

import { createServerClient } from '@/lib/database';
import { getAdapter } from '../adapters';
import { candidateFingerprint } from '../heuristics';
import { emitShadowFunnelEvent, recordShadowOutcome } from './shadow-funnel';
import { wouldRadar1Retrieve } from './would-radar1-retrieve';
import { CONTROL_PARITY_QUERY_FAMILY } from './types';
import type { RadarCandidate } from '../types';

const SHADOW_STATE_SOURCE = 'x-shadow-control-parity';
const REVIEW_QUEUE_MAX_INSERT = 50; // cap per run — this checkpoint is a parity proof, not a volume test

export interface ShadowControlParityResult {
  status: string;
  polled: number;
  matchedRadar1: number;
  unmatchedRadar1: number;
  unmatchedSamples: Array<{ category: string | null; textPreview: string }>;
  reviewQueueInserted: number;
  isTest: boolean;
  detail?: string;
}

export async function runShadowControlParity(opts: { isTest?: boolean }): Promise<ShadowControlParityResult> {
  const sb = createServerClient() as any;
  const adapter = getAdapter('x');
  const isTest = opts.isTest ?? false;
  const result: ShadowControlParityResult = {
    status: 'ok', polled: 0, matchedRadar1: 0, unmatchedRadar1: 0,
    unmatchedSamples: [], reviewQueueInserted: 0, isTest,
  };

  const { data: stateRow } = await sb
    .from('demand_radar_state')
    .select('cursor')
    .eq('source', SHADOW_STATE_SOURCE)
    .maybeSingle();
  const poll = await adapter.poll(stateRow?.cursor ?? null);

  const writeShadowState = async (status: string, candidates: number) => {
    await sb.from('demand_radar_state').upsert(
      {
        source: SHADOW_STATE_SOURCE,
        cursor: poll.status === 'ok' ? poll.nextCursor : stateRow?.cursor ?? null,
        last_poll_at: new Date().toISOString(),
        last_poll_status: status,
        last_poll_candidates: candidates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source' }
    );
  };

  if (poll.status !== 'ok') {
    result.status = poll.status;
    result.detail = poll.detail;
    await writeShadowState(`${poll.status}: ${poll.detail}`.slice(0, 300), 0);
    return result;
  }
  result.polled = poll.candidates.length;

  for (const c of poll.candidates as RadarCandidate[]) {
    const fingerprint = candidateFingerprint(c.source, c.sourcePostId, c.text);
    const check = wouldRadar1Retrieve(c.text);

    await emitShadowFunnelEvent({
      fingerprint, source: c.source, domain: 'product', category: check.matchedCategory,
      stage: 'fetched', detail: null, opportunityScore: null, answerabilityStatus: null,
      queryFamily: CONTROL_PARITY_QUERY_FAMILY, isTest,
    });
    await emitShadowFunnelEvent({
      fingerprint, source: c.source, domain: 'product', category: check.matchedCategory,
      stage: 'replay_checked',
      detail: check.matched ? 'radar1_match_confirmed' : 'radar1_match_MISSING_unexpected',
      opportunityScore: null, answerabilityStatus: null,
      queryFamily: CONTROL_PARITY_QUERY_FAMILY, isTest,
    });

    if (check.matched) {
      result.matchedRadar1++;
    } else {
      result.unmatchedRadar1++;
      if (result.unmatchedSamples.length < 10) {
        result.unmatchedSamples.push({ category: check.matchedCategory, textPreview: c.text.slice(0, 80) });
      }
    }

    await recordShadowOutcome({
      fingerprint, tier: null, domain: 'product', category: check.matchedCategory,
      intentType: null, buyingStage: null, exclusion: null,
      opportunityScore: null, answerabilityStatus: null,
      queryFamily: CONTROL_PARITY_QUERY_FAMILY, isTest,
      retrievedByRadar1: check.matched, shadowReviewLabel: null,
    });

    // Feed the Checkpoint 3 review queue — bounded, content-bearing, 72h
    // lifecycle enforced by the sweep in shadow-review.ts, never here.
    if (result.reviewQueueInserted < REVIEW_QUEUE_MAX_INSERT) {
      const { error } = await sb.from('demand_radar_shadow_review_queue').insert({
        fingerprint,
        source: c.source,
        source_post_id: c.sourcePostId,
        source_url: c.sourceUrl,
        author_handle: c.authorHandle,
        post_text: c.text.slice(0, 1000),
        post_lang: c.lang,
        source_posted_at: c.postedAt,
        category: check.matchedCategory,
        domain: 'product',
        retrieved_by_radar1: check.matched,
        query_family: CONTROL_PARITY_QUERY_FAMILY,
        is_test: isTest,
      });
      if (!error) result.reviewQueueInserted++;
    }
  }

  await writeShadowState('ok', result.polled);
  return result;
}
