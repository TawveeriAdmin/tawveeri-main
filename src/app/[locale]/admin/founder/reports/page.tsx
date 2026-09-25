import Link from 'next/link';
import { windowFromSearchParams } from '@/lib/founder/api';
import { buildFounderReport, buildInvestorReport, buildStoreReport, type Report } from '@/lib/founder/reports';
import { listRetailerOptions } from '@/lib/admin/retailer-report-queries';
import { formatRiyadh } from '@/lib/founder/windows';
import { FCard, SectionTitle, WindowPicker, EmptyNote, Tag } from '@/components/founder/ui';
import { PrintButton } from '@/components/admin/print-button';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string; kind?: string; store?: string };

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const kind = sp.kind === 'investor' ? 'investor' : sp.kind === 'store' ? 'store' : 'founder';
  const stores = listRetailerOptions();
  const store = sp.store && stores.some((s) => s.slug === sp.store) ? sp.store : null;
  const base = `/${locale}/admin/founder/reports`;
  const qsWin = `${sp.w ? `&w=${sp.w}` : ''}${sp.start && sp.end ? `&start=${sp.start}&end=${sp.end}` : ''}`;
  let report: Report | null = null; let error: string | null = null;
  try { report = kind === 'investor' ? await buildInvestorReport(w) : kind === 'store' ? (store ? await buildStoreReport(w, store) : null) : await buildFounderReport(w); } catch (e) { error = e instanceof Error ? e.message : 'خطأ'; }
  const exportHref = (format: 'json' | 'csv') => `/api/admin/founder/export?kind=${kind}${store ? `&store=${store}` : ''}${qsWin}&format=${format}`;

  return (
    <div className="space-y-6">
      <FCard className="space-y-3 print:hidden">
        <WindowPicker current={w} basePath={base} sp={sp} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[['founder', 'تقرير المؤسس'], ['investor', 'تقرير المستثمر'], ['store', 'تقرير متجر']].map(([k, l]) => <Link key={k} href={`${base}?kind=${k}${qsWin}`} className={`rounded-full px-3 py-1.5 font-black ${kind === k ? 'bg-[#0f3d31] text-white' : 'border border-[#d7ece5] dark:border-[#263b33]'}`}>{l}</Link>)}
          {kind === 'store' && <form method="get" className="flex items-center gap-1"><input type="hidden" name="kind" value="store" />{sp.w && <input type="hidden" name="w" value={sp.w} />}{sp.start && sp.end && <><input type="hidden" name="start" value={sp.start} /><input type="hidden" name="end" value={sp.end} /></>}<select name="store" defaultValue={store ?? ''} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]"><option value="">اختر متجرًا</option>{stores.map((s) => <option key={s.slug} value={s.slug}>{s.displayNameAr}</option>)}</select><button className="rounded-lg bg-[#1f6f59] px-3 py-1 font-black text-white">عرض</button></form>}
          {report && <><a href={exportHref('json')} className="underline decoration-dotted">تصدير JSON</a><a href={exportHref('csv')} className="underline decoration-dotted">تصدير CSV</a><PrintButton label="طباعة / PDF" /></>}
        </div>
        <p className="text-[11px] text-on-surface-variant dark:text-white/55">راجع التقرير قبل مشاركته؛ لا مشاركة تلقائية خارجية. تقرير المتجر لا يكشف بيانات أفراد ولا أرقام متاجر أخرى.</p>
      </FCard>
      {error && <EmptyNote>{error}</EmptyNote>}
      {!report && !error && <EmptyNote>اختر متجرًا لعرض تقريره.</EmptyNote>}
      {report && (
        <article className="space-y-4">
          <FCard>
            <p className="text-[11px] font-black text-[#1f6f59]">توفيري · {report.audienceAr}</p>
            <h2 className="text-2xl font-black">{report.titleAr}</h2>
            <p className="mt-1 text-xs text-on-surface-variant dark:text-white/55">الفترة: {report.window.labelAr} ({formatRiyadh(report.window.start)} → {formatRiyadh(report.window.end)}) {report.window.partial && <Tag tone="warn">جزئية</Tag>} · الاستخراج: {formatRiyadh(report.extractedAt)} · نسخة التعريف {report.definitionVersion}</p>
            <p className="mt-1 text-[11px] text-on-surface-variant dark:text-white/50">المصادر: {report.sources.join('، ')}</p>
          </FCard>
          {report.sections.map((s) => (
            <FCard key={s.titleAr}>
              <SectionTitle>{s.titleAr}</SectionTitle>
              {s.rows.length === 0 ? <EmptyNote>لا بيانات</EmptyNote> : (
                <dl className="divide-y divide-[#eef6f2] dark:divide-white/10">{s.rows.map((r, i) => <div key={i} className="grid gap-1 py-2 text-sm sm:grid-cols-[minmax(160px,1fr)_2fr]"><dt className="text-xs font-black text-on-surface-variant dark:text-white/60">{r.labelAr}</dt><dd><span className="tabular-nums">{r.value}</span>{r.noteAr && <p className="text-[11px] text-on-surface-variant dark:text-white/50">{r.noteAr}</p>}</dd></div>)}</dl>
              )}
            </FCard>
          ))}
          <FCard tone="muted"><SectionTitle>حدود القياس</SectionTitle><ul className="list-disc space-y-1 ps-4 text-xs">{report.limitationsAr.map((l, i) => <li key={i}>{l}</li>)}</ul></FCard>
        </article>
      )}
    </div>
  );
}
