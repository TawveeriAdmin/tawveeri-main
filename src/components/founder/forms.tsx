'use client';
// src/components/founder/forms.tsx — the founder's write surfaces: expense, revenue, funding,
// budget, goal, scenario inputs, CSV import, evidence upload, on-demand summary. Mobile-first,
// Arabic, every server-side validation error is shown next to its field. All writes go through
// /api/admin/founder/* (admin-gated, audited).
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_AR, METRICS, DEFINITION_VERSION } from '@/lib/founder/registry';

type FieldErrors = Record<string, string>;
const API = '/api/admin/founder';

async function call(method: string, path: string, body?: unknown, form?: FormData): Promise<{ ok: boolean; data: any; fieldErrors: FieldErrors; error: string | null }> {
  try {
    const res = await fetch(`${API}${path}`, { method, headers: form ? undefined : { 'content-type': 'application/json' }, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, data, fieldErrors: data.fieldErrors ?? {}, error: data.fieldErrors ? 'راجع الحقول المعلّمة' : (data.error ?? `HTTP ${res.status}`) };
    return { ok: true, data, fieldErrors: {}, error: null };
  } catch (e) { return { ok: false, data: null, fieldErrors: {}, error: e instanceof Error ? e.message : 'تعذر الاتصال' }; }
}

const inputCls = 'w-full rounded-xl border border-[#d7ece5] bg-white px-3 py-2.5 text-sm dark:border-[#263b33] dark:bg-[#0f1512]';
const labelCls = 'block text-[11px] font-black text-on-surface-variant dark:text-white/60';

function Field({ label, name, errors, children, hint }: { label: string; name: string; errors: FieldErrors; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && !errors[name] && <span className="block text-[11px] text-on-surface-variant dark:text-white/45">{hint}</span>}
      {errors[name] && <span className="block text-[11px] font-bold text-red-700 dark:text-red-300">{errors[name]}</span>}
    </label>
  );
}

function Btn({ children, kind = 'primary', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'danger' }) {
  const cls = kind === 'primary' ? 'bg-[#1f6f59] text-white hover:bg-[#185947]' : kind === 'danger' ? 'bg-red-700 text-white' : 'border border-[#d7ece5] text-on-surface-variant dark:border-[#263b33] dark:text-white/70';
  return <button {...rest} className={`rounded-full px-4 py-2 text-xs font-black disabled:opacity-50 ${cls}`}>{children}</button>;
}

function Status({ msg, ok }: { msg: string | null; ok?: boolean }) {
  if (!msg) return null;
  return <p className={`rounded-xl px-3 py-2 text-xs font-bold ${ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300'}`}>{msg}</p>;
}

function formToObject(form: HTMLFormElement): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  new FormData(form).forEach((v, k) => { if (typeof v === 'string') o[k] = v; });
  return o;
}

export function EvidenceUpload({ entity, onUploaded, initialPath }: { entity: string; onUploaded: (path: string) => void; initialPath?: string | null }) {
  const [path, setPath] = useState<string | null>(initialPath ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-1">
      <span className={labelCls}>المرفق (صورة/PDF/CSV، خاص، حتى 10MB)</span>
      <input type="file" accept="image/*,application/pdf,text/csv,text/plain" className="block w-full text-xs" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true); setMsg(null);
        const fd = new FormData(); fd.append('file', f); fd.append('entity', entity);
        const r = await call('POST', '/evidence', undefined, fd);
        setBusy(false);
        if (r.ok) { setPath(r.data.path); onUploaded(r.data.path); setMsg(`رُفع: ${r.data.name}`); } else setMsg(r.error);
      }} />
      {path && <ViewEvidence path={path} />}
      {msg && <span className="block text-[11px]">{msg}</span>}
    </div>
  );
}

export function ViewEvidence({ path }: { path: string }) {
  return <button type="button" className="text-[11px] font-bold text-[#1f6f59] underline decoration-dotted" onClick={async () => {
    const r = await call('GET', `/evidence?path=${encodeURIComponent(path)}`);
    if (r.ok) window.open(r.data.url, '_blank', 'noopener'); else alert(r.error);
  }}>عرض المرفق</button>;
}

