import { windowFromSearchParams } from '@/lib/founder/api';
import { fetchExpenses, fetchBudgets, cashSpent, periodCost, dueUnpaid, totalSinceStart, breakdownBy, upcomingCommitments, budgetStatus, expenseSar } from '@/lib/founder/finance';
import { EXPENSE_CATEGORY_AR } from '@/lib/founder/registry';
import { daysBetween, monthWindow, riyadhMonthStart, riyadhMidnightDaysAgo, formatRiyadh } from '@/lib/founder/windows';
import { FCard, SectionTitle, WindowPicker, EmptyNote, KV, Sar, Tag } from '@/components/founder/ui';
import { ExpenseForm, ExpenseImportForm, BudgetForm, DeleteButton, EditToggle, ViewEvidence, SubscriptionForm, ConfirmExpectedButton } from '@/components/founder/forms';
import { fetchSubscriptions, materializeExpectedExpenses, SUBSCRIPTION_STATUS_AR, SUBSCRIPTION_KIND_AR } from '@/lib/founder/subscriptions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string };

export default async function ExpensesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const now = new Date();
  // Rule 1: any fixed subscription whose renewal date has arrived gets its EXPECTED draft now
  // (idempotent; the worker does the same hourly). Never marks anything paid.
  await materializeExpectedExpenses(null).catch(() => null);
  const [allRows, budgets, subs] = await Promise.all([fetchExpenses(), fetchBudgets(), fetchSubscriptions()]);
  const expected = allRows.filter((e) => e.payment_status === 'expected');
  const rows = allRows.filter((e) => e.payment_status !== 'expected');
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
        <FCard><KV rows={[{ k: 'إجمالي ما صُرف منذ البداية (F04)', v: <Sar v={total.sar} />, note: `${total.rows} سجل مدفوع${total.estimateRows ? ` · ${total.estimateRows} تقدير` : ''}${unconverted ? ` · ${unconverted} بلا تحويل` : ''}${total.undatedRows ? ` · ${total.undatedRows} بتاريخ يحتاج مراجعة (خارج النوافذ المؤرخة)` : ''}` }]} /></FCard>
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

      <section id="subscriptions">
        <SectionTitle sub="منفصلة عن المصروفات المدفوعة. الاشتراك الثابت ينشئ قيدًا متوقعًا في تاريخ التجديد ولا يصبح مدفوعًا إلا بتأكيد فاتورة أو خصم. المتغير (Railway/Supabase/SendGrid/Anthropic API) ميزانية تقديرية فقط وتُدخل فاتورته الفعلية شهريًا." action={<Link href={`/${locale}/admin/founder/expenses/report`} className="text-xs font-black text-[#1f6f59] underline decoration-dotted">تقرير المصروفات ←</Link>}>الالتزامات والاشتراكات الشهرية</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <FCard>
            {subs.length === 0 ? <EmptyNote>لا التزامات مسجلة</EmptyNote> : (
              <div className="space-y-2 text-xs">
                {subs.map((s) => (
                  <div key={s.id} className="rounded-xl border border-[#eef6f2] p-2.5 dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black">{s.vendor} <span className="font-normal text-on-surface-variant dark:text-white/60">· {EXPENSE_CATEGORY_AR[s.category]}</span></span>
                      <span className="flex gap-1"><Tag tone={s.kind === 'fixed' ? 'good' : 'muted'}>{SUBSCRIPTION_KIND_AR[s.kind]}</Tag><Tag tone={s.status === 'active' ? 'good' : s.status === 'needs_confirmation' ? 'warn' : 'muted'}>{SUBSCRIPTION_STATUS_AR[s.status]}</Tag></span>
                    </div>
                    <p className="mt-1 tabular-nums text-on-surface-variant dark:text-white/60">
                      {s.kind === 'fixed' ? <>{s.amount_sar} ر.س / {s.cadence === 'yearly' ? 'سنة' : 'شهر'}{s.next_renewal_at ? ` · التجديد القادم ${s.next_renewal_at}` : ''}{s.last_confirmed_at ? ` · آخر تأكيد ${s.last_confirmed_at}` : ''}</> : <>ميزانية تقديرية {s.amount_sar} ر.س/شهر · {s.budget_source}</>}
                    </p>
                    {s.notes && <p className="mt-0.5 text-[11px] text-on-surface-variant dark:text-white/50">{s.notes}</p>}
                    <div className="mt-1 flex items-center gap-3"><EditToggle><SubscriptionForm initial={s} /></EditToggle><DeleteButton path={`/subscriptions/${s.id}`} label="أرشفة" confirmText="أرشفة هذا الالتزام؟ (يبقى في سجل التدقيق)" /></div>
                  </div>
                ))}
              </div>
            )}
          </FCard>
          <div className="space-y-4">
            <FCard>
              <SectionTitle sub="قيود أنشأها الاشتراك الثابت في تاريخ تجديده؛ خارج كل مجموع حتى يُؤكد الدفع بفاتورة أو خصم.">قيود متوقعة بانتظار التأكيد</SectionTitle>
              {expected.length === 0 ? <EmptyNote>لا قيود متوقعة الآن — تظهر تلقائيًا في تاريخ التجديد</EmptyNote> : (
                <div className="space-y-2 text-xs">
                  {expected.map((e) => (
                    <div key={e.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/5">
                      <p className="font-black">{e.vendor} <span className="font-normal tabular-nums text-on-surface-variant dark:text-white/60">· {expenseSar(e) ?? e.amount_original} ر.س · متوقع في {e.expected_for ?? e.due_at}</span></p>
                      <div className="mt-1 flex flex-wrap items-center gap-3"><ConfirmExpectedButton expenseId={e.id} defaultDate={e.expected_for ?? e.due_at ?? ''} /><DeleteButton path={`/expenses/${e.id}?note=${encodeURIComponent('إلغاء قيد متوقع')}`} label="لم يُدفع — إلغاء" /></div>
                    </div>
                  ))}
                </div>
              )}
            </FCard>
            <FCard><SectionTitle sub="Store Leads وBrowserless لا يُنشآن التزامًا متكررًا إلا بعد تأكيد أنهما لا يزالان فعالين (غيّر الحالة إلى «فعال»).">إضافة التزام</SectionTitle><SubscriptionForm /></FCard>
          </div>
        </div>
      </section>

      <FCard>
        <SectionTitle sub="اشتراكات متكررة تجديدها خلال 45 يومًا (من القيود نفسها).">الالتزامات القادمة من القيود</SectionTitle>
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
                      {e.amount_original} {e.currency}{e.fees || e.tax ? ` (+${e.fees} رسوم، +${e.tax} ضريبة)` : ''} = <b>{expenseSar(e) == null ? 'غير محوّل' : `${expenseSar(e)} ر.س`}</b> · {e.date_precision === 'needs_review' || !e.service_period_start ? <Tag tone="warn">تاريخ تاريخي يحتاج مراجعة</Tag> : <>الخدمة {e.service_period_start} → {e.service_period_end} · {e.payment_status === 'paid' ? `دُفع ${e.paid_at ?? 'بلا تاريخ'}` : `مستحق ${e.due_at ?? ''}`}</>}
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
