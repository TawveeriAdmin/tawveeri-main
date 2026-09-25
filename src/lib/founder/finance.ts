// src/lib/founder/finance.ts — the founder management ledger: expenses (cash vs. period cost),
// revenue/commission entries, founder funding, budgets. Pure functions over rows so every number
// is unit-testable; fetchers are thin and paginated. Amounts in SAR only when a documented
// conversion exists — unconverted rows are COUNTED and shown, never silently dropped or guessed.
import { createServerClient, fetchAllPaginated } from '@/lib/database';
import { EXPENSE_CATEGORY_AR, PARTNER_SOURCES, type ExpenseCategory } from './registry';
import { daysBetween, riyadhDateString, type MetricWindow } from './windows';

type AnyClient = { from: (table: string) => any };

export interface ExpenseRow {
  id: string; vendor: string; description: string | null; category: ExpenseCategory;
  service_period_start: string; service_period_end: string; due_at: string | null; paid_at: string | null;
  payment_status: 'paid' | 'due'; amount_original: number; currency: string; fees: number; tax: number;
  amount_sar: number | null; fx_rate: number | null; fx_source: string | null;
  campaign: string | null; project: string | null; channel: string | null;
  recurrence: 'one_time' | 'monthly' | 'yearly' | 'other'; renewal_at: string | null;
  evidence_ref: string | null; evidence_path: string | null; evidence_state: 'documented' | 'estimate';
  cost_kind: 'direct' | 'shared'; allocation_note: string | null; import_id: string | null; row_hash: string | null;
  notes: string | null; created_by: string | null; created_at: string; updated_at: string; deleted_at: string | null; revision: number;
}

export interface RevenueRow {
  id: string; source: string; account_ref: string | null; report_ref: string | null; partner_txn_id: string | null;
  period_start: string | null; period_end: string | null; occurred_at: string | null; approved_at: string | null; paid_at: string | null;
  unit: 'order' | 'item' | 'aggregate'; quantity: number | null; sales_amount: number | null; commission_amount: number;
  currency: string; amount_sar: number | null; fx_rate: number | null; fx_source: string | null;
  state: 'declared' | 'matched' | 'pending' | 'confirmed' | 'paid' | 'cancelled';
  matched_report_id: string | null; matched_conversion_id: string | null; evidence_ref: string | null; evidence_path: string | null;
  notes: string | null; created_at: string; updated_at: string; deleted_at: string | null; revision: number;
}

export interface FundingRow { id: string; amount: number; currency: string; amount_sar: number | null; funded_at: string; note: string | null; evidence_ref: string | null; deleted_at: string | null }
export interface BudgetRow { id: string; category: string; monthly_amount_sar: number; effective_from: string; note: string | null; deleted_at: string | null }
export interface AffiliateReportRow { id: string; source: string; report_period_start: string | null; report_period_end: string | null; created_at: string; imported_rows: number }
export interface AffiliateConversionRow { id: string; report_id: string; source: string; order_date: string | null; ship_date: string | null; quantity: number | null; price: number | null; commission_amount: number | null; currency: string | null; state: string; match_tier: string }

const num = (v: unknown): number => (typeof v === 'number' ? v : v == null ? 0 : Number(v) || 0);

export async function fetchExpenses(): Promise<ExpenseRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const rows = await fetchAllPaginated<ExpenseRow>((from, to) =>
    supabase.from('founder_expenses').select('*').is('deleted_at', null).order('service_period_start', { ascending: false }).order('id', { ascending: true }).range(from, to));
  return rows.map((r) => ({ ...r, amount_original: num(r.amount_original), fees: num(r.fees), tax: num(r.tax), amount_sar: r.amount_sar == null ? null : num(r.amount_sar) }));
}

export async function fetchRevenueEntries(): Promise<RevenueRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const rows = await fetchAllPaginated<RevenueRow>((from, to) =>
    supabase.from('founder_revenue_entries').select('*').is('deleted_at', null).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to));
  return rows.map((r) => ({ ...r, commission_amount: num(r.commission_amount), sales_amount: r.sales_amount == null ? null : num(r.sales_amount), amount_sar: r.amount_sar == null ? null : num(r.amount_sar) }));
}