// ── Expense ──────────────────────────────────────────────────────────────────
export function ExpenseForm({ initial, onDone }: { initial?: Record<string, any> | null; onDone?: () => void }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState(initial?.currency ?? 'SAR');
  const [evidencePath, setEvidencePath] = useState<string | null>(initial?.evidence_path ?? null);
  const [status, setStatus] = useState(initial?.payment_status ?? 'paid');
  const [today] = useState(() => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg(null); setErrors({});
    const body = { ...formToObject(e.currentTarget), evidence_path: evidencePath };
    const r = initial?.id ? await call('PATCH', `/expenses/${initial.id}`, body) : await call('POST', '/expenses', body);
    setBusy(false); setErrors(r.fieldErrors); setOk(r.ok); setMsg(r.ok ? 'حُفظ المصروف وسُجل في سجل التدقيق' : r.error);
    if (r.ok) { router.refresh(); onDone?.(); if (!initial?.id) (e.target as HTMLFormElement).reset(); }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="المورد *" name="vendor" errors={errors}><input name="vendor" required defaultValue={initial?.vendor ?? ''} className={inputCls} placeholder="Railway، Supabase، Browserless…" /></Field>
      <Field label="الفئة *" name="category" errors={errors}>
        <select name="category" defaultValue={initial?.category ?? 'tools'} className={inputCls}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_AR[c]}</option>)}</select>
      </Field>
      <Field label="وصف المصروف" name="description" errors={errors}><input name="description" defaultValue={initial?.description ?? ''} className={inputCls} /></Field>
      <Field label="المبلغ الأصلي *" name="amount_original" errors={errors}><input name="amount_original" type="number" step="0.01" min="0" required defaultValue={initial?.amount_original ?? ''} className={inputCls} /></Field>
      <Field label="العملة" name="currency" errors={errors}><select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>{['SAR', 'USD', 'EUR', 'AED', 'GBP'].map((c) => <option key={c}>{c}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="رسوم" name="fees" errors={errors}><input name="fees" type="number" step="0.01" min="0" defaultValue={initial?.fees ?? 0} className={inputCls} /></Field>
        <Field label="ضريبة" name="tax" errors={errors}><input name="tax" type="number" step="0.01" min="0" defaultValue={initial?.tax ?? 0} className={inputCls} /></Field>
      </div>
      {currency !== 'SAR' && (<>
        <Field label="سعر التحويل إلى الريال" name="fx_rate" errors={errors} hint="اتركه فارغًا إن لم يكن موثقًا؛ يبقى الصف خارج المجاميع بالريال"><input name="fx_rate" type="number" step="0.000001" defaultValue={initial?.fx_rate ?? ''} className={inputCls} /></Field>
        <Field label="مصدر سعر التحويل" name="fx_source" errors={errors}><input name="fx_source" defaultValue={initial?.fx_source ?? ''} className={inputCls} placeholder="كشف البنك، بطاقة، SAMA…" /></Field>
      </>)}
      <Field label="دقة التاريخ" name="date_precision" errors={errors} hint="«يحتاج مراجعة» يسمح بترك التواريخ فارغة؛ يبقى الصف في إجمالي البداية وخارج النوافذ المؤرخة"><select name="date_precision" defaultValue={initial?.date_precision ?? 'exact'} className={inputCls}><option value="exact">دقيق</option><option value="month">الشهر فقط</option><option value="year">السنة فقط</option><option value="needs_review">تاريخ تاريخي يحتاج مراجعة</option></select></Field>
      <Field label="بداية فترة الخدمة *" name="service_period_start" errors={errors}><input name="service_period_start" type="date" defaultValue={initial?.service_period_start ?? today} className={inputCls} /></Field>
      <Field label="نهاية فترة الخدمة" name="service_period_end" errors={errors} hint="اشتراك سنوي: ضع سنة كاملة؛ تُوزع التكلفة على الأشهر"><input name="service_period_end" type="date" defaultValue={initial?.service_period_end ?? ''} className={inputCls} /></Field>
      <Field label="الحالة" name="payment_status" errors={errors}><select name="payment_status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}><option value="paid">مدفوع</option><option value="due">مستحق</option></select></Field>
      {status === 'paid' ? <Field label="تاريخ الدفع *" name="paid_at" errors={errors}><input name="paid_at" type="date" defaultValue={initial?.paid_at ?? today} className={inputCls} /></Field>
        : <Field label="تاريخ الاستحقاق" name="due_at" errors={errors}><input name="due_at" type="date" defaultValue={initial?.due_at ?? ''} className={inputCls} /></Field>}
      <Field label="التكرار" name="recurrence" errors={errors}><select name="recurrence" defaultValue={initial?.recurrence ?? 'one_time'} className={inputCls}><option value="one_time">مرة واحدة</option><option value="monthly">شهري</option><option value="yearly">سنوي</option><option value="other">آخر</option></select></Field>
      <Field label="تاريخ التجديد" name="renewal_at" errors={errors}><input name="renewal_at" type="date" defaultValue={initial?.renewal_at ?? ''} className={inputCls} /></Field>
      <Field label="الحملة / المشروع / القناة" name="campaign" errors={errors}><div className="grid grid-cols-3 gap-1"><input name="campaign" placeholder="حملة" defaultValue={initial?.campaign ?? ''} className={inputCls} /><input name="project" placeholder="مشروع" defaultValue={initial?.project ?? ''} className={inputCls} /><input name="channel" placeholder="قناة" defaultValue={initial?.channel ?? ''} className={inputCls} /></div></Field>
      <Field label="نوع التكلفة" name="cost_kind" errors={errors}><select name="cost_kind" defaultValue={initial?.cost_kind ?? 'direct'} className={inputCls}><option value="direct">مباشرة</option><option value="shared">مشتركة</option></select></Field>
      <Field label="حالة الإثبات" name="evidence_state" errors={errors}><select name="evidence_state" defaultValue={initial?.evidence_state ?? 'documented'} className={inputCls}><option value="documented">موثق (فاتورة/إيصال)</option><option value="estimate">تقدير تاريخي</option></select></Field>
      <Field label="مرجع الإثبات" name="evidence_ref" errors={errors}><input name="evidence_ref" defaultValue={initial?.evidence_ref ?? ''} className={inputCls} placeholder="رقم فاتورة، رابط، ملاحظة" /></Field>
      <EvidenceUpload entity="expense" onUploaded={setEvidencePath} initialPath={evidencePath} />
      <Field label="ملاحظات" name="notes" errors={errors}><textarea name="notes" rows={2} defaultValue={initial?.notes ?? ''} className={inputCls} /></Field>
      {initial?.id && <Field label="سبب التعديل" name="note" errors={errors}><input name="note" className={inputCls} placeholder="يُحفظ في سجل التدقيق" /></Field>}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><Btn type="submit" disabled={busy}>{initial?.id ? 'حفظ التعديل' : 'إضافة المصروف'}</Btn><Status msg={msg} ok={ok} /></div>
    </form>
  );
}

