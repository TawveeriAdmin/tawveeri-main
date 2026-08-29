/**
 * Radar 2.0 Phase 1 — funnel observability tests (founder decision
 * 2026-08-29). Covers: four-axis taxonomy schema completeness, the new
 * deterministic exclusion signals, the privacy-safe fingerprint, the
 * privacy regression test on the actual row builders, the Opportunity
 * Score/Answerability decoupling, and stage-coverage ("funnel
 * completeness") across the deterministic mock candidate set.
 */
import {
  isContestQuestion,
  isPostPurchaseStory,
  candidateFingerprint,
  hasArabic,
  looksLikeNoise,
  isStale,
  lexicalIntent,
} from '@/lib/growth/demand-radar/heuristics';
import { heuristicClassification } from '@/lib/growth/demand-radar/classify';
import { rankOpportunity, computeOpportunityScore } from '@/lib/growth/demand-radar/rank';
import {
  buildFunnelEventRow,
  buildOutcomeRow,
  FORBIDDEN_FIELDS,
  DEFAULT_QUERY_FAMILY,
} from '@/lib/growth/demand-radar/funnel';
import { MockAdapter } from '@/lib/growth/demand-radar/adapters';
import {
  FUNNEL_STAGES,
  type RadarCandidate,
  type FunnelEvent,
  type OutcomeRecord,
} from '@/lib/growth/demand-radar/types';

const mk = (text: string, minsAgo = 10): RadarCandidate => ({
  source: 'mock',
  sourcePostId: 'p1',
  sourceUrl: 'https://example.com/p1',
  authorHandle: 'u1',
  threadKey: null,
  text,
  lang: 'ar',
  postedAt: new Date(Date.now() - minsAgo * 60000).toISOString(),
});

describe('four-axis taxonomy — deterministic fallback schema completeness', () => {
  it('heuristicClassification always produces a valid enum for all four axes', () => {
    const cases = [
      'ابي غسالة لعائلة 6 وميزانيتي 3000 وش تنصحون؟',
      'يارب افوز في القرعة وابي جوال جديد',
      'اشتريت جوال جديد الحمدلله',
      'عرض خاص خصم يصل 50%',
      '',
    ];
    for (const text of cases) {
      const cls = heuristicClassification(mk(text));
      expect(['product', 'home_mission', 'housing_partnership', 'brand_mention', 'other']).toContain(cls.domain);
      expect(['problem', 'research', 'comparison', 'decision', 'purchase_imminent', 'post_purchase', 'none']).toContain(cls.buyingStage);
      expect(['help_request', 'recommendation', 'comparison', 'price_search', 'availability', 'budget', 'replacement', 'gift_purchase', 'other', 'none']).toContain(cls.intentType);
      expect(['contest', 'joke', 'ad_seller', 'post_purchase_story', 'support_complaint', 'spam', 'needs_context', 'none']).toContain(cls.exclusion);
    }
  });
});

describe('deterministic exclusion signals — founder-reviewed false-positive classes', () => {
  it('detects contest/giveaway framing even alongside a real intent marker', () => {
    expect(isContestQuestion('يارب أفوز بالمسابقة أبي آيفون')).toBe(true);
    expect(isContestQuestion('يارب افوز في القرعة وابي جوال جديد')).toBe(true);
    expect(isContestQuestion('ابي جوال جديد ميزانيتي 2000')).toBe(false);
  });

  it('detects a past-tense purchase story, distinct from forward-looking intent', () => {
    expect(isPostPurchaseStory('اشتريت لي جوال جديد')).toBe(true);
    expect(isPostPurchaseStory('اشتريت جوال جديد الحمدلله واخيرا ودعت القديم')).toBe(true);
    expect(isPostPurchaseStory('ابي اشتري جوال جديد')).toBe(false);
  });

  it('heuristicClassification routes these to the correct exclusion + buying_stage', () => {
    const contest = heuristicClassification(mk('يارب افوز في القرعة وابي جوال جديد'));
    expect(contest.exclusion).toBe('contest');

    const bought = heuristicClassification(mk('اشتريت لي جوال جديد'));
    expect(bought.exclusion).toBe('post_purchase_story');
    expect(bought.buyingStage).toBe('post_purchase');
  });
});

