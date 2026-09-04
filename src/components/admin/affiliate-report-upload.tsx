'use client';

import { useCallback, useEffect, useState } from 'react';
import { Upload, FileCheck2, AlertTriangle } from 'lucide-react';
import { CANONICAL_FIELDS, type CanonicalField } from '@/lib/admin/affiliate-csv';

interface ReportSummary {
  id: string;
  source: string;
  original_filename: string | null;
  row_count: number;
  imported_rows: number;
  rejected_rows: number;
  created_at: string;
  matchTiers: Record<string, number>;
}

const FIELD_LABELS: Record<CanonicalField, { en: string; ar: string; required?: boolean }> = {
  trackingId: { en: 'Tracking ID / sub-tag', ar: 'رقم التتبع', required: true },
  asinOrSku: { en: 'ASIN / SKU', ar: 'رمز المنتج' },
  itemName: { en: 'Item name', ar: 'اسم المنتج', required: true },
  orderDate: { en: 'Order date', ar: 'تاريخ الطلب' },
  shipDate: { en: 'Ship date', ar: 'تاريخ الشحن' },
  quantity: { en: 'Quantity', ar: 'الكمية' },
  price: { en: 'Price', ar: 'السعر' },
  commissionAmount: { en: 'Commission amount', ar: 'مبلغ العمولة' },
  state: { en: 'Status / state', ar: 'الحالة' },
};

