import { windowFromSearchParams } from '@/lib/founder/api';
import { buildOverview } from '@/lib/founder/overview';
import { GOAL_STATUS_AR } from '@/lib/founder/goals';
import { getSetting } from '@/lib/founder/ledger';
import { metricFromPack } from '@/lib/founder/metrics';
import { riyadhMonthStart, monthWindow, formatRiyadh, toRiyadh } from '@/lib/founder/windows';
import { FCard, SectionTitle, WindowPicker, EmptyNote, Tag, KV } from '@/components/founder/ui';
import { GoalForm, GoalActions, ScenarioInputsForm } from '@/components/founder/forms';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string };

export default async function GoalsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const now = new Date();
  const o = await buildOverview(w, { includeDemand: false, includeReferrals: false });
  const base = `/${locale}/admin/founder/goals`;
  const month = toRiyadh(riyadhMonthStart(now)).toISOString().slice(0, 10);
  const prevMonthW = monthWindow(riyadhMonthStart(now, 1));
  // Baselines offered to a new goal: the previous completed month, from the same pack.
  const baselinePack = o.prevPack;
  const baselines: Record<string, { value: number | null; start: string; end: string; labelAr: string }> = {};
  for (const id of ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'Q01I']) {
    const m = metricFromPack(id, o.prevPack, o.previousWindow);
    baselines[id] = { value: baselinePack.ok ? m.numerator : null, start: o.previousWindow.start.toISOString(), end: o.previousWindow.end.toISOString(), labelAr: o.previousWindow.labelAr };
  }
  if (o.money) {
    baselines.S07 = { value: o.money.revenue.coverageState === 'coverage_missing' ? null : o.money.revenue.orders + o.money.revenue.items + o.money.revenue.aggregates, start: w.start.toISOString(), end: w.end.toISOString(), labelAr: w.labelAr };
    baselines.S08 = { value: o.money.revenue.coverageState === 'coverage_missing' ? null : o.money.revenue.confirmedSar, start: w.start.toISOString(), end: w.end.toISOString(), labelAr: w.labelAr };
    baselines.F02 = { value: o.money.periodCost.sar, start: w.start.toISOString(), end: w.end.toISOString(), labelAr: w.labelAr };
    baselines.F01 = { value: o.money.cashSpent.sar, start: w.start.toISOString(), end: w.end.toISOString(), labelAr: w.labelAr };
  }
  const scenarioInputs = (await getSetting<Record<string, unknown>>('scenario_inputs')) ?? {};
  const sc = o.scenarios;

  return (
    <div className="space-y-6">
      <FCard><WindowPicker current={w} basePath={base} sp={sp} /></FCard>
      <FCard tone="muted" className="text-xs leading-relaxed">
        الهدف التزام تجربة لا توقع إيراد. الحالة: <Tag tone="good">متحقق</Tag> <Tag tone="good">على المسار</Tag> (≥90% من الوتيرة المتوقعة حتى اليوم) <Tag tone="warn">متأخر</Tag> <Tag>غير قابل للحكم</Tag> (قيمة غير متاحة، تغطية ناقصة، أو تعريف تغير). لا يُعدّل هدف بأثر رجعي دون سبب مسجل. زيادة الزيارات من اختبارات أو حركة آلية ليست نجاحًا (مستبعدة أصلًا من التعريف).
      </FCard>

      <section>
        <SectionTitle sub={`الشهر الحالي ${month} · القيم حتى الآن (منتصف الليل السعودي → الآن)`}>أهداف الشهر</SectionTitle>
        {o.goals.length === 0 ? <EmptyNote>لا أهداف بعد. اقتراح الدراسة (للتقييم لا للاعتماد الآلي): S02 ≥ 100 متصفح تلقى نتيجة خلال 30 يومًا، S06 ≥ 20 بحث تبعه خروج مرتبط، S08 أول عمولة معتمدة موجبة، C01 تغطية 2/2.</EmptyNote> : (
          <div className="grid gap-3 md:grid-cols-2">
            {o.goals.map((g) => (
              <FCard key={g.goal.id} tone={g.status === 'behind' ? 'warn' : g.status === 'not_judgeable' ? 'muted' : 'default'} className="text-xs">
                <div className="flex items-center justify-between gap-2"><p className="font-black">{g.goal.metric_id} — {g.nameAr}</p><Tag tone={g.status === 'achieved' || g.status === 'on_track' ? 'good' : g.status === 'behind' ? 'warn' : 'muted'}>{GOAL_STATUS_AR[g.status]}</Tag></div>
                <KV rows={[
                  { k: 'خط الأساس', v: g.goal.baseline_value ?? 'غير متاح', note: g.goal.baseline_window_start ? `${formatRiyadh(g.goal.baseline_window_start, false)} → ${formatRiyadh(g.goal.baseline_window_end, false)} · تعريف ${g.goal.definition_version}` : undefined },
                  { k: 'الهدف', v: `${g.goal.direction === 'lte' ? '≤' : '≥'} ${g.goal.target_value}` },
                  { k: 'حتى الآن', v: g.current ?? 'غير متاح', note: g.progressPct != null ? `${g.progressPct.toFixed(0)}% من الهدف · الوتيرة المتوقعة ${g.expectedPacePct?.toFixed(0)}% · ${g.daysLeft} يومًا متبقيًا` : g.statusReasonAr },
                ]} />
                <p className="mt-1 text-[11px] text-on-surface-variant dark:text-white/55"><b>المبرر:</b> {g.goal.rationale} {g.goal.proposed_action ? <><br /><b>القرار المقترح:</b> {g.goal.proposed_action}</> : null} · <b>الصاحب:</b> {g.goal.owner}</p>
                {g.definitionChanged && <p className="mt-1 text-[11px] font-bold text-amber-700">تعريف المؤشر تغير منذ وضع الهدف.</p>}
                {g.revisions.length > 1 && <details className="mt-1 text-[11px]"><summary className="cursor-pointer font-bold">سجل التغيير ({g.revisions.length})</summary><ul className="ps-4 list-disc">{g.revisions.map((r) => <li key={r.id}>{formatRiyadh(r.created_at)} — {r.reason ?? 'بلا سبب'} {r.before && r.after && r.before.target_value !== r.after.target_value ? `(${r.before.target_value} → ${r.after.target_value})` : ''}</li>)}</ul></details>}
                <GoalActions id={g.goal.id} />
              </FCard>
            ))}
          </div>
        )}
      </section>

      <FCard id="add"><SectionTitle sub={`خط الأساس يُقترح من ${o.previousWindow.labelAr}؛ يمكنك تغيير الهدف والمبرر فقط.`}>تحديد هدف</SectionTitle><GoalForm month={month} baselines={baselines} /></FCard>

      <section>
        <SectionTitle sub="سيناريوهات من مدخلات معلنة. إن غابت مدخلات لا يُعرض توقع مختلق. التعادل التشغيلي الشهري منفصل عن استرداد ما أنفقه المؤسس.">التقدم نحو الربحية</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <FCard>
            {!sc ? <EmptyNote>غير متاح</EmptyNote> : !sc.ready ? (
              <div className="space-y-2 text-xs">
                <p className="font-black text-amber-800 dark:text-amber-300">مدخلات ناقصة يحتاج المؤسس توفيرها:</p>
                <ul className="list-disc ps-4">{sc.missingInputsAr.map((m) => <li key={m}>{m}</li>)}</ul>
                {sc.breakevenMonthlyExitsNeeded != null && <p>التعادل التشغيلي يحتاج نحو <b>{sc.breakevenMonthlyExitsNeeded}</b> خروجًا مرتبطًا شهريًا بالمدخلات الحالية.</p>}
                <p className="text-on-surface-variant dark:text-white/55">الافتراضات المتاحة: {sc.assumptionsAr.join('؛ ')}</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <KV rows={sc.results.map((r) => ({ k: `${r.labelAr} (نمو ${(r.growthMonthly * 100).toFixed(0)}%/شهر)`, v: r.monthsToOperatingBreakeven ? `تعادل بعد ${r.monthsToOperatingBreakeven} شهرًا` : 'لا تعادل خلال 36 شهرًا', note: `${r.monthsToPayback ? `استرداد تمويل المؤسس بعد ${r.monthsToPayback} شهرًا` : 'لا استرداد خلال 36 شهرًا'} · عمولة الشهر 12 ≈ ${r.monthlyCommissionAtMonth12} ر.س` }))} />
                <p>التعادل التشغيلي يحتاج نحو <b>{sc.breakevenMonthlyExitsNeeded}</b> خروجًا مرتبطًا شهريًا. صافي النقد المستخدم حتى الآن: {sc.founderNetCashUsedSar ?? 'غير متاح'} ر.س.</p>
                <p className="text-on-surface-variant dark:text-white/55">الافتراضات: {sc.assumptionsAr.join('؛ ')}. لا CAC/ROAS/LTV بوحدات غير صالحة.</p>
              </div>
            )}
          </FCard>
          <FCard><SectionTitle sub="كل مدخل يحمل مصدره: مقاس أو افتراض.">مدخلات السيناريو</SectionTitle><ScenarioInputsForm initial={scenarioInputs} /></FCard>
        </div>
        <p className="mt-2 text-[11px] text-on-surface-variant dark:text-white/50">الشهر السابق المكتمل: {prevMonthW.labelAr}.</p>
      </section>
    </div>
  );
}