export function ExpenseImportForm() {
  const router = useRouter();
  const [preview, setPreview] = useState<any>(null); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  async function run(dry: boolean) {
    if (!file) return; setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append('file', file); if (dry) fd.append('dryRun', '1'); if (preview?.mapping && !dry) fd.append('mapping', JSON.stringify(preview.mapping));
    const r = await call('POST', '/expenses/import', undefined, fd);
    setBusy(false); setOk(r.ok);
    if (!r.ok) { setMsg(r.error); return; }
    if (dry) { setPreview(r.data); setMsg(`معاينة: ${r.data.wouldImport} سيُستورد، ${r.data.skippedDuplicates} مكرر يُتخطى، ${r.data.rejectedRows} مرفوض`); }
    else { setMsg(r.data.alreadyImported ? 'هذا الملف مستورد مسبقًا — لم يُعد الاستيراد' : `تم: ${r.data.wouldImport} صفًا مستوردًا، ${r.data.skippedDuplicates} مكررًا، ${r.data.rejectedRows} مرفوضًا`); setPreview(null); router.refresh(); }
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-on-surface-variant dark:text-white/55">أعمدة مقترحة: المورد، الوصف، الفئة، بداية الخدمة، نهاية الخدمة، تاريخ الدفع، المبلغ، العملة، الرسوم، الضريبة، الحملة، التكرار، المرجع، موثق/تقدير، ملاحظات. الرؤوس بالعربية أو الإنجليزية تُخمَّن تلقائيًا. التواريخ YYYY-MM-DD أو DD/MM/YYYY.</p>
      <input type="file" accept=".csv,text/csv" className="block w-full text-xs" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setMsg(null); }} />
      <div className="flex flex-wrap gap-2"><Btn type="button" kind="ghost" disabled={!file || busy} onClick={() => run(true)}>معاينة (بلا حفظ)</Btn><Btn type="button" disabled={!preview || busy} onClick={() => run(false)}>استيراد فعلي</Btn></div>
      <Status msg={msg} ok={ok} />
      {preview && (
        <div className="space-y-2 rounded-xl border border-[#eef6f2] p-3 text-[11px] dark:border-white/10">
          <p><b>الأعمدة المكتشفة:</b> {preview.headers.join(' | ')}</p>
          <p><b>الربط:</b> {Object.entries(preview.mapping).map(([k, v]) => `${k}←${v}`).join('، ') || 'لا شيء'}</p>
          {preview.rejectedSamples?.length > 0 && <div><b>عينات مرفوضة:</b><ul className="list-disc ps-4">{preview.rejectedSamples.map((r: any) => <li key={r.row}>سطر {r.row}: {r.error}</li>)}</ul></div>}
          {preview.preview?.length > 0 && <div><b>عينة مقبولة:</b><ul className="list-disc ps-4">{preview.preview.map((p: any, i: number) => <li key={i}>{p.vendor} · {EXPENSE_CATEGORY_AR[p.category as keyof typeof EXPENSE_CATEGORY_AR]} · {p.amount_original} {p.currency} · {p.service_period_start}→{p.service_period_end} · {p.payment_status === 'paid' ? `دُفع ${p.paid_at}` : 'مستحق'}</li>)}</ul></div>}
        </div>
      )}
    </div>
  );
}

