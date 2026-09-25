// tests/founder/daily-email.test.ts — the founder's morning email: fixed section order, subject
// format, unknown never rendered as zero, pending never presented as cash, one decision, link,
// and a deterministic body when the summary/AI cannot be computed.
import { buildDailyEmail, subjectFor, nextScheduledRun, SCHEDULE_LABEL } from '@/lib/founder/daily-email';

jest.mock('@/lib/database', () => ({ createServerClient: () => ({ from: () => ({}) }), fetchAllPaginated: async () => [] }));
jest.mock('@/lib/auth/audit', () => ({ createAuditLog: async () => ({}) }));

const card = (id: string, numerator: number | null, denominator: number | null = null) => ({ id, version: 'v', window: { kind: 'day', start: '', end: '', partial: false, labelAr: 'يوم' }, numerator, denominator, unit: 'browsers', coverage: 'complete', computedAt: '', lastEventAt: null });
const money = (over: Record<string, unknown> = {}) => ({
  cashSpent: { sar: 12.5, rows: 1, unconvertedRows: 0, estimateRows: 0, undatedRows: 0 }, periodCost: { sar: 0, rows: 0, unconvertedRows: 0, estimateRows: 0, undatedRows: 0 },
  dueUnpaid: { sar: 0, rows: 0, unconvertedRows: 0, estimateRows: 0, undatedRows: 0 }, totalSinceStart: { sar: 0, rows: 0, unconvertedRows: 0, estimateRows: 0, undatedRows: 0 },
  byCategory: [], byVendor: [], byCampaign: [], byKind: [], upcoming: [], budgets: [],
  revenue: { byState: {}, orders: 0, items: 0, aggregates: 0, confirmedSar: 0, paidSar: 0, pendingSar: 77, receivableSar: 0, coverage: [], coverageCount: 0, coverageState: 'coverage_missing', currencies: ['SAR'] },
  funding: { sar: 0, unconvertedRows: 0 }, operatingResultSar: null, netCashSar: null, founderNetCashUsedSar: null, expenseRows: 38, revenueRows: 1, ...over,
});
const overview = {
  window: { kind: 'day' }, previousWindow: {}, generatedAt: '', definitionVersion: 'v',
  pack: { ok: true, pack: { observed_browsers: 35, intent_browsers: 9, last_usage_event_at: null }, computedAt: '' }, prevPack: { ok: false },
  cards: [card('S01', 3), card('S02', 3, 3), card('S03', 0), card('S04', 0, 3), card('S05', 14), card('S06', 1, 3), card('S07', null), card('S08', null)], prevCards: [],
  money: money(), moneyReason: null,
  goals: [{ goal: { id: 'g', metric_id: 'S02', target_value: 100, direction: 'gte' }, nameAr: 'تلقت نتائج غير فارغة', current: 80, status: 'behind', statusReasonAr: 'x', daysLeft: 5 }],
  scenarios: null, needs: [{ category: 'unparsed', labelAr: 'غير مصنف', searchSessions: 9 }, { category: 'air_conditioner', labelAr: 'مكيفات', searchSessions: 4 }], queries: [], products: [{ nameAr: 'مكيف إل جي', sessions: 15, blockerAr: 'خلط موديلات' }], demandReason: null,
  referrals: { ok: true, stores: [{ nameAr: 'اكسترا', linkedInteractions: 9 }], byChannel: [], totals: {} },
  quality: [{ severity: 'critical', textAr: 'تغطية تقارير الشركاء 0/2' }, { severity: 'info', textAr: 'x' }],
  headline: { resultAr: '', gapAr: '', decisionAr: 'القرار الافتراضي' },
};

jest.mock('@/lib/founder/overview', () => ({ buildOverview: jest.fn(async () => overview), buildMoneyPicture: jest.fn(async () => money({ cashSpent: { sar: 1043.15, rows: 7, unconvertedRows: 0, estimateRows: 0, undatedRows: 0 } })) }));
jest.mock('@/lib/founder/summary', () => ({
  latestSummary: jest.fn(async () => null),
  generateSummary: jest.fn(async () => ({ id: 'sum-1', kind: 'daily', aiStatus: 'rejected', ai: null, deterministic: { decisionsAr: ['استيراد تقارير أمازون ونون للفترة ومطابقتها — قبل أي حكم على الربحية.'] } })),
}));
jest.mock('@/lib/founder/finance', () => ({ ...jest.requireActual('@/lib/founder/finance'), fetchExpenses: jest.fn(async () => [{ vendor: 'Claude Max 5x', payment_status: 'expected', amount_original: 499.99, currency: 'SAR', amount_sar: 499.99, fees: 0, tax: 0, expected_for: '2026-10-03', due_at: '2026-10-03' }]) }));

