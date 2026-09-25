import { windowFromSearchParams } from '@/lib/founder/api';
import { fetchDailySeries, fetchWindowWithPrevious, metricFromPack } from '@/lib/founder/metrics';
import { FCard, MetricCard, SectionTitle, KV, WindowPicker, EmptyNote, Tag } from '@/components/founder/ui';
import { formatRiyadh } from '@/lib/founder/windows';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string };

const ENTRY_AR: Record<string, string> = { landing_view: 'الصفحة الرئيسية', category_page_view: 'صفحة فئة', search: 'بحث مباشر', product_view: 'صفحة منتج', campaign_impression: 'بطاقة حملة', category_go_click: 'خروج من صفحة مقارنة', go_click: 'خروج مباشر', advisor_query: 'استشارة', comparison_view: 'صفحة مقارنة', evidence_view: 'دليل', error: 'خطأ' };

export default async function AudiencePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const { current, previous, previousWindow } = await fetchWindowWithPrevious(w);
  const series = await fetchDailySeries(w);
  const base = `/${locale}/admin/founder/audience`;
  const ids = ['Q01', 'Q01V', 'Q01N', 'Q01R', 'Q01I', 'S01', 'Q03', 'S05B'];
  const p = current.ok ? current.pack : null;

  return (
    <div className="space-y-6">
      <FCard><WindowPicker current={w} basePath={base} sp={sp} /></FCard>
      <section>
        <SectionTitle sub="المتصفح ≠ الزيارة ≠ الشخص. الزيارة = سلسلة أحداث يفصلها 30 دقيقة خمول. لا بصمة، لا IP كشخص، لا تسجيل دخول مطلوب.">من رصدنا؟</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ids.map((id) => <MetricCard key={id} metric={metricFromPack(id, current, w)} previous={metricFromPack(id, previous, previousWindow)} />)}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <FCard>
          <SectionTitle sub="utm_source على أول حدث لكل متصفح؛ unknown = لم تُسجل قناة، وليس «مباشر». UTM قابل للتمرير وليس تصديقًا مستقلًا.">القناة عند الدخول</SectionTitle>
          {p ? <KV rows={p.channels.map((c) => ({ k: c.channel, v: `${c.browsers} متصفح` }))} /> : <EmptyNote>غير متاح</EmptyNote>}
        </FCard>
        <FCard>
          <SectionTitle sub="نوع أول حدث مسجل لكل متصفح داخل النافذة.">الصفحة الأولى</SectionTitle>
          {p ? <KV rows={p.entry_types.map((e) => ({ k: ENTRY_AR[e.event_type] ?? e.event_type, v: `${e.browsers} متصفح` }))} /> : <EmptyNote>غير متاح</EmptyNote>}
        </FCard>
        <FCard>
          <SectionTitle sub="ما استُبعد من كل رقم أعلاه — يبقى مرئيًا لا مخفيًا.">الحركة المستبعدة والمصنفة</SectionTitle>
          {p ? <KV rows={[
            { k: 'متصفحات اختبار (tw_test)', v: p.test_browsers },
            { k: 'متصفحات إدارة (admin_session)', v: p.admin_browsers },
            { k: 'أحداث بوسم زاحف معروف', v: p.bot_ua_events_excluded, note: 'تُوسم عند الاستقبال؛ عدم المطابقة لا يثبت البشرية' },
            { k: 'طلبات /go خام بلا معرّف', v: `${p.raw_outbound_without_session} / ${p.raw_outbound_rows}`, note: 'حركة غير مصنفة — قرينة آلية لا برهان' },
            { k: 'أحداث خطأ / بلا إجابة', v: `${p.error_events} / ${p.no_answer_events}` },
          ]} /> : <EmptyNote>غير متاح</EmptyNote>}
        </FCard>
      </div>

      <section>
        <SectionTitle sub={`أيام تقويمية بتوقيت السعودية داخل ${w.labelAr}؛ اليوم الأخير قد يكون جزئيًا. آخر حدث: ${formatRiyadh(p?.last_usage_event_at)}`}>يومًا بيوم</SectionTitle>
        {!series.ok ? <EmptyNote>{series.reason}</EmptyNote> : (
          <FCard className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-[#f8fcfa] text-[11px] font-black text-on-surface-variant dark:bg-white/5 dark:text-white/60">
                <tr>{['اليوم', 'متصفحات', 'زيارات', 'بحث (متصفحات)', 'نتيجة غير فارغة', 'فتح منتج (أحداث)', 'ضغطة خروج', 'خروج مرتبط', 'خروج خام'].map((h) => <th key={h} className="px-3 py-2 text-start">{h}</th>)}</tr>
              </thead>
              <tbody>
                {series.days.map((d) => (
                  <tr key={d.day} className="border-t border-[#eef6f2] tabular-nums dark:border-white/10">
                    <td className="px-3 py-1.5 font-bold">{d.day}</td><td className="px-3 py-1.5">{d.browsers}</td><td className="px-3 py-1.5">{d.visits30m}</td><td className="px-3 py-1.5">{d.searchSessions}</td>
                    <td className="px-3 py-1.5">{d.positiveResultSessions}</td><td className="px-3 py-1.5">{d.productViewEvents}</td><td className="px-3 py-1.5">{d.goClickEvents}</td><td className="px-3 py-1.5 font-black">{d.linkedInteractions}</td>
                    <td className="px-3 py-1.5 text-on-surface-variant">{d.rawOutboundRows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FCard>
        )}
        <p className="mt-2 text-[11px] text-on-surface-variant dark:text-white/50"><Tag>تنبيه</Tag> مجموع متصفحات الأيام أكبر من متصفحات الفترة لأن المعرّف يتكرر عبر الأيام. لا يوجد تأهيل صريح للأشخاص أو الإقامة بعد؛ عندما يُضاف يُعرض هنا كصف مستقل «أشخاص مؤهلون صراحة».</p>
      </section>
    </div>
  );
}