// ── Revenue / funding / budget ──────────────────────────────────────────────
export function RevenueForm({ initial, onDone }: { initial?: Record<string, any> | null; onDone?: () => void }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({}); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState(initial?.currency ?? 'SAR'); const [evidencePath, setEvidencePath] = useState<string | null>(initial?.evidence_path ?? null);
  const [state, setState] = useState(initial?.state ?? 'declared');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg(null); setErrors({});
    const body = { ...formToObject(e.currentTarget), evidence_path: evidencePath };
    const r = initial?.id ? await call('PATCH', `/revenue/${initial.id}`, body) : await call('POST', '/revenue', body);
    setBusy(false); setErrors(r.fieldErrors); setOk(r.ok);
    setMsg(r.ok ? (r.data.possibleDuplicates ? `حُفظ. تنبيه: ${r.data.possibleDuplicates} إدخال مشابه (نفس المصدر والفترة والمبلغ) — راجع التكرار` : 'حُفظ الإدخال وسُجل في سجل التدقيق') : r.error);
    if (r.ok) { router.refresh(); onDone?.(); if (!initial?.id) (e.target as HTMLFormElement).reset(); }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="مصدر الشريك *" name="source" errors={errors}><select name="source" defaultValue={initial?.source ?? 'amazon_associates'} className={inputCls}><option value="amazon_associates">أمازون السعودية (Associates)</option><option value="noon_affiliate">نون</option><option value="other">آخر</option></select></Field>
      <Field label="الحالة" name="state" errors={errors}><select name="state" value={state} onChange={(e) => setState(e.target.value)} className={inputCls}>
        <option value="declared">صرّح به المؤسس، غير مطابق</option><option value="matched">مطابق لوثيقة شريك</option><option value="pending">عمولة معلقة</option><option value="confirmed">معتمدة بعد التعديلات</option><option value="paid">مقبوضة نقدًا</option><option value="cancelled">ملغاة/معدلة</option></select></Field>
      <Field label="مبلغ العمولة *" name="commission_amount" errors={errors} hint="سالب للتعديلات/المرتجعات"><input name="commission_amount" type="number" step="0.01" required defaultValue={initial?.commission_amount ?? ''} className={inputCls} /></Field>
      <Field label="العملة" name="currency" errors={errors}><select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>{['SAR', 'USD', 'AED', 'EUR'].map((c) => <option key={c}>{c}</option>)}</select></Field>
      {currency !== 'SAR' && (<><Field label="سعر التحويل" name="fx_rate" errors={errors}><input name="fx_rate" type="number" step="0.000001" defaultValue={initial?.fx_rate ?? ''} className={inputCls} /></Field><Field label="مصدر التحويل" name="fx_source" errors={errors}><input name="fx_source" defaultValue={initial?.fx_source ?? ''} className={inputCls} /></Field></>)}
      <Field label="الوحدة" name="unit" errors={errors}><select name="unit" defaultValue={initial?.unit ?? 'aggregate'} className={inputCls}><option value="aggregate">مجموع فترة</option><option value="order">طلب</option><option value="item">بند/وحدة</option></select></Field>
      <Field label="الكمية" name="quantity" errors={errors}><input name="quantity" type="number" min="0" defaultValue={initial?.quantity ?? ''} className={inputCls} /></Field>
      <Field label="مبيعات مرتبطة" name="sales_amount" errors={errors}><input name="sales_amount" type="number" step="0.01" defaultValue={initial?.sales_amount ?? ''} className={inputCls} /></Field>
      <Field label="معرّف العملية عند الشريك" name="partner_txn_id" errors={errors} hint="يمنع التكرار عند توفره"><input name="partner_txn_id" defaultValue={initial?.partner_txn_id ?? ''} className={inputCls} /></Field>
      <Field label="بداية الفترة المغطاة" name="period_start" errors={errors}><input name="period_start" type="date" defaultValue={initial?.period_start ?? ''} className={inputCls} /></Field>
      <Field label="نهاية الفترة المغطاة" name="period_end" errors={errors}><input name="period_end" type="date" defaultValue={initial?.period_end ?? ''} className={inputCls} /></Field>
      <Field label="تاريخ وقوع العملية" name="occurred_at" errors={errors}><input name="occurred_at" type="date" defaultValue={initial?.occurred_at ?? ''} className={inputCls} /></Field>
      {(state === 'confirmed' || state === 'paid') && <Field label="تاريخ الاعتماد" name="approved_at" errors={errors}><input name="approved_at" type="date" defaultValue={initial?.approved_at ?? ''} className={inputCls} /></Field>}
      {state === 'paid' && <Field label="تاريخ القبض *" name="paid_at" errors={errors}><input name="paid_at" type="date" defaultValue={initial?.paid_at ?? ''} className={inputCls} /></Field>}
      <Field label="الحساب / التقرير" name="report_ref" errors={errors}><div className="grid grid-cols-2 gap-1"><input name="account_ref" placeholder="الحساب" defaultValue={initial?.account_ref ?? ''} className={inputCls} /><input name="report_ref" placeholder="اسم التقرير وفترته" defaultValue={initial?.report_ref ?? ''} className={inputCls} /></div></Field>
      <Field label="مرجع الإثبات" name="evidence_ref" errors={errors}><input name="evidence_ref" defaultValue={initial?.evidence_ref ?? ''} className={inputCls} /></Field>
      <EvidenceUpload entity="revenue" onUploaded={setEvidencePath} initialPath={evidencePath} />
      <Field label="ملاحظات" name="notes" errors={errors}><textarea name="notes" rows={2} defaultValue={initial?.notes ?? ''} className={inputCls} /></Field>
      {initial?.id && <Field label="سبب التعديل" name="note" errors={errors}><input name="note" className={inputCls} /></Field>}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><Btn type="submit" disabled={busy}>{initial?.id ? 'حفظ التعديل' : 'إضافة العمولة'}</Btn><Status msg={msg} ok={ok} /></div>
    </form>
  );
}

