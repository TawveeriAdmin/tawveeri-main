// Radar 2.0 Phase 2 — Checkpoint 5 (founder decision 2026-08-29, X Developer
// Console spend/cap prerequisite explicitly waived, cost risk explicitly
// accepted). The ONE approved widened experiment: PRODUCT_RECOMMENDATION ×
// {mobile, laptop, air_conditioner}, nothing else.
//
// FAIL-SAFE CONTRACT (founder's own instruction): if X returns a quota,
// credit, billing, or rate-limit failure, this function STOPS Shadow
// polling for the run, PRESERVES everything already collected, NEVER
// touches Radar 1, and NEVER auto-purchases/upgrades/changes billing. A
// 402/401/403 is treated as account-wide (stop the whole run — the other
// categories would fail identically); a 429 skips only that one category;
// any other non-ok response or network error isolates to that one category
// and the loop continues (mirrors the per-family-isolation fix from §S —
// one failed query must never discard already-collected results).
//
// ISOLATION CONTRACT: own demand_radar_state row
// ('x-shadow-recommendation-v1'), own funnel/outcome tables (shadow-funnel.ts).
// classifyCandidate() / computeOpportunityScore() / assessAnswerability() /
// wouldRadar1Retrieve() are READ-ONLY reuses of Radar 1's own logic — none
// of them write anywhere. This file never inserts into the production
// opportunity table and never calls a reply-drafting or email-sending
// function — no email path exists here (verified by the static isolation
// test, which is why this comment deliberately does not spell those names out).

import { createServerClient } from '@/lib/database';
import { candidateFingerprint } from '../heuristics';
import { classifyCandidate } from '../classify';
import { computeOpportunityScore } from '../rank';
import { assessAnswerability } from '../answerability';
import { wouldRadar1Retrieve } from './would-radar1-retrieve';
import { emitShadowFunnelEvent, recordShadowOutcome } from './shadow-funnel';
import { PRODUCT_RECOMMENDATION_QUERIES, PRODUCT_RECOMMENDATION_QUERY_FAMILY } from './shadow-vocabulary';
import type { RadarCandidate } from '../types';

const X_API = 'https://api.x.com/2/tweets/search/recent';
const ADAPTER_SUFFIX = ' lang:ar -is:retweet -from:Tawveeri';
const SHADOW_STATE_SOURCE = 'x-shadow-recommendation-v1';
const REVIEW_QUEUE_MAX_INSERT = 50;

export interface CategoryPollOutcome {
  category: string;
  polled: number;
  httpStatus?: number;
  errorDetail?: string;
}

export interface RecommendationExperimentResult {
  status: 'ok' | 'unconfigured' | 'stopped_quota_or_auth' | 'partial';
  perCategory: CategoryPollOutcome[];
  totalPolled: number;
  matchedRadar1: number; // Radar 1 overlap
  unmatchedRadar1: number; // net-new (Shadow-only recovery)
  reviewQueueInserted: number;
  stoppedEarly: boolean;
  stopReason?: string;
  isTest: boolean;
}

async function upsertShadowState(sb: any, cursor: string | null, status: string, candidates: number) {
  await sb.from('demand_radar_state').upsert(
    {
      source: SHADOW_STATE_SOURCE,
      cursor,
      last_poll_at: new Date().toISOString(),
      last_poll_status: status.slice(0, 300),
      last_poll_candidates: candidates,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'source' }
  );
}

