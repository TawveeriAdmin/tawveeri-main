// src/lib/founder/ledger.ts — the ONLY write path for founder ledgers. Every mutation: validates,
// derives amount_sar only when documented, bumps revision, and mirrors before/after into
// founder_ledger_audit (plus the platform admin_logs via createAuditLog). Deletes are soft.
import { createServerClient } from '@/lib/database';
import { createAuditLog } from '@/lib/auth/audit';
import { EXPENSE_CATEGORIES } from './registry';

type AnyClient = { from: (table: string) => any };
export type LedgerEntity = 'expense' | 'revenue' | 'funding' | 'budget' | 'goal' | 'setting' | 'import';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const numOrNull = (v: unknown): number | null => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const strOrNull = (v: unknown, max = 500): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const dateOrNull = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) ? v : null);

export class LedgerValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) { super('validation'); }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function audit(entity: LedgerEntity, entityId: string, action: string, before: unknown, after: unknown, actor: string | null, note?: string) {
  const supabase = createServerClient() as unknown as AnyClient;
  await supabase.from('founder_ledger_audit').insert({ entity, entity_id: entityId, action, before: before ?? null, after: after ?? null, actor, note: note ?? null });
  // admin_logs.entity_id is a uuid column; a settings key ("scenario_inputs") would make the
  // platform audit insert fail silently, so non-uuid ids travel in details instead.
  await createAuditLog({ user_id: actor, action: `founder_${entity}_${action}`, entity_type: `founder_${entity}`, entity_id: UUID_RE.test(entityId) ? entityId : null, details: { entity_id: entityId, note: note ?? null } });
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpenseInput {
  vendor: string; description?: string | null; category: string;
  service_period_start: string; service_period_end?: string | null; due_at?: string | null; paid_at?: string | null; payment_status?: string;
  amount_original: number | string; currency?: string; fees?: number | string | null; tax?: number | string | null;
  fx_rate?: number | string | null; fx_source?: string | null; amount_sar?: number | string | null;
  campaign?: string | null; project?: string | null; channel?: string | null;
  recurrence?: string; renewal_at?: string | null; evidence_ref?: string | null; evidence_path?: string | null; evidence_state?: string;
  cost_kind?: string; allocation_note?: string | null; notes?: string | null; import_id?: string | null; row_hash?: string | null;
}

export function normalizeExpense(input: ExpenseInput): Record<string, unknown> {
  const errors: Record<string, string> = {};
  const vendor = strOrNull(input.vendor, 200);
  if (!vendor) errors.vendor = 'المورد مطلوب';
  const category = EXPENSE_CATEGORIES.includes(input.category as never) ? input.category : null;
  if (!category) errors.category = 'الفئة غير معروفة';
  const start = dateOrNull(input.service_period_start);
  if (!start) errors.service_period_start = 'تاريخ بداية الخدمة مطلوب (YYYY-MM-DD)';
  const end = dateOrNull(input.service_period_end) ?? start;
  if (start && end && end < start) errors.service_period_end = 'نهاية الخدمة قبل بدايتها';
  const amount = numOrNull(input.amount_original);
  if (amount == null || amount < 0) errors.amount_original = 'المبلغ مطلوب ولا يكون سالبًا';
  const currency = (strOrNull(input.currency, 8) ?? 'SAR').toUpperCase();
  const fees = numOrNull(input.fees) ?? 0, tax = numOrNull(input.tax) ?? 0;
  const paymentStatus = input.payment_status === 'due' ? 'due' : 'paid';
  const paidAt = dateOrNull(input.paid_at);
  if (paymentStatus === 'paid' && !paidAt) errors.paid_at = 'تاريخ الدفع مطلوب للمصروف المدفوع';
  const fxRate = numOrNull(input.fx_rate);
  const fxSource = strOrNull(input.fx_source, 200);
  let amountSar = numOrNull(input.amount_sar);
  if (currency === 'SAR') amountSar = Math.round(((amount ?? 0) + fees + tax) * 100) / 100;
  else if (amountSar == null && fxRate != null && fxRate > 0) {
    if (!fxSource) errors.fx_source = 'مصدر سعر التحويل مطلوب عند إدخال سعر تحويل';
    amountSar = Math.round(((amount ?? 0) + fees + tax) * fxRate * 100) / 100;
  } else if (amountSar != null && !fxSource) errors.fx_source = 'مصدر التحويل مطلوب عند إدخال مبلغ بالريال لعملة أخرى';
  const recurrence = ['one_time', 'monthly', 'yearly', 'other'].includes(input.recurrence ?? '') ? input.recurrence : 'one_time';
  if (Object.keys(errors).length) throw new LedgerValidationError(errors);
  return {
    vendor, description: strOrNull(input.description, 1000), category,
    service_period_start: start, service_period_end: end, due_at: dateOrNull(input.due_at), paid_at: paymentStatus === 'paid' ? paidAt : dateOrNull(input.paid_at),
    payment_status: paymentStatus, amount_original: amount, currency, fees, tax, amount_sar: amountSar, fx_rate: currency === 'SAR' ? null : fxRate, fx_source: currency === 'SAR' ? null : fxSource,
    campaign: strOrNull(input.campaign, 120), project: strOrNull(input.project, 120), channel: strOrNull(input.channel, 120),
    recurrence, renewal_at: dateOrNull(input.renewal_at), evidence_ref: strOrNull(input.evidence_ref, 500), evidence_path: strOrNull(input.evidence_path, 500),
    evidence_state: input.evidence_state === 'estimate' ? 'estimate' : 'documented', cost_kind: input.cost_kind === 'shared' ? 'shared' : 'direct',
    allocation_note: strOrNull(input.allocation_note, 500), notes: strOrNull(input.notes, 2000), import_id: strOrNull(input.import_id, 64), row_hash: strOrNull(input.row_hash, 80),
  };
}

export async function createExpense(input: ExpenseInput, actor: string | null): Promise<{ id: string }> {
  const row = normalizeExpense(input);
  const supabase = createServerClient() as unknown as AnyClient;
  const { data, error } = await supabase.from('founder_expenses').insert({ ...row, created_by: actor, updated_by: actor }).select('*').single();
  if (error) throw new Error(error.message);
  await audit('expense', data.id, 'create', null, data, actor);
  return { id: data.id };
}

export async function updateExpense(id: string, input: ExpenseInput, actor: string | null, note?: string): Promise<void> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before, error: readError } = await supabase.from('founder_expenses').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!before) throw new Error('not found');
  const row = normalizeExpense({ ...before, ...input });
  const { data: after, error } = await supabase.from('founder_expenses').update({ ...row, updated_by: actor, updated_at: new Date().toISOString(), revision: (before.revision ?? 1) + 1 }).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  await audit('expense', id, 'update', before, after, actor, note);
}

