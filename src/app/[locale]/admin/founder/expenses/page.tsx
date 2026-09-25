import { windowFromSearchParams } from '@/lib/founder/api';
import { fetchExpenses, fetchBudgets, cashSpent, periodCost, dueUnpaid, totalSinceStart, breakdownBy, upcomingCommitments, budgetStatus, expenseSar } from '@/lib/founder/finance';
import { EXPENSE_CATEGORY_AR } from '@/lib/founder/registry';
import { daysBetween, monthWindow, riyadhMonthStart, riyadhMidnightDaysAgo, formatRiyadh } from '@/lib/founder/windows';
import { FCard, SectionTitle, WindowPicker, EmptyNote, KV, Sar, Tag } from '@/components/founder/ui';
import { ExpenseForm, ExpenseImportForm, BudgetForm, DeleteButton, EditToggle, ViewEvidence } from '@/components/founder/forms';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string };

export default async function ExpensesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const now = new Date();
  const [rows, budgets] = await Promise.all([fetchExpenses(), fetchBudgets()]);
  const base = `/${locale}/admin/founder/expenses`;
  const monthW = monthWindow(riyadhMonthStart(now));
  const todayW = { kind: 'day' as const, start: riyadhMidnightDaysAgo(0, now), end: now, partial: true, labelAr: 'اليوم' };
  const cash = cashSpent(rows, w), period = periodCost(rows, w), due = dueUnpaid(rows, w.end), total = totalSinceStart(rows);
  const monthCash = cashSpent(rows, monthW), monthPeriod = periodCost(rows, monthW), todayCash = cashSpent(rows, todayW);
  const byCat = breakdownBy(rows, w, 'category'), byVendor = breakdownBy(rows, w, 'vendor'), byCampaign = breakdownBy(rows, w, 'campaign'), byKind = breakdownBy(rows, w, 'cost_kind');
  const budgetsView = budgetStatus(budgets, breakdownBy(rows, monthW, 'category'), daysBetween(monthW.start, now) / Math.max(1, daysBetween(monthW.start, monthW.end)));
  const upcoming = upcomingCommitments(rows, now);
  const unconverted = rows.filter((r) => expenseSar(r) == null).length;

  return (
    <div className="space-y-6">
      <FCard><WindowPicker current={w} basePath={base} sp={sp} /></FCard>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FCard><KV rows={[{ k: 'إجمالي ما صُرف منذ البداية (F04)', v: <Sar v={total.sar} />, note: `${total.rows} سجل مدفوع${total.estimateRows ? ` · ${total.estimateRows} تقدير` : ''}${unconverted ? ` · ${unconverted} بلا تحويل` : ''}` }]} /></FCard>
        <FCard><KV rows={[{ k: 'هذا الشهر: نقد / تكلفة', v: <><Sar v={monthCash.sar} /> / <Sar v={monthPeriod.sar} /></>, note: monthW.labelAr }]} /></FCard>
        <FCard><KV rows={[{ k: 'اليوم نقدًا', v: <Sar v={todayCash.sar} /> }, { k: 'مستحق غير مدفوع (F03)', v: <Sar v={due.sar} /> }]} /></FCard>
        <FCard><KV rows={[{ k: `${w.labelAr}: نقد (F01)`, v: <Sar v={cash.sar} /> }, { k: 'تكلفة الفترة (F02)', v: <Sar v={period.sar} />, note: 'موزعة على فترة الخدمة' }]} /></FCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FCard id="add"><SectionTitle sub="كل حقل ناقص يبقى ناقصًا موسومًا؛ لا اختلاق تاريخ أو إيصال.">إضافة مصروف</SectionTitle><ExpenseForm /></FCard>
        <div className="space-y-4">
          <FCard><SectionTitle sub="ملف واحد لا يُستورد مرتين (بصمة الملف)، والصف المكرر يُتخطى ويُعدّ.">استيراد CSV للمصروفات التاريخية</SectionTitle><ExpenseImportForm /></FCard>
          <FCard>
            <SectionTitle sub="ميزانية قابلة للضبط، ليست حقيقة عن المصروف الفعلي. التنبيه عندما يتجاوز صرف الشهر حصة الأيام المنقضية.">الميزانيات الشهرية</SectionTitle>
            {budgetsView.length ? <KV rows={budgetsView.map((b) => ({ k: b.labelAr, v: <>{b.spentSar.toLocaleString('en-US')} / {b.budgetSar.toLocaleString('en-US')} ر.س {b.over ? <Tag tone="warn">تجاوز الوتيرة</Tag> : b.ratio != null && b.ratio > 1 ? <Tag tone="bad">تجاوز</Tag> : <Tag tone="good">ضمن الميزانية</Tag>}</>, note: b.note ?? undefined }))} /> : <EmptyNote>لا ميزانيات</EmptyNote>}
            <div className="mt-3"><BudgetForm /></div>
          </FCard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FCard><SectionTitle>حسب الفئة</SectionTitle>{byCat.length ? <KV rows={byCat.map((b) => ({ k: b.labelAr, v: <Sar v={b.sar} />, note: b.unconvertedRows ? `${b.unconvertedRows} بلا تحويل` : undefined }))} /> : <EmptyNote>لا شيء في الفترة</EmptyNote>}</FCard>
        <FCard><SectionTitle>حسب الأداة/المورد</SectionTitle>{byVendor.length ? <KV rows={byVendor.slice(0, 12).map((b) => ({ k: b.labelAr, v: <Sar v={b.sar} /> }))} /> : <EmptyNote>لا شيء</EmptyNote>}</FCard>
        <FCard><SectionTitle>حسب الحملة</SectionTitle>{byCampaign.length ? <KV rows={byCampaign.map((b) => ({ k: b.labelAr, v: <Sar v={b.sar} /> }))} /> : <EmptyNote>لا شيء</EmptyNote>}</FCard>
        <FCard><SectionTitle sub="سياسة التوزيع: المشترك يُعرض منفصلًا ولا يُوزع تلقائيًا على الحملات.">مباشر / مشترك</SectionTitle>{byKind.length ? <KV rows={byKind.map((b) => ({ k: b.labelAr, v: <Sar v={b.sar} /> }))} /> : <EmptyNote>لا شيء</EmptyNote>}</FCard>
      </div>

      <FCard>
        <SectionTitle sub="اشتراكات متكررة تجديدها خلال 45 يومًا.">الالتزامات القادمة</SectionTitle>
        {upcoming.length ? <KV rows={upcoming.map((u) => ({ k: `${u.vendor} (${u.recurrence === 'monthly' ? 'شهري' : u.recurrence === 'yearly' ? 'سنوي' : 'متكرر'})`, v: <Sar v={u.sar} />, note: `التجديد ${u.renewalAt}` }))} /> : <EmptyNote>لا تجديدات مسجلة قريبة</EmptyNote>}
      </FCard>

      <section>
        <SectionTitle sub={`${rows.length} سجلًا نشطًا. الحذف ناعم ويبقى في سجل التدقيق.`}>السجل</SectionTitle>
        {rows.length === 0 ? <EmptyNote>لا مصروفات بعد</EmptyNote> : (
          <div className="space-y-2">
            {rows.slice(0, 200).map((e) => (
              <FCard key={e.id} className="text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black">{e.vendor} <span className="font-normal text-on-surface-variant dark:text-white/60">· {EXPENSE_CATEGORY_AR[e.category]} · {e.description ?? ''}</span></p>
                    <p className="mt-0.5 tabular-nums text-on-surface-variant dark:text-white/60">
                      {e.amount_original} {e.currency}{e.fees || e.tax ? ` (+${e.fees} رسوم، +${e.tax} ضريبة)` : ''} = <b>{expenseSar(e) == null ? 'غير محوّل' : `${expenseSar(e)} ر.س`}</b> · الخدمة {e.service_period_start} → {e.service_period_end} · {e.payment_status === 'paid' ? `دُفع ${e.paid_at}` : `مستحق ${e.due_at ?? ''}`}
                      {e.recurrence !== 'one_time' ? ` · ${e.recurrence === 'monthly' ? 'شهري' : e.recurrence === 'yearly' ? 'سنوي' : 'متكرر'}` : ''}{e.campaign ? ` · حملة ${e.campaign}` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant dark:text-white/50">
                      <Tag tone={e.evidence_state === 'documented' ? 'good' : 'warn'}>{e.evidence_state === 'documented' ? 'موثق' : 'تقدير'}</Tag> {e.cost_kind === 'shared' && <Tag>مشترك</Tag>} {e.evidence_ref ? `مرجع: ${e.evidence_ref} · ` : ''}{e.evidence_path && <ViewEvidence path={e.evidence_path} />} · نسخة {e.revision} · آخر تعديل {formatRiyadh(e.updated_at)}{e.import_id ? ' · مستورد' : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <EditToggle><ExpenseForm initial={e} /></EditToggle>
                    <DeleteButton path={`/expenses/${e.id}`} />
                  </div>
                </div>
              </FCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