export function FundingForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({}); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const r = await call('POST', '/funding', formToObject(e.currentTarget));
    setErrors(r.fieldErrors); setOk(r.ok); setMsg(r.ok ? 'سُجل التمويل (ليس إيرادًا)' : r.error); if (r.ok) { router.refresh(); (e.target as HTMLFormElement).reset(); }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      <Field label="المبلغ *" name="amount" errors={errors}><input name="amount" type="number" step="0.01" min="0" required className={inputCls} /></Field>
      <Field label="التاريخ *" name="funded_at" errors={errors}><input name="funded_at" type="date" required className={inputCls} /></Field>
      <Field label="ملاحظة / إثبات" name="note" errors={errors}><input name="note" className={inputCls} /></Field>
      <div className="flex items-center gap-2 sm:col-span-3"><Btn type="submit">تسجيل تمويل المؤسس</Btn><Status msg={msg} ok={ok} /></div>
    </form>
  );
}

export function BudgetForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({}); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const r = await call('POST', '/budgets', formToObject(e.currentTarget));
    setErrors(r.fieldErrors); setOk(r.ok); setMsg(r.ok ? 'حُفظت الميزانية' : r.error); if (r.ok) router.refresh();
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
      <Field label="الفئة" name="category" errors={errors}><select name="category" className={inputCls}><option value="total">الإجمالي</option>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_AR[c]}</option>)}</select></Field>
      <Field label="ريال/شهر *" name="monthly_amount_sar" errors={errors}><input name="monthly_amount_sar" type="number" min="0" step="1" required className={inputCls} /></Field>
      <Field label="من تاريخ *" name="effective_from" errors={errors}><input name="effective_from" type="date" required className={inputCls} /></Field>
      <div className="flex items-end gap-2"><Btn type="submit">حفظ الميزانية</Btn></div>
      <div className="sm:col-span-4"><Status msg={msg} ok={ok} /></div>
    </form>
  );
}

// ── Goals & scenarios ───────────────────────────────────────────────────────
const GOAL_METRICS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'Q01I', 'F02', 'F01'];

