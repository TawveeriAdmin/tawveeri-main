/**
 * Radar 2.0 Phase 2 — Checkpoint 2 isolation tests (part 1 of 3: the two
 * DB-free tests). Part 2 (identical-fingerprint cross-table coexistence)
 * and part 3 (drop-and-diff) require a live database and are run/reported
 * separately, matching this repo's existing convention of keeping
 * DB-integration suites out of the default `npm test` gate
 * (jest.config.js's testPathIgnorePatterns).
 */
import fs from 'fs';
import path from 'path';
import { wouldRadar1Retrieve } from '@/lib/growth/demand-radar/shadow/would-radar1-retrieve';
import { buildShadowFunnelEventRow, buildShadowOutcomeRow, SHADOW_FORBIDDEN_FIELDS } from '@/lib/growth/demand-radar/shadow/shadow-funnel';
import { CONTROL_PARITY_QUERY_FAMILY } from '@/lib/growth/demand-radar/shadow/types';
import { CATEGORY_LEXICONS } from '@/lib/growth/demand-radar/saudi-lexicon';
import type { ShadowFunnelEvent, ShadowOutcomeRecord } from '@/lib/growth/demand-radar/shadow/types';

const SHADOW_DIR = path.join(__dirname, '..', '..', 'src', 'lib', 'growth', 'demand-radar', 'shadow');
const FORBIDDEN_TABLE_REFS = ["'demand_radar_funnel_events'", '"demand_radar_funnel_events"', "'demand_radar_outcomes'", '"demand_radar_outcomes"'];

describe('Checkpoint 2, test 2 — static reference test: Shadow never writes to Phase 1 control tables', () => {
  it('no file under shadow/ contains a string reference to either Phase 1 table name', () => {
    const files = fs.readdirSync(SHADOW_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0); // sanity: the directory actually exists and has files
    for (const file of files) {
      const content = fs.readFileSync(path.join(SHADOW_DIR, file), 'utf8');
      for (const forbidden of FORBIDDEN_TABLE_REFS) {
        expect(content).not.toContain(forbidden);
      }
    }
  });

  it('shadow-funnel.ts writes only to the two Shadow-prefixed table names', () => {
    const content = fs.readFileSync(path.join(SHADOW_DIR, 'shadow-funnel.ts'), 'utf8');
    expect(content).toContain("'demand_radar_shadow_funnel_events'");
    expect(content).toContain("'demand_radar_shadow_outcomes'");
  });
});

describe('would_radar1_retrieve() — Checkpoint 4 replay correctness', () => {
  it('matches text containing an exact CATEGORY_LEXICONS phrase', () => {
    const r = wouldRadar1Retrieve('ابي جوال جديد ميزانيتي 2000');
    expect(r.matched).toBe(true);
    expect(r.matchedCategory).toBe('mobile');
    expect(r.matchedPhrase).toBe('ابي جوال');
  });

  it('does NOT match text using only broader recommendation grammar (no exact phrase)', () => {
    // "وش تنصحون" was deliberately dropped in the 2026-08-26 narrowing —
    // this text must NOT be flagged as Radar-1-retrievable.
    const r = wouldRadar1Retrieve('وش تنصحون بجوال زين للتصوير؟');
    expect(r.matched).toBe(false);
  });

  it('does not match unrelated text', () => {
    const r = wouldRadar1Retrieve('اليوم الجو حلو في الرياض');
    expect(r.matched).toBe(false);
  });

  it('every CATEGORY_LEXICONS category is represented in the replay phrase set', () => {
    // NOTE: does not assert matchedCategory === cat — a real, pre-existing
    // overlap exists in Radar 1's own phrases (tv's "ابي شاشة" is a plain
    // substring of monitor's "ابي شاشة كمبيوتر"), so category-order in
    // CATEGORY_LEXICONS can win the match for a phrase picked from a LATER
    // category. That is correct replay behavior — X's own OR-phrase
    // matching would hit the same ambiguity — not a bug in the replay
    // function, so only `matched` is asserted here.
    const categories = new Set(CATEGORY_LEXICONS.map((c) => c.category));
    for (const cat of categories) {
      const lex = CATEGORY_LEXICONS.find((c) => c.category === cat)!;
      const firstPhrase = lex.xQuery.match(/"([^"]+)"/)?.[1];
      expect(firstPhrase).toBeTruthy();
      const r = wouldRadar1Retrieve(`${firstPhrase} test`);
      expect(r.matched).toBe(true);
    }
  });
});

describe('Shadow privacy regression test — mirrors Phase 1\'s pattern exactly', () => {
  const fullEvent: ShadowFunnelEvent = {
    fingerprint: 'abc123', source: 'x', domain: 'product', category: 'mobile',
    stage: 'fetched', detail: null, opportunityScore: null, answerabilityStatus: null,
    queryFamily: CONTROL_PARITY_QUERY_FAMILY, isTest: true,
  };
  const fullOutcome: ShadowOutcomeRecord = {
    fingerprint: 'abc123', tier: null, domain: 'product', category: 'mobile',
    intentType: null, buyingStage: null, exclusion: null,
    opportunityScore: null, answerabilityStatus: null, queryFamily: CONTROL_PARITY_QUERY_FAMILY,
    isTest: true, retrievedByRadar1: true, shadowReviewLabel: null,
  };

  it('demand_radar_shadow_funnel_events row never contains a forbidden key', () => {
    const row = buildShadowFunnelEventRow(fullEvent);
    for (const forbidden of SHADOW_FORBIDDEN_FIELDS) expect(Object.keys(row)).not.toContain(forbidden);
  });

  it('demand_radar_shadow_outcomes row never contains a forbidden key', () => {
    const row = buildShadowOutcomeRow(fullOutcome);
    for (const forbidden of SHADOW_FORBIDDEN_FIELDS) expect(Object.keys(row)).not.toContain(forbidden);
  });

  it('the row shapes are exactly the expected field set — pins against silent widening', () => {
    expect(Object.keys(buildShadowFunnelEventRow(fullEvent)).sort()).toEqual([
      'answerability_status', 'category', 'detail', 'domain', 'fingerprint',
      'is_test', 'opportunity_score', 'query_family', 'source', 'stage',
    ].sort());
    expect(Object.keys(buildShadowOutcomeRow(fullOutcome)).sort()).toEqual([
      'answerability_status', 'buying_stage', 'category', 'domain', 'exclusion',
      'fingerprint', 'intent_type', 'is_test', 'opportunity_score', 'query_family',
      'retrieved_by_radar1', 'shadow_review_label', 'shadow_reviewed_at', 'tier',
    ].sort());
  });
});
