// tests/founder/summary-and-metrics.test.ts — the AI-explanation gate (numbers not in the fact
// pack reject the whole response), pack→metric mapping, windows, CSV import parsing.
import { validateAiExplanation, type DeterministicSummary } from '@/lib/founder/summary';
import { metricFromPack, ratioText, deltaText, type PackResult } from '@/lib/founder/metrics';
import { windowFor, previousEqualWindow, monthWindow, riyadhMidnight } from '@/lib/founder/windows';
import { prepareExpenseRows, guessExpenseMapping } from '@/lib/founder/csv-import';

jest.mock('@/lib/database', () => ({ createServerClient: () => ({ from: () => ({}), rpc: async () => ({ data: null, error: null }) }), fetchAllPaginated: async () => [] }));
jest.mock('@/lib/auth/audit', () => ({ createAuditLog: async () => ({}) }));

const det: DeterministicSummary = {
  titleAr: 't', windowLabelAr: 'w', partial: false, cutoffAr: 'c', whatHappenedAr: [], changedAr: [], topNeedsAr: [], servingWellAr: [], blockersAr: [], moneyAr: [], decisionsAr: [], unknownsAr: [],
  facts: [{ metricId: 'S01', windowLabelAr: 'w', numerator: 53, denominator: null, previous: 15, textAr: '', coverage: 'complete' }, { metricId: 'S02', windowLabelAr: 'w', numerator: 45, denominator: 53, previous: 13, textAr: '', coverage: 'complete' }],
  allowedNumbers: [53, 15, 45, 13, 84.9, 30],
};

describe('validateAiExplanation', () => {
  it('accepts explanations that only reuse pack numbers', () => {
    const r = validateAiExplanation({ facts_used: ['S01'], possible_explanations: ['ارتفع الباحثون من 15 إلى 53 ربما بسبب تغير القنوات.'], unknowns: ['لا نعرف الأشخاص'], one_experiment: { title_ar: 'اختبار مكيف', proposed_target: '5', measure_ar: 'إكمال المهمة' } }, det);
    expect(r.ok).toBe(true);
  });
  it('rejects a number that is not in the fact pack (even in Arabic digits)', () => {
    const r = validateAiExplanation({ facts_used: ['S01'], possible_explanations: ['نتوقع ٢٠٠ طلب'], unknowns: [] }, det);
    expect(r.ok).toBe(false);
  });
  it('rejects unknown metric ids, empty explanations, and out-of-range experiment sizes', () => {
    expect(validateAiExplanation({ facts_used: ['ZZ9'], possible_explanations: ['x'], unknowns: [] }, det).ok).toBe(false);
    expect(validateAiExplanation({ facts_used: ['S01'], possible_explanations: [], unknowns: [] }, det).ok).toBe(false);
    expect(validateAiExplanation({ facts_used: ['S01'], possible_explanations: ['x'], unknowns: [], one_experiment: { title_ar: 'a', proposed_target: '50', measure_ar: 'b' } }, det).ok).toBe(false);
  });
  it('rejects malformed input', () => { expect(validateAiExplanation('nope', det).ok).toBe(false); expect(validateAiExplanation(null, det).ok).toBe(false); });
});

describe('metricFromPack', () => {
  const w = windowFor('custom', new Date('2026-09-25T06:00:00Z'), { start: '2026-09-01', end: '2026-09-24' });
  const pack = { search_sessions: 91, positive_result_sessions: 80, linked_interactions: 204, last_usage_event_at: '2026-09-25T02:46:08Z', last_outbound_at: '2026-09-25T03:00:05Z', last_interaction_at: null } as any;
  const ok: PackResult = { ok: true, pack, computedAt: '2026-09-25T06:00:00Z' };
  it('maps numerator/denominator from the pack keys', () => {
    const m = metricFromPack('S02', ok, w);
    expect(m.numerator).toBe(80); expect(m.denominator).toBe(91); expect(m.coverage).toBe('complete'); expect(m.unit).toBe('browsers');
  });
  it('a failed pack is UNAVAILABLE with a reason, never 0', () => {
    const m = metricFromPack('S01', { ok: false, reason: 'timeout', computedAt: 'x' }, w);
    expect(m.numerator).toBeNull(); expect(m.coverage).toBe('unavailable'); expect(m.reason).toBe('timeout');
  });
  it('ratio and delta helpers never divide by zero or produce infinite growth', () => {
    expect(ratioText(3, 0)).toContain('لا توجد عينة');
    expect(deltaText(5, 0)?.pctText).toBe('من صفر');
    expect(deltaText(53, 15)?.absolute).toBe(38);
    expect(deltaText(null, 1)).toBeNull();
  });
});

describe('windows', () => {
  const now = new Date('2026-09-25T06:00:00Z');
  it('previous completed Riyadh day is [24 Sep 00:00, 25 Sep 00:00) Riyadh', () => {
    const w = windowFor('day', now);
    expect(w.start.toISOString()).toBe('2026-09-23T21:00:00.000Z'); expect(w.end.toISOString()).toBe('2026-09-24T21:00:00.000Z'); expect(w.partial).toBe(false);
  });
  it('custom window includes the whole last day and previous equal window abuts it', () => {
    const w = windowFor('custom', now, { start: '2026-09-18', end: '2026-09-24' });
    expect(w.end.toISOString()).toBe('2026-09-24T21:00:00.000Z');
    const p = previousEqualWindow(w);
    expect(p.end.getTime()).toBe(w.start.getTime()); expect(p.end.getTime() - p.start.getTime()).toBe(w.end.getTime() - w.start.getTime());
  });
  it('month window is a completed Riyadh month', () => {
    const m = monthWindow(riyadhMidnight('2026-09-01'));
    expect(m.end.toISOString()).toBe('2026-09-30T21:00:00.000Z');
  });
});

describe('expense CSV import', () => {
  const csv = 'المورد,الوصف,الفئة,تاريخ الدفع,المبلغ,العملة\nRailway,استضافة الشهر,استضافة,03/09/2026,"1,234.50",SAR\nAnthropic,API,ai,2026-09-05,20,USD\nBad,,unknowncat,2026-09-05,abc,SAR\nRailway,استضافة الشهر,استضافة,03/09/2026,"1,234.50",SAR';
  it('guesses Arabic headers, parses DD/MM/YYYY, hashes rows for duplicate detection', () => {
    const mapping = guessExpenseMapping(['المورد', 'الوصف', 'الفئة', 'تاريخ الدفع', 'المبلغ', 'العملة']);
    expect(mapping.vendor).toBe('المورد'); expect(mapping.paid_at).toBe('تاريخ الدفع');
    const { results } = prepareExpenseRows(csv, mapping, 'imp');
    expect(results[0].ok).toBe(true); expect(results[0].input?.paid_at).toBe('2026-09-03'); expect(results[0].input?.amount_original).toBe(1234.5); expect(results[0].input?.category).toBe('hosting');
    expect(results[1].ok).toBe(true); expect(results[1].input?.amount_sar).toBeNull(); // USD, no rate → unconverted, still imported
    expect(results[2].ok).toBe(false);
    expect(results[3].rowHash).toBe(results[0].rowHash); // exact duplicate row → same hash → skipped by the route
  });
});
