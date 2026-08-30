// Founder Intelligence — shared FOCUS TODAY computation (ADR-277). The ONE function both the
// daily email and the Command Center dashboard call — these tests are the single source of truth
// for its contract; neither caller's own test suite re-tests this logic (see
// tests/admin/daily-report.test.ts and the Command Center dashboard's own test, both of which
// mock this module directly rather than its internals).
//
// require() (not import) is deliberate throughout: each test needs a fresh module instance after
// jest.resetModules() to pick up that test's own jest.doMock() dependency swaps.
/* eslint-disable @typescript-eslint/no-require-imports */
function freshFocusToday(enableAiBrief: boolean) {
  if (enableAiBrief) process.env.ENABLE_FOUNDER_AI_BRIEF = '1';
  else delete process.env.ENABLE_FOUNDER_AI_BRIEF;
  jest.resetModules();
  return require('@/lib/admin/focus-today') as typeof import('@/lib/admin/focus-today');
}

function mockDeps({
  needSignalsImpl, clustersImpl, briefImpl,
}: {
  needSignalsImpl?: (...args: unknown[]) => Promise<unknown[]>;
  clustersImpl?: (...args: unknown[]) => unknown[];
  briefImpl?: (...args: unknown[]) => Promise<{ focusItems: unknown[]; aiAvailable: boolean; reason?: string }>;
}) {
  jest.doMock('@/lib/admin/command-center-queries', () => ({
    fetchUsageEvents: jest.fn(async () => []),
  }));
  jest.doMock('@/lib/admin/need-signals', () => ({
    computeNeedSignals: jest.fn(needSignalsImpl ?? (async () => [])),
  }));
  jest.doMock('@/lib/admin/emerging-language', () => ({
    clusterEmergingLanguage: jest.fn(clustersImpl ?? (() => [])),
  }));
  jest.doMock('@/lib/admin/founder-intelligence', () => {
    const actual = jest.requireActual('@/lib/admin/founder-intelligence');
    return { ...actual, generateFounderIntelligenceBrief: jest.fn(briefImpl ?? (async () => ({ focusItems: [], aiAvailable: true }))) };
  });
}

describe('computeFocusToday — flag OFF (default)', () => {
  beforeEach(() => { jest.resetModules(); jest.clearAllMocks(); });

  it('returns {enabled:false} and calls none of the AI-layer functions', async () => {
    mockDeps({});
    const { computeFocusToday } = freshFocusToday(false);
    const cc = require('@/lib/admin/command-center-queries');
    const needSignals = require('@/lib/admin/need-signals');
    const emergingLanguage = require('@/lib/admin/emerging-language');
    const founderIntel = require('@/lib/admin/founder-intelligence');

    const result = await computeFocusToday([]);

    expect(result).toEqual({ enabled: false });
    expect(cc.fetchUsageEvents).not.toHaveBeenCalled();
    expect(needSignals.computeNeedSignals).not.toHaveBeenCalled();
    expect(emergingLanguage.clusterEmergingLanguage).not.toHaveBeenCalled();
    expect(founderIntel.generateFounderIntelligenceBrief).not.toHaveBeenCalled();
  });
});

describe('isFounderAIBriefEnabled', () => {
  it('reflects ENABLE_FOUNDER_AI_BRIEF exactly', () => {
    const off = freshFocusToday(false);
    expect(off.isFounderAIBriefEnabled()).toBe(false);
    const on = freshFocusToday(true);
    expect(on.isFounderAIBriefEnabled()).toBe(true);
  });
});

describe('computeFocusToday — flag ON', () => {
  beforeEach(() => { jest.resetModules(); jest.clearAllMocks(); });

  it('reports aiAvailable:false with the stated reason on a model failure', async () => {
    mockDeps({ briefImpl: async () => ({ focusItems: [], aiAvailable: false, reason: 'Anthropic API 500' }) });
    const { computeFocusToday } = freshFocusToday(true);
    const result = await computeFocusToday([]);
    expect(result).toEqual({ enabled: true, aiAvailable: false, reason: 'Anthropic API 500' });
  });

  it('reports an empty focusItems array as a valid "nothing worth surfacing" result', async () => {
    mockDeps({ briefImpl: async () => ({ focusItems: [], aiAvailable: true }) });
    const { computeFocusToday } = freshFocusToday(true);
    const result = await computeFocusToday([]);
    expect(result).toEqual({ enabled: true, aiAvailable: true, focusItems: [] });
  });

  it('returns real focus items through unchanged', async () => {
    const item = {
      candidateId: 'c0', titleAr: 'x', evidenceAr: 'y', sampleSize: 10, earlySignal: false,
      domain: 'commercial', evidenceConfidence: 'high', actionTier: 'WATCH',
      whyNowAr: 'a', recommendedActionAr: 'b', riskCaveatAr: '', whatToMeasureNextAr: '',
    };
    mockDeps({ briefImpl: async () => ({ focusItems: [item], aiAvailable: true }) });
    const { computeFocusToday } = freshFocusToday(true);
    const result = await computeFocusToday([]);
    expect(result).toEqual({ enabled: true, aiAvailable: true, focusItems: [item] });
  });

  it('never throws — a thrown failure anywhere in the assembly degrades to aiAvailable:false with the error message', async () => {
    mockDeps({ needSignalsImpl: async () => { throw new Error('catalog read timed out'); } });
    const { computeFocusToday } = freshFocusToday(true);
    await expect(computeFocusToday([])).resolves.not.toThrow();
    const result = await computeFocusToday([]);
    expect(result).toEqual({ enabled: true, aiAvailable: false, reason: 'catalog read timed out' });
  });

  it('folds a real demand_momentum need-signal into the AI candidate pool alongside existing opportunities (integration through the real, unmocked opportunities.ts)', async () => {
    const strongSignal = {
      category: 'tablet', volume: 200, recorded: 20, derived: 180, baselineVolume: 30,
      momentumPct: 400, topSessionShare: 0.2, decisionEvidenceShare: 0.1, decisionEvidenceCount: 20,
      signalBreakdown: {
        recommendationRequest: 0, explicitComparison: 0, budgetStated: 0, useCaseStated: 0,
        namedCompetingProducts: 0, urgency: 0, replacement: 0, availabilityQuestion: 0,
      },
      answerability: 'yes' as const, answerabilityReason: 'well covered', sampleSize: 200, belowConfidenceFloor: false,
    };
    let capturedCandidateCount = 0;
    mockDeps({
      needSignalsImpl: async () => [strongSignal],
      briefImpl: async (...args: unknown[]) => {
        capturedCandidateCount = (args[0] as unknown[]).length;
        return { focusItems: [], aiAvailable: true };
      },
    });
    const existingOpportunity = {
      kind: 'no_agreement_retailer' as const, titleAr: 'x', titleEn: 'x', evidenceAr: 'y', evidenceEn: 'y',
      sampleSize: 50, earlySignal: false, evidenceConfidence: 'high' as const, actionTier: 'WATCH' as const,
      recommendedActionAr: 'z', recommendedActionEn: 'z',
    };
    const { computeFocusToday } = freshFocusToday(true);
    await computeFocusToday([existingOpportunity]);
    expect(capturedCandidateCount).toBe(2); // the existing opportunity + the real demand_momentum derived from strongSignal
  });
});
