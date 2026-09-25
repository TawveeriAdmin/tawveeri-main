// src/lib/founder/subscriptions.ts — «الالتزامات والاشتراكات الشهرية».
// Rules (founder mandate 2026-09-25, second finance task):
//   1. a FIXED subscription creates an EXPECTED (draft) expense on its renewal date; it becomes
//      `paid` only when the founder confirms an invoice/charge (updateExpense → paid + paid_at);
//   2. VARIABLE vendors (Railway, Supabase, SendGrid, Anthropic API) are never auto-repeated —
//      they carry a monthly budget estimate only; the real invoice is entered each month;
//   3. NEEDS_CONFIRMATION subscriptions (Store Leads, Browserless) create nothing until confirmed;
//   4. the expense report compares actual (paid) vs expected (drafts) vs budget per classification.
import { createServerClient } from '@/lib/database';
import { createAuditLog } from '@/lib/auth/audit';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_AR, type ExpenseCategory } from './registry';
import { expenseSar, round2, type ExpenseRow } from './finance';
import { LedgerValidationError, createExpense } from './ledger';
import { daysBetween, riyadhDateString, type MetricWindow } from './windows';

type AnyClient = { from: (table: string) => any };

export type SubscriptionKind = 'fixed' | 'variable_budget';
export type SubscriptionStatus = 'active' | 'paused' | 'needs_confirmation' | 'ended';
export interface SubscriptionRow {
  id: string; vendor: string; description: string | null; category: ExpenseCategory; kind: SubscriptionKind; status: SubscriptionStatus;
  cadence: 'monthly' | 'yearly'; amount_original: number | null; currency: string; amount_sar: number | null; budget_source: string | null;
  next_renewal_at: string | null; last_confirmed_at: string | null; notes: string | null; created_at: string; updated_at: string; archived_at: string | null;
}
export const SUBSCRIPTION_STATUS_AR: Record<SubscriptionStatus, string> = { active: 'فعال', paused: 'موقوف', needs_confirmation: 'يحتاج تأكيد المؤسس', ended: 'منتهٍ' };
export const SUBSCRIPTION_KIND_AR: Record<SubscriptionKind, string> = { fixed: 'اشتراك ثابت', variable_budget: 'متغير — ميزانية تقديرية فقط' };

const n = (v: unknown) => (v == null ? null : Number(v));

export async function fetchSubscriptions(): Promise<SubscriptionRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_subscriptions').select('*').is('archived_at', null).order('kind').order('vendor');
  return ((data ?? []) as SubscriptionRow[]).map((s) => ({ ...s, amount_original: n(s.amount_original), amount_sar: n(s.amount_sar) }));
}

export interface SubscriptionInput {
  vendor: string; description?: string | null; category: string; kind: string; status?: string; cadence?: string;
  amount_original?: number | string | null; currency?: string; amount_sar?: number | string | null; budget_source?: string | null;
  next_renewal_at?: string | null; last_confirmed_at?: string | null; notes?: string | null;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const numOrNull = (v: unknown): number | null => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const strOrNull = (v: unknown, max = 500): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const dateOrNull = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) ? v : null);

export function normalizeSubscription(input: SubscriptionInput): Record<string, unknown> {
  const errors: Record<string, string> = {};
  const vendor = strOrNull(input.vendor, 200); if (!vendor) errors.vendor = 'المورد مطلوب';
  const category = EXPENSE_CATEGORIES.includes(input.category as never) ? input.category : null; if (!category) errors.category = 'الفئة غير معروفة';
  const kind = input.kind === 'fixed' || input.kind === 'variable_budget' ? input.kind : null; if (!kind) errors.kind = 'النوع: ثابت أو متغير';
  const status = ['active', 'paused', 'needs_confirmation', 'ended'].includes(input.status ?? '') ? input.status : 'active';
  const currency = (strOrNull(input.currency, 8) ?? 'SAR').toUpperCase();
  const amount = numOrNull(input.amount_original);
  let amountSar = numOrNull(input.amount_sar);
  if (currency === 'SAR' && amount != null) amountSar = amount;
  if (kind === 'fixed' && (amountSar == null || amountSar < 0)) errors.amount_sar = 'المبلغ الشهري بالريال مطلوب للاشتراك الثابت';
  if (kind === 'variable_budget' && (amountSar == null || amountSar < 0)) errors.amount_sar = 'الميزانية التقديرية الشهرية مطلوبة';
  if (kind === 'variable_budget' && !strOrNull(input.budget_source, 300)) errors.budget_source = 'مصدر التقدير مطلوب (مثل: متوسط آخر 3 فواتير)';
  const next = dateOrNull(input.next_renewal_at);
  if (kind === 'fixed' && status === 'active' && !next) errors.next_renewal_at = 'تاريخ التجديد القادم مطلوب للاشتراك الثابت الفعال';
  if (Object.keys(errors).length) throw new LedgerValidationError(errors);
  return {
    vendor, description: strOrNull(input.description, 500), category, kind, status, cadence: input.cadence === 'yearly' ? 'yearly' : 'monthly',
    amount_original: amount ?? amountSar, currency, amount_sar: amountSar, budget_source: strOrNull(input.budget_source, 300),
    next_renewal_at: next, last_confirmed_at: dateOrNull(input.last_confirmed_at), notes: strOrNull(input.notes, 1000),
  };
}

