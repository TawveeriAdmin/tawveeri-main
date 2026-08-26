// Home Mission Watch (Growth Radar Phase 2, Part B — founder decision
// 2026-08-26). A SEPARATE opportunity type from the main product-purchase
// pipeline: furnishing-intent and new-home-receipt posts have no TPS product
// category, so the normal answerability gate in rank.ts would always IGNORE
// them (correctly, for real product opportunities) — this routes them
// instead to a distinct reply template that introduces «جهّز بيتك بذكاء»
// itself, which is accurate regardless of catalog state. Same structural
// pattern as brand-mentions.ts (ADR-248): one extra X query in the same poll
// cycle, own cursor in demand_radar_state, wrapped so a failure here never
// breaks the main radar run. Unlike brand-mentions.ts, this DOES write into
// demand_opportunities — same table, same status lifecycle, same 24h expiry,
// same weekly counter — distinguished only by `opportunity_type`.

import { createServerClient } from '@/lib/database';
import { isStale } from './heuristics';
import { draftHomeMissionReply } from './draft';
import type { RadarCandidate } from './types';

const X_API = 'https://api.x.com/2/tweets/search/recent';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

// Furnishing-intent + new-home-receipt phrasing (founder-approved list,
// 2026-08-26), aligned with the already-validated WHOLE_HOME regex in
// src/lib/agent/home-mission.ts (جهز.../انتقلت/بيت جديد/شقة جديدة) rather
// than inventing a parallel phrase set. 14 phrases — same conservative
// sizing as the Part A category additions, well under X's own 25-50
// tightly-themed-set guidance.
export const HOME_MISSION_QUERY =
  '("أبي أثث شقتي" OR "أبي أثث بيتي" OR "أبغى أثث شقتي" OR "أبغى أثث بيتي" ' +
  'OR "أثاث شقة جديدة" OR "أثاث بيت جديد" OR "احتاج أثث الشقة" OR "أحتاج أثث البيت" ' +
  'OR "استلمت بيتي الجديد" OR "استلمت شقتي الجديدة" OR "استلمنا الشقة" OR "استلمنا البيت" ' +
  'OR "استلمت الشقة الجديدة" OR "نقلت الشقة الجديدة" OR "دخلت الشقة الجديدة") ' +
  'lang:ar -is:retweet -from:Tawveeri';

interface HomeMissionCandidate {
  sourcePostId: string;
  sourceUrl: string;
  authorHandle: string | null;
  text: string;
  lang: string | null;
  postedAt: string | null;
}

export interface HomeMissionWatchResult {
  status: 'ok' | 'unconfigured' | 'source_unavailable';
  polled: number;
  stored: number;
  detail?: string;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function runHomeMissionWatch(opts: {
  isTest?: boolean;
  mockCandidates?: HomeMissionCandidate[];
}): Promise<HomeMissionWatchResult> {
  const sb = createServerClient() as any;
  const isTest = opts.isTest ?? Boolean(opts.mockCandidates);
  const result: HomeMissionWatchResult = { status: 'ok', polled: 0, stored: 0 };

  let candidates: HomeMissionCandidate[];
  if (opts.mockCandidates) {
    candidates = opts.mockCandidates;
  } else {
    const token = process.env.X_RADAR_BEARER_TOKEN;
    if (!token) return { ...result, status: 'unconfigured', detail: 'X_RADAR_BEARER_TOKEN not set' };
    const { data: st } = await sb.from('demand_radar_state').select('cursor').eq('source', 'home-mission').maybeSingle();
    const params = new URLSearchParams({
      query: HOME_MISSION_QUERY,
      max_results: '25',
      'tweet.fields': 'created_at,lang',
      expansions: 'author_id',
      'user.fields': 'username',
    });
    if (st?.cursor) params.set('since_id', st.cursor);
    let json: {
      data?: Array<{ id: string; text: string; created_at?: string; author_id?: string; lang?: string }>;
      includes?: { users?: Array<{ id: string; username: string }> };
      meta?: { newest_id?: string };
    };
    try {
      const res = await fetch(`${X_API}?${params}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = (await res.text().catch(() => '')).slice(0, 300);
        const detail = `X API ${res.status}: ${body}`;
        // Same stale-since_id recovery as brand-mentions.ts (found + fixed
        // 2026-08-26 for x-brand) — never let this watch deadlock the same way.
        const nextCursor = res.status === 400 && body.includes('since_id') ? null : (st?.cursor ?? null);
        await upsertState(sb, `source_unavailable: ${detail}`.slice(0, 300), 0, nextCursor);
        return { ...result, status: 'source_unavailable', detail };
      }
      json = await res.json();
    } catch (e) {
      return { ...result, status: 'source_unavailable', detail: e instanceof Error ? e.message : 'network' };
    }
    const users = new Map((json.includes?.users ?? []).map((u) => [u.id, u.username]));
    candidates = (json.data ?? []).map((t) => ({
      sourcePostId: t.id,
      sourceUrl: `https://x.com/${(t.author_id && users.get(t.author_id)) ?? 'i'}/status/${t.id}`,
      authorHandle: t.author_id ? users.get(t.author_id) ?? null : null,
      text: t.text,
      lang: t.lang ?? null,
      postedAt: t.created_at ?? null,
    }));
    await upsertState(sb, 'ok', candidates.length, json.meta?.newest_id ?? st?.cursor ?? null);
  }
  result.polled = candidates.length;

