// Founder Intelligence — need-based opportunities (integrated review, 2026-08-30).
import { computeNeedBasedOpportunities } from '@/lib/admin/opportunities';
import type { CategoryNeedSignal } from '@/lib/admin/need-signals';
import type { EmergingLanguageCluster } from '@/lib/admin/emerging-language';

function needSignal(overrides: Partial<CategoryNeedSignal>): CategoryNeedSignal {
  return {
    category: 'tablet', volume: 100, recorded: 10, derived: 90, baselineVolume: 20,
    momentumPct: 400, topSessionShare: 0.3, decisionEvidenceShare: 0.1, decisionEvidenceCount: 10,
    answerability: 'yes', answerabilityReason: 'well covered', sampleSize: 100, belowConfidenceFloor: false,
    ...overrides,
  };
}
function cluster(overrides: Partial<EmergingLanguageCluster>): EmergingLanguageCluster {
  return {
    signature: ['test'], sampleQueries: ['test query one', 'test query two'],
    count: 5, distinctSessions: 4, belowClusterFloor: false,
    ...overrides,
  };
}

describe('computeNeedBasedOpportunities — demand_momentum', () => {
  it('surfaces a category with strong momentum, real coverage, and no single-session dominance', () => {
    const opps = computeNeedBasedOpportunities([needSignal({})], []);
    expect(opps).toHaveLength(1);
    expect(opps[0].kind).toBe('demand_momentum');
    expect(opps[0].evidenceEn).toContain('100 demand events');
  });

  it('never surfaces a category below the confidence floor, however strong its momentum reads', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ belowConfidenceFloor: true, momentumPct: 1000 })], []);
    expect(opps).toEqual([]);
  });

  it('never surfaces momentum without a real baseline (momentumPct null) — no fabricated growth story for a brand-new category', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ momentumPct: null })], []);
    expect(opps).toEqual([]);
  });

  it('never surfaces momentum below the +50% threshold', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ momentumPct: 20 })], []);
    expect(opps).toEqual([]);
  });

  it('never surfaces a category Tawveeri cannot answer as demand_momentum — that belongs to high_demand_low_coverage instead', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ answerability: 'partial' })], []);
    expect(opps.find((o) => o.kind === 'demand_momentum')).toBeUndefined();
  });

  it('suppresses an apparent trend driven by one heavy session — not a market signal', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ topSessionShare: 0.85 })], []);
    expect(opps).toEqual([]);
  });
});

describe('computeNeedBasedOpportunities — emerging_language', () => {
  it('surfaces a cluster above both the clustering floor and the session-diversity floor', () => {
    const opps = computeNeedBasedOpportunities([], [cluster({})]);
    expect(opps).toHaveLength(1);
    expect(opps[0].kind).toBe('emerging_language');
  });

  it('never surfaces a cluster below its own clustering floor', () => {
    const opps = computeNeedBasedOpportunities([], [cluster({ belowClusterFloor: true })]);
    expect(opps).toEqual([]);
  });

  it('never promotes a cluster from a single session to an actionable opportunity — real production case: the Honor Pad cluster this session found (n=3, 1 session) correctly stays below this bar until independently confirmed by more than one person', () => {
    const opps = computeNeedBasedOpportunities([], [cluster({ count: 3, distinctSessions: 1 })]);
    expect(opps).toEqual([]);
  });
});
