import Link from 'next/link';
import { fetchExpenses } from '@/lib/founder/finance';
import { fetchSubscriptions, buildExpenseReport } from '@/lib/founder/subscriptions';
import { monthWindow, riyadhMonthStart, windowFor, formatRiyadh, type MetricWindow } from '@/lib/founder/windows';
import { FCard, SectionTitle, EmptyNote, Tag } from '@/components/founder/ui';

export const dynamic = 'force-dynamic';
type SP = { f?: string; start?: string; end?: string };

const FILTERS: Array<{ key: string; label: string }> = [{ key: 'month', label: 'هذا الشهر' }, { key: 'prev', label: 'الشهر السابق' }, { key: 'all', label: 'منذ البداية' }, { key: 'custom', label: 'فترة مخصصة' }];

function resolve(sp: SP, now: Date): { w: MetricWindow; allTime: boolean; key: string } {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (sp.start && sp.end && dateRe.test(sp.start) && dateRe.test(sp.end) && sp.start <= sp.end) return { w: windowFor('custom', now, { start: sp.start, end: sp.end }), allTime: false, key: 'custom' };
  if (sp.f === 'prev') return { w: monthWindow(riyadhMonthStart(now, 1)), allTime: false, key: 'prev' };
  if (sp.f === 'all') return { w: windowFor('30d', now), allTime: true, key: 'all' };
  return { w: windowFor('month', now), allTime: false, key: 'month' };
}

const sar = (v: number) => `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ExpenseReportPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const now = new Date();
  const { w, allTime, key } = resolve(sp, now);
  const [expenses, subs] = await Promise.all([fetchExpenses(), fetchSubscriptions()]);
  const r = buildExpenseReport(expenses, subs, w, allTime);
  const base = `/${locale}/admin/founder/expenses/report`;

  return (
    <div className="space-y-5">
      <FCard className="space-y-3">
        <SectionTitle sub="الفعلي = مدفوع بتاريخ الدفع داخل الفترة. المتوقع = قيود اشتراك/مستحقة لم تُدفع. الميزانية = الاشتراكات الثابتة الفعالة + الميزانيات التقديرية للمتغيرة، مقيسة بطول الفترة. الفرق = الفعلي − الميزانية." action={<Link href={`/${locale}/admin/founder/expenses`} className="text-xs font-black text-[#1f6f59] underline decoration-dotted">← المصروفات</Link>}>تقرير المصروفات</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {FILTERS.map((f) => <Link key={f.key} href={f.key === 'custom' ? `${base}?f=custom` : `${base}?f=${f.key}`} className={`rounded-full px-3 py-1.5 font-black ${key === f.key ? 'bg-[#1f6f59] text-white' : 'border border-[#d7ece5] dark:border-[#263b33]'}`}>{f.label}</Link>)}
          <form method="get" className="flex items-center gap-1"><input type="date" name="start" defaultValue={sp.start} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]" /><input type="date" name="end" defaultValue={sp.end} className="rounded-lg border border-[#d7ece5] bg-transparent px-2 py-1 dark:border-[#263b33]" /><button className="rounded-lg bg-[#1f6f59] px-3 py-1 font-black text-white">تطبيق</button></form>
        </div>
        <p className="text-[11px] text-on-surface-variant dark:text-white/55">{allTime ? 'منذ البداية: كل القيود المدفوعة بغض النظر عن التاريخ؛ لا ميزانية لفترة مفتوحة.' : <><b>{r.window.labelAr}</b> · {formatRiyadh(r.window.start)} → {formatRiyadh(r.window.end)} · {r.monthsInWindow} شهرًا {r.window.partial && <Tag tone="warn">جزئية</Tag>}</>}</p>
      </FCard>

      <FCard className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-[#f8fcfa] text-[11px] font-black text-on-surface-variant dark:bg-white/5 dark:text-white/60"><tr>{['التصنيف', 'الفعلي (ر.س)', 'المتوقع (ر.س)', 'الميزانية (ر.س)', 'الفرق (فعلي − ميزانية)', 'قيود'].map((h) => <th key={h} className="px-3 py-2 text-start">{h}</th>)}</tr></thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.classification} className="border-t border-[#eef6f2] tabular-nums dark:border-white/10">
                <td className="px-3 py-2 font-black">{l.labelAr}</td><td className="px-3 py-2">{sar(l.actualSar)}</td><td className="px-3 py-2">{sar(l.expectedSar)}</td><td className="px-3 py-2">{allTime ? '—' : sar(l.budgetSar)}</td>
                <td className={`px-3 py-2 ${!allTime && l.varianceSar > 0 ? 'text-amber-700 dark:text-amber-300' : ''}`}>{allTime ? '—' : `${l.varianceSar >= 0 ? '+' : '−'}${sar(Math.abs(l.varianceSar))}`}</td>
                <td className="px-3 py-2 text-on-surface-variant">{l.actualRows} مدفوع{l.expectedRows ? ` · ${l.expectedRows} متوقع` : ''}{l.undatedActualRows ? ` · ${l.undatedActualRows} بتاريخ يحتاج مراجعة` : ''}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[#d7ece5] bg-[#f8fcfa] font-black tabular-nums dark:border-[#263b33] dark:bg-white/5">
              <td className="px-3 py-2">الإجمالي</td><td className="px-3 py-2">{sar(r.total.actualSar)}</td><td className="px-3 py-2">{sar(r.total.expectedSar)}</td><td className="px-3 py-2">{allTime ? '—' : sar(r.total.budgetSar)}</td>
              <td className="px-3 py-2">{allTime ? '—' : `${r.total.varianceSar >= 0 ? '+' : '−'}${sar(Math.abs(r.total.varianceSar))}`}</td><td className="px-3 py-2">{r.total.actualRows} مدفوع{r.total.expectedRows ? ` · ${r.total.expectedRows} متوقع` : ''}</td>
            </tr>
          </tbody>
        </table>
      </FCard>
      {expenses.length === 0 && <EmptyNote>لا مصروفات مسجلة</EmptyNote>}
      <p className="text-[11px] text-on-surface-variant dark:text-white/50">التصنيف: بنية = استضافة/بريد/قاعدة بيانات/استخراج بيانات/بيانات سوق؛ AI = اشتراكات وواجهات الذكاء الاصطناعي؛ تسويق = حملات X وTikTok وأدوات التسويق؛ تطوير خارجي = الشركة التقنية والمطور المستقل (متوقف، غير مسترد). القيود بتاريخ يحتاج مراجعة تظهر في «منذ البداية» فقط.</p>
    </div>
  );
}
