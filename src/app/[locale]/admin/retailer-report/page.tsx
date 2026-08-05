import type { Metadata } from 'next';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { getRetailerReport, listRetailerOptions, buildRetailerNarrative } from '@/lib/admin/retailer-report-queries';
import type { Period } from '@/lib/admin/command-center-queries';
import { PrintButton } from '@/components/admin/print-button';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PERIODS: Period[] = ['today', 'yesterday', '7d', '30d'];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 print:rounded-none print:border-0 print:p-0 dark:border-[#263b33] dark:bg-[#141c18] ${className}`}>
      {children}
    </div>
  );
}

export default async function RetailerReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ storeId?: string; period?: string; start?: string; end?: string; historical?: string }>;
}) {
  const { locale } = await params;
  const isRTL = locale === 'ar';
  const sp = await searchParams;
  const options = listRetailerOptions();
  const storeId = Number(sp.storeId) || options[0]?.storeId;
  const period: Period = (PERIODS as string[]).includes(sp.period || '') ? (sp.period as Period) : (sp.start && sp.end ? 'custom' : '30d');
  const includeHistorical = sp.historical === '1';

  const report = storeId ? await getRetailerReport(storeId, period, sp.start, sp.end, includeHistorical) : null;
  const narrative = report ? buildRetailerNarrative(report, isRTL) : '';

  const periodLabel = (p: Period) => ({
    today: isRTL ? 'اليوم' : 'Today', yesterday: isRTL ? 'أمس' : 'Yesterday',
    '7d': isRTL ? '7 أيام' : '7 days', '30d': isRTL ? '30 يوم' : '30 days', custom: isRTL ? 'مخصص' : 'Custom',
  })[p];

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ storeId: String(storeId ?? ''), period });
    if (includeHistorical) p.set('historical', '1');
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return `?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Controls — hidden when printing */}
      <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 print:hidden dark:border-[#263b33] dark:bg-[#141c18]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59] dark:text-[#9fe4d0]">
              {isRTL ? 'دليل تجاري' : 'Commercial evidence'}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-on-surface md:text-3xl dark:text-white">
              {isRTL ? 'تقرير شراكة المتجر' : 'Retailer Partnership Report'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {report?.retailer && (
              <>
                <a href={`/api/admin/retailer-report/export${qs({})}`} className="inline-flex items-center gap-1.5 rounded-full border border-[#d7ece5] px-3.5 py-1.5 text-xs font-black text-on-surface-variant hover:bg-[#f8fcfa] dark:border-[#263b33] dark:text-white/60">
                  <Download className="h-3.5 w-3.5" /> {isRTL ? 'CSV' : 'CSV'}
                </a>
                <PrintButton label={isRTL ? 'طباعة / PDF' : 'Print / PDF'} />
              </>
            )}
          </div>
        </div>

        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-on-surface-variant dark:text-white/50">
            {isRTL ? 'المتجر' : 'Retailer'}
            <select name="storeId" defaultValue={storeId} className="mt-1 block rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1.5 text-sm dark:border-[#263b33]">
              {options.map((o) => (
                <option key={o.storeId} value={o.storeId}>{isRTL ? o.displayNameAr : o.displayName}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Link key={p} href={qs({ period: p })} className={`rounded-full px-3 py-1.5 text-xs font-black ${period === p ? 'bg-[#1f6f59] text-white' : 'border border-[#d7ece5] text-on-surface-variant dark:border-[#263b33] dark:text-white/60'}`}>
                {periodLabel(p)}
              </Link>
            ))}
          </div>
          <input type="hidden" name="period" value="custom" />
          <input type="date" name="start" defaultValue={sp.start} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 text-sm dark:border-[#263b33]" />
          <input type="date" name="end" defaultValue={sp.end} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 text-sm dark:border-[#263b33]" />
          <button type="submit" className="rounded-lg bg-[#1f6f59] px-3 py-1.5 text-sm font-black text-white">{isRTL ? 'تطبيق' : 'Apply'}</button>
        </form>
      </section>

      {!report?.retailer ? (
        <Card><p className="text-sm text-on-surface-variant dark:text-white/50">{isRTL ? 'اختر متجراً' : 'Select a retailer'}</p></Card>
      ) : (
        <>
          {/* Print header — visible only when printing */}
          <div className="hidden print:block">
            <h1 className="text-xl font-black">{isRTL ? 'تقرير شراكة توفيري' : 'Tawveeri Partnership Report'} — {isRTL ? report.retailer.displayNameAr : report.retailer.displayName}</h1>
            <p className="text-xs text-gray-600">{isRTL ? 'تم الإنشاء' : 'Generated'}: {new Date(report.generatedAt).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</p>
          </div>

          <Card>
            <p className="text-sm leading-7 text-on-surface dark:text-white">{narrative}</p>
            <p className="mt-2 text-xs text-on-surface-variant dark:text-white/40">
              {isRTL ? 'تم الإنشاء' : 'Generated'}: {new Date(report.generatedAt).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ·{' '}
              {isRTL ? 'حجم العينة' : 'Sample size'}: {report.sampleSize} {isRTL ? 'تحويلة' : 'redirects'}
              {report.sampleSize < 30 && <span className="ms-2 font-black text-amber-600 dark:text-amber-400">{isRTL ? 'إشارة مبكرة' : 'EARLY SIGNAL'}</span>}
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { label: isRTL ? 'زيارات مؤهلة' : 'Qualified visits', value: report.qualifiedSessions },
              { label: isRTL ? 'تحويلات مؤكدة' : 'Confirmed redirects', value: report.confirmedRedirects },
              { label: isRTL ? 'منتجات فريدة' : 'Unique products', value: report.uniqueProducts },
              { label: isRTL ? 'حملة معروفة' : 'Known campaign', value: `${report.acquisition.withKnownCampaign}/${report.acquisition.withKnownCampaign + report.acquisition.unknownCampaign}` },
            ].map((s) => (
              <Card key={s.label}>
                <p className="text-xs font-bold text-on-surface-variant dark:text-white/50">{s.label}</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-on-surface dark:text-white">{s.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'أعلى المنتجات' : 'Top products'}</h2>
              <div className="mt-3 space-y-1.5 text-sm">
                {report.topProducts.length === 0 && <p className="text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات' : 'No data'}</p>}
                {report.topProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-on-surface-variant dark:text-white/60">{isRTL ? p.nameAr : p.nameEn}</span>
                    <span className="shrink-0 font-bold tabular-nums text-on-surface dark:text-white">{p.count}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'أعلى الفئات' : 'Top categories'}</h2>
              <div className="mt-3 space-y-1.5 text-sm">
                {report.topCategories.length === 0 && <p className="text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات' : 'No data'}</p>}
                {report.topCategories.map((c) => (
                  <div key={c.category} className="flex items-center justify-between">
                    <span className="text-on-surface-variant dark:text-white/60">{c.category}</span>
                    <span className="font-bold tabular-nums text-on-surface dark:text-white">{c.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'الاتجاه اليومي' : 'Daily trend'}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-xs font-bold text-on-surface-variant dark:text-white/50">
                    <th className="pb-2 text-start">{isRTL ? 'التاريخ' : 'Date'}</th>
                    <th className="pb-2 text-end">{isRTL ? 'تحويلات' : 'Redirects'}</th>
                    <th className="pb-2 text-end">{isRTL ? 'زيارات مؤهلة' : 'Qualified sessions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyTrend.length === 0 && <tr><td colSpan={3} className="py-3 text-center text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات' : 'No data'}</td></tr>}
                  {report.dailyTrend.map((d) => (
                    <tr key={d.date} className="border-t border-[#eef6f2] dark:border-[#1c261f]">
                      <td className="py-2">{d.date}</td>
                      <td className="py-2 text-end tabular-nums">{d.redirects}</td>
                      <td className="py-2 text-end tabular-nums">{d.qualifiedSessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'حدود معروفة' : 'Known limitations'}</h2>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-on-surface-variant dark:text-white/50">
              {report.limitations.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