export function GoalForm({ month, baselines }: { month: string; baselines: Record<string, { value: number | null; start: string; end: string; labelAr: string }> }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({}); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false);
  const [metric, setMetric] = useState('S02');
  const b = baselines[metric];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = { ...formToObject(e.currentTarget), month, definition_version: DEFINITION_VERSION, baseline_value: b?.value ?? null, baseline_window_start: b?.start ?? null, baseline_window_end: b?.end ?? null };
    const r = await call('POST', '/goals', body);
    setErrors(r.fieldErrors); setOk(r.ok); setMsg(r.ok ? 'حُفظ الهدف مع خط الأساس ونسخة التعريف' : r.error); if (r.ok) { router.refresh(); (e.target as HTMLFormElement).reset(); }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="المؤشر *" name="metric_id" errors={errors}><select name="metric_id" value={metric} onChange={(e) => setMetric(e.target.value)} className={inputCls}>{GOAL_METRICS.map((id) => <option key={id} value={id}>{id} — {METRICS[id].nameAr}</option>)}</select></Field>
      <Field label="الهدف الرقمي *" name="target_value" errors={errors} hint={b ? `خط الأساس: ${b.value ?? 'غير متاح'} في ${b.labelAr}` : undefined}><input name="target_value" type="number" step="0.01" required className={inputCls} /></Field>
      <Field label="الاتجاه" name="direction" errors={errors}><select name="direction" className={inputCls}><option value="gte">أعلى أو يساوي أفضل</option><option value="lte">أقل أو يساوي أفضل</option></select></Field>
      <Field label="صاحب الإجراء" name="owner" errors={errors}><input name="owner" defaultValue="المؤسس" className={inputCls} /></Field>
      <Field label="مبرر الهدف *" name="rationale" errors={errors}><textarea name="rationale" rows={2} required className={inputCls} placeholder="لماذا هذا الرقم؟ ما الذي يثبته أو ينفيه؟" /></Field>
      <Field label="القرار المقترح عند التأخر" name="proposed_action" errors={errors}><textarea name="proposed_action" rows={2} className={inputCls} /></Field>
      <p className="text-[11px] text-on-surface-variant sm:col-span-2 dark:text-white/50">الشهر: {month} · التعريف {DEFINITION_VERSION} يُجمَّد مع الهدف؛ أي تعديل لاحق يحتاج سببًا ويُسجل في سجل المراجعات.</p>
      <div className="flex items-center gap-2 sm:col-span-2"><Btn type="submit">تحديد الهدف</Btn><Status msg={msg} ok={ok} /></div>
    </form>
  );
}

export function GoalActions({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const r = await call('PATCH', `/goals/${id}`, formToObject(e.currentTarget)); setMsg(r.ok ? 'حُفظ التعديل بسبب مسجل' : r.error); if (r.ok) { router.refresh(); setOpen(false); }
  }
  return (
    <div className="mt-2 space-y-2 text-[11px]">
      <div className="flex gap-2"><Btn type="button" kind="ghost" onClick={() => setOpen((v) => !v)}>تعديل الهدف</Btn>
        <Btn type="button" kind="ghost" onClick={async () => { const reason = prompt('سبب الأرشفة:'); if (!reason) return; const r = await call('DELETE', `/goals/${id}?reason=${encodeURIComponent(reason)}`); setMsg(r.ok ? 'أُرشف' : r.error); if (r.ok) router.refresh(); }}>أرشفة</Btn></div>
      {open && <form onSubmit={submit} className="grid gap-2 sm:grid-cols-3"><input name="target_value" type="number" step="0.01" placeholder="الهدف الجديد" className={inputCls} /><input name="reason" required placeholder="سبب التعديل *" className={inputCls} /><Btn type="submit">حفظ</Btn></form>}
      <Status msg={msg} ok={!!msg && !msg.includes('HTTP')} />
    </div>
  );
}

