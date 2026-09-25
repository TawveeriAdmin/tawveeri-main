// tests/founder/finance.test.ts — pure arithmetic of the founder management ledger.
import {
  expenseSar, cashSpent, periodCost, dueUnpaid, totalSinceStart, breakdownBy, upcomingCommitments, budgetStatus,
  revenueSummary, conversionStateToCommissionState, fundingTotal, type ExpenseRow, type RevenueRow,
} from '@/lib/founder/finance';
import { windowFor, monthWindow, riyadhMidnight } from '@/lib/founder/windows';

const base: ExpenseRow = {
  id: 'e1', vendor: 'Railway', description: null, category: 'hosting', service_period_start: '2026-09-01', service_period_end: '2026-09-30', due_at: null, paid_at: '2026-09-03',
  payment_status: 'paid', amount_original: 100, currency: 'SAR', fees: 0, tax: 0, amount_sar: null, fx_rate: null, fx_source: null, campaign: null, project: null, channel: null,
  recurrence: 'monthly', renewal_at: '2026-10-01', evidence_ref: null, evidence_path: null, evidence_state: 'documented', cost_kind: 'direct', allocation_note: null, import_id: null, row_hash: null,
  notes: null, created_by: null, created_at: '2026-09-03T00:00:00Z', updated_at: '2026-09-03T00:00:00Z', deleted_at: null, revision: 1,
};
const sept = monthWindow(riyadhMidnight('2026-09-01'));

describe('expenseSar', () => {
  it('SAR rows convert 1:1 including fees and tax', () => expect(expenseSar({ ...base, fees: 5, tax: 15 })).toBe(120));
  it('foreign currency without documented rate stays null (never guessed)', () => expect(expenseSar({ ...base, currency: 'USD' })).toBeNull());
  it('foreign currency with rate converts', () => expect(expenseSar({ ...base, currency: 'USD', fx_rate: 3.75 })).toBe(375));
  it('explicit amount_sar wins', () => expect(expenseSar({ ...base, currency: 'USD', amount_sar: 380 })).toBe(380));
});

describe('cash vs period cost', () => {
  it('annual payment is full cash in the paid month but 1/12 period cost', () => {
    const annual: ExpenseRow = { ...base, id: 'a', service_period_start: '2026-09-01', service_period_end: '2027-08-31', paid_at: '2026-09-10', amount_original: 1200, recurrence: 'yearly' };
    const cash = cashSpent([annual], sept);
    const period = periodCost([annual], sept);
    expect(cash.sar).toBe(1200);
    expect(period.sar).toBeCloseTo(1200 * (30 / 365), 1);
  });
  it('unpaid due rows are excluded from cash and counted as due', () => {
    const due: ExpenseRow = { ...base, id: 'd', payment_status: 'due', paid_at: null, due_at: '2026-09-20' };
    expect(cashSpent([due], sept).sar).toBe(0);
    expect(dueUnpaid([due], sept.end).sar).toBe(100);
  });
  it('unconverted foreign rows are counted, not silently dropped', () => {
    const usd: ExpenseRow = { ...base, id: 'u', currency: 'USD' };
    const t = cashSpent([base, usd], sept);
    expect(t.sar).toBe(100); expect(t.rows).toBe(2); expect(t.unconvertedRows).toBe(1);
  });
  it('total since start ignores due rows', () => expect(totalSinceStart([base, { ...base, id: 'x', payment_status: 'due', paid_at: null }]).sar).toBe(100));
});

describe('breakdowns, commitments, budgets', () => {
  it('breakdown by category labels in Arabic and sums period cost', () => {
    const rows = breakdownBy([base, { ...base, id: 'b', category: 'ai', amount_original: 50 }], sept, 'category');
    expect(rows[0]).toMatchObject({ key: 'hosting', labelAr: 'استضافة', sar: 100 });
    expect(rows[1]).toMatchObject({ key: 'ai', sar: 50 });
  });
  it('upcoming commitments lists renewals inside 45 days only', () => {
    const now = new Date('2026-09-25T06:00:00Z');
    expect(upcomingCommitments([base, { ...base, id: 'far', renewal_at: '2027-01-01' }], now).map((u) => u.id)).toEqual(['e1']);
  });
  it('budget over-pace flag uses the elapsed month fraction', () => {
    const s = budgetStatus([{ id: 'b', category: 'tools', monthly_amount_sar: 1300, effective_from: '2026-09-01', note: null, deleted_at: null }], [{ key: 'tools', labelAr: 'أدوات', sar: 700, rows: 1, unconvertedRows: 0 }], 0.5);
    expect(s[0].over).toBe(true);
    expect(s[0].ratio).toBeCloseTo(700 / 1300);
  });
});