const NOW = new Date('2026-09-26T05:00:30Z'); // 08:00:30 Riyadh on 26 Sep → report covers 25 Sep

describe('buildDailyEmail', () => {
  it('subject format and report date are the previous Riyadh day', async () => {
    const e = await buildDailyEmail(NOW);
    expect(e.reportDate).toBe('2026-09-25');
    expect(e.subject).toBe('ملخص توفيري اليومي — 2026-09-25');
    expect(subjectFor('2026-09-25', 'test')).toBe('[اختبار] ملخص توفيري اليومي — 2026-09-25');
  });
  it('sections appear in the mandated order and end with one decision and the founder link', async () => {
    const e = await buildDailyEmail(NOW);
    const idx = (s: string) => e.html.indexOf(s);
    expect(idx('ماذا حدث أمس')).toBeGreaterThan(0);
    expect(idx('الأداء المالي')).toBeGreaterThan(idx('ماذا حدث أمس'));
    expect(idx('أهداف الشهر')).toBeGreaterThan(idx('الأداء المالي'));
    expect(idx('جودة البيانات')).toBeGreaterThan(idx('أهداف الشهر'));
    expect(idx('قرار اليوم')).toBeGreaterThan(idx('جودة البيانات'));
    expect(idx('https://tawveeri.com/founder')).toBeGreaterThan(idx('قرار اليوم'));
    expect((e.html.match(/قرار اليوم/g) ?? []).length).toBe(1);
    expect(e.html).toContain('استيراد تقارير أمازون ونون');
  });
  it('unknown commissions are «غير معلوم», pending is labelled not-cash, browsers are not people', async () => {
    const e = await buildDailyEmail(NOW);
    expect(e.html).toContain('عمولات مقبوضة: <b>غير معلوم</b>');
    expect(e.html).toContain('77 ر.س — ليس إيرادًا مقبوضًا');
    expect(e.html).toContain('ليست أشخاصًا');
    expect(e.html).toContain('ليس زيارة متجر مؤكدة ولا شراء');
    expect(e.html).toContain('35</b> (Q01)');
    expect(e.html).toContain('3/3 = 100.0%');
  });
  it('goals carry status, numerator/denominator and the deadline; expected commitments listed; critical quality shown', async () => {
    const e = await buildDailyEmail(NOW);
    expect(e.html).toContain('متأخر');
    expect(e.html).toContain('80 / 100');
    expect(e.html).toContain('Claude Max 5x 499.99');
    expect(e.html).toContain('⚠︎ تغطية تقارير الشركاء 0/2');
    expect(e.html).not.toContain('غير مصنف'); // unparsed is never a "need"
  });
  it('a failed summary/AI still yields a deterministic email with the default decision', async () => {
    const summary = jest.requireMock('@/lib/founder/summary');
    summary.generateSummary.mockImplementationOnce(async () => { throw new Error('anthropic 402'); });
    const e = await buildDailyEmail(NOW);
    expect(e.blocksUnavailable[0]).toContain('summary');
    expect(e.html).toContain('القرار الافتراضي');
    expect(e.html).not.toContain('anthropic 402</h');
    expect(e.html).toContain('افتح مركز قرارات المؤسس');
  });
  it('schedule helper: next run is 05:00 UTC (08:00 Riyadh) of the next day when called after 08:00', () => {
    expect(SCHEDULE_LABEL).toContain('08:00 Asia/Riyadh');
    expect(nextScheduledRun(new Date('2026-09-25T13:00:00Z')).toISOString()).toBe('2026-09-26T05:00:00.000Z');
    expect(nextScheduledRun(new Date('2026-09-26T02:00:00Z')).toISOString()).toBe('2026-09-26T05:00:00.000Z');
  });
});