export async function fetchFunding(): Promise<FundingRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_funding').select('*').is('deleted_at', null).order('funded_at', { ascending: false });
  return ((data ?? []) as FundingRow[]).map((r) => ({ ...r, amount: num(r.amount), amount_sar: r.amount_sar == null ? null : num(r.amount_sar) }));
}

export async function fetchBudgets(): Promise<BudgetRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_budgets').select('*').is('deleted_at', null).order('effective_from', { ascending: false });
  return ((data ?? []) as BudgetRow[]).map((r) => ({ ...r, monthly_amount_sar: num(r.monthly_amount_sar) }));
}

export async function fetchAffiliateReports(): Promise<AffiliateReportRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('affiliate_reports').select('id, source, report_period_start, report_period_end, created_at, imported_rows').order('created_at', { ascending: false }).limit(200);
  return (data ?? []) as AffiliateReportRow[];
}

export async function fetchAffiliateConversions(): Promise<AffiliateConversionRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const rows = await fetchAllPaginated<AffiliateConversionRow>((from, to) =>
    supabase.from('affiliate_conversions').select('id, report_id, source, order_date, ship_date, quantity, price, commission_amount, currency, state, match_tier').order('id', { ascending: true }).range(from, to));
  return rows.map((r) => ({ ...r, commission_amount: r.commission_amount == null ? null : num(r.commission_amount), price: r.price == null ? null : num(r.price) }));
}

// ── Expense arithmetic ─────────────────────────────────────────────────────

export function expenseTotalOriginal(e: Pick<ExpenseRow, 'amount_original' | 'fees' | 'tax'>): number {
  return num(e.amount_original) + num(e.fees) + num(e.tax);
}

/** SAR value of a row, or null when no documented conversion exists. SAR rows convert 1:1. */
export function expenseSar(e: Pick<ExpenseRow, 'amount_original' | 'fees' | 'tax' | 'currency' | 'amount_sar' | 'fx_rate'>): number | null {
  if (e.amount_sar != null) return num(e.amount_sar);
  if ((e.currency || 'SAR').toUpperCase() === 'SAR') return expenseTotalOriginal(e);
  if (e.fx_rate != null && num(e.fx_rate) > 0) return Math.round(expenseTotalOriginal(e) * num(e.fx_rate) * 100) / 100;
  return null;
}

const dateInWindow = (d: string | null, w: MetricWindow) => !!d && new Date(`${d}T00:00:00+03:00`).getTime() >= w.start.getTime() && new Date(`${d}T00:00:00+03:00`).getTime() < w.end.getTime();

export interface SarTotal { sar: number; rows: number; unconvertedRows: number; estimateRows: number }
const emptyTotal = (): SarTotal => ({ sar: 0, rows: 0, unconvertedRows: 0, estimateRows: 0 });
const addTo = (t: SarTotal, e: ExpenseRow, sar: number | null, factor = 1) => {
  t.rows += 1;
  if (e.evidence_state === 'estimate') t.estimateRows += 1;
  if (sar == null) t.unconvertedRows += 1; else t.sar += sar * factor;
};

/** F01 — cash paid inside the window (paid_at). */
export function cashSpent(rows: ExpenseRow[], w: MetricWindow): SarTotal {
  const t = emptyTotal();
  for (const e of rows) if (e.payment_status === 'paid' && dateInWindow(e.paid_at, w)) addTo(t, e, expenseSar(e));
  t.sar = round2(t.sar);
  return t;
}