export function AffiliateReportUpload({ locale }: { locale: string }) {
  const isRTL = locale === 'ar';
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<CanonicalField, string>>>({});
  const [source, setSource] = useState('amazon_associates');
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);

  const loadReports = useCallback(() => {
    fetch('/api/admin/affiliate/reports').then((r) => r.json()).then((d) => setReports(d.reports || [])).catch(() => {});
  }, []);
  useEffect(() => { loadReports(); }, [loadReports]);

  const onFile = async (f: File | null) => {
    setFile(f);
    setResult(null);
    if (!f) { setHeaders([]); return; }
    const head = await f.slice(0, 8192).text();
    const firstLine = head.split(/\r?\n/)[0] || '';
    setHeaders(firstLine.split(',').map((h) => h.replace(/^"|"$/g, '').trim()).filter(Boolean));
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('source', source);
      fd.set('mapping', JSON.stringify(mapping));
      if (dryRun) fd.set('dryRun', '1');
      const res = await fetch('/api/admin/affiliate/reports', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(res.ok ? data : { error: data.error || 'Import failed' });
      if (res.ok && !dryRun) loadReports();
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Import failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
      <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">
        {isRTL ? 'استيراد تقرير أمازون العمولات' : 'Import Amazon Associates report'}
      </h2>
      <p className="mt-1 text-xs text-on-surface-variant dark:text-white/50">
        {isRTL
          ? 'CSV يدوي فقط — لا يوجد API متاح لهذا النوع من الحسابات. رفع نفس الملف مرة أخرى لا يكرر البيانات.'
          : 'Manual CSV only — no self-serve API exists for this account tier. Re-uploading the same file is a no-op.'}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs font-bold text-on-surface-variant dark:text-white/50">
            {isRTL ? 'المصدر' : 'Source'}
            <select value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1.5 text-sm dark:border-[#263b33]">
              <option value="amazon_associates">amazon_associates</option>
              <option value="noon_affiliate">noon_affiliate</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-on-surface-variant dark:text-white/50">
            {isRTL ? 'ملف CSV' : 'CSV file'}
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] || null)} className="mt-1 w-full text-sm" />
          </label>
          {headers.length > 0 && (
            <datalist id="csv-headers">{headers.map((h) => <option key={h} value={h} />)}</datalist>
          )}
          <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant dark:text-white/50">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            {isRTL ? 'معاينة فقط (بدون حفظ)' : 'Preview only (no write)'}
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-on-surface-variant dark:text-white/50">
            {isRTL ? 'ربط الأعمدة' : 'Column mapping'} {headers.length === 0 && `(${isRTL ? 'اختر ملفاً أولاً' : 'choose a file first'})`}
          </p>
          {CANONICAL_FIELDS.map((field) => (
            <div key={field} className="flex items-center gap-2 text-xs">
              <label className="w-40 shrink-0 text-on-surface-variant dark:text-white/60">
                {isRTL ? FIELD_LABELS[field].ar : FIELD_LABELS[field].en}
                {FIELD_LABELS[field].required && <span className="text-red-500">*</span>}
              </label>
              <input
                list="csv-headers"
                placeholder={isRTL ? 'اسم العمود في الملف' : 'CSV header name'}
                value={mapping[field] || ''}
                onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                className="flex-1 rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={!file || busy}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1f6f59] px-4 py-2 text-sm font-black text-white disabled:opacity-40"
      >
        <Upload className="h-4 w-4" />
        {busy ? (isRTL ? 'جاري الاستيراد…' : 'Importing…') : (isRTL ? 'استيراد' : 'Import')}
      </button>

      {result && (
        <div className={`mt-4 rounded-xl p-3 text-sm ${result.error ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'}`}>
          {result.error ? (
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{String(result.error)}</span>
          ) : result.alreadyImported ? (
            <span className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" />{isRTL ? 'تم استيراد هذا الملف مسبقاً.' : 'This file was already imported.'}</span>
          ) : result.dryRun ? (
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2 font-bold"><FileCheck2 className="h-4 w-4" />{isRTL ? 'معاينة فقط — لم يتم الحفظ' : 'Preview only — nothing was saved'}</span>
              <span>{isRTL ? 'سيتم استيراد' : 'Would import'} {String(result.wouldImportRows)} / {String(result.rowCount)}
                {Number(result.wouldRejectRows) > 0 && ` · ${isRTL ? 'سيُرفض' : 'would reject'}: ${result.wouldRejectRows}`}
              </span>
              {Array.isArray(result.unknownTrackingIds) && result.unknownTrackingIds.length > 0 && (
                <span className="text-amber-700 dark:text-amber-300">
                  {isRTL ? 'أرقام تتبع غير معروفة:' : 'Unrecognized tracking IDs:'} {(result.unknownTrackingIds as string[]).join(', ')}
                </span>
              )}
            </span>
          ) : (
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" />
                {isRTL ? 'تم' : 'Imported'} {String(result.importedRows)} / {String(result.rowCount)}
                {Number(result.rejectedRows) > 0 && ` · ${isRTL ? 'مرفوض' : 'rejected'}: ${result.rejectedRows}`}
                {' · '}{JSON.stringify(result.matchSummary)}
              </span>
              {Array.isArray(result.unknownTrackingIds) && result.unknownTrackingIds.length > 0 && (
                <span className="text-amber-700 dark:text-amber-300">
                  {isRTL ? 'أرقام تتبع غير معروفة:' : 'Unrecognized tracking IDs:'} {(result.unknownTrackingIds as string[]).join(', ')}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <div className="mt-6">
        <p className="text-xs font-bold text-on-surface-variant dark:text-white/50">{isRTL ? 'التقارير المستوردة' : 'Imported reports'}</p>
        <div className="mt-2 space-y-2">
          {reports.length === 0 && <p className="text-xs text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد تقارير بعد' : 'No reports yet'}</p>}
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#eef6f2] p-3 text-xs dark:border-[#1c261f]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-on-surface dark:text-white">{r.source} — {r.original_filename}</span>
                <span className="text-on-surface-variant dark:text-white/40">{new Date(r.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</span>
              </div>
              <p className="mt-1 text-on-surface-variant dark:text-white/50">
                {r.imported_rows}/{r.row_count} {isRTL ? 'مستورد' : 'imported'} · EXACT={r.matchTiers.EXACT || 0} · PROBABLE={r.matchTiers.PROBABLE || 0} · AGGREGATE_ONLY={r.matchTiers.AGGREGATE_ONLY || 0} · UNMATCHED={r.matchTiers.UNMATCHED || 0}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
