// Daily Founder Email — FOCUS TODAY HTML rendering (ADR-277). generateDailyFounderReport()'s
// core body (stats/brief/opportunities) is pre-existing and untouched. The FOCUS TODAY
// COMPUTATION (need-signals/emerging-language/AI call) is no longer this file's job — that lives
// in src/lib/admin/focus-today.ts and is tested once, directly, in tests/admin/focus-today.test.ts.
// These tests exist ONLY to prove this file renders computeFocusToday()'s result correctly as
// HTML for the email: the three result shapes (disabled/unavailable/populated), the
// ACT/WATCH/INSUFFICIENT_EVIDENCE badges, and that model-influenced text is always escaped.
/* eslint-disable @typescript-eslint/no-require-imports */

function freshDailyReport() {
  jest.resetModules();
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

function mockPipeline(focusTodayResult: unknown) {
  jest.doMock('@/lib/admin/command-center-queries', () => ({
    getCommandCenterData: jest.fn(async () => baseData),
  }));
  jest.doMock('@/lib/admin/growth-queries', () => ({
    fetchGrowthContent: jest.fn(async () => []),
  }));
  jest.doMock('@/lib/providers/registry', () => ({
    getProviderByStoreId: jest.fn(() => null),
  }));
  jest.doMock('@/lib/admin/focus-today', () => {
    const actual = jest.requireActual('@/lib/admin/focus-today');
    return { ...actual, computeFocusToday: jest.fn(async () => focusTodayResult) };
  });
}

describe('generateDailyFounderReport — FOCUS TODAY rendering', () => {
  beforeEach(() => { jest.resetModules(); jest.clearAllMocks(); });

  it('renders no FOCUS TODAY section when computeFocusToday reports {enabled:false}', async () => {
    mockPipeline({ enabled: false });
    const { generateDailyFounderReport } = freshDailyReport();
    const result = await generateDailyFounderReport();
    expect(result.html).not.toContain('ركّز اليوم على');
    expect(result.hasActivity).toBe(true);
    expect(result.subjectAr).toContain('50 جلسة');
    expect(result.html).toContain('الجلسات الحقيقية');
  });

  it('renders the amber "AI unavailable" note with the stated reason, and the rest of the email is unaffected', async () => {
    mockPipeline({ enabled: true, aiAvailable: false, reason: 'Anthropic API 500' });
    const { generateDailyFounderReport } = freshDailyReport();
    const result = await generateDailyFounderReport();
    expect(result.html).toContain('تعذر توليد توصيات الذكاء الاصطناعي اليوم');
    expect(result.html).toContain('Anthropic API 500');
    expect(result.html).toContain('الجلسات الحقيقية');
    expect(result.hasActivity).toBe(true);
  });

  it('renders the "no strong signal" note for an empty focusItems array', async () => {
    mockPipeline({ enabled: true, aiAvailable: true, focusItems: [] });
    const { generateDailyFounderReport } = freshDailyReport();
    const result = await generateDailyFounderReport();
    expect(result.html).toContain('ركّز اليوم على');
    expect(result.html).toContain('لا توجد إشارة قوية بما يكفي');
  });

  it('renders a real focus item with correct domain/evidence-confidence/action-tier labels and the early-signal marker', async () => {
    mockPipeline({
      enabled: true, aiAvailable: true,
      focusItems: [{
        candidateId: 'c0', titleAr: 'عنوان الفرصة', evidenceAr: 'دليل الفرصة',
        sampleSize: 12, earlySignal: true, domain: 'catalog_coverage',
        evidenceConfidence: 'low', actionTier: 'INSUFFICIENT_EVIDENCE',
        whyNowAr: 'لأن الطلب حقيقي', recommendedActionAr: 'راجع الفئة',
        riskCaveatAr: 'عينة صغيرة', whatToMeasureNextAr: 'راقب الأسبوع القادم',
      }],
    });
    const { generateDailyFounderReport } = freshDailyReport();
    const result = await generateDailyFounderReport();
    expect(result.html).toContain('عنوان الفرصة');
    expect(result.html).toContain('لأن الطلب حقيقي');
    expect(result.html).toContain('راجع الفئة');
    expect(result.html).toContain('دليل الفرصة');
    expect(result.html).toContain('تغطية الكتالوج'); // catalog_coverage domain label
    expect(result.html).toContain('ثقة الدليل منخفضة'); // low evidence-confidence label
    expect(result.html).toContain('دليل غير كافٍ بعد'); // INSUFFICIENT_EVIDENCE action-tier badge
    expect(result.html).toContain('إشارة مبكرة'); // earlySignal true
    expect(result.html).toContain('عينة صغيرة'); // risk caveat rendered
  });

  it('renders the ACT badge for an action-ready focus item', async () => {
    mockPipeline({
      enabled: true, aiAvailable: true,
      focusItems: [{
        candidateId: 'c0', titleAr: 'فرصة قوية', evidenceAr: 'دليل قوي',
        sampleSize: 150, earlySignal: false, domain: 'commercial',
        evidenceConfidence: 'high', actionTier: 'ACT',
        whyNowAr: 'x', recommendedActionAr: 'y', riskCaveatAr: '', whatToMeasureNextAr: '',
      }],
    });
    const { generateDailyFounderReport } = freshDailyReport();
    const result = await generateDailyFounderReport();
    expect(result.html).toContain('جاهز للتحرك'); // ACT badge
  });

  it('HTML-escapes every model-influenced field so a candidate/AI string can never inject markup into the founder email', async () => {
    mockPipeline({
      enabled: true, aiAvailable: true,
      focusItems: [{
        candidateId: 'c0', titleAr: '<img src=x onerror=alert(1)>', evidenceAr: 'A & B',
        sampleSize: 1, earlySignal: false, domain: 'marketing_content',
        evidenceConfidence: 'high', actionTier: 'ACT',
        whyNowAr: '<script>steal()</script>', recommendedActionAr: '"quoted"',
        riskCaveatAr: "it's risky", whatToMeasureNextAr: '',
      }],
    });
    const { generateDailyFounderReport } = freshDailyReport();
    const result = await generateDailyFounderReport();
    expect(result.html).not.toContain('<img src=x onerror=alert(1)>');
    expect(result.html).not.toContain('<script>steal()</script>');
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
    expect(result.html).toContain('A &amp; B');
  });
});