/** F02 — period cost: each row pro-rated by the day-overlap of its service period with the window. */
export function periodCost(rows: ExpenseRow[], w: MetricWindow): SarTotal {
  const t = emptyTotal();
  for (const e of rows) {
    const ps = new Date(`${e.service_period_start}T00:00:00+03:00`);
    const pe = new Date(new Date(`${e.service_period_end}T00:00:00+03:00`).getTime() + 86_400_000); // inclusive end date
    const overlapStart = Math.max(ps.getTime(), w.start.getTime());
    const overlapEnd = Math.min(pe.getTime(), w.end.getTime());
    if (overlapEnd <= overlapStart) continue;
    const periodDays = Math.max(1, daysBetween(ps, pe));
    const factor = daysBetween(new Date(overlapStart), new Date(overlapEnd)) / periodDays;
    addTo(t, e, expenseSar(e), factor);
  }
  t.sar = round2(t.sar);
  return t;
}

/** F03 — due and unpaid as of the window end. */
export function dueUnpaid(rows: ExpenseRow[], asOf: Date): SarTotal {
  const t = emptyTotal();
  for (const e of rows) if (e.payment_status === 'due' && (!e.due_at || new Date(`${e.due_at}T00:00:00+03:00`).getTime() < asOf.getTime() + 86_400_000 * 45)) addTo(t, e, expenseSar(e));
  t.sar = round2(t.sar);
  return t;
}

/** F04 — everything ever paid. */
export function totalSinceStart(rows: ExpenseRow[]): SarTotal {
  const t = emptyTotal();
  for (const e of rows) if (e.payment_status === 'paid') addTo(t, e, expenseSar(e));
  t.sar = round2(t.sar);
  return t;
}

export interface Breakdown { key: string; labelAr: string; sar: number; rows: number; unconvertedRows: number }

export function breakdownBy(rows: ExpenseRow[], w: MetricWindow, key: 'category' | 'vendor' | 'campaign' | 'cost_kind', mode: 'cash' | 'period' = 'period'): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const e of rows) {
    let factor = 0;
    if (mode === 'cash') factor = e.payment_status === 'paid' && dateInWindow(e.paid_at, w) ? 1 : 0;
    else {
      const ps = new Date(`${e.service_period_start}T00:00:00+03:00`).getTime();
      const pe = new Date(`${e.service_period_end}T00:00:00+03:00`).getTime() + 86_400_000;
      const os = Math.max(ps, w.start.getTime()), oe = Math.min(pe, w.end.getTime());
      factor = oe > os ? (oe - os) / Math.max(86_400_000, pe - ps) : 0;
    }
    if (factor <= 0) continue;
    const k = (e[key] as string | null) || (key === 'campaign' ? 'بلا حملة' : 'other');
    const labelAr = key === 'category' ? (EXPENSE_CATEGORY_AR[k as ExpenseCategory] ?? k) : key === 'cost_kind' ? (k === 'shared' ? 'مشترك' : 'مباشر') : k;
    const b = map.get(k) ?? { key: k, labelAr, sar: 0, rows: 0, unconvertedRows: 0 };
    const sar = expenseSar(e);
    b.rows += 1;
    if (sar == null) b.unconvertedRows += 1; else b.sar = round2(b.sar + sar * factor);
    map.set(k, b);
  }
  return [...map.values()].sort((a, b) => b.sar - a.sar);
}

export interface UpcomingCommitment { id: string; vendor: string; renewalAt: string; sar: number | null; recurrence: string }
export function upcomingCommitments(rows: ExpenseRow[], now = new Date(), horizonDays = 45): UpcomingCommitment[] {
  const today = riyadhDateString(now);
  const horizon = riyadhDateString(new Date(now.getTime() + horizonDays * 86_400_000));
  return rows
    .filter((e) => e.recurrence !== 'one_time' && e.renewal_at && e.renewal_at >= today && e.renewal_at <= horizon)
    .map((e) => ({ id: e.id, vendor: e.vendor, renewalAt: e.renewal_at as string, sar: expenseSar(e), recurrence: e.recurrence }))
    .sort((a, b) => a.renewalAt.localeCompare(b.renewalAt));
}