describe('revenueSummary', () => {
  const w = windowFor('custom', new Date('2026-09-25T06:00:00Z'), { start: '2026-09-01', end: '2026-09-24' });
  const entry = (over: Partial<RevenueRow>): RevenueRow => ({
    id: 'r', source: 'amazon_associates', account_ref: null, report_ref: 'Sep report', partner_txn_id: null, period_start: '2026-09-01', period_end: '2026-09-20', occurred_at: null, approved_at: '2026-09-21', paid_at: null,
    unit: 'aggregate', quantity: 1, sales_amount: null, commission_amount: 40, currency: 'SAR', amount_sar: null, fx_rate: null, fx_source: null, state: 'confirmed', matched_report_id: null, matched_conversion_id: null,
    evidence_ref: null, evidence_path: null, notes: null, created_at: '', updated_at: '', deleted_at: null, revision: 1, ...over,
  });
  it('no entries and no reports → coverage_missing, never zero revenue', () => {
    const s = revenueSummary([], [], [], w);
    expect(s.coverageState).toBe('coverage_missing'); expect(s.coverageCount).toBe(0); expect(s.confirmedSar).toBe(0);
  });
  it('a confirmed amazon entry covers amazon only (1/2) and counts as confirmed, not paid', () => {
    const s = revenueSummary([entry({})], [], [], w);
    expect(s.coverageState).toBe('partial'); expect(s.coverageCount).toBe(1);
    expect(s.confirmedSar).toBe(40); expect(s.paidSar).toBe(0); expect(s.receivableSar).toBe(40);
  });
  it('declared entries do not create coverage', () => {
    expect(revenueSummary([entry({ state: 'declared', approved_at: null })], [], [], w).coverageCount).toBe(0);
  });
  it('a paid entry counts cash only when paid inside the window', () => {
    expect(revenueSummary([entry({ state: 'paid', paid_at: '2026-09-22' })], [], [], w).paidSar).toBe(40);
    expect(revenueSummary([entry({ state: 'paid', paid_at: '2026-10-05' })], [], [], w).paidSar).toBe(0);
  });
  it('imported conversions map partner states and are not double counted when matched', () => {
    const conv = { id: 'c1', report_id: 'rep', source: 'amazon_associates', order_date: '2026-09-10', ship_date: null, quantity: 2, price: 500, commission_amount: 15, currency: 'SAR', state: 'COMMISSION_CONFIRMED', match_tier: 'EXACT' };
    const reports = [{ id: 'rep', source: 'amazon_associates', report_period_start: '2026-09-01', report_period_end: '2026-09-15', created_at: '', imported_rows: 1 }];
    const s = revenueSummary([], [conv], reports, w);
    expect(s.confirmedSar).toBe(15); expect(s.items).toBe(2); expect(s.coverageCount).toBe(1);
    const matched = revenueSummary([entry({ matched_conversion_id: 'c1', commission_amount: 15 })], [conv], reports, w);
    expect(matched.confirmedSar).toBe(15);
  });
  it('conversion state mapping', () => {
    expect(conversionStateToCommissionState('PAID')).toBe('paid');
    expect(conversionStateToCommissionState('RETURNED')).toBe('cancelled');
    expect(conversionStateToCommissionState('ORDERED')).toBe('pending');
  });
});

describe('fundingTotal', () => {
  it('sums SAR and counts unconverted', () => {
    expect(fundingTotal([{ id: '1', amount: 1000, currency: 'SAR', amount_sar: null, funded_at: '2026-01-01', note: null, evidence_ref: null, deleted_at: null }, { id: '2', amount: 100, currency: 'USD', amount_sar: null, funded_at: '2026-01-01', note: null, evidence_ref: null, deleted_at: null }])).toEqual({ sar: 1000, unconvertedRows: 1 });
  });
});