export async function softDeleteExpense(id: string, actor: string | null, note?: string): Promise<void> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_expenses').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!before) throw new Error('not found');
  const { error } = await supabase.from('founder_expenses').update({ deleted_at: new Date().toISOString(), updated_by: actor }).eq('id', id);
  if (error) throw new Error(error.message);
  await audit('expense', id, 'delete', before, null, actor, note);
}

// ── Revenue entries ─────────────────────────────────────────────────────────

export interface RevenueInput {
  source: string; account_ref?: string | null; report_ref?: string | null; partner_txn_id?: string | null;
  period_start?: string | null; period_end?: string | null; occurred_at?: string | null; approved_at?: string | null; paid_at?: string | null;
  unit?: string; quantity?: number | string | null; sales_amount?: number | string | null; commission_amount: number | string;
  currency?: string; fx_rate?: number | string | null; fx_source?: string | null; amount_sar?: number | string | null;
  state?: string; matched_report_id?: string | null; matched_conversion_id?: string | null;
  evidence_ref?: string | null; evidence_path?: string | null; notes?: string | null;
}

const REVENUE_STATES = ['declared', 'matched', 'pending', 'confirmed', 'paid', 'cancelled'];

export function normalizeRevenue(input: RevenueInput): Record<string, unknown> {
  const errors: Record<string, string> = {};
  const source = strOrNull(input.source, 80);
  if (!source) errors.source = 'مصدر الشريك مطلوب';
  const commission = numOrNull(input.commission_amount);
  if (commission == null) errors.commission_amount = 'مبلغ العمولة مطلوب (قد يكون سالبًا للتعديلات)';
  const currency = (strOrNull(input.currency, 8) ?? 'SAR').toUpperCase();
  const state = REVENUE_STATES.includes(input.state ?? '') ? (input.state as string) : 'declared';
  const paidAt = dateOrNull(input.paid_at);
  if (state === 'paid' && !paidAt) errors.paid_at = 'تاريخ القبض مطلوب للعمولة المقبوضة';
  const approvedAt = dateOrNull(input.approved_at);
  if ((state === 'confirmed') && !approvedAt) errors.approved_at = 'تاريخ الاعتماد مطلوب للعمولة المعتمدة';
  const periodStart = dateOrNull(input.period_start), periodEnd = dateOrNull(input.period_end), occurredAt = dateOrNull(input.occurred_at);
  if (!periodStart && !occurredAt) errors.period_start = 'يلزم تاريخ العملية أو بداية فترة التقرير';
  if (periodStart && periodEnd && periodEnd < periodStart) errors.period_end = 'نهاية الفترة قبل بدايتها';
  if (state !== 'declared' && !strOrNull(input.evidence_ref, 500) && !strOrNull(input.evidence_path, 500) && !strOrNull(input.report_ref, 300)) errors.evidence_ref = 'الحالة غير «مصرّح» تحتاج مرجع تقرير أو إثبات';
  const fxRate = numOrNull(input.fx_rate), fxSource = strOrNull(input.fx_source, 200);
  let amountSar = numOrNull(input.amount_sar);
  if (currency === 'SAR') amountSar = commission;
  else if (amountSar == null && fxRate != null && fxRate > 0) { if (!fxSource) errors.fx_source = 'مصدر سعر التحويل مطلوب'; amountSar = Math.round((commission ?? 0) * fxRate * 100) / 100; }
  else if (amountSar != null && !fxSource) errors.fx_source = 'مصدر التحويل مطلوب';
  if (Object.keys(errors).length) throw new LedgerValidationError(errors);
  return {
    source, account_ref: strOrNull(input.account_ref, 200), report_ref: strOrNull(input.report_ref, 300), partner_txn_id: strOrNull(input.partner_txn_id, 120),
    period_start: periodStart, period_end: periodEnd, occurred_at: occurredAt, approved_at: approvedAt, paid_at: paidAt,
    unit: ['order', 'item', 'aggregate'].includes(input.unit ?? '') ? input.unit : 'aggregate', quantity: numOrNull(input.quantity),
    sales_amount: numOrNull(input.sales_amount), commission_amount: commission, currency, amount_sar: amountSar,
    fx_rate: currency === 'SAR' ? null : fxRate, fx_source: currency === 'SAR' ? null : fxSource, state,
    matched_report_id: strOrNull(input.matched_report_id, 64), matched_conversion_id: strOrNull(input.matched_conversion_id, 64),
    evidence_ref: strOrNull(input.evidence_ref, 500), evidence_path: strOrNull(input.evidence_path, 500), notes: strOrNull(input.notes, 2000),
  };
}

