/**
 * Radar 2.0 Phase 2 — Checkpoint 5.1 near-duplicate suppression audit
 * (founder decision 2026-08-30). Covers both the pure selection function
 * (shadow-dedup.ts) and the full orchestrator's wiring
 * (shadow-recommendation-experiment.ts), the latter with @/lib/database,
 * global.fetch, and classifyCandidate() mocked — no network, no database,
 * no LLM calls, matching this repo's established mock-client test pattern
 * (tests/scraping/store-identity-propagation.test.ts).
 */
import fs from 'fs';
import path from 'path';
import { selectSuppressionAuditSample, SUPPRESSION_AUDIT_CAP } from '@/lib/growth/demand-radar/shadow/shadow-dedup';
import { SUPPRESSION_AUDIT_QUERY_FAMILY } from '@/lib/growth/demand-radar/shadow/types';
import { PRODUCT_RECOMMENDATION_QUERY_FAMILY } from '@/lib/growth/demand-radar/shadow/shadow-vocabulary';
import { runShadowRecommendationExperiment } from '@/lib/growth/demand-radar/shadow/shadow-recommendation-experiment';

// ---------------------------------------------------------------------------
// Part 1 — selectSuppressionAuditSample(): pure function, no mocking needed.
// ---------------------------------------------------------------------------
describe('selectSuppressionAuditSample — deterministic, capped selection', () => {
  const mk = (fp: string) => ({ fingerprint: fp, note: `item-${fp}` });

  it('returns everything when count <= cap', () => {
    const items = [mk('c'), mk('a'), mk('b')];
    const sample = selectSuppressionAuditSample(items, 5);
    expect(sample).toHaveLength(3);
  });

  it('caps at exactly N when more than N qualify', () => {
    const items = Array.from({ length: 12 }, (_, i) => mk(String(i).padStart(2, '0')));
    const sample = selectSuppressionAuditSample(items, SUPPRESSION_AUDIT_CAP);
    expect(sample).toHaveLength(SUPPRESSION_AUDIT_CAP);
  });

  it('default cap is 5', () => {
    const items = Array.from({ length: 9 }, (_, i) => mk(String(i)));
    expect(selectSuppressionAuditSample(items)).toHaveLength(5);
  });

  it('selection is deterministic and order-independent — same items, different arrival order, same result', () => {
    const a = [mk('bb'), mk('aa'), mk('dd'), mk('cc'), mk('ee'), mk('ff')];
    const b = [mk('ff'), mk('ee'), mk('dd'), mk('cc'), mk('bb'), mk('aa')]; // reversed arrival order
    const sampleA = selectSuppressionAuditSample(a, 3).map((x) => x.fingerprint);
    const sampleB = selectSuppressionAuditSample(b, 3).map((x) => x.fingerprint);
    expect(sampleA).toEqual(sampleB);
    expect(sampleA).toEqual(['aa', 'bb', 'cc']); // lexicographically smallest 3 fingerprints
  });

  it('is stable across repeated calls on the same input (not randomized)', () => {
    const items = Array.from({ length: 20 }, () => mk(Math.random().toString(36).slice(2))); // random fingerprints, fixed set
    const run1 = selectSuppressionAuditSample(items, 5).map((x) => x.fingerprint);
    const run2 = selectSuppressionAuditSample(items, 5).map((x) => x.fingerprint);
    expect(run1).toEqual(run2);
  });

  it('does not mutate the input array', () => {
    const items = [mk('c'), mk('a'), mk('b')];
    const original = items.map((x) => x.fingerprint);
    selectSuppressionAuditSample(items, 2);
    expect(items.map((x) => x.fingerprint)).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — static isolation check: the audit path must never reference
// Radar 1's production tables, email/draft functions, or demand_opportunities.
// ---------------------------------------------------------------------------
describe('suppression audit — static isolation check', () => {
  const SHADOW_DIR = path.join(__dirname, '..', '..', 'src', 'lib', 'growth', 'demand-radar', 'shadow');
  const FORBIDDEN = ['demand_opportunities', 'draftReply', 'sendHighOpportunityAlert', 'sendEmailNotification', "'demand_radar_funnel_events'", "'demand_radar_outcomes'"];

  it('shadow-recommendation-experiment.ts and shadow-dedup.ts never reference a Radar 1 / email / opportunity path', () => {
    for (const file of ['shadow-recommendation-experiment.ts', 'shadow-dedup.ts']) {
      const content = fs.readFileSync(path.join(SHADOW_DIR, file), 'utf8');
      for (const forbidden of FORBIDDEN) expect(content).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// Part 3 — full orchestrator, mocked. Proves: near-dup still suppressed from
// the primary path; an eligible audit copy reaches Shadow Review distinctly
// tagged; the cap holds end-to-end; audit rows never touch the primary
// track's counters.
// ---------------------------------------------------------------------------
type Insert = { table: string; row: any };

function makeMockSupabase() {
  const inserts: Insert[] = [];
  const upserts: Insert[] = [];

  function from(table: string) {
    return {
      select() {
        return {
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: { cursor: null }, error: null }) }),
          range: () => Promise.resolve({ data: [], error: null }), // tps_product_projection (assessAnswerability)
        };
      },
      insert(row: any) {
        inserts.push({ table, row });
        return Promise.resolve({ error: null });
      },
      upsert(row: any) {
        upserts.push({ table, row });
        return Promise.resolve({ error: null });
      },
    };
  }

  return { client: { from }, inserts, upserts };
}

let currentMock = makeMockSupabase();
jest.mock('@/lib/database', () => ({
  createServerClient: () => currentMock.client,
}));

jest.mock('@/lib/growth/demand-radar/classify', () => ({
  classifyCandidate: jest.fn(async () => ({
    category: 'mobile', intentClass: 'recommendation', intentStrength: 'strong',
    ksaRelevance: 'likely', isDirectQuestion: true, budgetSar: null, confidence: 0.8, via: 'llm',
    domain: 'product', buyingStage: 'research', intentType: 'recommendation', exclusion: 'none',
  })),
}));

function mkTweet(id: string, text: string) {
  return { id, text, created_at: '2026-08-30T12:00:00.000Z', conversation_id: id, lang: 'ar' };
}

function xResponse(tweets: ReturnType<typeof mkTweet>[]) {
  return { ok: true, status: 200, json: async () => ({ data: tweets, includes: { users: [] } }), text: async () => '' } as unknown as Response;
}

describe('runShadowRecommendationExperiment — near-duplicate suppression audit wiring', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, X_RADAR_BEARER_TOKEN: 'test-token', DEMAND_RADAR_FINGERPRINT_SECRET: 'test-secret' };
    currentMock = makeMockSupabase();
  });
  afterEach(() => { process.env = OLD_ENV; jest.restoreAllMocks(); });

  it('8 near-identical mobile posts: 1 passes through the primary track, 7 are suppressed, exactly 5 (the cap) reach the audit sample — none touch the primary counters', async () => {
    // Same template text, only a trailing tracking link differs — near-dup
    // normalization strips the link, so all 8 collapse to one content
    // fingerprint: the 1st is genuinely new, the other 7 are near-dupes.
    const mobileTweets = Array.from({ length: 8 }, (_, i) =>
      mkTweet(`m${i}`, `قبل ما تشتري، شوف المقارنة! https://t.co/link${i}`)
    );
    global.fetch = jest.fn()
      .mockResolvedValueOnce(xResponse(mobileTweets)) // mobile
      .mockResolvedValueOnce(xResponse([])) // laptop
      .mockResolvedValueOnce(xResponse([])); // air_conditioner

    const result = await runShadowRecommendationExperiment({ isTest: true });

    expect(result.status).toBe('ok');
    expect(result.totalPolled).toBe(8);
    expect(result.nearDuplicatesSuppressed).toBe(7);
    // the primary track only ever saw the 1 non-duplicate candidate
    expect(result.matchedRadar1 + result.unmatchedRadar1).toBe(1);
    expect(result.reviewQueueInserted).toBe(1);
    // exactly the cap, not all 7 suppressed candidates
    expect(result.suppressionAuditInserted).toBe(SUPPRESSION_AUDIT_CAP);

    const queueInserts = currentMock.inserts.filter((i) => i.table === 'demand_radar_shadow_review_queue');
    expect(queueInserts).toHaveLength(1 + SUPPRESSION_AUDIT_CAP); // 1 primary + 5 audit

    const primaryRows = queueInserts.filter((i) => i.row.query_family === PRODUCT_RECOMMENDATION_QUERY_FAMILY);
    const auditRows = queueInserts.filter((i) => i.row.query_family === SUPPRESSION_AUDIT_QUERY_FAMILY);
    expect(primaryRows).toHaveLength(1);
    expect(auditRows).toHaveLength(SUPPRESSION_AUDIT_CAP);

    // audit rows are distinctly tagged and carry no primary-track scoring
    for (const row of auditRows) {
      expect(row.row.query_family).toBe(SUPPRESSION_AUDIT_QUERY_FAMILY);
      expect(row.row.category).toBe('mobile');
      expect(row.row.domain).toBe('product');
    }

    // outcomes: 1 primary-track outcome + 5 audit outcomes, correctly tagged
    const outcomeUpserts = currentMock.upserts.filter((u) => u.table === 'demand_radar_shadow_outcomes');
    const primaryOutcomes = outcomeUpserts.filter((u) => u.row.query_family === PRODUCT_RECOMMENDATION_QUERY_FAMILY);
    const auditOutcomes = outcomeUpserts.filter((u) => u.row.query_family === SUPPRESSION_AUDIT_QUERY_FAMILY);
    expect(primaryOutcomes).toHaveLength(1);
    expect(auditOutcomes).toHaveLength(SUPPRESSION_AUDIT_CAP);
    // audit outcomes never carry a real classification/score (none was run)
    for (const o of auditOutcomes) {
      expect(o.row.exclusion).toBeNull();
      expect(o.row.opportunity_score).toBeNull();
      expect(o.row.answerability_status).toBeNull();
    }
  });

  it('a fully clean run (no duplicates at all) inserts zero audit rows', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(xResponse([mkTweet('m1', 'وش افضل جوال بميزانية 2000؟')]))
      .mockResolvedValueOnce(xResponse([]))
      .mockResolvedValueOnce(xResponse([]));

    const result = await runShadowRecommendationExperiment({ isTest: true });
    expect(result.nearDuplicatesSuppressed).toBe(0);
    expect(result.suppressionAuditInserted).toBe(0);
    const auditRows = currentMock.inserts.filter(
      (i) => i.table === 'demand_radar_shadow_review_queue' && i.row.query_family === SUPPRESSION_AUDIT_QUERY_FAMILY
    );
    expect(auditRows).toHaveLength(0);
  });

  it('never writes to demand_opportunities or any table other than the Shadow-prefixed set', async () => {
    const mobileTweets = Array.from({ length: 3 }, (_, i) => mkTweet(`m${i}`, `قبل ما تشتري، شوف المقارنة! https://t.co/link${i}`));
    global.fetch = jest.fn()
      .mockResolvedValueOnce(xResponse(mobileTweets))
      .mockResolvedValueOnce(xResponse([]))
      .mockResolvedValueOnce(xResponse([]));

    await runShadowRecommendationExperiment({ isTest: true });

    const allTouchedTables = new Set([
      ...currentMock.inserts.map((i) => i.table),
      ...currentMock.upserts.map((u) => u.table),
    ]);
    for (const table of allTouchedTables) {
      expect(table === 'demand_opportunities').toBe(false);
      expect(
        table === 'demand_radar_shadow_review_queue' ||
        table === 'demand_radar_shadow_outcomes' ||
        table === 'demand_radar_shadow_funnel_events' ||
        table === 'demand_radar_state'
      ).toBe(true);
    }
  });
});