export async function runShadowRecommendationExperiment(opts: { isTest?: boolean }): Promise<RecommendationExperimentResult> {
  const isTest = opts.isTest ?? false;
  const token = process.env.X_RADAR_BEARER_TOKEN;
  const result: RecommendationExperimentResult = {
    status: 'ok', perCategory: [], totalPolled: 0, matchedRadar1: 0, unmatchedRadar1: 0,
    reviewQueueInserted: 0, stoppedEarly: false, isTest,
  };
  if (!token) {
    result.status = 'unconfigured';
    return result;
  }

  const sb = createServerClient() as any;
  const { data: stateRow } = await sb.from('demand_radar_state').select('cursor').eq('source', SHADOW_STATE_SOURCE).maybeSingle();
  const cursor: string | null = stateRow?.cursor ?? null;
  let maxId: bigint | null = cursor ? BigInt(cursor) : null;
  let anyIsolatedFailure = false;

  for (const spec of PRODUCT_RECOMMENDATION_QUERIES) {
    const params = new URLSearchParams({
      query: spec.query + ADAPTER_SUFFIX,
      max_results: '25',
      'tweet.fields': 'created_at,conversation_id,lang,public_metrics',
      expansions: 'author_id',
      'user.fields': 'username',
    });
    if (cursor) params.set('since_id', cursor);

    let res: Response;
    try {
      res = await fetch(`${X_API}?${params}`, { headers: { authorization: `Bearer ${token}` } });
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'network error';
      result.perCategory.push({ category: spec.category, polled: 0, errorDetail: detail });
      await emitShadowFunnelEvent({
        fingerprint: null, source: 'x', domain: 'product', category: spec.category,
        stage: 'family_fetch_failed', detail: detail.slice(0, 200), opportunityScore: null,
        answerabilityStatus: null, queryFamily: PRODUCT_RECOMMENDATION_QUERY_FAMILY, isTest,
      });
      anyIsolatedFailure = true;
      continue; // isolate — try the next category
    }

    if (res.status === 429) {
      result.perCategory.push({ category: spec.category, polled: 0, httpStatus: 429, errorDetail: 'rate limited — skipped this category this cycle' });
      anyIsolatedFailure = true;
      continue;
    }

    if (res.status === 402 || res.status === 401 || res.status === 403) {
      // Quota / billing / auth — account-wide, not category-specific. STOP
      // the whole run now; do not attempt the remaining categories.
      const body = (await res.text().catch(() => '')).slice(0, 300);
      result.perCategory.push({ category: spec.category, polled: 0, httpStatus: res.status, errorDetail: body });
      result.status = 'stopped_quota_or_auth';
      result.stoppedEarly = true;
      result.stopReason = `X API ${res.status} on ${spec.category}: ${body}`;
      await emitShadowFunnelEvent({
        fingerprint: null, source: 'x', domain: 'product', category: spec.category,
        stage: 'family_fetch_failed', detail: `${res.status}:${body}`.slice(0, 200), opportunityScore: null,
        answerabilityStatus: null, queryFamily: PRODUCT_RECOMMENDATION_QUERY_FAMILY, isTest,
      });
      await upsertShadowState(sb, maxId ? String(maxId) : cursor, result.stopReason, result.totalPolled);
      return result; // hard stop — preserves everything already written above
    }

    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300);
      result.perCategory.push({ category: spec.category, polled: 0, httpStatus: res.status, errorDetail: body });
      await emitShadowFunnelEvent({
        fingerprint: null, source: 'x', domain: 'product', category: spec.category,
        stage: 'family_fetch_failed', detail: `${res.status}:${body}`.slice(0, 200), opportunityScore: null,
        answerabilityStatus: null, queryFamily: PRODUCT_RECOMMENDATION_QUERY_FAMILY, isTest,
      });
      anyIsolatedFailure = true;
      continue; // isolate — try the next category
    }

    const json = (await res.json()) as {
      data?: Array<{ id: string; text: string; created_at?: string; conversation_id?: string; author_id?: string; lang?: string }>;
      includes?: { users?: Array<{ id: string; username: string }> };
    };
    const users = new Map((json.includes?.users ?? []).map((u) => [u.id, u.username]));
    const candidates: RadarCandidate[] = (json.data ?? []).map((t) => ({
      source: 'x' as const,
      sourcePostId: t.id,
      sourceUrl: `https://x.com/${(t.author_id && users.get(t.author_id)) ?? 'i'}/status/${t.id}`,
      authorHandle: t.author_id ? users.get(t.author_id) ?? null : null,
      threadKey: t.conversation_id ?? null,
      text: t.text,
      lang: t.lang ?? null,
      postedAt: t.created_at ?? null,
    }));
    result.perCategory.push({ category: spec.category, polled: candidates.length });
    result.totalPolled += candidates.length;

    for (const c of candidates) {
      try {
        const idb = BigInt(c.sourcePostId);
        if (maxId === null || idb > maxId) maxId = idb;
      } catch { /* non-numeric id — cursor unchanged */ }

      const fingerprint = candidateFingerprint(c.source, c.sourcePostId, c.text);
      const check = wouldRadar1Retrieve(c.text);
      if (check.matched) result.matchedRadar1++; else result.unmatchedRadar1++;

      // Read-only reuse of Radar 1's own classification/scoring/answerability
      // logic — none of these write anywhere.
      const cls = await classifyCandidate(c);
      const opp = computeOpportunityScore(c, cls);
      const { answerability } = await assessAnswerability(cls.category);
      const category = cls.category ?? spec.category;

      await emitShadowFunnelEvent({
        fingerprint, source: c.source, domain: cls.domain, category,
        stage: 'fetched', detail: null, opportunityScore: null, answerabilityStatus: null,
        queryFamily: PRODUCT_RECOMMENDATION_QUERY_FAMILY, isTest,
      });
      await emitShadowFunnelEvent({
        fingerprint, source: c.source, domain: cls.domain, category,
        stage: 'replay_checked',
        detail: check.matched ? 'radar1_match_confirmed' : 'radar1_net_new',
        opportunityScore: opp.score, answerabilityStatus: answerability,
        queryFamily: PRODUCT_RECOMMENDATION_QUERY_FAMILY, isTest,
      });
      await recordShadowOutcome({
        fingerprint, tier: null, domain: cls.domain, category,
        intentType: cls.intentType, buyingStage: cls.buyingStage, exclusion: cls.exclusion,
        opportunityScore: opp.score, answerabilityStatus: answerability,
        queryFamily: PRODUCT_RECOMMENDATION_QUERY_FAMILY, isTest,
        retrievedByRadar1: check.matched, shadowReviewLabel: null,
      });

      if (result.reviewQueueInserted < REVIEW_QUEUE_MAX_INSERT) {
        const { error } = await sb.from('demand_radar_shadow_review_queue').insert({
          fingerprint, source: c.source, source_post_id: c.sourcePostId, source_url: c.sourceUrl,
          author_handle: c.authorHandle, post_text: c.text.slice(0, 1000), post_lang: c.lang,
          source_posted_at: c.postedAt, category, domain: cls.domain,
          retrieved_by_radar1: check.matched, query_family: PRODUCT_RECOMMENDATION_QUERY_FAMILY, is_test: isTest,
        });
        if (!error) result.reviewQueueInserted++;
      }
    }
  }

  result.status = anyIsolatedFailure ? 'partial' : 'ok';
  await upsertShadowState(sb, maxId ? String(maxId) : cursor, result.status, result.totalPolled);
  return result;
}
