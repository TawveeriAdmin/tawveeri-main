import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Search, FileSearch, Eye, Scale, BookOpen, ExternalLink, Users, TrendingUp, ShoppingBag,
} from 'lucide-react';
import { getCommandCenterData, type Period, type ConfidenceState } from '@/lib/admin/command-center-queries';
import { retailerDisplayName } from '@/lib/providers/registry';
import { FocusTodaySection } from './focus-today';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PERIODS: Period[] = ['today', 'yesterday', '7d', '30d'];

function sessionRatio(n: number, d: number, ar: boolean) {
  return d ? `${fpct(n / d)} (${n}/${d})` : (ar ? 'لا توجد عينة' : 'No sample');
}

function fpct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function trend(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? { dir: 'up' as const, pct: null } : null;
  const delta = (current - previous) / previous;
  return { dir: delta >= 0 ? ('up' as const) : ('down' as const), pct: Math.abs(delta) };
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18] ${className}`}>
      {children}
    </div>
  );
}

const CONFIDENCE_STYLE: Record<ConfidenceState, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ESTIMATED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  DELAYED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  INCOMPLETE: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  UNAVAILABLE: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50',
};
const CONFIDENCE_LABEL_AR: Record<ConfidenceState, string> = {
  CONFIRMED: 'مؤكد', ESTIMATED: 'مقدّر', DELAYED: 'متأخر', INCOMPLETE: 'غير مكتمل', UNAVAILABLE: 'غير متاح',
};
function ConfidenceBadge({ state, note, isRTL }: { state: ConfidenceState; note: string; isRTL: boolean }) {
  return (
    <span title={note} className={`inline-flex shrink-0 cursor-help items-center rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${CONFIDENCE_STYLE[state]}`}>
      {isRTL ? CONFIDENCE_LABEL_AR[state] : state}
    </span>
  );
}

export default async function CommandCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string; start?: string; end?: string; historical?: string }>;
}) {
  const { locale } = await params;
  const isRTL = locale === 'ar';
  const sp = await searchParams;
  const period: Period = (PERIODS as string[]).includes(sp.period || '') ? (sp.period as Period) : (sp.start && sp.end ? 'custom' : 'today');
  const includeHistorical = sp.historical === '1';

  const data = await getCommandCenterData(period, sp.start, sp.end, includeHistorical);
  const {
    real, test, prevReal, sessionFunnel, gate, surfaces, topDemand, unmetDemand, decisionHelpIntent, outboundReal, outboundTest,
    quality, campaignAttribution, confidence, commercial, baseline, homeMission,
  } = data;

  const periodLabel = (p: Period) => ({
    today: isRTL ? 'اليوم' : 'Today',
    yesterday: isRTL ? 'أمس' : 'Yesterday',
    '7d': isRTL ? '7 أيام' : '7 days',
    '30d': isRTL ? '30 يوم' : '30 days',
    custom: isRTL ? 'مخصص' : 'Custom',
  })[p];

  const qsBase = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ period: extra.period ?? period });
    if (includeHistorical) p.set('historical', '1');
    Object.entries(extra).forEach(([k, v]) => { if (k !== 'period') p.set(k, v); });
    return `?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header + period filter */}
      <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59] dark:text-[#9fe4d0]">
              {isRTL ? 'مركز قيادة المؤسس' : 'Founder Command Center'}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-on-surface md:text-3xl dark:text-white">
              {isRTL ? 'حالة العمل الآن' : 'The business, right now'}
            </h1>
            <p className="mt-1 text-xs text-on-surface-variant dark:text-white/50">
              {isRTL ? 'وقت قراءة الصفحة (السعودية)' : 'Page read time (Riyadh)'}: {new Date().toLocaleString(isRTL ? 'ar-SA' : 'en-US', { timeZone: 'Asia/Riyadh' })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={qsBase({ period: p })}
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
          <input type="hidden" name="period" value="custom" />
          {includeHistorical && <input type="hidden" name="historical" value="1" />}
          <span className="font-bold text-on-surface-variant dark:text-white/50">{isRTL ? 'نطاق مخصص:' : 'Custom range:'}</span>
          <input type="date" name="start" defaultValue={sp.start} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]" />
          <input type="date" name="end" defaultValue={sp.end} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]" />
          <button type="submit" className="rounded-lg bg-[#1f6f59] px-3 py-1 font-black text-white">{isRTL ? 'تطبيق' : 'Apply'}</button>
          <Link href={qsBase({ historical: includeHistorical ? '0' : '1' })} className="ms-auto underline decoration-dotted">
            {includeHistorical
              ? (isRTL ? 'إخفاء بيانات ما قبل الإطلاق' : 'Hide pre-launch data')
              : (isRTL ? 'عرض بيانات ما قبل الإطلاق (تاريخي)' : 'Show pre-launch data (historical)')}
          </Link>
        </form>
      </section>

      {/* Baseline / pre-launch banner — never show a pre-baseline period as if it were real commercial signal */}
      {baseline.currentIsPreLaunch && !includeHistorical && (
        <Card className="border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10">
          <p className="text-sm font-black text-blue-800 dark:text-blue-200">
            {isRTL ? 'اختبار ما قبل الإطلاق' : 'PRE-LAUNCH TESTING'}
          </p>
          <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-200/70">
            {isRTL
              ? `الأساس التجاري الرسمي يبدأ ${new Date(baseline.date).toLocaleDateString('ar-SA')}. الفترة المختارة بالكامل قبل هذا التاريخ، لذا لا تُعرض كإشارة تجارية حقيقية.`
              : `The official commercial baseline begins ${new Date(baseline.date).toLocaleDateString('en-US')}. The selected period is entirely before that date, so it is not shown as a real commercial signal.`}
            {' '}
            <Link href={qsBase({ historical: '1' })} className="underline">{isRTL ? 'عرض على أي حال' : 'view anyway'}</Link>
          </p>
        </Card>
      )}

      {/* Data-quality banner (Rule 6/7/8 — never hide missing/stale data) */}
      {(quality.trackingStopped || !quality.amazonTagConfigured || (quality.goClickOutboundDivergencePct ?? 0) > 0.15 || quality.topSessionSearchShare > 0.3) && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
              {quality.trackingStopped && <p>{isRTL ? 'لم يتم رصد أي حدث تتبع خلال آخر 6 ساعات — تحقق من التتبع.' : 'No tracking event in the last 6 hours — check instrumentation.'}</p>}
              {!quality.amazonTagConfigured && <p>{isRTL ? 'كود أمازون التابع غير مُهيأ.' : 'Amazon affiliate tag is not configured.'}</p>}
              {(quality.goClickOutboundDivergencePct ?? 0) > 0.15 && <p>{isRTL ? `تباين ${fpct(quality.goClickOutboundDivergencePct!)} بين مسارَي القياس.` : `${fpct(quality.goClickOutboundDivergencePct!)} divergence between the two measurement pipes.`}</p>}
              {quality.topSessionSearchShare > 0.3 && (
                <p>{isRTL ? `جلسة واحدة تمثل ${fpct(quality.topSessionSearchShare)} من البحث — نتائج مركّزة.` : `One session accounts for ${fpct(quality.topSessionSearchShare)} of search — results are concentrated.`}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <p className="text-xs font-semibold text-on-surface-variant dark:text-white/50">
        {isRTL ? 'حقيقي فقط في كل الأرقام أدناه.' : 'REAL only in every number below.'}{' '}
        {isRTL ? 'حركة اختبار/إدارية مستبعدة' : 'TEST/admin traffic excluded'}: {isRTL ? 'جلسات' : 'sessions'}={test.sessions}.
        {includeHistorical && (isRTL ? ' — تعرض بيانات ما قبل الإطلاق.' : ' — showing pre-launch data.')}
      </p>

      {/* ── FOCUS TODAY (ADR-277) — the persistent Founder Intelligence surface; the 8AM email is
          its daily briefing. Same pipeline, same evidence, same ACT/WATCH/INSUFFICIENT_EVIDENCE
          tiers as the email — computed once in src/lib/admin/focus-today.ts, never duplicated.
          Renders nothing at all when ENABLE_FOUNDER_AI_BRIEF is off. ── */}
      <p className="text-xs leading-6 text-on-surface-variant">
        {isRTL ? 'الفترة بتوقيت السعودية' : 'Period in Riyadh time'}: {data.range.start.toLocaleString(locale, { timeZone: 'Asia/Riyadh' })} — {data.range.end.toLocaleString(locale, { timeZone: 'Asia/Riyadh' })}.
        {' '}{isRTL ? 'آخر حدث مسجل' : 'Latest recorded event'}: {quality.lastEventAt ? new Date(quality.lastEventAt).toLocaleString(locale, { timeZone: 'Asia/Riyadh' }) : '—'}.
        {' '}{isRTL ? 'معرّف الجلسة لا يساوي شخصًا؛ الزيارات البشرية المؤكدة ووصول صفحة المتجر غير مقاسين. اليوم الجاري غير مكتمل.' : 'Session IDs are not people; verified humans and merchant page arrivals are not measured. The current day is incomplete.'}
      </p>

      {/* ── Commercial headline — answers the founder's 7 questions in one screen ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          { icon: Users, label: isRTL ? 'معرّفات جلسات غير اختبارية' : 'Non-test session identifiers', value: real.sessions, prev: prevReal.sessions, confidenceKey: 'sessions' },
          { icon: Search, label: isRTL ? 'عمليات البحث' : 'Searches', value: real.search, prev: prevReal.search, confidenceKey: 'search' },
          { icon: TrendingUp, label: isRTL ? 'جلسات مرتبطة بإشارة خروج' : 'Sessions with an exit signal', value: commercial.qualifiedVisitsReferred, prev: undefined, confidenceKey: 'qualifiedVisitsReferred' },
          {
            // ADR-286 wording fix: this used to be "تحويلات مؤكدة للمتاجر" / "Confirmed retailer
            // redirects" bound to a RAW outbound_clicks row count — a bare /go request/redirect
            // row, never proof a customer actually interacted. Now shows the decision-grade
            // explicit-interaction count instead; the old raw count is demoted to a secondary
            // diagnostic note on this same card, explicitly labeled operational/non-proof.
            icon: ExternalLink,
            label: isRTL ? 'تفاعلات متجر صريحة' : 'Explicit retailer interactions',
            value: commercial.explicitRetailerInteractions,
            prev: undefined,
            confidenceKey: 'explicitInteractions',
            notes: [
              isRTL
                ? `${commercial.correlatedMerchantNavigations ?? 'غير متاح'} منها مرتبطة بسجل /go؛ وصول المتجر غير مقاس`
                : `${commercial.correlatedMerchantNavigations ?? 'Unavailable'} correlate to a /go record; merchant arrival is not measured`,
              isRTL
                ? `طلبات /go مسجّلة: ${commercial.confirmedRetailerRedirects} — قياس تشغيلي، لا يثبت تفاعل عميل`
                : `Recorded /go requests: ${commercial.confirmedRetailerRedirects} — operational metric, not proof of customer interaction`,
            ],
          },
        ].map((h) => {
          const tr = h.prev !== undefined && h.value !== null ? trend(h.value, h.prev) : null;
          const conf = confidence[h.confidenceKey];
          return (
            <Card key={h.label}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-on-surface-variant dark:text-white/50">{h.label}</p>
                {conf && <ConfidenceBadge state={conf.state} note={conf.note} isRTL={isRTL} />}
              </div>
              <p className="mt-2 text-3xl font-black tabular-nums text-on-surface dark:text-white">{h.value ?? (isRTL ? 'غير متاح' : 'Unavailable')}</p>
              {tr && (
                <p className={`mt-1 text-xs font-bold ${tr.dir === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {tr.dir === 'up' ? '▲' : '▼'} {tr.pct !== null ? fpct(tr.pct) : (isRTL ? 'جديد' : 'new')} {isRTL ? `مقابل الفترة السابقة المساوية (${h.prev} ← ${h.value})` : `vs equal previous period (${h.prev} → ${h.value})`}
                </p>
              )}
              {baseline.previousIsPreLaunch && !tr && period === 'today' && (
                <p className="mt-1 text-[11px] font-bold text-blue-600 dark:text-blue-300">{isRTL ? 'أمس: اختبار ما قبل الإطلاق' : 'Yesterday: pre-launch testing'}</p>
              )}
              {'notes' in h && h.notes?.map((n) => (
                <p key={n} className="mt-1 text-[11px] leading-snug text-on-surface-variant dark:text-white/40">{n}</p>
              ))}
            </Card>
          );
        })}
      </div>

      <Card>
        <p className="text-sm font-bold">{isRTL ? 'الطلبات والعمولات المؤكدة' : 'Verified orders and commissions'}</p>
        <p className="mt-2 text-sm">{isRTL ? 'مصدرها تقارير الشركاء، ولا يمكن استنتاجها من البحث أو الخروج. راجع تغطية التقارير وفترتها قبل الحكم على الإيراد.' : 'Evidence comes from partner reports, never inferred from searches or exits. Check the report coverage and period before assessing revenue.'}</p>
        <Link href={`/${locale}/admin/affiliate`} className="mt-2 inline-block text-sm underline">{isRTL ? 'تقارير الشركاء وحالة الاستيراد' : 'Partner reports and import status'}</Link>
      </Card>

      <FocusTodaySection data={data} isRTL={isRTL} />

      <Card>
        <h2 className="font-bold">{isRTL ? 'التفاعلات المرتبطة بسجل خروج — بحسب المتجر والقناة' : 'Interactions linked to exit records — by retailer and channel'}</h2>
        <p className="mt-2 text-xs leading-6">{isRTL ? 'نفس الفترة أعلاه؛ عدّ معرّفات تفاعل فريدة بعد مطابقة المصدرين. القناة هي UTM المسجلة وليست إثبات إعلان مدفوع. قد يظهر التفاعل في أكثر من مجموعة؛ لا تجمع المجموعات لإنتاج الإجمالي.' : 'Same period; distinct interaction IDs matched across both sources. Channels use recorded UTM, not proof of paid advertising. Groups may overlap.'}</p>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          {[commercial.byStore, commercial.byChannel].map((rows, index) => (
            <div key={index} className="space-y-2 text-sm">
              <h3 className="font-bold">{index === 0 ? (isRTL ? 'المتجر' : 'Retailer') : (isRTL ? 'القناة المسجلة' : 'Recorded channel')}</h3>
              {rows === null ? <p>{isRTL ? 'تعذر قراءة المصدر' : 'Source unavailable'}</p> : rows.length === 0 ? <p>{isRTL ? 'لا تفاعلات مطابقة في الفترة' : 'No matched interactions in this period'}</p> : rows.map(row => (
                <div key={row.key} className="flex justify-between gap-3"><bdi>{row.key === 'unknown' ? (isRTL ? 'غير معروفة' : 'Unknown') : index === 0 ? retailerDisplayName(row.key, isRTL) : row.key}</bdi><span>{row.interactions}</span></div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      {/* Referred product/category interest */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs font-bold text-on-surface-variant dark:text-white/50">{isRTL ? 'منتجات في سجل الخروج الخام' : 'Products in raw exit ledger'}</p>
          <p className="mt-2 text-2xl font-black tabular-nums text-on-surface dark:text-white">{commercial.referredProductInterest}</p>
          <p className="mt-1 text-[11px] text-on-surface-variant dark:text-white/40">{isRTL ? 'معرّفات منتجات فريدة في طلبات /go؛ تشمل حركة غير مؤهلة، ولا تثبت اهتمام عملاء أو وصول المتجر.' : 'Distinct product IDs in raw /go requests, including unqualified traffic; not proof of customer interest or merchant arrival.'}</p>
        </Card>
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-[#1f6f59] dark:text-[#9fe4d0]" />
            <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'أعلى المتاجر إحالة' : 'Top retailers referred'}</h2>
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            {commercial.retailers.length === 0 && <p className="text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}</p>}
            {commercial.retailers.slice(0, 5).map((r) => (
              <div key={r.storeSlug} className="flex items-center justify-between">
                <span className="text-on-surface-variant dark:text-white/60">{retailerDisplayName(r.storeSlug, isRTL)}</span>
                <span className="font-bold tabular-nums text-on-surface dark:text-white">{r.confirmedRedirects}</span>
              </div>
            ))}
          </div>
          <Link href={`/${locale}/admin/retailer-report`} className="mt-3 inline-block text-xs font-black text-[#1f6f59] underline dark:text-[#9fe4d0]">
            {isRTL ? 'تقرير شراكة المتجر الكامل ←' : 'Full retailer partnership report →'}
          </Link>
        </Card>
      </div>

      {/* Demand — what visitors search for */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'أعلى عبارات البحث' : 'Top search terms'}</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            {commercial.topSearchTerms.length === 0 && <p className="text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}</p>}
            {commercial.topSearchTerms.map((d) => (
              <div key={d.query} className="flex items-center justify-between gap-3">
                <span className="truncate text-on-surface-variant dark:text-white/60">{d.query}</span>
                <span className="shrink-0 font-bold tabular-nums text-on-surface dark:text-white">{d.count}×</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'الفئات الأعلى طلباً' : 'Top demand categories'}</h2>
          <p className="mt-2 text-xs text-on-surface-variant dark:text-white/60">{isRTL ? 'تصنيف تقديري للنص بمحلل الفئات الحالي؛ العربية والإنجليزية قد تمثلان الفئة نفسها. العدد أحداث بحث، لا أشخاص.' : 'Estimated text classification with the current parser; counts are search events, not people.'}</p>
          <div className="mt-3 space-y-1.5 text-sm">
            {topDemand.length === 0 && <p className="text-on-surface-variant dark:text-white/40">{isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}</p>}
            {topDemand.slice(0, 8).map((d) => (
              <div key={d.category} className="flex items-center justify-between">
                <span className="text-on-surface-variant dark:text-white/60">{d.category === '(unparsed)' || d.category === 'unparsed' ? (isRTL ? 'غير مصنف آليًا' : 'Not automatically classified') : d.category}</span>
                <span className="font-bold tabular-nums text-on-surface dark:text-white">{d.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── TAWVEERI HOME (ADR-257 §8) — the pilot as a measured product surface.
          Semantics never conflated: exit CLICK ≠ RETURN ≠ SELF-MARKED ≠ verified sale. ── */}
      <Card>
        <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">
          {isRTL ? 'توفيري هوم — «جهّز بيتك بذكاء»' : 'Tawveeri Home'}
        </h2>
        <p className="mt-1 text-xs text-on-surface-variant dark:text-white/50">
          {isRTL
            ? 'إتمام العناصر إشارة ذاتية من المستخدم — ليست تحويلاً تجاريًا مؤكدًا.'
            : 'Item completion is self-reported by the user — never a verified commercial conversion.'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          {([
            [isRTL ? 'جلسات' : 'Sessions', homeMission.sessions],
            [isRTL ? 'بدايات مهمة' : 'Mission starts', homeMission.starts],
            [isRTL ? 'خطط مولّدة' : 'Plans generated', homeMission.plans],
            [isRTL ? 'تعديلات' : 'Refinements', homeMission.refines],
            [isRTL ? 'فتح خطة الشراء' : 'Purchase-plan opens', homeMission.purchasePlanOpens],
            [isRTL ? 'نقرات خروج للمتاجر' : 'Retailer exit clicks', homeMission.retailerExitClicks],
            [isRTL ? 'عودة من متجر' : 'Returns from retailer', homeMission.returnsFromRetailer],
            [isRTL ? 'عناصر معلّمة «تم»' : 'Items self-marked', homeMission.itemsSelfMarked],
            [isRTL ? 'متاجر مكتملة' : 'Retailers completed', homeMission.retailersCompleted],
            [isRTL ? 'مهمات مكتملة' : 'Missions completed', homeMission.missionsCompleted],
            [isRTL ? 'مشاركات منشأة' : 'Shares created', homeMission.sharesCreated],
            [isRTL ? 'فتحات رابط المشاركة' : 'Share opens', homeMission.shareOpens],
            [isRTL ? 'آراء مستلمة' : 'Share feedback', homeMission.shareFeedback],
            [isRTL ? 'نقرات بطاقة الرئيسية' : 'Entry-card clicks', homeMission.entryCardClicks],
          ] as Array<[string, number]>).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="truncate text-on-surface-variant dark:text-white/60">{label}</span>
              <span className="shrink-0 font-bold tabular-nums text-on-surface dark:text-white">{value}</span>
            </div>
          ))}
        </div>
        {homeMission.unsupportedRequests.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-bold text-on-surface dark:text-white">{isRTL ? 'طلبات فئات غير مدعومة (رفض صادق — ماذا نبني بعده؟)' : 'Unsupported-category requests (honest refusals — what to build next)'}</p>
            <div className="mt-1.5 space-y-1 text-sm">
              {homeMission.unsupportedRequests.map((u) => (
                <div key={u.term} className="flex items-center justify-between gap-3">
                  <span className="truncate text-on-surface-variant dark:text-white/60">{u.term}</span>
                  <span className="shrink-0 font-bold tabular-nums text-on-surface dark:text-white">{u.count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {unmetDemand.length > 0 && (
        <Card>
          <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'طلب غير ملبى' : 'Unmet demand'}</h2>
          <p className="mt-1 text-xs text-on-surface-variant dark:text-white/50">{isRTL ? 'عمليات بحث لم تُرجع نتيجة مفيدة' : 'Searches that returned no useful result'}</p>
          <div className="mt-3 space-y-1.5 text-sm">
            {unmetDemand.map((d) => (
              <div key={d.query} className="flex items-center justify-between gap-3">
                <span className="truncate text-on-surface-variant dark:text-white/60">{d.query}</span>
                <span className="shrink-0 font-bold tabular-nums text-on-surface dark:text-white">{d.count}×</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(decisionHelpIntent.indecisionQueries > 0 || decisionHelpIntent.replacementTimingQueries > 0) && (
        <Card>
          <h2 className="text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">{isRTL ? 'مساعدة القرار' : 'Decision help'}</h2>
          <p className="mt-1 text-xs text-on-surface-variant dark:text-white/50">
            {isRTL ? 'عملاء محتارون بين خيارات أو يسألون عن توقيت الشراء — وهل حصلوا على إجابة' : 'Shoppers torn between options or asking about purchase timing — and whether they got an answer'}
          </p>
          <div className="mt-3 space-y-1.5 text-sm">
            {decisionHelpIntent.indecisionQueries > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-on-surface-variant dark:text-white/60">{isRTL ? 'محتار بين خيارات' : 'Torn between options'}</span>
                <span className="shrink-0 font-bold tabular-nums text-on-surface dark:text-white">
                  {decisionHelpIntent.indecisionServed}/{decisionHelpIntent.indecisionQueries} {isRTL ? 'تمت الإجابة' : 'answered'}
                </span>
              </div>
            )}
            {decisionHelpIntent.replacementTimingQueries > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-on-surface-variant dark:text-white/60">{isRTL ? 'الشراء الآن أم الانتظار' : 'Buy now vs. wait'}</span>
                <span className="shrink-0 font-bold tabular-nums text-on-surface dark:text-white">
                  {decisionHelpIntent.replacementTimingServed}/{decisionHelpIntent.replacementTimingQueries} {isRTL ? 'تمت الإجابة' : 'answered'}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href={`/${locale}/admin/retailer-report`} className="rounded-2xl bg-[#1f6f59] px-4 py-2.5 text-sm font-black text-white">
          {isRTL ? 'تقرير شراكة المتجر' : 'Retailer partnership report'}
        </Link>
        <Link href={`/${locale}/admin/command-center/opportunities`} className="rounded-2xl border border-[#d7ece5] px-4 py-2.5 text-sm font-black text-on-surface dark:border-[#263b33] dark:text-white">
          {isRTL ? 'الفرص التجارية' : 'Commercial opportunities'}
        </Link>
      </div>

      {/* ── Technical detail — collapsed by default, native <details> so it costs zero JS ── */}
      <details className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
        <summary className="cursor-pointer text-sm font-black uppercase tracking-wide text-on-surface dark:text-white">
          {isRTL ? 'التفاصيل التقنية' : 'Technical detail'}
        </summary>

        <div className="mt-4 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wide text-on-surface-variant dark:text-white/60">{isRTL ? 'مراحل النشاط المسجّل' : 'Recorded activity stages'}</h3>
              <ConfidenceBadge state={confidence.search.state} note={confidence.search.note} isRTL={isRTL} />
            </div>
            <p className="mt-2 text-xs">{isRTL ? 'الأعداد أحداث؛ النسب تقاطع معرّفات الجلسات بين مرحلتين، ولا تثبت ترتيب الخطوات أو وصول العميل للمتجر.' : 'Counts are events; rates intersect session IDs across stages and do not establish sequence or merchant arrival.'}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
              {[
                { icon: Search, label: isRTL ? 'بحث' : 'Search', value: real.search, conv: null },
                { icon: FileSearch, label: isRTL ? 'نتائج' : 'Results', value: real.results, conv: sessionRatio(sessionFunnel.searchedAndGotResults, sessionFunnel.searched, isRTL) },
                { icon: Eye, label: isRTL ? 'فتح منتج' : 'Product view', value: real.productView, conv: sessionRatio(sessionFunnel.searchedAndViewedProduct, sessionFunnel.searched, isRTL) },
                { icon: Scale, label: isRTL ? 'مقارنة' : 'Comparison', value: real.comparisonView, conv: sessionRatio(sessionFunnel.viewedProductAndComparison, sessionFunnel.viewedProduct, isRTL) },
                { icon: BookOpen, label: isRTL ? 'دليل' : 'Evidence', value: real.evidenceView, conv: null },
                {
                  icon: ExternalLink, label: isRTL ? 'نقر خروج من المتصفح' : 'Client exit clicks', value: data.clientExitEvents, conv: sessionRatio(sessionFunnel.viewedComparisonAndExited, sessionFunnel.viewedComparison, isRTL),
                  // 2026-09-24 labeling fix: this is the legacy client-fired go_click usage_event
                  // (ADR-244), not the decision-grade first_party_interactions ledger (ADR-286) or
                  // the raw outbound_clicks table shown elsewhere on this page — each is a
                  // deliberately different, already-documented metric, but this tile alone had no
                  // caption distinguishing it from its labeled neighbors.
                  hint: isRTL ? 'حدث نقر من المتصفح (go_click) — وليس سجل outbound_clicks أو first_party_interactions.' : 'Client-fired go_click event — not the outbound_clicks or first_party_interactions ledgers.',
                },
              ].map((s) => (
                <div key={s.label} title={s.hint} className="rounded-2xl border border-[#eef6f2] p-3 text-center dark:border-[#1c261f]">
                  <s.icon className="mx-auto h-4 w-4 text-[#1f6f59] dark:text-[#9fe4d0]" />
                  <p className="mt-1 text-[11px] font-bold text-on-surface-variant dark:text-white/50">{s.label}</p>
                  <p className="text-xl font-black tabular-nums text-on-surface dark:text-white">{s.value}</p>
                  {s.conv && <p className="text-[10px] text-on-surface-variant dark:text-white/40">{s.conv}</p>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-on-surface-variant dark:text-white/50">
              {isRTL ? 'بدون نتيجة' : 'No-answer'}={real.noAnswer} · {isRTL ? 'أخطاء' : 'errors'}={real.errors} · {isRTL ? 'بحث→خروج إجمالي' : 'overall Search→Exit'}={sessionRatio(sessionFunnel.searchedAndExited, sessionFunnel.searched, isRTL)}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wide text-on-surface-variant dark:text-white/60">{isRTL ? 'بوابة جاهزية الإطلاق' : 'Launch-readiness gate'}</h3>
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
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wide text-on-surface-variant dark:text-white/60">{isRTL ? 'التجارة والعمولات' : 'Commerce & affiliate'}</h3>
              <ConfidenceBadge state={confidence.affiliateCommission.state} note={confidence.affiliateCommission.note} isRTL={isRTL} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-on-surface-variant dark:text-white/50">{isRTL ? 'نقرات خروج مقاسة' : 'Measured exits'}</p>
                <p className="text-2xl font-black tabular-nums text-on-surface dark:text-white">{outboundReal.clicks}</p>
                <p className="text-xs text-on-surface-variant dark:text-white/40">{isRTL ? 'مُموّل' : 'monetized'}: {outboundReal.monetized}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant dark:text-white/50">{isRTL ? 'اختبار (مستبعد)' : 'TEST (excluded)'}</p>
                <p className="text-2xl font-black tabular-nums text-on-surface-variant dark:text-white/40">{outboundTest.clicks}</p>
              </div>
              <div className="rounded-xl border border-dashed border-[#d7ece5] p-3 text-xs text-on-surface-variant dark:border-[#263b33] dark:text-white/50">
                {isRTL ? 'الطلبات/الشحن/العمولة: غير متاحة — لا يوجد تقرير عمولات مستورد بعد.' : 'Orders/shipped/commission: UNAVAILABLE — no affiliate report imported yet.'}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wide text-on-surface-variant dark:text-white/60">{isRTL ? 'الحملة → الخروج' : 'Campaign → outbound'}</h3>
              <ConfidenceBadge state={confidence.campaignAttribution.state} note={confidence.campaignAttribution.note} isRTL={isRTL} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-on-surface-variant dark:text-white/50">{isRTL ? 'حملة معروفة' : 'Known campaign'}</p>
                <p className="text-2xl font-black tabular-nums text-on-surface dark:text-white">{campaignAttribution.withKnownCampaign} / {campaignAttribution.totalGoClicks}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant dark:text-white/50">{isRTL ? 'غير معروف' : 'UNKNOWN'}</p>
                <p className="text-2xl font-black tabular-nums text-on-surface-variant dark:text-white/40">{campaignAttribution.unknownCampaign}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant dark:text-white/50">{isRTL ? 'مطابق' : 'Matched'}</p>
                <p className="text-2xl font-black tabular-nums text-on-surface dark:text-white">{campaignAttribution.matchedToOutboundClicks} / {campaignAttribution.totalGoClicks}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wide text-on-surface-variant dark:text-white/60">{isRTL ? 'حسب المصدر' : 'By surface'}</h3>
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
          </div>
        </div>
      </details>
    </div>
  );
}