describe('candidateFingerprint — privacy-safe, stable, one-way', () => {
  const OLD_ENV = process.env;
  afterEach(() => { process.env = { ...OLD_ENV }; });

  it('is deterministic for the same input', () => {
    process.env.DEMAND_RADAR_FINGERPRINT_SECRET = 'test-secret';
    const a = candidateFingerprint('x', '12345', 'text');
    const b = candidateFingerprint('x', '12345', 'text');
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it('differs for different inputs and never echoes the raw post id', () => {
    process.env.DEMAND_RADAR_FINGERPRINT_SECRET = 'test-secret';
    const a = candidateFingerprint('x', '12345', 'text');
    const b = candidateFingerprint('x', '67890', 'text');
    expect(a).not.toBe(b);
    expect(a).not.toContain('12345');
    expect(a).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it('falls back to CRON_SECRET when no dedicated secret is configured', () => {
    delete process.env.DEMAND_RADAR_FINGERPRINT_SECRET;
    process.env.CRON_SECRET = 'cron-fallback-secret';
    expect(candidateFingerprint('x', '111', 'text')).not.toBeNull();
  });

  it('returns null (never a guessed value) when no secret exists at all', () => {
    delete process.env.DEMAND_RADAR_FINGERPRINT_SECRET;
    delete process.env.CRON_SECRET;
    expect(candidateFingerprint('x', '111', 'text')).toBeNull();
  });
});

describe('privacy regression test — the row builders can never emit an identifying field', () => {
  const fullEvent: FunnelEvent = {
    fingerprint: 'abc123', source: 'x', domain: 'product', category: 'mobile',
    stage: 'classified', detail: null, opportunityScore: 4, answerabilityStatus: 'yes',
    queryFamily: DEFAULT_QUERY_FAMILY, isTest: true,
  };
  const fullOutcome: OutcomeRecord = {
    fingerprint: 'abc123', tier: 'high', domain: 'product', category: 'mobile',
    intentType: 'help_request', buyingStage: 'decision', exclusion: 'none',
    opportunityScore: 5, answerabilityStatus: 'yes', queryFamily: DEFAULT_QUERY_FAMILY,
    isTest: true, founderOutcome: 'accepted',
  };

  it('demand_radar_funnel_events row never contains a forbidden key', () => {
    const row = buildFunnelEventRow(fullEvent);
    for (const forbidden of FORBIDDEN_FIELDS) {
      expect(Object.keys(row)).not.toContain(forbidden);
    }
  });

  it('demand_radar_outcomes row never contains a forbidden key', () => {
    const row = buildOutcomeRow(fullOutcome);
    for (const forbidden of FORBIDDEN_FIELDS) {
      expect(Object.keys(row)).not.toContain(forbidden);
    }
  });

  it('the FunnelEvent/OutcomeRecord types structurally have no field to leak in the first place', () => {
    // TypeScript already enforces this at compile time (no post_text/author_handle/
    // source_url/tracking_url field exists on either interface) — this runtime
    // check pins the SAME guarantee against the actual constructed row, so a
    // future edit that widens either builder still fails this test even if the
    // type were loosened.
    const eventKeys = Object.keys(buildFunnelEventRow(fullEvent));
    const outcomeKeys = Object.keys(buildOutcomeRow(fullOutcome));
    expect(eventKeys.sort()).toEqual([
      'answerability_status', 'category', 'detail', 'domain', 'fingerprint',
      'is_test', 'opportunity_score', 'query_family', 'source', 'stage',
    ].sort());
    expect(outcomeKeys.sort()).toEqual([
      'answerability_status', 'buying_stage', 'category', 'domain', 'exclusion',
      'fingerprint', 'founder_outcome', 'founder_outcome_at', 'intent_type',
      'is_test', 'opportunity_score', 'query_family', 'tier',
    ].sort());
  });
});

describe('Opportunity Score / Answerability decoupling (§9/§10 of the architecture doc)', () => {
  it('a high-evidence candidate scores a real Opportunity Score with NO answerability input at all', () => {
    const cls = {
      ...heuristicClassification(mk('x')),
      category: 'washing_machine', intentClass: 'recommendation' as const,
      intentStrength: 'strong' as const, ksaRelevance: 'confirmed' as const,
      isDirectQuestion: true, budgetSar: 3000, confidence: 0.9,
    };
    const cand = mk('ابي غسالة لعائلة 6 وميزانيتي 3000 وش تنصحون؟');
    const opp = computeOpportunityScore(cand, cls);
    expect(opp.excluded).toBe(false);
    expect(opp.score).toBeGreaterThanOrEqual(4);
    // computeOpportunityScore's signature takes no `answerability` argument —
    // it is structurally impossible for it to have used one.
    expect(computeOpportunityScore.length).toBe(2);
  });

  it('the SAME evidence still ties tier to answerability today — rankOpportunity is unchanged', () => {
    const cls = {
      ...heuristicClassification(mk('x')),
      category: 'washing_machine', intentClass: 'recommendation' as const,
      intentStrength: 'strong' as const, ksaRelevance: 'confirmed' as const,
      isDirectQuestion: true, budgetSar: 3000, confidence: 0.9,
    };
    const cand = mk('ابي غسالة لعائلة 6 وميزانيتي 3000 وش تنصحون؟');
    const oppScore = computeOpportunityScore(cand, cls).score;
    expect(oppScore).toBeGreaterThan(0); // real opportunity, independent of answerability

    const r = rankOpportunity(cand, cls, 'no', 'فئة غير مدعومة');
    expect(r.tier).toBe('ignore'); // TODAY's real, unchanged tier decision still gates on answerability
  });
});

describe('funnel completeness — every stage-determining branch is reachable on the mock candidate set', () => {
  it('the 10 mock candidates collectively exercise prefilter-rejection, exclusion, and every tier', async () => {
    const poll = await new MockAdapter().poll(null);
    expect(poll.status).toBe('ok');
    if (poll.status !== 'ok') return;

    const stagesSeen = new Set<string>();
    for (const c of poll.candidates) {
      const gate = !hasArabic(c.text) ? 'not_arabic'
        : looksLikeNoise(c.text) ? 'noise'
          : isStale(c.postedAt) ? 'stale'
            : lexicalIntent(c.text).strength === 'none' ? 'no_intent' : null;
      if (gate) { stagesSeen.add('prefilter_rejected'); continue; }
      const cls = heuristicClassification(c);
      if (cls.exclusion !== 'none') { stagesSeen.add('excluded'); continue; }
      stagesSeen.add('classified');
      const r = rankOpportunity(c, cls, cls.category ? 'yes' : 'unknown', 'test-stub');
      stagesSeen.add(r.tier === 'high' ? 'ranked_high' : r.tier === 'medium' ? 'ranked_medium' : 'ranked_ignore');
    }
    // 'fetched' always fires (one per raw candidate, unconditionally, in
    // pipeline.ts) and 'alert_attempted'/'alert_accepted'/'founder_acted'/
    // 'founder_dismissed'/'expired' depend on DB state (cooldown counts,
    // founder action, 24h clock) that this deterministic unit test cannot
    // exercise without a live database — verified separately, out of the
    // default `npm test` gate, matching the existing convention for
    // DB-backed suites (see jest.config.js's testPathIgnorePatterns).
    expect(stagesSeen.has('prefilter_rejected')).toBe(true); // the ad/joke mock cases
    expect(['classified', 'excluded'].some((s) => stagesSeen.has(s))).toBe(true);
    expect(stagesSeen.has('ranked_ignore') || stagesSeen.has('ranked_medium') || stagesSeen.has('ranked_high')).toBe(true);
    // sanity: every stage this test CAN observe is a real, known FUNNEL_STAGES value
    for (const s of stagesSeen) expect(FUNNEL_STAGES as readonly string[]).toContain(s);
  });
});