export async function createRevenue(input: RevenueInput, actor: string | null): Promise<{ id: string; possibleDuplicates: number }> {
  const row = normalizeRevenue(input);
  const supabase = createServerClient() as unknown as AnyClient;
  // Duplicate guard: same source + partner txn id is blocked by the unique index; without a txn
  // id we WARN on same source/period/amount rather than block — the founder decides.
  let possibleDuplicates = 0;
  if (!row.partner_txn_id) {
    const { data: dupes } = await supabase.from('founder_revenue_entries').select('id').is('deleted_at', null)
      .eq('source', row.source).eq('commission_amount', row.commission_amount).eq('currency', row.currency)
      .is('period_start', row.period_start ?? null).is('occurred_at', row.occurred_at ?? null).limit(5);
    possibleDuplicates = (dupes ?? []).length;
  }
  const { data, error } = await supabase.from('founder_revenue_entries').insert({ ...row, created_by: actor, updated_by: actor }).select('*').single();
  if (error) {
    if (String(error.message).includes('founder_revenue_partner_txn_idx')) throw new LedgerValidationError({ partner_txn_id: 'هذه العملية مسجلة مسبقًا لنفس الشريك' });
    throw new Error(error.message);
  }
  await audit('revenue', data.id, 'create', null, data, actor, possibleDuplicates ? `possible duplicates: ${possibleDuplicates}` : undefined);
  return { id: data.id, possibleDuplicates };
}

