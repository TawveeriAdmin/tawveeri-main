// src/lib/founder/csv-import.ts — historical expense CSV import. Reuses the affiliate CSV parser
// (one parser in the codebase). Every row gets a content hash; the file gets a checksum — a
// re-import is a no-op, a duplicate row is skipped and COUNTED, a bad row is rejected with the
// reason kept on the import record. Never invents a date or a receipt: missing fields stay
// missing and the row is marked as an estimate when the founder says so.
import { parseCsv, sha256 } from '@/lib/admin/affiliate-csv';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_AR, type ExpenseCategory } from './registry';
import { normalizeExpense, LedgerValidationError, type ExpenseInput } from './ledger';

export const EXPENSE_CSV_FIELDS = [
  'vendor', 'description', 'category', 'service_period_start', 'service_period_end', 'paid_at', 'due_at', 'payment_status',
  'amount_original', 'currency', 'fees', 'tax', 'fx_rate', 'fx_source', 'campaign', 'project', 'channel', 'recurrence', 'renewal_at',
  'evidence_ref', 'evidence_state', 'cost_kind', 'notes',
] as const;
export type ExpenseCsvField = (typeof EXPENSE_CSV_FIELDS)[number];
export type ExpenseColumnMapping = Partial<Record<ExpenseCsvField, string>>;

const CATEGORY_ALIASES: Record<string, ExpenseCategory> = {
  ...Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, c])),
  ...Object.fromEntries((Object.entries(EXPENSE_CATEGORY_AR) as [ExpenseCategory, string][]).map(([k, v]) => [v, k])),
  host: 'hosting', server: 'hosting', railway: 'hosting', supabase: 'hosting', domain: 'hosting',
  scraping: 'data_extraction', scraper: 'data_extraction', browserless: 'data_extraction', firecrawl: 'data_extraction', apify: 'data_extraction',
  llm: 'ai', anthropic: 'ai', openai: 'ai', gemini: 'ai', 'ai': 'ai',
  tool: 'tools', saas: 'tools', subscription: 'tools',
  ads: 'advertising', ad: 'advertising', marketing: 'advertising', إعلانات: 'advertising',
  freelancer: 'contractor', contractor: 'contractor',
  fee: 'fees', bank: 'fees', vat: 'fees',
};

/** Best-effort auto-mapping from a header row (Arabic or English); the founder can override. */
export function guessExpenseMapping(headers: string[]): ExpenseColumnMapping {
  const norm = (h: string) => h.trim().toLowerCase();
  const find = (...cands: string[]) => headers.find((h) => cands.includes(norm(h)));
  const m: ExpenseColumnMapping = {};
  const set = (f: ExpenseCsvField, h?: string) => { if (h) m[f] = h; };
  set('vendor', find('vendor', 'supplier', 'المورد', 'مورد', 'الجهة'));
  set('description', find('description', 'desc', 'الوصف', 'وصف', 'البيان'));
  set('category', find('category', 'الفئة', 'فئة', 'التصنيف'));
  set('service_period_start', find('service_period_start', 'period_start', 'service_start', 'start', 'بداية الخدمة', 'من'));
  set('service_period_end', find('service_period_end', 'period_end', 'service_end', 'end', 'نهاية الخدمة', 'إلى'));
  set('paid_at', find('paid_at', 'paid', 'payment_date', 'date', 'تاريخ الدفع', 'التاريخ'));
  set('due_at', find('due_at', 'due', 'تاريخ الاستحقاق'));
  set('payment_status', find('payment_status', 'status', 'الحالة'));
  set('amount_original', find('amount', 'amount_original', 'total', 'المبلغ', 'مبلغ'));
  set('currency', find('currency', 'العملة', 'عملة'));
  set('fees', find('fees', 'fee', 'الرسوم', 'رسوم'));
  set('tax', find('tax', 'vat', 'الضريبة', 'ضريبة'));
  set('fx_rate', find('fx_rate', 'rate', 'سعر التحويل'));
  set('fx_source', find('fx_source', 'مصدر التحويل'));
  set('campaign', find('campaign', 'الحملة', 'حملة'));
  set('project', find('project', 'المشروع'));
  set('channel', find('channel', 'القناة'));
  set('recurrence', find('recurrence', 'recurring', 'التكرار', 'متكرر'));
  set('renewal_at', find('renewal_at', 'renewal', 'التجديد'));
  set('evidence_ref', find('evidence_ref', 'evidence', 'receipt', 'invoice', 'المرجع', 'الإثبات', 'الفاتورة'));
  set('evidence_state', find('evidence_state', 'documented', 'موثق'));
  set('cost_kind', find('cost_kind', 'نوع التكلفة'));
  set('notes', find('notes', 'note', 'ملاحظات'));
  return m;
}

