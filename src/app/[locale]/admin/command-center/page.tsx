import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Search, FileSearch, Eye, Scale, BookOpen, ExternalLink,
} from 'lucide-react';
import { getCommandCenterData, type Period } from '@/lib/admin/command-center-queries';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PERIODS: Period[] = ['today', 'yesterday', '7d', '30d'];

function fpct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function trend(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? { dir: 'up' as const, pct: null } : null;
  const delta = (current - previous) / previous;
  return { dir: delta >= 0 ? ('up' as const) : ('down' as const), pct: Math.abs(delta) };
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18] ${className}`}>
      {children}
    </div>
  );
}

export default async function CommandCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const { locale } = await params;
  const isRTL = locale === 'ar';
  const sp = await searchParams;
  const period: Period = (PERIODS as string[]).includes(sp.period || '') ? (sp.period as Period) : (sp.start && sp.end ? 'custom' : '30d');

  const data = await getCommandCenterData(period, sp.start, sp.end);
  const { real, test, prevReal, kpis, gate, surfaces, topDemand, unmetDemand, outboundReal, outboundTest, quality } = data;

  const periodLabel = (p: Period) => ({
    today: isRTL ? 'اليوم' : 'Today',
    yesterday: isRTL ? 'أمس' : 'Yesterday',
    '7d': isRTL ? '7 أيام' : '7 days',
    '30d': isRTL ? '30 يوم' : '30 days',
    custom: isRTL ? 'مخصص' : 'Custom',
  })[p];

  const headline = [
    { label: isRTL ? 'الجلسات (حقيقية)' : 'Real sessions', value: real.sessions, prev: prevReal.sessions },
    { label: isRTL ? 'عمليات البحث' : 'Searches', value: real.search, prev: prevReal.search },
    { label: isRTL ? 'مقارنات مفتوحة' : 'Comparisons opened', value: real.comparisonView, prev: prevReal.comparisonView },
    { label: isRTL ? 'الخروج للمتاجر' : 'Retailer outbound clicks', value: real.outbound, prev: prevReal.outbound },
  ];

  return (
    <div className="space-y-6">
      {/* Header + period filter */}
      <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59] dark:text-[#9fe4d0]">
              {isRTL ? 'مركز قيادة المؤسس' : 'Founder Commerce Command Center'}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-on-surface md:text-3xl dark:text-white">
              {isRTL ? 'حالة العمل الآن' : 'The business, right now'}
            </h1>
            <p className="mt-1 text-xs text-on-surface-variant dark:text-white/50">
              {isRTL ? 'آخر تحديث' : 'Last updated'}: {new Date().toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ·{' '}
              {isRTL ? 'التعريفات: docs/METRIC_DEFINITIONS.md' : 'Definitions: docs/METRIC_DEFINITIONS.md'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`?period=${p}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-black transition-colors ${
                  period === p
                    ? 'bg-[#1f6f59] text-white'
                    : 'border border-[#d7ece5] text-on-surface-variant hover:bg-[#f8fcfa] dark:border-[#263b33] dark:text-white/60'
                }`}
              >
                {periodLabel(p)}
              </Link>
            ))}
          </div>
        </div>
        <form method="get" className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-on-surface-variant dark:text-white/50">{isRTL ? 'نطاق مخصص:' : 'Custom range:'}</span>
          <input type="date" name="start" defaultValue={sp.start} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]" />
          <input type="date" name="end" defaultValue={sp.end} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]" />
          <button type="submit" className="rounded-lg bg-[#1f6f59] px-3 py-1 font-black text-white">{isRTL ? 'تطبيق' : 'Apply'}</button>
        </form>
      </section>

      {/* Data-quality banner (Rule 6/7/8 — never hide missing/stale data) */}
      {(quality.trackingStopped || !quality.amazonTagConfigured || (quality.goClickOutboundDivergencePct ?? 0) > 0.15) && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
              {quality.trackingStopped && <p>{isRTL ? 'لم يتم رصد أي حدث تتبع خلال آخر 6 ساعات — تحقق من التتبع.' : 'No tracking event in the last 6 hours — check instrumentation.'}</p>}
              {!quality.amazonTagConfigured && <p>{isRTL ? 'كود أمازون التابع غير مُهيأ في stores.affiliate_config.' : 'Amazon affiliate tag is not configured in stores.affiliate_config.'}</p>}
              {(quality.goClickOutboundDivergencePct ?? 0) > 0.15 && <p>{isRTL ? `تباين ${fpct(quality.goClickOutboundDivergencePct!)} بين go_click و outbound_clicks — أحد المسارين يفقد أحداثاً.` : `${fpct(quality.goClickOutboundDivergencePct!)} divergence between go_click events and outbound_clicks rows — one pipe is dropping events.`}</p>}
            </div>
          </div>
        </Card>
      )}

      {/* Real vs test disclosure — Rule 2, never blended */}
      <p className="text-xs font-semibold text-on-surface-variant dark:text-white/50">
        {isRTL ? 'حقيقي فقط في كل الأرقام أدناه.' : 'REAL only in every number below.'}{' '}
        {isRTL ? 'حركة اختبار مستبعدة' : 'TEST traffic excluded'}: {isRTL ? 'جلسات' : 'sessions'}={test.sessions}, {isRTL ? 'بحث' : 'search'}={test.search}, {isRTL ? 'خروج' : 'outbound'}={test.outbound}.
      </p>

      {/* Headline cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headline.map((h) => {
          const tr = trend(h.value, h.prev);
          return (
            <Card key={h.label}>
              <p className="text-xs font-bold text-on-surface-variant dark:text-white/50">{h.label}</p>
              <p className="mt-2 text-3xl font-black tabular-nums text-on-surface dark:text-white">{h.value}</p>
              {tr && (
                <p className={`mt-1 text-xs font-bold ${tr.dir === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {tr.dir === 'up' ? '▲' : '▼'} {tr.pct !== null ? fpct(tr.pct) : (isRTL ? 'جديد' : 'new')} {isRTL ? 'مقابل الفترة السابقة' : 'vs previous period'}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Funnel */}
      <Card>
        <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'رحلة العميل الكاملة' : 'Full customer journey'}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Search, label: isRTL ? 'بحث' : 'Search', value: real.search, conv: null },
            { icon: FileSearch, label: isRTL ? 'نتائج' : 'Results', value: real.results, conv: fpct(kpis.answerRate) },
            { icon: Eye, label: isRTL ? 'فتح منتج' : 'Product view', value: real.productView, conv: fpct(kpis.searchToProduct) },
            { icon: Scale, label: isRTL ? 'مقارنة' : 'Comparison', value: real.comparisonView, conv: fpct(kpis.productToCompare) },
            { icon: BookOpen, label: isRTL ? 'دليل' : 'Evidence', value: real.evidenceView, conv: null },
            { icon: ExternalLink, label: isRTL ? 'خروج' : 'Outbound', value: real.outbound, conv: fpct(kpis.compareToExit) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#eef6f2] p-3 text-center dark:border-[#1c261f]">
              <s.icon className="mx-auto h-4 w-4 text-[#1f6f59] dark:text-[#9fe4d0]" />
              <p className="mt-1 text-[11px] font-bold text-on-surface-variant dark:text-white/50">{s.label}</p>
              <p className="text-xl font-black tabular-nums text-on-surface dark:text-white">{s.value}</p>
              {s.conv && <p className="text-[10px] text-on-surface-variant dark:text-white/40">{s.conv}</p>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-on-surface-variant dark:text-white/50">
          {isRTL ? 'بدون نتيجة' : 'No-answer'}={real.noAnswer} · {isRTL ? 'أخطاء' : 'errors'}={real.errors} · {isRTL ? 'بحث→خروج إجمالي' : 'overall Search→Exit'}={fpct(kpis.searchToExit)}
        </p>
      </Card>

      {/* Launch-readiness gate */}
      <Card>
        <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'بوابة جاهزية الإطلاق' : 'Launch-readiness gate'}</h2>
        <div className="mt-3 space-y-1.5">
          {gate.checks.map((c) => (
            <div key={c.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-on-surface-variant dark:text-white/60">
                {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                {c.label}
              </span>
              <span className="font-bold tabular-nums text-on-surface dark:text-white">{c.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-[#f8fcfa] p-3 text-sm font-black text-[#1f6f59] dark:bg-[#101713] dark:text-[#9fe4d0]">{gate.verdict}</p>
      </Card>

      {/* Commerce / affiliate */}
      <Card>
        <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'التجارة والعمولات' : 'Commerce & affiliate'}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-on-surface-variant dark:text-white/50">{isRTL ? 'نقرات خروج مقاسة' : 'Measured exits'}</p>
            <p className="text-2xl font-black tabular-nums text-on-surface dark:text-white">{outboundReal.clicks}</p>
            <p className="text-xs text-on-surface-variant dark:text-white/40">{isRTL ? 'منتجات مميزة' : 'distinct products'}: {outboundReal.distinctProducts} · {isRTL ? 'مُموّل' : 'monetized'}: {outboundReal.monetized}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant dark:text-white/50">{isRTL ? 'اختبار (مستبعد)' : 'TEST (excluded)'}</p>
            <p className="text-2xl font-black tabular-nums text-on-surface-variant dark:text-white/40">{outboundTest.clicks}</p>
          </div>
          <div className="rounded-xl border border-dashed border-[#d7ece5] p-3 text-xs text-on-surface-variant dark:border-[#263b33] dark:text-white/50">
            {isRTL
              ? 'الطلبات/الشحن/العمولة: غير متاحة — لا يوجد تقرير عمولات مستورد بعد. راجع /admin/affiliate.'
              : 'Orders/shipped/commission: UNAVAILABLE — no affiliate report imported yet. See /admin/affiliate.'}
          </div>
        </div>
      </Card>

      {/* By surface */}
      <Card>
        <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'حسب المصدر' : 'By surface'}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs font-bold text-on-surface-variant dark:text-white/50">
                <th className="pb-2 text-start">{isRTL ? 'المصدر' : 'Surface'}</th>
                <th className="pb-2 text-end">{isRTL ? 'جلسات' : 'Sessions'}</th>
                <th className="pb-2 text-end">{isRTL ? 'بحث' : 'Search'}</th>
                <th className="pb-2 text-end">{isRTL ? 'نتائج' : 'Results'}</th>
                <th className="pb-2 text-end">{isRTL ? 'خروج' : 'Outbound'}</th>
              </tr>
            </thead>
            <tbody>
              {surfaces.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-center text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات' : 'No data'}</td></tr>
              )}
              {surfaces.map((s) => (
                <tr key={s.source} className="border-t border-[#eef6f2] dark:border-[#1c261f]">
                  <td className="py-2 font-bold text-on-surface dark:text-white">{s.source}</td>
                  <td className="py-2 text-end tabular-nums">{s.sessions}</td>
                  <td className="py-2 text-end tabular-nums">{s.search}</td>
                  <td className="py-2 text-end tabular-nums">{s.results}</td>
                  <td className="py-2 text-end tabular-nums">{s.outbound}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Demand */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'أعلى طلب' : 'Top demand'}</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            {topDemand.length === 0 && <p className="text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}</p>}
            {topDemand.map((d) => (
              <div key={d.category} className="flex items-center justify-between">
                <span className="text-on-surface-variant dark:text-white/60">{d.category}</span>
                <span className="font-bold tabular-nums text-on-surface dark:text-white">{d.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'طلب غير ملبى' : 'Unmet demand'}</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            {unmetDemand.length === 0 && <p className="text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}</p>}
            {unmetDemand.map((d) => (
              <div key={d.query} className="flex items-center justify-between gap-3">
                <span className="truncate text-on-surface-variant dark:text-white/60">{d.query}</span>
                <span className="shrink-0 font-bold tabular-nums text-on-surface dark:text-white">{d.count}×</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
