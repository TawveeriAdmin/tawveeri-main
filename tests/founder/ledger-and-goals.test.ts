// tests/founder/ledger-and-goals.test.ts — validation contracts (never invent a date/rate) and goal status logic.
import { normalizeExpense, normalizeRevenue, normalizeGoal, LedgerValidationError } from '@/lib/founder/ledger';
import { evaluateGoal, buildScenarios, type GoalRow } from '@/lib/founder/goals';

jest.mock('@/lib/database', () => ({ createServerClient: () => ({ from: () => ({}) }), fetchAllPaginated: async () => [] }));
jest.mock('@/lib/auth/audit', () => ({ createAuditLog: async () => ({}) }));

const errorsOf = (fn: () => unknown): Record<string, string> => { try { fn(); return {}; } catch (e) { if (e instanceof LedgerValidationError) return e.fieldErrors; throw e; } };

describe('normalizeExpense', () => {
  it('requires vendor, category, start date, amount, paid date for paid rows', () => {
    const errs = errorsOf(() => normalizeExpense({ vendor: '', category: 'nope', service_period_start: 'bad', amount_original: 'x' }));
    expect(Object.keys(errs).sort()).toEqual(['amount_original', 'category', 'paid_at', 'service_period_start', 'vendor']);
  });
  it('SAR row gets amount_sar = amount + fees + tax', () => {
    const r = normalizeExpense({ vendor: 'X', category: 'tools', service_period_start: '2026-09-01', amount_original: 100, fees: 2, tax: 15, paid_at: '2026-09-01' });
    expect(r.amount_sar).toBe(117); expect(r.service_period_end).toBe('2026-09-01'); expect(r.fx_rate).toBeNull();
  });
  it('foreign currency: fx_rate without fx_source is rejected; without any rate stays unconverted', () => {
    expect(errorsOf(() => normalizeExpense({ vendor: 'X', category: 'ai', service_period_start: '2026-09-01', amount_original: 10, currency: 'usd', fx_rate: 3.75, paid_at: '2026-09-01' })).fx_source).toBeTruthy();
    const r = normalizeExpense({ vendor: 'X', category: 'ai', service_period_start: '2026-09-01', amount_original: 10, currency: 'usd', paid_at: '2026-09-01' });
    expect(r.amount_sar).toBeNull(); expect(r.currency).toBe('USD');
  });
  it('period end before start is rejected', () => {
    expect(errorsOf(() => normalizeExpense({ vendor: 'X', category: 'tools', service_period_start: '2026-09-10', service_period_end: '2026-09-01', amount_original: 1, paid_at: '2026-09-01' })).service_period_end).toBeTruthy();
  });
});

describe('normalizeRevenue', () => {
  it('paid needs paid_at, confirmed needs approved_at, non-declared needs evidence', () => {
    expect(errorsOf(() => normalizeRevenue({ source: 'amazon_associates', commission_amount: 10, state: 'paid', period_start: '2026-09-01' })).paid_at).toBeTruthy();
    expect(errorsOf(() => normalizeRevenue({ source: 'amazon_associates', commission_amount: 10, state: 'confirmed', period_start: '2026-09-01' })).approved_at).toBeTruthy();
    expect(errorsOf(() => normalizeRevenue({ source: 'amazon_associates', commission_amount: 10, state: 'matched', period_start: '2026-09-01' })).evidence_ref).toBeTruthy();
  });
  it('declared entry with a period is accepted and negative adjustments are allowed', () => {
    const r = normalizeRevenue({ source: 'noon_affiliate', commission_amount: -5, period_start: '2026-09-01', period_end: '2026-09-30' });
    expect(r.state).toBe('declared'); expect(r.amount_sar).toBe(-5);
  });
});

describe('normalizeGoal + evaluateGoal', () => {
  it('requires month (first day), metric, target, rationale', () => {
    expect(Object.keys(errorsOf(() => normalizeGoal({ month: '2026-09-15', metric_id: '', definition_version: 'v', target_value: 'x' }))).sort()).toEqual(['metric_id', 'month', 'rationale', 'target_value']);
  });
  const goal: GoalRow = { id: 'g', month: '2026-09-01', metric_id: 'S02', definition_version: '2026-09-25.1', baseline_value: 80, baseline_window_start: null, baseline_window_end: null, target_value: 100, direction: 'gte', rationale: 'x', owner: 'f', proposed_action: null, created_at: '', updated_at: '', archived_at: null };
  const mid = new Date('2026-09-15T21:00:00Z'); // 16 Sep 00:00 Riyadh → exactly half the month elapsed
  it('achieved when current ≥ target', () => expect(evaluateGoal(goal, 120, true, null, mid, '2026-09-25.1').status).toBe('achieved'));
  it('on track when current ≥ 90% of expected pace', () => expect(evaluateGoal(goal, 46, true, null, mid, '2026-09-25.1').status).toBe('on_track'));
  it('behind when below pace', () => expect(evaluateGoal(goal, 20, true, null, mid, '2026-09-25.1').status).toBe('behind'));
  it('not judgeable when value missing, coverage missing, or definition changed', () => {
    expect(evaluateGoal(goal, null, true, 'x', mid, '2026-09-25.1').status).toBe('not_judgeable');
    expect(evaluateGoal(goal, 50, false, 'no coverage', mid, '2026-09-25.1').status).toBe('not_judgeable');
    expect(evaluateGoal(goal, 50, true, null, mid, '2026-10-01.1').status).toBe('not_judgeable');
  });
});

describe('buildScenarios', () => {
  it('refuses to forecast without commission per exit', () => {
    const s = buildScenarios({}, { linkedExits30d: 118, periodCostLast30dSar: 1300, founderNetCashUsedSar: 5000 });
    expect(s.ready).toBe(false); expect(s.missingInputsAr.length).toBe(1); expect(s.results).toEqual([]);
  });
  it('computes breakeven and payback with all inputs', () => {
    const s = buildScenarios({ commission_per_linked_exit_sar: { value: 5, source: 'assumption' }, growth_base: 0.1 }, { linkedExits30d: 100, periodCostLast30dSar: 1000, founderNetCashUsedSar: 2000 });
    expect(s.ready).toBe(true); expect(s.breakevenMonthlyExitsNeeded).toBe(200);
    const base = s.results.find((r) => r.name === 'base')!;
    expect(base.monthsToOperatingBreakeven).toBeGreaterThan(1);
    const cons = s.results.find((r) => r.name === 'conservative')!;
    expect(cons.monthsToOperatingBreakeven).toBeNull();
  });
});
