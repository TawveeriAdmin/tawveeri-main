// Daily Founder Email — FOCUS TODAY wiring (integrated review, 2026-08-30).
// generateDailyFounderReport()'s core body (stats/brief/opportunities) is pre-existing and
// untouched; these tests exist ONLY to prove the new optional AI section behaves per its own
// contract: OFF by default with zero added cost, never breaks the guaranteed-send email on
// failure, and never lets model-influenced text bypass HTML escaping.
//
// ENABLE_FOUNDER_AI_BRIEF is read into a module-level const at import time (matches this
// codebase's existing convention for env-gated consts, e.g. MODEL/TIMEOUT_MS in
// founder-intelligence.ts) — so each test that needs a specific flag value sets the env var,
// then jest.resetModules() + require()s a fresh copy of the module under test.

function freshDailyReport(enableAiBrief: boolean) {
  if (enableAiBrief) process.env.ENABLE_FOUNDER_AI_BRIEF = '1';
  else delete process.env.ENABLE_FOUNDER_AI_BRIEF;
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@/lib/admin/daily-report') as typeof import('@/lib/admin/daily-report');
}

const baseData = {
  homeMission: {},
  range: { start: new Date('2026-08-29'), end: new Date('2026-08-30') },
  real: { sessions: 50, search: 20 },
  test: { sessions: 0, search: 0 },
  prevReal: { sessions: 40, search: 15 },
  surfaces: [],
  topDemand: [],
  unmetDemand: [],
  outboundReal: { clicks: 0, distinctProducts: 0, monetized: 0 },
  outboundTest: { clicks: 0, distinctProducts: 0, monetized: 0 },
  kpis: { answerRate: 0, noAnswerRate: 0, searchToProduct: 0, productToCompare: 0, compareToExit: 0, searchToExit: 0 },
  gate: { checks: [], verdict: 'PASS' },
  quality: {
    lastEventAt: new Date().toISOString(), trackingStopped: false,
    goClickOutboundDivergencePct: 0, amazonTagConfigured: true, topSessionSearchShare: 0.1,
  },
  campaignAttribution: {},
  confidence: {},
  commercial: {
    qualifiedVisitsReferred: 5, confirmedRetailerRedirects: 10, referredProductInterest: 0,
    referredCategoryDemand: [], topSearchTerms: [], topReferredProducts: [], retailers: [],
  },
  baseline: { date: '2026-08-01', currentIsPreLaunch: false, previousIsPreLaunch: false, includesHistorical: true },
};

function mockPipeline({
  needSignalsImpl, clustersImpl, briefImpl,
}: {
  needSignalsImpl?: (...args: unknown[]) => Promise<unknown[]>;
  clustersImpl?: (...args: unknown[]) => unknown[];
  briefImpl?: (...args: unknown[]) => Promise<{ focusItems: unknown[]; aiAvailable: boolean; reason?: string }>;
}) {
  jest.doMock('@/lib/admin/command-center-queries', () => ({
    getCommandCenterData: jest.fn(async () => baseData),
    fetchUsageEvents: jest.fn(async () => []),
  }));
  jest.doMock('@/lib/admin/growth-queries', () => ({
    fetchGrowthContent: jest.fn(async () => []),
  }));
  jest.doMock('@/lib/providers/registry', () => ({
    getProviderByStoreId: jest.fn(() => null),
  }));
  jest.doMock('@/lib/admin/need-signals', () => ({
    computeNeedSignals: jest.fn(needSignalsImpl ?? (async () => [])),
  }));
  jest.doMock('@/lib/admin/emerging-language', () => ({
    clusterEmergingLanguage: jest.fn(clustersImpl ?? (() => [])),
  }));
  jest.doMock('@/lib/admin/founder-intelligence', () => {
    const actual = jest.requireActual('@/lib/admin/founder-intelligence');
    return {
      ...actual,
      generateFounderIntelligenceBrief: jest.fn(briefImpl ?? (async () => ({ focusItems: [], aiAvailable: true }))),
    };
  });
}

describe('generateDailyFounderReport — FOCUS TODAY flag OFF (default)', () => {
  beforeEach(() => { jest.resetModules(); jest.clearAllMocks(); });

  it('renders no FOCUS TODAY section and never calls any of the AI-layer functions', async () => {
    mockPipeline({});
    const { generateDailyFounderReport } = freshDailyReport(false);
    const needSignals = require('@/lib/admin/need-signals');
    const emergingLanguage = require('@/lib/admin/emerging-language');
    const founderIntel = require('@/lib/admin/founder-intelligence');
    const cc = require('@/lib/admin/command-center-queries');

    const result = await generateDailyFounderReport();

    expect(result.html).not.toContain('ركّز اليوم على');
    expect(needSignals.computeNeedSignals).not.toHaveBeenCalled();
    expect(emergingLanguage.clusterEmergingLanguage).not.toHaveBeenCalled();
    expect(founderIntel.generateFounderIntelligenceBrief).not.toHaveBeenCalled();
    // fetchUsageEvents is only ever called by buildFocusTodaySection — flag off means zero extra queries.
    expect(cc.fetchUsageEvents).not.toHaveBeenCalled();
  });

  it('still produces the normal deterministic email (subject, activity flag, core stats)', async () => {
    mockPipeline({});
    const { generateDailyFounderReport } = freshDailyReport(false);
    const result = await generateDailyFounderReport();
    expect(result.hasActivity).toBe(true);
    expect(result.subjectAr).toContain('50 جلسة');
    expect(result.html).toContain('الجلسات الحقيقية');
  });
});

