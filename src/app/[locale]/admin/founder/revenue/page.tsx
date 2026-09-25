import Link from 'next/link';
import { windowFromSearchParams } from '@/lib/founder/api';
import { fetchRevenueEntries, fetchFunding, fetchAffiliateReports, fetchAffiliateConversions, fetchExpenses, revenueSummary, revenueSar, fundingTotal, cashSpent, periodCost, totalSinceStart, COMMISSION_STATE_AR, type CommissionState } from '@/lib/founder/finance';
import { PARTNER_LABEL_AR } from '@/lib/founder/registry';
import { formatRiyadh } from '@/lib/founder/windows';
import { FCard, SectionTitle, WindowPicker, EmptyNote, KV, Sar, Tag } from '@/components/founder/ui';
import { RevenueForm, FundingForm, DeleteButton, EditToggle, ViewEvidence } from '@/components/founder/forms';

export const dynamic = 'force-dynamic';
type SP = { w?: string; start?: string; end?: string };

export default async function RevenuePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const w = windowFromSearchParams(sp);
  const [entries, funding, reports, conversions, expenses] = await Promise.all([fetchRevenueEntries(), fetchFunding(), fetchAffiliateReports(), fetchAffiliateConversions(), fetchExpenses()]);
  const base = `/${locale}/admin/founder/revenue`;
  const rev = revenueSummary(entries, conversions, reports, w);
  const fund = fundingTotal(funding);
  const cash = cashSpent(expenses, w), period = periodCost(expenses, w), total = totalSinceStart(expenses);
  const paidAllTime = entries.filter((e) => e.state === 'paid').reduce((s, e) => s + (revenueSar(e) ?? 0), 0);
  const coverageOk = rev.coverageState !== 'coverage_missing';

  return (
    <div className="space-y-6">
      <FCard><WindowPicker current={w} basePath={base} sp={sp} /></FCard>
      <FCard tone="muted" className="text-xs leading-relaxed">
        الفرق الملزم: <b>صرّح به المؤسس</b> (غير مطابق) ≠ <b>مطابق لوثيقة شريك</b> ≠ <b>معلق</b> ≠ <b>معتمد بعد التعديلات</b> ≠ <b>مقبوض نقدًا</b>. غياب الاستيراد لا يعني صفر إيراد. الصادرات التي تعرض وحدات/بنودًا تُسجل بوحدتها لا كطلبات. التقارير المستوردة تُرفع من <Link className="underline" href={`/${locale}/admin/affiliate`}>صفحة العمولات</Link> وتظهر هنا تلقائيًا.
      </FCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FCard><KV rows={[{ k: 'تغطية الشركاء (C01)', v: `${rev.coverageCount}/2`, note: rev.coverage.map((c) => `${PARTNER_LABEL_AR[c.source]}: ${c.detailAr}`).join(' · ') }]} /></FCard>
        <FCard><KV rows={[{ k: 'معتمدة (S08)', v: coverageOk ? <Sar v={rev.confirmedSar} /> : <Tag>غير معلوم</Tag> }, { k: 'مقبوض نقدًا (S08P)', v: coverageOk ? <Sar v={rev.paidSar} /> : <Tag>غير معلوم</Tag> }]} /></FCard>
        <FCard><KV rows={[{ k: 'معلق', v: coverageOk ? <Sar v={rev.pendingSar} /> : <Tag>غير معلوم</Tag> }, { k: 'مستحق القبض (F08)', v: coverageOk ? <Sar v={rev.receivableSar} /> : <Tag>غير معلوم</Tag> }]} /></FCard>
        <FCard><KV rows={[{ k: 'النتيجة التشغيلية (F06)', v: coverageOk ? <Sar v={Math.round((rev.confirmedSar - period.sar) * 100) / 100} /> : <Tag>غير قابل للحكم</Tag>, note: 'S08 − F02' }, { k: 'صافي النقد (F07)', v: coverageOk ? <Sar v={Math.round((rev.paidSar - cash.sar) * 100) / 100} /> : <Tag>غير قابل للحكم</Tag> }]} /></FCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FCard id="add"><SectionTitle sub="أرفق التقرير أو صورة الإثبات؛ الحالة غير «مصرّح» تشترط مرجعًا.">إضافة عمولة / إيراد يدويًا</SectionTitle><RevenueForm /></FCard>
        <div className="space-y-4">
          <FCard>
            <SectionTitle sub="مصادر التقارير المستوردة وفتراتها.">تقارير الشركاء المستوردة</SectionTitle>
            {reports.length ? <KV rows={reports.slice(0, 10).map((r) => ({ k: `${r.source} · ${r.report_period_start ?? '؟'} → ${r.report_period_end ?? '؟'}`, v: `${r.imported_rows} صف`, note: formatRiyadh(r.created_at) }))} /> : <EmptyNote>لا تقارير مستوردة — ارفع صادرات أمازون ونون من صفحة العمولات</EmptyNote>}
          </FCard>
          <FCard>
            <SectionTitle sub="أموال المؤسس التي يمول بها المشروع ليست إيرادًا. صافي النقد المستخدم = إجمالي الصرف − المقبوض.">تمويل المؤسس</SectionTitle>
            <KV rows={[{ k: 'إجمالي التمويل (F05)', v: <Sar v={fund.sar} /> }, { k: 'إجمالي الصرف منذ البداية (F04)', v: <Sar v={total.sar} /> }, { k: 'مقبوض منذ البداية', v: <Sar v={paidAllTime} /> }, { k: 'صافي النقد المستخدم', v: <Sar v={Math.round((total.sar - paidAllTime) * 100) / 100} /> }]} />
            <div className="mt-3"><FundingForm /></div>
            {funding.length > 0 && <ul className="mt-2 space-y-1 text-[11px]">{funding.map((f) => <li key={f.id} className="flex justify-between"><span>{f.funded_at} · {f.amount} {f.currency} {f.note ? `· ${f.note}` : ''}</span><DeleteButton path={`/funding?id=${f.id}`} /></li>)}</ul>}
          </FCard>
        </div>
      </div>

      <section>
        <SectionTitle sub="حسب الحالة داخل النافذة (يدوي + مستورد بلا ازدواج).">حالات العمولة</SectionTitle>
        {!coverageOk ? <EmptyNote>غير معلوم — لا تغطية شريك للفترة</EmptyNote> : <FCard><KV rows={(Object.entries(rev.byState) as Array<[CommissionState, { sar: number; rows: number; units: number; unconverted: number }]>).map(([k, v]) => ({ k: COMMISSION_STATE_AR[k], v: <><Sar v={v.sar} /> · {v.rows} صف · {v.units} وحدة</>, note: v.unconverted ? `${v.unconverted} بلا تحويل موثق` : undefined }))} /></FCard>}
        {rev.currencies.length > 1 && <p className="mt-2 text-[11px] text-amber-700">عملات متعددة في الفترة: {rev.currencies.join('، ')} — تُفصل حتى التحويل الموثق.</p>}
      </section>

      <section>
        <SectionTitle sub={`${entries.length} إدخالًا يدويًا نشطًا.`}>سجل الإدخالات اليدوية</SectionTitle>
        {entries.length === 0 ? <EmptyNote>لا إدخالات بعد</EmptyNote> : (
          <div className="space-y-2">
            {entries.map((e) => (
              <FCard key={e.id} className="text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black">{PARTNER_LABEL_AR[e.source] ?? e.source} · <Tag tone={e.state === 'paid' || e.state === 'confirmed' ? 'good' : e.state === 'cancelled' ? 'bad' : e.state === 'declared' ? 'warn' : 'muted'}>{COMMISSION_STATE_AR[e.state]}</Tag></p>
                    <p className="mt-0.5 tabular-nums text-on-surface-variant dark:text-white/60">{e.commission_amount} {e.currency} = <b>{revenueSar(e) == null ? 'غير محوّل' : `${revenueSar(e)} ر.س`}</b> · {e.unit} {e.quantity ?? ''} · الفترة {e.period_start ?? '—'} → {e.period_end ?? '—'}{e.occurred_at ? ` · وقعت ${e.occurred_at}` : ''}{e.approved_at ? ` · اعتُمدت ${e.approved_at}` : ''}{e.paid_at ? ` · قُبضت ${e.paid_at}` : ''}</p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant dark:text-white/50">{e.partner_txn_id ? `عملية ${e.partner_txn_id} · ` : ''}{e.report_ref ? `تقرير ${e.report_ref} · ` : ''}{e.evidence_ref ? `مرجع ${e.evidence_ref} · ` : ''}{e.evidence_path && <ViewEvidence path={e.evidence_path} />} نسخة {e.revision}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1"><EditToggle><RevenueForm initial={e} /></EditToggle><DeleteButton path={`/revenue/${e.id}`} /></div>
                </div>
              </FCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