export function ScenarioInputsForm({ initial }: { initial: Record<string, any> }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false);
  const g = (k: string) => initial?.[k]?.value ?? '';
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = formToObject(e.currentTarget);
    const wrap = (k: string) => (f[k] === '' || f[k] == null ? null : { value: Number(f[k]), source: (f[`${k}_source`] as string) || 'assumption', note: (f[`${k}_note`] as string) || undefined });
    const body = { scenario_inputs: { commission_per_linked_exit_sar: wrap('commission_per_linked_exit_sar'), monthly_operating_cost_sar: wrap('monthly_operating_cost_sar'), linked_exits_monthly: wrap('linked_exits_monthly'), acquisition_cost_per_linked_exit_sar: wrap('acquisition_cost_per_linked_exit_sar'), growth_conservative: Number(f.growth_conservative ?? 0) / 100, growth_base: Number(f.growth_base ?? 10) / 100, growth_optimistic: Number(f.growth_optimistic ?? 25) / 100 } };
    const r = await call('PATCH', '/settings', body); setOk(r.ok); setMsg(r.ok ? 'حُفظت المدخلات (افتراضات معلنة)' : r.error); if (r.ok) router.refresh();
  }
  const row = (k: string, label: string, hint: string) => (
    <div className="grid grid-cols-3 gap-1 sm:col-span-2">
      <label className="col-span-3 sm:col-span-1"><span className={labelCls}>{label}</span><input name={k} type="number" step="0.01" defaultValue={g(k)} className={inputCls} /></label>
      <label><span className={labelCls}>المصدر</span><select name={`${k}_source`} defaultValue={initial?.[k]?.source ?? 'assumption'} className={inputCls}><option value="assumption">افتراض</option><option value="measured">مقاس</option></select></label>
      <label className="col-span-2 sm:col-span-1"><span className={labelCls}>ملاحظة</span><input name={`${k}_note`} defaultValue={initial?.[k]?.note ?? ''} className={inputCls} placeholder={hint} /></label>
    </div>
  );
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {row('commission_per_linked_exit_sar', 'عمولة معتمدة لكل خروج مرتبط (ر.س)', 'من تقارير الشريك ÷ الخروج المرتبط')}
      {row('monthly_operating_cost_sar', 'تكلفة التشغيل الشهرية (ر.س)', 'فارغ = من سجل المصروفات')}
      {row('linked_exits_monthly', 'خروج مرتبط شهري', 'فارغ = آخر 30 يومًا')}
      {row('acquisition_cost_per_linked_exit_sar', 'تكلفة استحواذ لكل خروج مرتبط (ر.س)', 'إنفاق الحملة ÷ الخروج المرتبط منها')}
      <div className="grid grid-cols-3 gap-1 sm:col-span-2">
        {[['growth_conservative', 'نمو محافظ %', 0], ['growth_base', 'نمو أساسي %', 10], ['growth_optimistic', 'نمو متفائل %', 25]].map(([k, l, d]) => <label key={k as string}><span className={labelCls}>{l}</span><input name={k as string} type="number" step="1" defaultValue={initial?.[k as string] != null ? Math.round(initial[k as string] * 100) : (d as number)} className={inputCls} /></label>)}
      </div>
      <div className="flex items-center gap-2 sm:col-span-2"><Btn type="submit">حفظ مدخلات السيناريو</Btn><Status msg={msg} ok={ok} /></div>
    </form>
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────
export function GenerateSummaryButton({ sp }: { sp: { w?: string; start?: string; end?: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn type="button" disabled={busy} onClick={async () => { setBusy(true); setMsg(null); const r = await call('POST', '/summary', { ...sp, withAi: true }); setBusy(false); setOk(r.ok); setMsg(r.ok ? `وُلّد الملخص (الذكاء الاصطناعي: ${r.data.summary.aiStatus}${r.data.summary.aiReason ? ` — ${r.data.summary.aiReason}` : ''})` : r.error); if (r.ok) router.refresh(); }}>{busy ? 'جارٍ التوليد…' : 'توليد ملخص الآن'}</Btn>
      <Status msg={msg} ok={ok} />
    </div>
  );
}

// ── Subscriptions & commitments ─────────────────────────────────────────────
export function SubscriptionForm({ initial }: { initial?: Record<string, any> | null }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({}); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false);
  const [kind, setKind] = useState(initial?.kind ?? 'fixed');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const body = formToObject(e.currentTarget);
    const r = initial?.id ? await call('PATCH', `/subscriptions/${initial.id}`, body) : await call('POST', '/subscriptions', body);
    setErrors(r.fieldErrors); setOk(r.ok); setMsg(r.ok ? 'حُفظ الاشتراك' : r.error); if (r.ok) { router.refresh(); if (!initial?.id) (e.target as HTMLFormElement).reset(); }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="المورد *" name="vendor" errors={errors}><input name="vendor" required defaultValue={initial?.vendor ?? ''} className={inputCls} /></Field>
      <Field label="الفئة *" name="category" errors={errors}><select name="category" defaultValue={initial?.category ?? 'ai'} className={inputCls}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_AR[c]}</option>)}</select></Field>
      <Field label="النوع *" name="kind" errors={errors} hint="الثابت ينشئ قيدًا متوقعًا في التجديد؛ المتغير ميزانية تقديرية فقط وتُدخل فاتورته شهريًا"><select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}><option value="fixed">اشتراك ثابت</option><option value="variable_budget">متغير — ميزانية تقديرية</option></select></Field>
      <Field label="الحالة" name="status" errors={errors}><select name="status" defaultValue={initial?.status ?? 'active'} className={inputCls}><option value="active">فعال</option><option value="needs_confirmation">يحتاج تأكيد المؤسس</option><option value="paused">موقوف</option><option value="ended">منتهٍ</option></select></Field>
      <Field label={kind === 'fixed' ? 'المبلغ الشهري (ر.س) *' : 'الميزانية التقديرية الشهرية (ر.س) *'} name="amount_sar" errors={errors}><input name="amount_sar" type="number" step="0.01" min="0" defaultValue={initial?.amount_sar ?? ''} className={inputCls} /></Field>
      <Field label="الدورة" name="cadence" errors={errors}><select name="cadence" defaultValue={initial?.cadence ?? 'monthly'} className={inputCls}><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></Field>
      {kind === 'fixed' ? <Field label="تاريخ التجديد القادم *" name="next_renewal_at" errors={errors}><input name="next_renewal_at" type="date" defaultValue={initial?.next_renewal_at ?? ''} className={inputCls} /></Field>
        : <Field label="مصدر التقدير *" name="budget_source" errors={errors}><input name="budget_source" defaultValue={initial?.budget_source ?? ''} className={inputCls} placeholder="متوسط آخر 3 فواتير" /></Field>}
      <Field label="الوصف / ملاحظات" name="notes" errors={errors}><input name="notes" defaultValue={initial?.notes ?? ''} className={inputCls} /></Field>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><Btn type="submit">{initial?.id ? 'حفظ' : 'إضافة التزام'}</Btn><Status msg={msg} ok={ok} /></div>
    </form>
  );
}

