import { addCadence, buildExpenseReport, classify, normalizeSubscription, type SubscriptionRow } from '@/lib/founder/subscriptions';
import { LedgerValidationError } from '@/lib/founder/ledger';
import { periodCost, cashSpent, type ExpenseRow } from '@/lib/founder/finance';
import { windowFor, monthWindow, riyadhMidnight } from '@/lib/founder/windows';

jest.mock('@/lib/database', () => ({ createServerClient: () => ({ from: () => ({}) }), fetchAllPaginated: async () => [] }));
jest.mock('@/lib/auth/audit', () => ({ createAuditLog: async () => ({}) }));

const exp = (over: Partial<ExpenseRow>): ExpenseRow => ({
  id: 'x', vendor: 'V', description: null, category: 'ai', service_period_start: '2026-10-03', service_period_end: '2026-11-02', due_at: null, paid_at: '2026-10-03',
  payment_status: 'paid', amount_original: 499.99, currency: 'SAR', fees: 0, tax: 0, amount_sar: 499.99, fx_rate: null, fx_source: null, campaign: null, project: null, channel: null,
  recurrence: 'monthly', renewal_at: null, evidence_ref: null, evidence_path: null, evidence_state: 'documented', cost_kind: 'direct', allocation_note: null, import_id: null, row_hash: null,
  notes: null, created_by: null, created_at: '', updated_at: '', deleted_at: null, revision: 1, ...over,
});
const sub = (over: Partial<SubscriptionRow>): SubscriptionRow => ({ id: 's', vendor: 'Claude Max 5x', description: null, category: 'ai', kind: 'fixed', status: 'active', cadence: 'monthly', amount_original: 499.99, currency: 'SAR', amount_sar: 499.99, budget_source: null, next_renewal_at: '2026-10-03', last_confirmed_at: null, notes: null, created_at: '', updated_at: '', archived_at: null, ...over });

describe('addCadence', () => {
  it('monthly clamps to month end', () => { expect(addCadence('2026-01-31', 'monthly')).toBe('2026-02-28'); expect(addCadence('2026-10-03', 'monthly')).toBe('2026-11-03'); });
  it('yearly', () => expect(addCadence('2026-02-28', 'yearly')).toBe('2027-02-28'));
});

describe('classify', () => {
  it('maps categories to the four founder classifications', () => {
    expect(classify('hosting')).toBe('infrastructure'); expect(classify('data_extraction')).toBe('infrastructure'); expect(classify('other')).toBe('infrastructure');
    expect(classify('ai')).toBe('ai'); expect(classify('advertising')).toBe('marketing'); expect(classify('tools')).toBe('marketing'); expect(classify('contractor')).toBe('external_dev');
  });
});

describe('normalizeSubscription', () => {
  it('fixed active needs amount and next renewal; variable needs budget + source', () => {
    const e1 = (() => { try { normalizeSubscription({ vendor: 'X', category: 'ai', kind: 'fixed' }); return {}; } catch (e) { return (e as LedgerValidationError).fieldErrors; } })();
    expect(Object.keys(e1).sort()).toEqual(['amount_sar', 'next_renewal_at']);
    const e2 = (() => { try { normalizeSubscription({ vendor: 'Railway', category: 'hosting', kind: 'variable_budget', amount_sar: 100 }); return {}; } catch (e) { return (e as LedgerValidationError).fieldErrors; } })();
    expect(Object.keys(e2)).toEqual(['budget_source']);
  });
});

describe('expected drafts never count as spend', () => {
  const oct = monthWindow(riyadhMidnight('2026-10-01'));
  const draft = exp({ id: 'd', payment_status: 'expected', paid_at: null, due_at: '2026-10-03', subscription_id: 's', expected_for: '2026-10-03' });
  it('excluded from cash and period cost', () => { expect(cashSpent([draft], oct).sar).toBe(0); expect(periodCost([draft], oct).sar).toBe(0); });
  it('report shows it as expected, the paid one as actual, and the budget from the subscription', () => {
    const r = buildExpenseReport([draft, exp({ id: 'p' })], [sub({}), sub({ id: 'v', vendor: 'Railway', category: 'hosting', kind: 'variable_budget', amount_sar: 300, budget_source: 'avg' })], oct);
    const ai = r.lines.find((l) => l.classification === 'ai')!;
    expect(ai.actualSar).toBe(499.99); expect(ai.expectedSar).toBe(499.99); expect(ai.budgetSar).toBeCloseTo(499.99 * (31 / 30.4375), 1);
    const infra = r.lines.find((l) => l.classification === 'infrastructure')!;
    expect(infra.actualSar).toBe(0); expect(infra.budgetSar).toBeCloseTo(300 * (31 / 30.4375), 1);
    expect(r.total.actualSar).toBe(499.99);
  });
  it('all-time report has no budget line and counts undated paid rows', () => {
    const r = buildExpenseReport([exp({ id: 'u', paid_at: null, service_period_start: null, service_period_end: null, date_precision: 'needs_review', category: 'contractor', amount_original: 4000, amount_sar: 4000 })], [sub({})], windowFor('30d'), true);
    const ext = r.lines.find((l) => l.classification === 'external_dev')!;
    expect(ext.actualSar).toBe(4000); expect(ext.undatedActualRows).toBe(1); expect(r.total.budgetSar).toBe(0);
  });
});
