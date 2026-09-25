import { windowFromSearchParams } from '@/lib/founder/api';
import { fetchQueryDemand, buildQueryDemand, buildNeedDemand, fetchCatalogCapability, fetchProductDemand, categoryAr } from '@/lib/founder/demand';
import { FCard, SectionTitle, WindowPicker, EmptyNote, Tag } from '@/components/founder/ui';
import { formatRiyadh } from '@/lib/founder/windows';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string };

const BUCKET: Record<string, { label: string; tone: 'good' | 'warn' | 'muted' }> = {
  demand_with_valid_comparison: { label: 'طلب مرصود وعرض صالح للمقارنة', tone: 'good' },
  demand_needs_coverage_or_identity: { label: 'طلب مرصود وتغطية/هوية تحتاج إصلاحًا', tone: 'warn' },
  early_interest: { label: 'اهتمام أولي محدود الأدلة', tone: 'muted' },
};

export default async function DemandPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const base = `/${locale}/admin/founder/demand`;
  const [qd, catalog, pd] = await Promise.all([fetchQueryDemand(w), fetchCatalogCapability().catch(() => new Map()), fetchProductDemand(w, 30)]);
  const queries = qd.ok ? buildQueryDemand(qd.rows) : [];
  const needs = qd.ok ? buildNeedDemand(qd.rows, catalog) : [];

  return (
    <div className="space-y-6">
      <FCard><WindowPicker current={w} basePath={base} sp={sp} /></FCard>

      <section>
        <SectionTitle sub="الترتيب بعدد المتصفحات الباحثة (اتحاد المعرّفات لكل فئة)، لا بمجموع الأحداث. الفئة مشتقة من النص وقت العرض. المعرّفات تتداخل بين الفئات فلا تُجمع.">الاحتياجات</SectionTitle>
        {!qd.ok ? <EmptyNote>تعذر القراءة: {qd.reason}</EmptyNote> : needs.length === 0 ? <EmptyNote>لا بحث مسجل في الفترة</EmptyNote> : (
          <FCard className="overflow-x-auto p-0">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="bg-[#f8fcfa] text-[11px] font-black text-on-surface-variant dark:bg-white/5 dark:text-white/60">
                <tr>{['الحاجة', 'متصفحات / أحداث', 'أكبر تكرار لمعرّف', 'تلقى نتيجة', 'فتح منتج ≤30د', 'خروج مرتبط ≤30د', 'الكتالوج: مقارنة / حديثة 72س / كل', 'التصنيف'].map((h) => <th key={h} className="px-3 py-2 text-start">{h}</th>)}</tr>
              </thead>
              <tbody>
                {needs.map((n) => (
                  <tr key={n.category} className="border-t border-[#eef6f2] align-top tabular-nums dark:border-white/10">
                    <td className="px-3 py-2"><b>{n.labelAr}</b><p className="mt-0.5 line-clamp-2 max-w-[260px] text-[11px] text-on-surface-variant dark:text-white/50">{n.queries.slice(0, 5).join(' · ')}</p></td>
                    <td className="px-3 py-2">{n.searchSessions} / {n.searchEvents}</td>
                    <td className="px-3 py-2">{n.topSessionEvents}</td>
                    <td className="px-3 py-2">{n.positiveSessions}/{n.searchSessions}</td>
                    <td className="px-3 py-2">{n.productSessions}/{n.searchSessions}</td>
                    <td className="px-3 py-2 font-black">{n.linkedSessions}/{n.searchSessions}</td>
                    <td className="px-3 py-2">{n.catalog ? `${n.catalog.comparable} / ${n.catalog.fresh72h} / ${n.catalog.products}` : '—'}</td>
                    <td className="px-3 py-2"><Tag tone={BUCKET[n.bucket].tone}>{BUCKET[n.bucket].label}</Tag><p className="mt-1 max-w-[220px] text-[11px] text-on-surface-variant dark:text-white/50">{n.bucketReasonAr}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FCard>
        )}
      </section>

      <section id="products">
        <SectionTitle sub="مجموعات المنتجات خلف الخروج المرتبط (ضغطة فعلية + طلب تحويل بالمعرّف نفسه). «مجموعة» مقصودة: قد تجمع أكثر من رقم موديل — الفحص التلقائي يعرض الخلط.">المنتجات والموديلات المطلوبة</SectionTitle>
        {!pd.ok ? <EmptyNote>تعذر القراءة: {pd.reason}</EmptyNote> : pd.products.length === 0 ? <EmptyNote>لا خروج مرتبط في الفترة</EmptyNote> : (
          <div className="grid gap-3 md:grid-cols-2">
            {pd.products.map((p, i) => (
              <FCard key={p.canonicalId} tone={p.blockerAr ? 'warn' : 'default'} className="space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="text-[10px] font-black text-on-surface-variant dark:text-white/50">#{i + 1} · {categoryAr(p.category)} · {p.brand ?? 'ماركة غير معروفة'}</p><p className="font-black text-on-surface dark:text-white">{p.nameAr}</p></div>
                  <span className="shrink-0 rounded-xl bg-[#eef8f4] px-2 py-1 text-center tabular-nums dark:bg-white/10"><b className="block text-base">{p.sessions}</b><span className="text-[10px]">متصفح</span></span>
                </div>
                <p className="tabular-nums text-on-surface-variant dark:text-white/60">{p.interactions} خروجًا مرتبطًا · المتاجر: {p.stores.join('، ') || '—'} · القنوات: {p.channels.join('، ')}</p>
                <p className="tabular-nums text-on-surface-variant dark:text-white/60">الموديل: {p.modelNumber ?? 'غير مكتمل'} · {p.projection ? `أقل سعر ${p.projection.lowestPrice ?? '—'} ر.س من ${p.projection.storeCount ?? '—'} متاجر · آخر رصد ${formatRiyadh(p.projection.lastObservedAt)}` : 'لا إسقاط حالي'}</p>
                {p.identityCheck && <p className="text-on-surface-variant dark:text-white/60">فحص الهوية: {p.identityCheck.offers} عرضًا صالحًا، أرقام موديل مختلفة: {p.identityCheck.distinctModels.length || '—'} {p.identityCheck.mixed ? <Tag tone="warn">خلط محتمل</Tag> : <Tag tone="good">موديل واحد</Tag>}</p>}
                {p.blockerAr && <p className="font-bold text-amber-800 dark:text-amber-300">يمنع التوصية التسويقية: {p.blockerAr}</p>}
                <p className="text-[11px] text-on-surface-variant dark:text-white/50">الثقة: {p.confidenceAr}{p.projection?.compareUrl ? <> · <a className="underline decoration-dotted" href={p.projection.compareUrl} target="_blank" rel="noreferrer">صفحة المقارنة</a></> : null}</p>
              </FCard>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle sub="النص الحرفي كما أُرسل. «أكبر تكرار» يكشف المتصفح الواحد المكرِّر. الفتح والمقارنة والخروج ارتباط زمني ≤30 دقيقة (يُستبدل تدريجيًا بربط query_id الصريح الذي بدأ تسجيله اليوم).">عبارات البحث</SectionTitle>
        {queries.length === 0 ? <EmptyNote>لا بحث في الفترة</EmptyNote> : (
          <FCard className="overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-[#f8fcfa] text-[11px] font-black text-on-surface-variant dark:bg-white/5 dark:text-white/60">
                <tr>{['النص', 'الفئة', 'متصفحات', 'أحداث', 'أكبر تكرار', 'نتيجة', 'فتح منتج', 'خروج مرتبط', 'بلا إجابة / خطأ', 'آخر مرة'].map((h) => <th key={h} className="px-3 py-2 text-start">{h}</th>)}</tr>
              </thead>
              <tbody>
                {queries.slice(0, 60).map((q) => (
                  <tr key={q.query} className="border-t border-[#eef6f2] tabular-nums dark:border-white/10">
                    <td className="max-w-[260px] px-3 py-1.5 font-bold">{q.query}</td><td className="px-3 py-1.5">{categoryAr(q.category)}</td>
                    <td className="px-3 py-1.5">{q.searchSessions}</td><td className="px-3 py-1.5">{q.searchEvents}</td><td className="px-3 py-1.5">{q.topSessionEvents}{q.concentration > 0.5 && q.searchEvents >= 4 ? ' ⚠' : ''}</td>
                    <td className="px-3 py-1.5">{q.positiveSessions}</td><td className="px-3 py-1.5">{q.productSessions}</td><td className="px-3 py-1.5 font-black">{q.linkedSessions}</td>
                    <td className="px-3 py-1.5">{q.noAnswerEvents} / {q.errorEvents}</td><td className="px-3 py-1.5 text-[11px]">{formatRiyadh(q.lastSeen, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FCard>
        )}
      </section>
    </div>
  );
}
