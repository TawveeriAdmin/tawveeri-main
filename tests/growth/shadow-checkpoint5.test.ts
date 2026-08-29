/**
 * Radar 2.0 Phase 2, Checkpoint 5 (founder decision 2026-08-29) — the ONE
 * approved widened experiment. Pins the exact query strings against the
 * published architecture doc figures (266–302 chars) and confirms the
 * isolation contract extends to this new file.
 */
import fs from 'fs';
import path from 'path';
import { PRODUCT_RECOMMENDATION_QUERIES, PRODUCT_RECOMMENDATION_QUERY_FAMILY } from '@/lib/growth/demand-radar/shadow/shadow-vocabulary';

const ADAPTER_SUFFIX = ' lang:ar -is:retweet -from:Tawveeri';
const SHADOW_DIR = path.join(__dirname, '..', '..', 'src', 'lib', 'growth', 'demand-radar', 'shadow');

describe('Checkpoint 5 — PRODUCT_RECOMMENDATION query construction', () => {
  it('is exactly the three approved categories, nothing else', () => {
    const categories = PRODUCT_RECOMMENDATION_QUERIES.map((q) => q.category).sort();
    expect(categories).toEqual(['air_conditioner', 'laptop', 'mobile']);
  });

  it('every query fits the 512-char self-serve limit with room to spare', () => {
    for (const { category, query } of PRODUCT_RECOMMENDATION_QUERIES) {
      const full = query + ADAPTER_SUFFIX;
      expect(full.length).toBeLessThanOrEqual(512);
      // sanity floor — matches the published 266/283/302 figures within a
      // reasonable margin, catching an accidental phrase-list change
      expect(full.length).toBeGreaterThan(200);
      expect(full.length).toBeLessThan(350);
      void category;
    }
  });

  it('carries recommendation grammar deliberately excluded from Radar 1 (dropped 2026-08-26)', () => {
    for (const { query } of PRODUCT_RECOMMENDATION_QUERIES) {
      expect(query).toContain('وش تنصحون');
      expect(query).toContain('وش افضل');
    }
  });

  it('excludes our own account and non-Arabic results, same convention as every other query', () => {
    for (const { query } of PRODUCT_RECOMMENDATION_QUERIES) {
      const full = query + ADAPTER_SUFFIX;
      expect(full).toContain('-from:Tawveeri');
      expect(full).toContain('lang:ar');
      expect(full).toContain('-is:retweet');
    }
  });
});

describe('Checkpoint 5 isolation — extends Checkpoint 2\'s static reference test', () => {
  it('shadow-recommendation-experiment.ts and shadow-vocabulary.ts never reference Radar 1 control tables', () => {
    const forbidden = ["'demand_radar_funnel_events'", '"demand_radar_funnel_events"', "'demand_radar_outcomes'", '"demand_radar_outcomes"'];
    for (const file of ['shadow-recommendation-experiment.ts', 'shadow-vocabulary.ts']) {
      const content = fs.readFileSync(path.join(SHADOW_DIR, file), 'utf8');
      for (const f of forbidden) expect(content).not.toContain(f);
    }
  });

  it('shadow-recommendation-experiment.ts never references saudi-lexicon.ts (Radar 1\'s own vocabulary is not modified or reused as a base)', () => {
    const content = fs.readFileSync(path.join(SHADOW_DIR, 'shadow-recommendation-experiment.ts'), 'utf8');
    expect(content).not.toContain('saudi-lexicon');
  });

  it('never calls draftReply, sendHighOpportunityAlert, or inserts into demand_opportunities', () => {
    const content = fs.readFileSync(path.join(SHADOW_DIR, 'shadow-recommendation-experiment.ts'), 'utf8');
    expect(content).not.toContain('draftReply');
    expect(content).not.toContain('sendHighOpportunityAlert');
    expect(content).not.toContain("from('demand_opportunities')");
  });

  it('the query family constant is distinct from the Checkpoint 4 control-parity family', () => {
    expect(PRODUCT_RECOMMENDATION_QUERY_FAMILY).toBe('PRODUCT_RECOMMENDATION');
    expect(PRODUCT_RECOMMENDATION_QUERY_FAMILY).not.toBe('CONTROL_PARITY_V1');
  });
});