describe('generateDailyFounderReport — FOCUS TODAY flag ON', () => {
  beforeEach(() => { jest.resetModules(); jest.clearAllMocks(); });

  it('renders the amber "AI unavailable" note (with the stated reason) when the model call fails, and the rest of the email is unaffected', async () => {
    mockPipeline({ briefImpl: async () => ({ focusItems: [], aiAvailable: false, reason: 'Anthropic API 500' }) });
    const { generateDailyFounderReport } = freshDailyReport(true);
    const result = await generateDailyFounderReport();
    expect(result.html).toContain('تعذر توليد توصيات الذكاء الاصطناعي اليوم');
    expect(result.html).toContain('Anthropic API 500');
    expect(result.html).toContain('الجلسات الحقيقية'); // core email body still rendered
    expect(result.hasActivity).toBe(true);
  });

  it('renders the "no strong signal" note when the model correctly recommends nothing', async () => {
    mockPipeline({ briefImpl: async () => ({ focusItems: [], aiAvailable: true }) });
    const { generateDailyFounderReport } = freshDailyReport(true);
    const result = await generateDailyFounderReport();
    expect(result.html).toContain('ركّز اليوم على');
    expect(result.html).toContain('لا توجد إشارة قوية بما يكفي');
  });

  it('renders a real focus item with correct domain/confidence labels and the early-signal marker', async () => {
    mockPipeline({
      briefImpl: async () => ({
        aiAvailable: true,
        focusItems: [{
          candidateId: 'c0', titleAr: 'عنوان الفرصة', evidenceAr: 'دليل الفرصة',
          sampleSize: 12, earlySignal: true, domain: 'catalog_coverage',
          whyNowAr: 'لأن الطلب حقيقي', recommendedActionAr: 'راجع الفئة',
          riskCaveatAr: 'عينة صغيرة', whatToMeasureNextAr: 'راقب الأسبوع القادم',
          confidence: 'low',
        }],
      }),
    });
    const { generateDailyFounderReport } = freshDailyReport(true);
    const result = await generateDailyFounderReport();
    expect(result.html).toContain('عنوان الفرصة');
    expect(result.html).toContain('لأن الطلب حقيقي');
    expect(result.html).toContain('راجع الفئة');
    expect(result.html).toContain('دليل الفرصة');
    expect(result.html).toContain('تغطية الكتالوج'); // catalog_coverage domain label
    expect(result.html).toContain('ثقة منخفضة'); // low confidence label
    expect(result.html).toContain('إشارة مبكرة'); // earlySignal true
    expect(result.html).toContain('عينة صغيرة'); // risk caveat rendered
  });

  it('HTML-escapes every model-influenced field so a candidate/AI string can never inject markup into the founder email', async () => {
    mockPipeline({
      briefImpl: async () => ({
        aiAvailable: true,
        focusItems: [{
          candidateId: 'c0', titleAr: '<img src=x onerror=alert(1)>', evidenceAr: 'A & B',
          sampleSize: 1, earlySignal: false, domain: 'marketing_content',
          whyNowAr: '<script>steal()</script>', recommendedActionAr: '"quoted"',
          riskCaveatAr: "it's risky", whatToMeasureNextAr: '',
          confidence: 'high',
        }],
      }),
    });
    const { generateDailyFounderReport } = freshDailyReport(true);
    const result = await generateDailyFounderReport();
    expect(result.html).not.toContain('<img src=x onerror=alert(1)>');
    expect(result.html).not.toContain('<script>steal()</script>');
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
    expect(result.html).toContain('A &amp; B');
  });

  it('a thrown failure anywhere in the FOCUS TODAY assembly (e.g. computeNeedSignals rejecting) is caught, renders a stated-error note, and never breaks the guaranteed-send email', async () => {
    mockPipeline({ needSignalsImpl: async () => { throw new Error('catalog read timed out'); } });
    const { generateDailyFounderReport } = freshDailyReport(true);
    const result = await generateDailyFounderReport();
    expect(result.html).toContain('تعذر توليد توصيات الذكاء الاصطناعي اليوم');
    expect(result.html).toContain('catalog read timed out');
    expect(result.hasActivity).toBe(true);
    expect(result.subjectAr).toContain('50 جلسة');
  });

  it('a real demand_momentum need-signal is folded into the AI candidate pool (integration through the real, unmocked opportunities.ts)', async () => {
    const strongSignal = {
      category: 'tablet', volume: 200, recorded: 20, derived: 180, baselineVolume: 30,
      momentumPct: 400, topSessionShare: 0.2, decisionEvidenceShare: 0.1, decisionEvidenceCount: 20,
      answerability: 'yes' as const, answerabilityReason: 'well covered', sampleSize: 200, belowConfidenceFloor: false,
    };
    let capturedCandidateCount = 0;
    mockPipeline({
      needSignalsImpl: async () => [strongSignal],
      briefImpl: async (...args: unknown[]) => {
        const candidates = args[0] as unknown[];
        capturedCandidateCount = candidates.length;
        return { focusItems: [], aiAvailable: true };
      },
    });
    const { generateDailyFounderReport } = freshDailyReport(true);
    await generateDailyFounderReport();
    expect(capturedCandidateCount).toBeGreaterThanOrEqual(1);
  });
});
