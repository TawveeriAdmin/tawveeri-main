// Founder Intelligence — need-based opportunities (integrated review, 2026-08-30).
import { computeNeedBasedOpportunities, type Opportunity } from '@/lib/admin/opportunities';
import type { CategoryNeedSignal } from '@/lib/admin/need-signals';
import type { EmergingLanguageCluster } from '@/lib/admin/emerging-language';

function needSignal(overrides: Partial<CategoryNeedSignal>): CategoryNeedSignal {
  return {
    category: 'tablet', volume: 100, recorded: 10, derived: 90, baselineVolume: 20,
    momentumPct: 400, topSessionShare: 0.3, decisionEvidenceShare: 0.1, decisionEvidenceCount: 10,
    signalBreakdown: {
      recommendationRequest: 0, explicitComparison: 0, budgetStated: 0, useCaseStated: 0,
      namedCompetingProducts: 0, urgency: 0, replacement: 0, availabilityQuestion: 0,
    },
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

  it('ADR-275: reaches ACT only with high confidence AND low concentration — a large but concentrated sample stays WATCH even though it clears the base eligibility bar', () => {
    const concentrated = computeNeedBasedOpportunities([needSignal({ volume: 200, topSessionShare: 0.6 })], []); // clears <=0.7 eligibility, fails <=0.4 ACT bar
    expect(concentrated[0].actionTier).toBe('WATCH');
    const clean = computeNeedBasedOpportunities([needSignal({ volume: 200, topSessionShare: 0.2 })], []);
    expect(clean[0].actionTier).toBe('ACT');
    expect(clean[0].evidenceConfidence).toBe('high');
  });

  it('ADR-275: a thin-but-eligible sample never reaches ACT, and below EARLY_SIGNAL_THRESHOLD is INSUFFICIENT_EVIDENCE', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ volume: 25, baselineVolume: 5, momentumPct: 400 })], []); // 25 < 30 -> earlySignal
    expect(opps[0].actionTier).toBe('INSUFFICIENT_EVIDENCE');
    expect(opps[0].evidenceConfidence).toBe('low');
  });
});

describe('computeNeedBasedOpportunities — recoverable_unmet (ADR-275)', () => {
  it('surfaces a category with genuine demand that Tawveeri cannot confidently answer — poor answerability IS the signal, not a reason to suppress it', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ answerability: 'partial', answerabilityReason: '109 منتجًا لكن 0 حديثة' })], []);
    const recoverable = opps.find((o) => o.kind === 'recoverable_unmet');
    expect(recoverable).toBeDefined();
    expect(recoverable!.evidenceAr).toContain('109 منتجًا لكن 0 حديثة');
  });

  it('does not require positive momentum — a flat or declining unanswerable category is still worth a look', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ answerability: 'no', momentumPct: -50, baselineVolume: 200 })], []);
    expect(opps.find((o) => o.kind === 'recoverable_unmet')).toBeDefined();
  });

  it('never surfaces recoverable_unmet for a category Tawveeri already answers well — that is demand_momentum\'s story', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ answerability: 'yes' })], []);
    expect(opps.find((o) => o.kind === 'recoverable_unmet')).toBeUndefined();
  });

  it('never surfaces recoverable_unmet when answerability could not even be computed (unknown) — that is not a coverage claim', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ answerability: 'unknown' })], []);
    expect(opps.find((o) => o.kind === 'recoverable_unmet')).toBeUndefined();
  });

  it('never surfaces below the confidence floor or with a single-session-dominated sample', () => {
    expect(computeNeedBasedOpportunities([needSignal({ answerability: 'no', belowConfidenceFloor: true })], [])
      .find((o) => o.kind === 'recoverable_unmet')).toBeUndefined();
    expect(computeNeedBasedOpportunities([needSignal({ answerability: 'no', topSessionShare: 0.9 })], [])
      .find((o) => o.kind === 'recoverable_unmet')).toBeUndefined();
  });

  it('reaches ACT at the same confidence a Commercial opportunity would still be WATCH — the evidence type is the difference, not the sample size', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ answerability: 'no', volume: 100 })], []);
    const recoverable = opps.find((o) => o.kind === 'recoverable_unmet')!;
    expect(recoverable.evidenceConfidence).toBe('high');
    expect(recoverable.actionTier).toBe('ACT');
  });

  it('a thin sample stays INSUFFICIENT_EVIDENCE, same discipline as every other kind', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ answerability: 'no', volume: 25 })], []);
    expect(opps.find((o) => o.kind === 'recoverable_unmet')!.actionTier).toBe('INSUFFICIENT_EVIDENCE');
  });
});

describe('computeNeedBasedOpportunities — cross-kind dedup with high_demand_low_coverage (integrity review, 2026-08-30)', () => {
  function highDemandLowCoverageOpp(category: string): Opportunity {
    return {
      kind: 'high_demand_low_coverage', category, titleAr: `طلب مرتفع على فئة "${category}"`, titleEn: `High demand for "${category}"`,
      evidenceAr: 'x', evidenceEn: 'x', sampleSize: 40, earlySignal: false,
      evidenceConfidence: 'medium', actionTier: 'ACT',
      recommendedActionAr: 'x', recommendedActionEn: 'x',
    };
  }

  it('never surfaces recoverable_unmet for a category high_demand_low_coverage already reported — no duplicated/overlapping intelligence for the founder to reconcile themselves', () => {
    const existing = [highDemandLowCoverageOpp('oven')];
    const opps = computeNeedBasedOpportunities(
      [needSignal({ category: 'oven', answerability: 'no' })], [], existing
    );
    expect(opps.find((o) => o.kind === 'recoverable_unmet')).toBeUndefined();
  });

  it('still surfaces recoverable_unmet for a DIFFERENT category than the ones high_demand_low_coverage covered', () => {
    const existing = [highDemandLowCoverageOpp('oven')];
    const opps = computeNeedBasedOpportunities(
      [needSignal({ category: 'cooker', answerability: 'no' })], [], existing
    );
    expect(opps.find((o) => o.kind === 'recoverable_unmet' && o.category === 'cooker')).toBeDefined();
  });

  it('with no existingOpportunities passed (the pre-fix call shape), still works — the parameter is additive/optional', () => {
    const opps = computeNeedBasedOpportunities([needSignal({ category: 'oven', answerability: 'no' })], []);
    expect(opps.find((o) => o.kind === 'recoverable_unmet')).toBeDefined();
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

  it('ADR-275: reaches ACT only with real session diversity (>=5), not raw occurrence count — a cluster that just cleared the eligibility floor is WATCH, not ACT', () => {
    const justOverFloor = computeNeedBasedOpportunities([], [cluster({ count: 3, distinctSessions: 3 })]);
    expect(justOverFloor[0].actionTier).toBe('WATCH');
    const wellCorroborated = computeNeedBasedOpportunities([], [cluster({ count: 12, distinctSessions: 6 })]);
    expect(wellCorroborated[0].actionTier).toBe('ACT');
    expect(wellCorroborated[0].evidenceConfidence).toBe('high');
  });
});