export async function updateRevenue(id: string, input: Partial<RevenueInput>, actor: string | null, note?: string): Promise<void> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_revenue_entries').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!before) throw new Error('not found');
  const row = normalizeRevenue({ ...before, ...input });
  const { data: after, error } = await supabase.from('founder_revenue_entries').update({ ...row, updated_by: actor, updated_at: new Date().toISOString(), revision: (before.revision ?? 1) + 1 }).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  await audit('revenue', id, 'update', before, after, actor, note);
}

export async function softDeleteRevenue(id: string, actor: string | null, note?: string): Promise<void> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_revenue_entries').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!before) throw new Error('not found');
  const { error } = await supabase.from('founder_revenue_entries').update({ deleted_at: new Date().toISOString(), updated_by: actor }).eq('id', id);
  if (error) throw new Error(error.message);
  await audit('revenue', id, 'delete', before, null, actor, note);
}

// ── Funding / budgets / settings ────────────────────────────────────────────

export async function createFunding(input: { amount: number | string; currency?: string; amount_sar?: number | string | null; funded_at: string; note?: string | null; evidence_ref?: string | null }, actor: string | null) {
  const amount = numOrNull(input.amount);
  const fundedAt = dateOrNull(input.funded_at);
  const errors: Record<string, string> = {};
  if (amount == null || amount <= 0) errors.amount = 'المبلغ مطلوب وموجب';
  if (!fundedAt) errors.funded_at = 'تاريخ التمويل مطلوب';
  if (Object.keys(errors).length) throw new LedgerValidationError(errors);
  const currency = (strOrNull(input.currency, 8) ?? 'SAR').toUpperCase();
  const supabase = createServerClient() as unknown as AnyClient;
  const { data, error } = await supabase.from('founder_funding').insert({ amount, currency, amount_sar: currency === 'SAR' ? amount : numOrNull(input.amount_sar), funded_at: fundedAt, note: strOrNull(input.note, 1000), evidence_ref: strOrNull(input.evidence_ref, 500), created_by: actor }).select('*').single();
  if (error) throw new Error(error.message);
  await audit('funding', data.id, 'create', null, data, actor);
  return { id: data.id as string };
}

export async function softDeleteFunding(id: string, actor: string | null) {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_funding').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!before) throw new Error('not found');
  await supabase.from('founder_funding').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  await audit('funding', id, 'delete', before, null, actor);
}

export async function upsertBudget(input: { category: string; monthly_amount_sar: number | string; effective_from: string; note?: string | null }, actor: string | null) {
  const amount = numOrNull(input.monthly_amount_sar);
  const from = dateOrNull(input.effective_from);
  const category = strOrNull(input.category, 40);
  const errors: Record<string, string> = {};
  if (amount == null || amount < 0) errors.monthly_amount_sar = 'مبلغ الميزانية مطلوب';
  if (!from) errors.effective_from = 'تاريخ السريان مطلوب';
  if (!category) errors.category = 'الفئة مطلوبة';
  if (Object.keys(errors).length) throw new LedgerValidationError(errors);
  const supabase = createServerClient() as unknown as AnyClient;
  const { data, error } = await supabase.from('founder_budgets').insert({ category, monthly_amount_sar: amount, effective_from: from, note: strOrNull(input.note, 500), created_by: actor }).select('*').single();
  if (error) throw new Error(error.message);
  await audit('budget', data.id, 'create', null, data, actor);
  return { id: data.id as string };
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? null) as T | null;
}