async function audit(entityId: string, action: string, before: unknown, after: unknown, actor: string | null, note?: string) {
  const supabase = createServerClient() as unknown as AnyClient;
  await supabase.from('founder_ledger_audit').insert({ entity: 'subscription', entity_id: entityId, action, before: before ?? null, after: after ?? null, actor, note: note ?? null });
  await createAuditLog({ user_id: actor, action: `founder_subscription_${action}`, entity_type: 'founder_subscription', entity_id: entityId, details: { note: note ?? null } });
}

export async function createSubscription(input: SubscriptionInput, actor: string | null): Promise<{ id: string }> {
  const row = normalizeSubscription(input);
  const supabase = createServerClient() as unknown as AnyClient;
  const { data, error } = await supabase.from('founder_subscriptions').insert({ ...row, created_by: actor, updated_by: actor }).select('*').single();
  if (error) throw new Error(error.message);
  await audit(data.id, 'create', null, data, actor);
  return { id: data.id };
}

export async function updateSubscription(id: string, input: Partial<SubscriptionInput>, actor: string | null, note?: string): Promise<void> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_subscriptions').select('*').eq('id', id).is('archived_at', null).maybeSingle();
  if (!before) throw new Error('not found');
  const row = normalizeSubscription({ ...before, ...input });
  const { data: after, error } = await supabase.from('founder_subscriptions').update({ ...row, updated_by: actor, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  await audit(id, 'update', before, after, actor, note);
}

export async function archiveSubscription(id: string, actor: string | null, note?: string): Promise<void> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_subscriptions').select('*').eq('id', id).is('archived_at', null).maybeSingle();
  if (!before) throw new Error('not found');
  await supabase.from('founder_subscriptions').update({ archived_at: new Date().toISOString(), updated_by: actor }).eq('id', id);
  await audit(id, 'delete', before, null, actor, note);
}

/** Month arithmetic on YYYY-MM-DD strings (Riyadh calendar, day clamped). */
export function addCadence(date: string, cadence: 'monthly' | 'yearly'): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y + (cadence === 'yearly' ? 1 : 0), m - 1 + (cadence === 'monthly' ? 1 : 0), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Rule 1: for every ACTIVE FIXED subscription whose renewal date has arrived, create ONE expected
 *  expense per renewal period (unique on subscription_id + expected_for) and advance the renewal.
 *  Never marks anything paid. Idempotent. */