export interface BudgetStatus { category: string; labelAr: string; budgetSar: number; spentSar: number; ratio: number | null; over: boolean; note: string | null }
export function budgetStatus(budgets: BudgetRow[], byCategory: Breakdown[], monthFraction: number): BudgetStatus[] {
  const latest = new Map<string, BudgetRow>();
  for (const b of budgets) if (!latest.has(b.category)) latest.set(b.category, b);
  return [...latest.values()].map((b) => {
    const spent = b.category === 'total' ? byCategory.reduce((s, x) => s + x.sar, 0) : (byCategory.find((x) => x.key === b.category)?.sar ?? 0);
    const budgetToDate = b.monthly_amount_sar * Math.min(1, Math.max(monthFraction, 0));
    return {
      category: b.category,
      labelAr: b.category === 'total' ? 'الإجمالي' : (EXPENSE_CATEGORY_AR[b.category as ExpenseCategory] ?? b.category),
      budgetSar: b.monthly_amount_sar, spentSar: round2(spent),
      ratio: b.monthly_amount_sar > 0 ? spent / b.monthly_amount_sar : null,
      over: budgetToDate > 0 && spent > budgetToDate,
      note: b.note,
    };
  });
}

// ── Revenue arithmetic ─────────────────────────────────────────────────────

export function revenueSar(r: Pick<RevenueRow, 'commission_amount' | 'currency' | 'amount_sar' | 'fx_rate'>): number | null {
  if (r.amount_sar != null) return num(r.amount_sar);
  if ((r.currency || 'SAR').toUpperCase() === 'SAR') return num(r.commission_amount);
  if (r.fx_rate != null && num(r.fx_rate) > 0) return Math.round(num(r.commission_amount) * num(r.fx_rate) * 100) / 100;
  return null;
}

export type CommissionState = 'declared' | 'matched' | 'pending' | 'confirmed' | 'paid' | 'cancelled';
export const COMMISSION_STATE_AR: Record<CommissionState, string> = {
  declared: 'صرّح به المؤسس، غير مطابق', matched: 'مطابق لوثيقة شريك', pending: 'عمولة معلقة', confirmed: 'معتمدة بعد التعديلات', paid: 'مقبوضة نقدًا', cancelled: 'ملغاة/معدلة',
};

export function conversionStateToCommissionState(state: string): CommissionState {
  const s = (state || '').toUpperCase();
  if (s === 'PAID') return 'paid';
  if (s === 'COMMISSION_CONFIRMED') return 'confirmed';
  if (s === 'CANCELLED' || s === 'RETURNED') return 'cancelled';
  if (s === 'COMMISSION_PENDING' || s === 'ORDERED' || s === 'SHIPPED') return 'pending';
  return 'matched';
}

export interface PartnerCoverage { source: string; covered: boolean; reports: number; entries: number; detailAr: string }

export interface RevenueSummary {
  byState: Record<CommissionState, { sar: number; rows: number; unconverted: number; units: number }>;
  orders: number; items: number; aggregates: number;
  confirmedSar: number; paidSar: number; pendingSar: number; receivableSar: number;
  coverage: PartnerCoverage[]; coverageCount: number; coverageState: 'complete' | 'partial' | 'coverage_missing';
  currencies: string[];
}

const overlaps = (start: string | null, end: string | null, w: MetricWindow) => {
  if (!start && !end) return false;
  const s = start ? new Date(`${start}T00:00:00+03:00`).getTime() : -Infinity;
  const e = end ? new Date(`${end}T00:00:00+03:00`).getTime() + 86_400_000 : Infinity;
  return s < w.end.getTime() && e > w.start.getTime();
};

