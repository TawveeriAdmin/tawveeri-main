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
import { hasArabic, looksLikeNoise, lexicalIntent, dedupKey, isStale } from './heuristics';
import { classifyCandidate } from './classify';
import { assessAnswerability } from './answerability';
import { rankOpportunity } from './rank';
import { draftReply } from './draft';
import { sendHighOpportunityAlert } from './alert';
import { opportunityAlertEligible } from './freshness';
import type { RadarCandidate } from './types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';
/** HIGH alerts: at most this many emails per rolling window (§25). */
const ALERT_MAX_PER_WINDOW = 3;
const ALERT_WINDOW_HOURS = 4;

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
  const worthy = fresh.filter((c) => {
    if (!hasArabic(c.text)) return false;
    if (looksLikeNoise(c.text)) return false;
    if (isStale(c.postedAt)) return false;
    return lexicalIntent(c.text).strength !== 'none';
  });
  result.prefiltered = fresh.length - worthy.length;

  for (const c of worthy) {
    const cls = await classifyCandidate(c);
    result.classified++;
    const { answerability, reason } = await assessAnswerability(cls.category);
    const rank = rankOpportunity(c, cls, answerability, reason);

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
        const sent = await sendHighOpportunityAlert({
          id: inserted.id, candidate: c, category: cls.category, reasons: rank.reasons,
          suggestedReply: reply, suggestedQuery: rank.suggestedQuery, isTest,
        });
        if (sent) {
          await sb.from('demand_opportunities').update({ alerted_at: new Date().toISOString() }).eq('id', inserted.id);
          result.alerted++;
        }
      }
    }
  }

  // expire stale unreviewed opportunities (48h) — keeps the queue honest
  await sb
    .from('demand_opportunities')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .in('status', ['new', 'ready_for_review'])
    .lt('created_at', new Date(Date.now() - 48 * 3600_000).toISOString());

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
  return result;
}