export async function materializeExpectedExpenses(actor: string | null, today = riyadhDateString(new Date())): Promise<{ created: number; advanced: number }> {
  const supabase = createServerClient() as unknown as AnyClient;
  const subs = (await fetchSubscriptions()).filter((s) => s.kind === 'fixed' && s.status === 'active' && s.next_renewal_at && s.amount_sar != null);
  let created = 0, advanced = 0;
  for (const s of subs) {
    let renewal = s.next_renewal_at as string;
    let guard = 0;
    while (renewal <= today && guard++ < 24) {
      const { data: existing } = await supabase.from('founder_expenses').select('id').eq('subscription_id', s.id).eq('expected_for', renewal).is('deleted_at', null).maybeSingle();
      if (!existing) {
        const periodEnd = addCadence(renewal, s.cadence);
        const end = new Date(new Date(`${periodEnd}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
        await createExpense({
          vendor: s.vendor, description: `${s.description ?? SUBSCRIPTION_KIND_AR.fixed} — قيد متوقع بتاريخ التجديد، بانتظار تأكيد الفاتورة/الخصم`, category: s.category,
          service_period_start: renewal, service_period_end: end, due_at: renewal, payment_status: 'expected', amount_original: s.amount_original ?? s.amount_sar ?? 0, currency: s.currency,
          amount_sar: s.currency === 'SAR' ? undefined : s.amount_sar, fx_source: s.currency === 'SAR' ? undefined : 'تقدير الاشتراك', recurrence: s.cadence,
          renewal_at: periodEnd, evidence_state: 'estimate', notes: `اشتراك ${s.vendor} — متوقع، لم يُؤكد`, subscription_id: s.id, expected_for: renewal,
        }, actor);
        created += 1;
      }
      renewal = addCadence(renewal, s.cadence);
    }
    if (renewal !== s.next_renewal_at) {
      await supabase.from('founder_subscriptions').update({ next_renewal_at: renewal, updated_by: actor, updated_at: new Date().toISOString() }).eq('id', s.id);
      advanced += 1;
    }
  }
  return { created, advanced };
}

// ── Report: actual vs expected vs budget, by classification ──────────────────

export type Classification = 'infrastructure' | 'ai' | 'marketing' | 'external_dev';
export const CLASSIFICATION_AR: Record<Classification, string> = { infrastructure: 'بنية', ai: 'AI', marketing: 'تسويق', external_dev: 'تطوير خارجي' };
export function classify(category: ExpenseCategory): Classification {
  if (category === 'ai') return 'ai';
  if (category === 'advertising' || category === 'tools') return 'marketing';
  if (category === 'contractor' || category === 'design') return 'external_dev';
  return 'infrastructure';
}

export interface ReportLine { classification: Classification; labelAr: string; actualSar: number; expectedSar: number; budgetSar: number; varianceSar: number; actualRows: number; expectedRows: number; undatedActualRows: number }
export interface ExpenseReport { window: { start: string; end: string; labelAr: string; partial: boolean }; lines: ReportLine[]; total: ReportLine; monthsInWindow: number }

const inWindow = (d: string | null, w: MetricWindow) => !!d && new Date(`${d}T00:00:00+03:00`).getTime() >= w.start.getTime() && new Date(`${d}T00:00:00+03:00`).getTime() < w.end.getTime();

export function buildExpenseReport(expenses: ExpenseRow[], subs: SubscriptionRow[], w: MetricWindow, allTime = false): ExpenseReport {
  const months = allTime ? 0 : daysBetween(w.start, w.end) / 30.4375;
  const lines = new Map<Classification, ReportLine>();
  const line = (c: Classification) => { let l = lines.get(c); if (!l) { l = { classification: c, labelAr: CLASSIFICATION_AR[c], actualSar: 0, expectedSar: 0, budgetSar: 0, varianceSar: 0, actualRows: 0, expectedRows: 0, undatedActualRows: 0 }; lines.set(c, l); } return l; };
  for (const c of ['infrastructure', 'ai', 'marketing', 'external_dev'] as Classification[]) line(c);
  for (const e of expenses) {
    const c = classify(e.category);
    const sar = expenseSar(e) ?? 0;
    if (e.payment_status === 'paid') {
      const undated = !e.paid_at;
      if (allTime || inWindow(e.paid_at, w)) { line(c).actualSar += sar; line(c).actualRows += 1; }
      if (undated && allTime) line(c).undatedActualRows += 1;
    } else if (e.payment_status === 'due' || (e.payment_status as string) === 'expected') {
      if (allTime || inWindow(e.due_at ?? e.service_period_start, w)) { line(c).expectedSar += sar; line(c).expectedRows += 1; }
    }
  }
  // Budget: fixed subscriptions (monthly amount) + variable budget estimates, scaled to the window.
  if (!allTime) for (const s of subs) {
    if (s.status !== 'active' || s.amount_sar == null) continue;
    const monthly = s.cadence === 'yearly' ? s.amount_sar / 12 : s.amount_sar;
    line(classify(s.category)).budgetSar += monthly * months;
  }
  const out = [...lines.values()].map((l) => ({ ...l, actualSar: round2(l.actualSar), expectedSar: round2(l.expectedSar), budgetSar: round2(l.budgetSar), varianceSar: round2(l.actualSar - l.budgetSar) }));
  const total = out.reduce((t, l) => ({ ...t, actualSar: round2(t.actualSar + l.actualSar), expectedSar: round2(t.expectedSar + l.expectedSar), budgetSar: round2(t.budgetSar + l.budgetSar), varianceSar: round2(t.varianceSar + l.varianceSar), actualRows: t.actualRows + l.actualRows, expectedRows: t.expectedRows + l.expectedRows, undatedActualRows: t.undatedActualRows + l.undatedActualRows }),
    { classification: 'infrastructure' as Classification, labelAr: 'الإجمالي', actualSar: 0, expectedSar: 0, budgetSar: 0, varianceSar: 0, actualRows: 0, expectedRows: 0, undatedActualRows: 0 });
  return { window: { start: w.start.toISOString(), end: w.end.toISOString(), labelAr: allTime ? 'منذ البداية' : w.labelAr, partial: w.partial }, lines: out, total, monthsInWindow: round2(months) };
}

export { EXPENSE_CATEGORY_AR };