export function revenueSummary(entries: RevenueRow[], conversions: AffiliateConversionRow[], reports: AffiliateReportRow[], w: MetricWindow): RevenueSummary {
  const byState = Object.fromEntries((Object.keys(COMMISSION_STATE_AR) as CommissionState[]).map((k) => [k, { sar: 0, rows: 0, unconverted: 0, units: 0 }])) as RevenueSummary['byState'];
  let orders = 0, items = 0, aggregates = 0, confirmedSar = 0, paidSar = 0, pendingSar = 0, receivableSar = 0;
  const currencies = new Set<string>();
  const matchedConversionIds = new Set(entries.map((e) => e.matched_conversion_id).filter(Boolean));

  // Manual founder entries, keyed by the date that defines each state.
  for (const r of entries) {
    const stateDate = r.state === 'paid' ? r.paid_at : r.state === 'confirmed' ? (r.approved_at ?? r.occurred_at ?? r.period_end) : (r.occurred_at ?? r.period_end ?? r.period_start);
    const inWin = dateInWindow(stateDate ?? null, w) || overlaps(r.period_start, r.period_end, w);
    if (!inWin) continue;
    const sar = revenueSar(r);
    currencies.add((r.currency || 'SAR').toUpperCase());
    const b = byState[r.state];
    b.rows += 1; b.units += r.quantity ?? 1;
    if (sar == null) b.unconverted += 1; else b.sar = round2(b.sar + sar);
    if (r.unit === 'order') orders += r.quantity ?? 1; else if (r.unit === 'item') items += r.quantity ?? 1; else aggregates += 1;
    if (sar != null) {
      if (r.state === 'confirmed' || r.state === 'paid') confirmedSar += sar;
      if (r.state === 'paid' && dateInWindow(r.paid_at, w)) paidSar += sar;
      if (r.state === 'confirmed') receivableSar += sar;
      if (r.state === 'pending') pendingSar += sar;
    }
  }
  // Imported partner rows (affiliate_conversions), skipping ones already represented by a matched manual entry.
  for (const c of conversions) {
    if (matchedConversionIds.has(c.id)) continue;
    if (!dateInWindow(c.order_date, w)) continue;
    const st = conversionStateToCommissionState(c.state);
    const sar = (c.currency || 'SAR').toUpperCase() === 'SAR' ? (c.commission_amount ?? null) : null;
    currencies.add((c.currency || 'SAR').toUpperCase());
    const b = byState[st];
    b.rows += 1; b.units += c.quantity ?? 1;
    if (sar == null) b.unconverted += 1; else b.sar = round2(b.sar + sar);
    items += c.quantity ?? 1;
    if (sar != null) {
      if (st === 'confirmed' || st === 'paid') confirmedSar += sar;
      if (st === 'paid') paidSar += sar;
      if (st === 'confirmed') receivableSar += sar;
      if (st === 'pending') pendingSar += sar;
    }
  }

  const coverage: PartnerCoverage[] = PARTNER_SOURCES.map((source) => {
    const rep = reports.filter((r) => r.source.toLowerCase().includes(source.split('_')[0]) && overlaps(r.report_period_start, r.report_period_end, w)).length;
    const ent = entries.filter((e) => e.source === source && e.state !== 'declared' && overlaps(e.period_start, e.period_end, w)).length;
    const covered = rep > 0 || ent > 0;
    return { source, covered, reports: rep, entries: ent, detailAr: covered ? `${rep} تقرير مستورد، ${ent} إدخال موثق يغطي الفترة` : 'لا تقرير مستورد ولا إدخال موثق يغطي الفترة — غير معلوم' };
  });
  const coverageCount = coverage.filter((c) => c.covered).length;
  return {
    byState, orders, items, aggregates,
    confirmedSar: round2(confirmedSar), paidSar: round2(paidSar), pendingSar: round2(pendingSar), receivableSar: round2(receivableSar),
    coverage, coverageCount,
    coverageState: coverageCount === PARTNER_SOURCES.length ? 'complete' : coverageCount > 0 ? 'partial' : 'coverage_missing',
    currencies: [...currencies],
  };
}

export function fundingTotal(rows: FundingRow[]): { sar: number; unconvertedRows: number } {
  let sar = 0, unconvertedRows = 0;
  for (const f of rows) {
    const v = f.amount_sar != null ? f.amount_sar : (f.currency || 'SAR').toUpperCase() === 'SAR' ? f.amount : null;
    if (v == null) unconvertedRows += 1; else sar += v;
  }
  return { sar: round2(sar), unconvertedRows };
}

export function round2(n: number): number { return Math.round(n * 100) / 100; }