const parseDate = (v: string | undefined): string | null => {
  if (!v) return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // DD/MM/YYYY (Saudi convention)
  return null;
};
const parseNumber = (v: string | undefined): string | undefined => {
  if (v == null) return undefined;
  const cleaned = v.replace(/[^\d.\-]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return cleaned === '' ? undefined : cleaned;
};

export interface ImportRowResult { index: number; ok: boolean; input?: Record<string, unknown>; rowHash?: string; error?: string }

export function prepareExpenseRows(text: string, mapping: ExpenseColumnMapping, importId: string): { checksum: string; headers: string[]; results: ImportRowResult[] } {
  const checksum = sha256(text);
  const { headers, rows } = parseCsv(text);
  const results: ImportRowResult[] = rows.map((raw, index) => {
    const get = (f: ExpenseCsvField) => (mapping[f] ? raw[mapping[f] as string] : undefined);
    const categoryRaw = (get('category') || '').trim().toLowerCase();
    const category = CATEGORY_ALIASES[categoryRaw] ?? CATEGORY_ALIASES[(get('category') || '').trim()] ?? (categoryRaw ? null : 'other');
    const paidAt = parseDate(get('paid_at'));
    const start = parseDate(get('service_period_start')) ?? paidAt;
    const statusRaw = (get('payment_status') || '').trim().toLowerCase();
    const input: ExpenseInput = {
      vendor: get('vendor') || '', description: get('description') || null, category: category ?? 'other',
      service_period_start: start ?? '', service_period_end: parseDate(get('service_period_end')) ?? start,
      paid_at: paidAt, due_at: parseDate(get('due_at')),
      payment_status: statusRaw === 'due' || statusRaw === 'مستحق' || statusRaw === 'unpaid' ? 'due' : 'paid',
      amount_original: parseNumber(get('amount_original')) ?? '', currency: get('currency') || 'SAR',
      fees: parseNumber(get('fees')) ?? 0, tax: parseNumber(get('tax')) ?? 0, fx_rate: parseNumber(get('fx_rate')) ?? null, fx_source: get('fx_source') || null,
      campaign: get('campaign') || null, project: get('project') || null, channel: get('channel') || null,
      recurrence: (['monthly', 'yearly', 'other', 'شهري', 'سنوي'].includes((get('recurrence') || '').trim().toLowerCase()) ? ({ شهري: 'monthly', سنوي: 'yearly' } as Record<string, string>)[(get('recurrence') || '').trim()] ?? (get('recurrence') || '').trim().toLowerCase() : 'one_time'),
      renewal_at: parseDate(get('renewal_at')), evidence_ref: get('evidence_ref') || null,
      evidence_state: ['estimate', 'تقدير', 'no', 'false', '0'].includes((get('evidence_state') || '').trim().toLowerCase()) ? 'estimate' : 'documented',
      cost_kind: ['shared', 'مشترك'].includes((get('cost_kind') || '').trim().toLowerCase()) ? 'shared' : 'direct',
      notes: get('notes') || null, import_id: importId,
    };
    try {
      if (category === null) throw new LedgerValidationError({ category: `فئة غير معروفة: ${get('category')}` });
      const normalized = normalizeExpense(input);
      const rowHash = sha256(JSON.stringify([normalized.vendor, normalized.category, normalized.service_period_start, normalized.service_period_end, normalized.paid_at, normalized.amount_original, normalized.currency, normalized.fees, normalized.tax]));
      return { index, ok: true, input: { ...normalized, row_hash: rowHash }, rowHash };
    } catch (e) {
      const error = e instanceof LedgerValidationError ? Object.values(e.fieldErrors).join('؛ ') : e instanceof Error ? e.message : 'خطأ';
      return { index, ok: false, error };
    }
  });
  return { checksum, headers, results };
}
