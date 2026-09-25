import Link from 'next/link';
import { buildOverview } from '@/lib/founder/overview';
import { windowFromSearchParams } from '@/lib/founder/api';
import { METRICS } from '@/lib/founder/registry';
import { GOAL_STATUS_AR } from '@/lib/founder/goals';
import { FCard, MetricCard, SectionTitle, KV, Sar, Tag, WindowPicker, qs, EmptyNote } from '@/components/founder/ui';
import { formatRiyadh } from '@/lib/founder/windows';

export const dynamic = 'force-dynamic';

type SP = { w?: string; start?: string; end?: string };

export default async function FounderOverviewPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const o = await buildOverview(w);
  const base = `/${locale}/admin/founder`;
  const q = qs(sp);
  const m = o.money;

  const actions = [
    { href: `${base}/expenses${q}#add`, label: 'إضافة مصروف' },
    { href: `${base}/revenue${q}#add`, label: 'إضافة عمولة' },
    { href: `/${locale}/admin/affiliate`, label: 'رفع تقرير شريك' },
    { href: `${base}/goals${q}#add`, label: 'تحديد هدف' },
    { href: `${base}/summary${q}`, label: 'تقرير اليوم' },
  ];

  return (
    <div className="space-y-6">
      <FCard><WindowPicker current={w} basePath={base} sp={sp} /></FCard>

      {/* Top: month result, biggest gap, next decision */}
      <FCard tone="accent" className="space-y-3">
        <p className="text-[11px] font-black text-[#1f6f59] dark:text-[#9fe4d0]">نتيجة الفترة</p>
        <p className="text-base font-black leading-relaxed text-on-surface dark:text-white">{o.headline.resultAr}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-white/70 p-3 dark:bg-white/5"><p className="text-[11px] font-black text-amber-700 dark:text-amber-300">أهم فجوة</p><p className="mt-1 text-sm">{o.headline.gapAr}</p></div>
          <div className="rounded-xl bg-white/70 p-3 dark:bg-white/5"><p className="text-[11px] font-black text-[#1f6f59] dark:text-[#9fe4d0]">القرار التالي</p><p className="mt-1 text-sm">{o.headline.decisionAr}</p></div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {actions.map((a) => <Link key={a.href} href={a.href} className="rounded-full bg-[#1f6f59] px-3.5 py-2 text-xs font-black text-white hover:bg-[#185947]">{a.label}</Link>)}
        </div>
      </FCard>

      {/* 8 decision cards */}
      <section>
        <SectionTitle sub="الترتيب: نية البحث ← نتيجة ← مقارنة ← فتح منتج ← خروج مرتبط ← بحث متبوع بخروج ← طلبات الشريك ← عمولات معتمدة">رحلة القرار</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {o.cards.map((c, i) => <MetricCard key={c.id} metric={c} previous={o.prevCards[i]} />)}
        </div>
      </section>

      {/* Money strip */}
      <section>
        <SectionTitle sub="سجل إدارة للمؤسس، لا دفتر محاسبي. النقد بتاريخ الدفع؛ تكلفة الفترة موزعة على فترة الخدمة.">المال</SectionTitle>
        {m ? (
          <div className="grid gap-3 md:grid-cols-3">
            <FCard><KV rows={[
              { k: 'نقد مصروف في الفترة (F01)', v: <Sar v={m.cashSpent.sar} /> },
              { k: 'تكلفة الفترة (F02)', v: <Sar v={m.periodCost.sar} />, note: m.periodCost.unconvertedRows ? `${m.periodCost.unconvertedRows} صفًا بلا تحويل موثق خارج المجموع` : undefined },
              { k: 'إجمالي الصرف منذ البداية (F04)', v: <Sar v={m.totalSinceStart.sar} />, note: m.expenseRows === 0 ? 'السجل فارغ — أضف المصروفات' : `${m.expenseRows} سجلًا` },
            ]} /></FCard>
            <FCard><KV rows={[
              { k: 'عمولات معتمدة (S08)', v: m.revenue.coverageState === 'coverage_missing' ? <Tag>غير معلوم</Tag> : <Sar v={m.revenue.confirmedSar} /> },
              { k: 'مقبوض نقدًا (S08P)', v: m.revenue.coverageState === 'coverage_missing' ? <Tag>غير معلوم</Tag> : <Sar v={m.revenue.paidSar} /> },
              { k: 'تغطية تقارير الشركاء (C01)', v: `${m.revenue.coverageCount}/2`, note: m.revenue.coverage.map((c) => `${c.source === 'amazon_associates' ? 'أمازون' : 'نون'}: ${c.covered ? 'مغطى' : 'غير مغطى'}`).join(' · ') },
            ]} /></FCard>
            <FCard><KV rows={[
              { k: 'النتيجة التشغيلية الإدارية (F06)', v: m.operatingResultSar == null ? <Tag>غير قابل للحكم</Tag> : <Sar v={m.operatingResultSar} />, note: 'S08 − F02' },
              { k: 'صافي التدفق النقدي (F07)', v: m.netCashSar == null ? <Tag>غير قابل للحكم</Tag> : <Sar v={m.netCashSar} /> },
              { k: 'تمويل المؤسس (F05)', v: <Sar v={m.funding.sar} />, note: 'ليس إيرادًا' },
            ]} /></FCard>
          </div>
        ) : <EmptyNote>تعذر قراءة السجل المالي: {o.moneyReason}</EmptyNote>}
      </section>

      {/* Goals + needs + products */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FCard>
          <SectionTitle action={<Link href={`${base}/goals${q}`} className="text-xs font-black text-[#1f6f59] underline decoration-dotted">كل الأهداف ←</Link>}>أهداف الشهر</SectionTitle>
          {o.goals.length === 0 ? <EmptyNote>لا أهداف لهذا الشهر بعد — «تحديد هدف» يبدأ بخط أساس وتعريف مجمّد.</EmptyNote> : (
            <ul className="space-y-2">
              {o.goals.map((g) => (
                <li key={g.goal.id} className="rounded-xl border border-[#eef6f2] p-2.5 text-xs dark:border-white/10">
                  <div className="flex items-center justify-between gap-2"><span className="font-black">{g.nameAr}</span><Tag tone={g.status === 'achieved' ? 'good' : g.status === 'on_track' ? 'good' : g.status === 'behind' ? 'warn' : 'muted'}>{GOAL_STATUS_AR[g.status]}</Tag></div>
                  <p className="mt-1 tabular-nums text-on-surface-variant dark:text-white/60">{g.current ?? 'غير متاح'} / {g.goal.target_value} · متبقٍ {g.daysLeft} يومًا</p>
                </li>
              ))}
            </ul>
          )}
        </FCard>
        <FCard>
          <SectionTitle action={<Link href={`${base}/demand${q}`} className="text-xs font-black text-[#1f6f59] underline decoration-dotted">التفاصيل ←</Link>}>ماذا يريد الجمهور؟</SectionTitle>
          {o.needs.filter((n) => n.category !== 'unparsed').slice(0, 5).map((n) => (
            <div key={n.category} className="flex items-center justify-between gap-2 border-b border-[#eef6f2] py-2 text-xs last:border-0 dark:border-white/10">
              <span className="font-black">{n.labelAr}</span>
              <span className="tabular-nums text-on-surface-variant dark:text-white/60">{n.searchSessions} متصفح · {n.linkedSessions} خرج</span>
            </div>
          ))}
          {o.needs.length === 0 && <EmptyNote>{o.demandReason ?? 'لا بحث مسجل في الفترة'}</EmptyNote>}
        </FCard>
        <FCard>
          <SectionTitle action={<Link href={`${base}/demand${q}#products`} className="text-xs font-black text-[#1f6f59] underline decoration-dotted">التفاصيل ←</Link>}>أعلى مجموعات الخروج المرتبط</SectionTitle>
          {o.products.slice(0, 4).map((p) => (
            <div key={p.canonicalId} className="border-b border-[#eef6f2] py-2 text-xs last:border-0 dark:border-white/10">
              <div className="flex items-center justify-between gap-2"><span className="line-clamp-1 font-black">{p.nameAr}</span><span className="shrink-0 tabular-nums text-on-surface-variant dark:text-white/60">{p.sessions} / {p.interactions}</span></div>
              {p.blockerAr && <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">{p.blockerAr}</p>}
            </div>
          ))}
          {o.products.length === 0 && <EmptyNote>لا خروج مرتبط في الفترة</EmptyNote>}
        </FCard>
      </div>

      {/* Data quality */}
      <section>
        <SectionTitle sub={`الإصدار ${o.definitionVersion} · وقت القراءة ${formatRiyadh(o.generatedAt)} · مقارنة بـ${o.previousWindow.labelAr}`}>جودة البيانات والخدمات</SectionTitle>
        <div className="grid gap-2 md:grid-cols-2">
          {o.quality.map((item, i) => (
            <FCard key={i} tone={item.severity === 'critical' ? 'critical' : item.severity === 'warn' ? 'warn' : 'muted'} className="py-3 text-xs">{item.textAr}</FCard>
          ))}
          {o.quality.length === 0 && <EmptyNote>لا ملاحظات جودة في هذه النافذة</EmptyNote>}
        </div>
        <p className="mt-3 text-[11px] text-on-surface-variant dark:text-white/50">
          السجل: {Object.keys(METRICS).length} مؤشرًا معرّفًا · المؤشرات S/Q/D تُحسب بدوال SQL في الإنتاج (founder_window_metrics) وتطابق التحقق المستقل لدراسة 25 سبتمبر.
        </p>
      </section>
    </div>
  );
}