/** Turns a subscription draft (payment_status=expected) into a PAID expense — only with a date and a reference. */
export function ConfirmExpectedButton({ expenseId, defaultDate }: { expenseId: string; defaultDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false); const [errors, setErrors] = useState<FieldErrors>({});
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = formToObject(e.currentTarget);
    const r = await call('PATCH', `/expenses/${expenseId}`, { payment_status: 'paid', paid_at: f.paid_at, evidence_ref: f.evidence_ref, evidence_state: 'documented', note: 'تأكيد فاتورة/خصم اشتراك' });
    setErrors(r.fieldErrors); setOk(r.ok); setMsg(r.ok ? 'أُكد الدفع وأصبح القيد مدفوعًا' : r.error); if (r.ok) { router.refresh(); setOpen(false); }
  }
  return (
    <div className="text-[11px]">
      <Btn type="button" onClick={() => setOpen((v) => !v)}>{open ? 'إغلاق' : 'تأكيد الدفع (فاتورة/خصم)'}</Btn>
      {open && <form onSubmit={submit} className="mt-2 grid gap-2 sm:grid-cols-3">
        <Field label="تاريخ الخصم *" name="paid_at" errors={errors}><input name="paid_at" type="date" required defaultValue={defaultDate} className={inputCls} /></Field>
        <Field label="مرجع الفاتورة/الخصم *" name="evidence_ref" errors={errors}><input name="evidence_ref" required className={inputCls} placeholder="رقم الفاتورة أو سطر كشف البطاقة" /></Field>
        <div className="flex items-end"><Btn type="submit">تأكيد</Btn></div>
      </form>}
      <Status msg={msg} ok={ok} />
    </div>
  );
}

export function DeleteButton({ path, label = 'حذف', confirmText = 'تأكيد الحذف (حذف ناعم، يبقى في سجل التدقيق)؟' }: { path: string; label?: string; confirmText?: string }) {
  const router = useRouter();
  return <button type="button" className="text-[11px] font-bold text-red-700 underline decoration-dotted dark:text-red-300" onClick={async () => { if (!confirm(confirmText)) return; const r = await call('DELETE', path); if (r.ok) router.refresh(); else alert(r.error); }}>{label}</button>;
}

export function EditToggle({ children, label = 'تعديل' }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return <div><button type="button" className="text-[11px] font-bold text-[#1f6f59] underline decoration-dotted" onClick={() => setOpen((v) => !v)}>{open ? 'إغلاق' : label}</button>{open && <div className="mt-2 rounded-xl border border-[#eef6f2] p-3 dark:border-white/10">{children}</div>}</div>;
}
