// Demand Radar pipeline orchestrator (ADR-247 §12). The simplest reliable
// workflow — deterministic where truth is deterministic, LLM only for language:
//
//   poll → dedup → deterministic prefilters → LLM classify → deterministic
//   answerability gate → explainable rank → draft (HIGH/MEDIUM only) →
//   store → HIGH email alert (with cooldown)
//
// Human-in-the-loop by construction: nothing here can publish externally.

import { createServerClient } from '@/lib/database';
import { getAdapter } from './adapters';
import { hasArabic, looksLikeNoise, lexicalIntent, lexicalCategory, dedupKey, isStale, candidateFingerprint } from './heuristics';
import { classifyCandidate } from './classify';
import { assessAnswerability } from './answerability';
import { rankOpportunity, computeOpportunityScore } from './rank';
import { draftReply } from './draft';
import { sendHighOpportunityAlert } from './alert';
import { opportunityAlertEligible } from './freshness';
import { recordWeeklyExpiry } from './weekly-stats';
import { emitFunnelEvent, recordOutcome, DEFAULT_QUERY_FAMILY } from './funnel';
import type { RadarCandidate } from './types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';
/** HIGH alerts: at most this many emails per rolling window (§25). */
const ALERT_MAX_PER_WINDOW = 3;
const ALERT_WINDOW_HOURS = 4;
/** Founder-review SLA (founder decision 2026-08-26): an unreviewed opportunity
 *  is hard-deleted after this many hours — no soft "expired" status, no
 *  per-item detail kept, only a weekly count (see weekly-stats.ts). This is
 *  distinct from heuristics.ts's isStale()/rank.ts's 48h source-post-age gate,
 *  which answer "is this post still worth replying to" — left unchanged. */
const REVIEW_WINDOW_HOURS = 24;