export async function setSetting(key: string, value: unknown, actor: string | null) {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_settings').select('value').eq('key', key).maybeSingle();
  const { error } = await supabase.from('founder_settings').upsert({ key, value, updated_by: actor, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  await audit('setting', key, before ? 'update' : 'create', before?.value ?? null, value, actor);
}

// ── Goals ───────────────────────────────────────────────────────────────────

export interface GoalInput {
  month: string; metric_id: string; definition_version: string; baseline_value?: number | string | null;
  baseline_window_start?: string | null; baseline_window_end?: string | null; target_value: number | string; direction?: string;
  rationale?: string | null; owner?: string | null; proposed_action?: string | null;
}

export function normalizeGoal(input: GoalInput): Record<string, unknown> {
  const errors: Record<string, string> = {};
  const month = dateOrNull(input.month);
  if (!month || !month.endsWith('-01')) errors.month = 'الشهر مطلوب بصيغة YYYY-MM-01';
  const metricId = strOrNull(input.metric_id, 16);
  if (!metricId) errors.metric_id = 'المؤشر مطلوب';
  const target = numOrNull(input.target_value);
  if (target == null) errors.target_value = 'الهدف الرقمي مطلوب';
  if (!strOrNull(input.rationale, 1000)) errors.rationale = 'مبرر الهدف مطلوب (حتى لا يُعدَّل لاحقًا بلا سبب)';
  if (Object.keys(errors).length) throw new LedgerValidationError(errors);
  return {
    month, metric_id: metricId, definition_version: strOrNull(input.definition_version, 40) ?? 'unknown', baseline_value: numOrNull(input.baseline_value),
    baseline_window_start: input.baseline_window_start ?? null, baseline_window_end: input.baseline_window_end ?? null,
    target_value: target, direction: input.direction === 'lte' ? 'lte' : 'gte', rationale: strOrNull(input.rationale, 1000),
    owner: strOrNull(input.owner, 120) ?? 'المؤسس', proposed_action: strOrNull(input.proposed_action, 1000),
  };
}

export async function createGoal(input: GoalInput, actor: string | null) {
  const row = normalizeGoal(input);
  const supabase = createServerClient() as unknown as AnyClient;
  const { data, error } = await supabase.from('founder_goals').insert({ ...row, created_by: actor, updated_by: actor }).select('*').single();
  if (error) throw new Error(error.message);
  await supabase.from('founder_goal_revisions').insert({ goal_id: data.id, before: null, after: data, reason: 'created', actor });
  await audit('goal', data.id, 'create', null, data, actor);
  return { id: data.id as string };
}

export async function updateGoal(id: string, input: Partial<GoalInput>, reason: string, actor: string | null) {
  if (!reason.trim()) throw new LedgerValidationError({ reason: 'سبب التعديل مطلوب' });
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_goals').select('*').eq('id', id).is('archived_at', null).maybeSingle();
  if (!before) throw new Error('not found');
  const row = normalizeGoal({ ...before, ...input });
  const { data: after, error } = await supabase.from('founder_goals').update({ ...row, updated_by: actor, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  await supabase.from('founder_goal_revisions').insert({ goal_id: id, before, after, reason: reason.slice(0, 500), actor });
  await audit('goal', id, 'update', before, after, actor, reason);
}

export async function archiveGoal(id: string, reason: string, actor: string | null) {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data: before } = await supabase.from('founder_goals').select('*').eq('id', id).is('archived_at', null).maybeSingle();
  if (!before) throw new Error('not found');
  const { data: after } = await supabase.from('founder_goals').update({ archived_at: new Date().toISOString(), updated_by: actor }).eq('id', id).select('*').single();
  await supabase.from('founder_goal_revisions').insert({ goal_id: id, before, after, reason: `archived: ${reason.slice(0, 400)}`, actor });
  await audit('goal', id, 'delete', before, after, actor, reason);
}