  for (const c of candidates) {
    const { data: existing } = await sb
      .from('demand_opportunities')
      .select('id')
      .eq('source', isTest ? 'mock' : 'x')
      .eq('source_post_id', c.sourcePostId)
      .maybeSingle();
    if (existing) continue;
    // Own-account guard (belt-and-braces beyond -from:Tawveeri).
    if (c.authorHandle && c.authorHandle.toLowerCase() === 'tawveeri') continue;
    // Same staleness gate as the main pipeline (48h, unchanged per founder
    // decision) — an old "we moved in" post is no more useful to reply to
    // than an old product-purchase one.
    if (isStale(c.postedAt)) continue;

    const sid = shortId();
    const homeMissionUrl = `${APP_URL}/r/${sid}`;
    const candidate: RadarCandidate = {
      source: isTest ? 'mock' : 'x',
      sourcePostId: c.sourcePostId,
      sourceUrl: c.sourceUrl,
      authorHandle: c.authorHandle,
      threadKey: null,
      text: c.text,
      lang: c.lang,
      postedAt: c.postedAt,
    };
    const reply = await draftHomeMissionReply(candidate, homeMissionUrl);

    const { error } = await sb
      .from('demand_opportunities')
      .insert({
        source: candidate.source,
        source_post_id: c.sourcePostId,
        source_url: c.sourceUrl,
        author_handle: c.authorHandle,
        thread_key: null,
        post_text: c.text.slice(0, 1000),
        post_lang: c.lang,
        source_posted_at: c.postedAt,
        classified_at: new Date().toISOString(),
        opportunity_type: 'home_mission',
        category: null, // not a TPS product category — intentional
        intent_class: 'other',
        intent_strength: 'strong', // the phrase match itself IS the intent signal here
        ksa_relevance: 'unknown', // no per-post KSA heuristic run for this type
        answerability: 'unknown', // the concept doesn't apply — see score_reasons
        // Medium-capped, never HIGH (founder decision 2026-08-26): a new,
        // unproven pattern — no founder email until it's proven out. HIGH
        // has never fired once in this table's history even for the mature
        // product path, so this is a deliberately conservative starting tier.
        tier: 'medium',
        score_reasons: ['فرصة جهّز بيتك — نية تأثيث أو استلام منزل جديد، لا تحتاج فئة منتج محددة'],
        suggested_query: null,
        suggested_reply: reply,
        tracking_url: homeMissionUrl,
        short_id: sid,
        status: 'ready_for_review',
        is_test: isTest,
      });
    if (error) continue; // unique-violation race etc. — never crashes the run
    result.stored++;
  }

  return result;
}

async function upsertState(sb: any, status: string, candidates: number, cursor: string | null) {
  await sb.from('demand_radar_state').upsert(
    {
      source: 'home-mission',
      cursor,
      last_poll_at: new Date().toISOString(),
      last_poll_status: status,
      last_poll_candidates: candidates,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'source' }
  );
}