export interface RadarRunResult {
  source: string;
  status: string;
  polled: number;
  deduped: number;
  prefiltered: number;
  classified: number;
  stored: number;
  high: number;
  medium: number;
  alerted: number;
  isTest: boolean;
  detail?: string;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function runDemandRadar(opts: { source: 'x' | 'mock'; isTest?: boolean }): Promise<RadarRunResult> {
  const sb = createServerClient() as any;
  const adapter = getAdapter(opts.source);
  const isTest = opts.isTest ?? opts.source === 'mock'; // mock is ALWAYS test
  const result: RadarRunResult = {
    source: adapter.source, status: 'ok', polled: 0, deduped: 0, prefiltered: 0,
    classified: 0, stored: 0, high: 0, medium: 0, alerted: 0, isTest,
  };

  // cursor
  const { data: stateRow } = await sb.from('demand_radar_state').select('cursor').eq('source', adapter.source).maybeSingle();
  const poll = await adapter.poll(stateRow?.cursor ?? null);

  const writeState = async (status: string, candidates: number) => {
    await sb.from('demand_radar_state').upsert({
      source: adapter.source,
      cursor: poll.status === 'ok' ? poll.nextCursor : stateRow?.cursor ?? null,
      last_poll_at: new Date().toISOString(),
      last_poll_status: status,
      last_poll_candidates: candidates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'source' });
  };

  if (poll.status !== 'ok') {
    // §37: UNKNOWN is not ZERO — the state row records the explicit reason.
    result.status = poll.status;
    result.detail = poll.detail;
    await writeState(`${poll.status}: ${poll.detail}`.slice(0, 300), 0);
    return result;
  }
  result.polled = poll.candidates.length;

  // Funnel observability (Radar 2.0 Phase 1): one 'fetched' event per raw
  // candidate X returned, BEFORE dedup — matches "every candidate returned
  // from an X query." Best-effort category tag via the same lexical guess
  // used elsewhere (adapters.ts itself is untouched in Phase 1, so the
  // per-query category isn't threaded through RadarCandidate yet).
  for (const c of poll.candidates) {
    await emitFunnelEvent({
      fingerprint: candidateFingerprint(c.source, c.sourcePostId, c.text),
      source: c.source,
      domain: 'product',
      category: lexicalCategory(c.text).category,
      stage: 'fetched',
      detail: null,
      opportunityScore: null,
      answerabilityStatus: null,
      queryFamily: DEFAULT_QUERY_FAMILY,
      isTest,
    });
  }

  // dedup against DB (post id + thread + text fingerprint)
  const fresh: RadarCandidate[] = [];
  for (const c of poll.candidates) {
    const { data: existing } = await sb
      .from('demand_opportunities')
      .select('id')
      .eq('source', c.source)
      .eq('source_post_id', c.sourcePostId)
      .maybeSingle();
    if (existing) continue;
    const dk = dedupKey(c.sourcePostId, c.threadKey, c.text);
    const { data: threadDup } = await sb
      .from('demand_opportunities')
      .select('id')
      .eq('thread_key', dk)
      .gte('created_at', new Date(Date.now() - 72 * 3600_000).toISOString())
      .limit(1);
    if (threadDup && threadDup.length > 0) continue;
    fresh.push(c);
  }
  result.deduped = result.polled - fresh.length;

  // deterministic prefilters — cheap, before any LLM tokens
  const worthy: RadarCandidate[] = [];
  for (const c of fresh) {
    const gate = !hasArabic(c.text)
      ? 'not_arabic'
      : looksLikeNoise(c.text)
        ? 'noise'
        : isStale(c.postedAt)
          ? 'stale'
          : lexicalIntent(c.text).strength === 'none'
            ? 'no_intent'
            : null;
    if (gate) {
      await emitFunnelEvent({
        fingerprint: candidateFingerprint(c.source, c.sourcePostId, c.text),
        source: c.source,
        domain: 'product',
        category: lexicalCategory(c.text).category,
        stage: 'prefilter_rejected',
        detail: gate,
        opportunityScore: null,
        answerabilityStatus: null,
        queryFamily: DEFAULT_QUERY_FAMILY,
        isTest,
      });
    } else {
      worthy.push(c);
    }
  }
  result.prefiltered = fresh.length - worthy.length;

  for (const c of worthy) {
    const cls = await classifyCandidate(c);
    result.classified++;
    const fingerprint = candidateFingerprint(c.source, c.sourcePostId, c.text);

    // Funnel observability (Phase 1): exactly one of 'excluded' / 'classified'
    // per candidate — never both, so the funnel doesn't double-count.
    await emitFunnelEvent({
      fingerprint, source: c.source, domain: cls.domain, category: cls.category,
      stage: cls.exclusion !== 'none' ? 'excluded' : 'classified',
      detail: cls.exclusion !== 'none' ? cls.exclusion : null,
      opportunityScore: null, answerabilityStatus: null,
      queryFamily: DEFAULT_QUERY_FAMILY, isTest,
    });

    // Independent Purchase/Market Opportunity Score (§9/§10 of the
    // architecture doc) — computed and logged for measurement ONLY. It never
    // feeds rankOpportunity() below, which is the untouched, real tier/email
    // decision (Phase 1 preserves "current tier decisions exactly").
    const oppScore = computeOpportunityScore(c, cls);

    const { answerability, reason } = await assessAnswerability(cls.category);
    const rank = rankOpportunity(c, cls, answerability, reason);

    await emitFunnelEvent({
      fingerprint, source: c.source, domain: cls.domain, category: cls.category,
      stage: rank.tier === 'high' ? 'ranked_high' : rank.tier === 'medium' ? 'ranked_medium' : 'ranked_ignore',
      detail: null, opportunityScore: oppScore.score, answerabilityStatus: answerability,
      queryFamily: DEFAULT_QUERY_FAMILY, isTest,
    });

    if (rank.tier === 'ignore') continue; // silence is a valid outcome (§16)

    const sid = shortId();
    const trackingUrl = `${APP_URL}/r/${sid}`;
    const reply =
      rank.tier === 'high' || rank.tier === 'medium'
        ? await draftReply(c, cls, rank.suggestedQuery, trackingUrl)
        : null;

    const { data: inserted, error } = await sb
      .from('demand_opportunities')
      .insert({
        source: c.source,
        source_post_id: c.sourcePostId,
        source_url: c.sourceUrl,
        author_handle: c.authorHandle,
        thread_key: dedupKey(c.sourcePostId, c.threadKey, c.text),
        post_text: c.text.slice(0, 1000),
        post_lang: c.lang,
        source_posted_at: c.postedAt,
        classified_at: new Date().toISOString(),
        opportunity_type: 'product',
        category: cls.category,
        intent_class: cls.intentClass,
        intent_strength: cls.intentStrength,
        ksa_relevance: cls.ksaRelevance,
        answerability,
        tier: rank.tier,
        score_reasons: rank.reasons,
        suggested_query: rank.suggestedQuery,
        suggested_reply: reply,
        tracking_url: trackingUrl,
        short_id: sid,
        status: 'ready_for_review',
        is_test: isTest,
      })
      .select('id')
      .single();
    if (error) continue; // unique-violation race etc. — never crashes the run
    result.stored++;
    if (rank.tier === 'high') result.high++;
    if (rank.tier === 'medium') result.medium++;

    // Baseline outcome row (Phase 1) — founder_outcome starts null; the
    // founder-action route (PATCH /api/admin/growth/opportunities) and the
    // 24h expiry sweep below are the only two places that ever set it.
    await recordOutcome({
      fingerprint, tier: rank.tier, domain: cls.domain, category: cls.category,
      intentType: cls.intentType, buyingStage: cls.buyingStage, exclusion: cls.exclusion,
      opportunityScore: oppScore.score, answerabilityStatus: answerability,
      queryFamily: DEFAULT_QUERY_FAMILY, isTest, founderOutcome: null,
    });

    // HIGH → rapid founder email — ONLY while the conversation is still live.
    // Backfill/stale posts stay dashboard-only (founder correction: a 40h-old
    // post must never arrive as an urgent email). Cooldown still applies.
    const alertGate = opportunityAlertEligible({
      sourcePostedAt: c.postedAt,
      ksaRelevance: cls.ksaRelevance,
      budgetSar: cls.budgetSar,
    });
    if (rank.tier === 'high' && alertGate.eligible) {
      const { count } = await sb
        .from('demand_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('is_test', isTest)
        .not('alerted_at', 'is', null)
        .gte('alerted_at', new Date(Date.now() - ALERT_WINDOW_HOURS * 3600_000).toISOString());
      if ((count ?? 0) < ALERT_MAX_PER_WINDOW) {
        await emitFunnelEvent({
          fingerprint, source: c.source, domain: cls.domain, category: cls.category,
          stage: 'alert_attempted', detail: null, opportunityScore: oppScore.score,
          answerabilityStatus: answerability, queryFamily: DEFAULT_QUERY_FAMILY, isTest,
        });
        const sent = await sendHighOpportunityAlert({
          id: inserted.id, candidate: c, category: cls.category, reasons: rank.reasons,
          suggestedReply: reply, suggestedQuery: rank.suggestedQuery, isTest,
        });
        if (sent) {
          await sb.from('demand_opportunities').update({ alerted_at: new Date().toISOString() }).eq('id', inserted.id);
          result.alerted++;
          await emitFunnelEvent({
            fingerprint, source: c.source, domain: cls.domain, category: cls.category,
            stage: 'alert_accepted', detail: null, opportunityScore: oppScore.score,
            answerabilityStatus: answerability, queryFamily: DEFAULT_QUERY_FAMILY, isTest,
          });
        }
      }
    }
  }

  // Hard-delete unreviewed opportunities past the founder-review SLA (24h) —
  // no soft "expired" status, no per-item detail kept (founder decision
  // 2026-08-26). Count first so the weekly total is exact even though the
  // rows themselves are gone.
  const reviewCutoff = new Date(Date.now() - REVIEW_WINDOW_HOURS * 3600_000).toISOString();
  const { data: staleRows } = await sb
    .from('demand_opportunities')
    // Phase 1: select enough to write a de-identified 'expired' outcome
    // BEFORE the delete below removes the identifying columns — source_post_id
    // here only ever feeds candidateFingerprint() (a one-way hash), never
    // written to any table itself.
    .select('id, source, source_post_id, opportunity_type, category, tier, is_test')
    .in('status', ['new', 'ready_for_review'])
    .lt('created_at', reviewCutoff);
  const staleCount = staleRows?.length ?? 0;
  if (staleCount > 0) {
    for (const row of staleRows ?? []) {
      const fp = candidateFingerprint(row.source, row.source_post_id, '');
      const domain = row.opportunity_type === 'home_mission' ? 'home_mission' : 'product';
      await emitFunnelEvent({
        fingerprint: fp, source: row.source, domain, category: row.category,
        stage: 'expired', detail: null, opportunityScore: null, answerabilityStatus: null,
        queryFamily: DEFAULT_QUERY_FAMILY, isTest: row.is_test,
      });
      await recordOutcome({
        fingerprint: fp, tier: row.tier, domain, category: row.category,
        intentType: null, buyingStage: null, exclusion: null,
        opportunityScore: null, answerabilityStatus: null,
        queryFamily: DEFAULT_QUERY_FAMILY, isTest: row.is_test, founderOutcome: 'expired_no_review',
      });
    }
    await sb
      .from('demand_opportunities')
      .delete()
      .in('status', ['new', 'ready_for_review'])
      .lt('created_at', reviewCutoff);
    await recordWeeklyExpiry(sb, staleCount);
  }

  await writeState('ok', result.polled);

  // Brand Mention Watch (ADR-248): one extra query per cycle, fully separate
  // storage/classification. A mention-watch failure never fails the radar run.
  if (opts.source === 'x') {
    try {
      const { runBrandMentionWatch } = await import('./brand-mentions');
      await runBrandMentionWatch({ isTest });
    } catch {
      /* observable via demand_radar_state('x-brand'), never fatal here */
    }
  }

  // Home Mission Watch (Growth Radar Phase 2, Part B — founder decision
  // 2026-08-26): one extra query per cycle, writes into demand_opportunities
  // with opportunity_type='home_mission' (bypasses the per-product
  // answerability gate by design). A failure here never fails the radar run.
  if (opts.source === 'x') {
    try {
      const { runHomeMissionWatch } = await import('./home-mission-detect');
      await runHomeMissionWatch({ isTest });
    } catch {
      /* observable via demand_radar_state('home-mission'), never fatal here */
    }
  }
  return result;
}
