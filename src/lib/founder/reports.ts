// src/lib/founder/reports.ts — exportable reports built on the SAME overview composition.
//   founder  — activity, money, goals, gaps, decisions (everything)
//   store    — one retailer's share only: demand for its products, linked referrals, its partner
//              results; never other stores' internals, never browser ids
//   investor — qualified usage, commercial evidence, confirmed vs collected revenue, expenses,
//              hypotheses, what is proven / not proven
// Every report carries period, extraction time, sources, definition version and limitations.
import { buildOverview, type Overview } from './overview';
import { getRetailerReport, listRetailerOptions } from '@/lib/admin/retailer-report-queries';
import { PARTNER_LABEL_AR, DEFINITION_VERSION, METRICS } from './registry';
import { COMMISSION_STATE_AR, type CommissionState } from './finance';
import { ratioText } from './metrics';
import { formatRiyadh, type MetricWindow } from './windows';

export type ReportKind = 'founder' | 'store' | 'investor';

export interface ReportSection { titleAr: string; rows: Array<{ labelAr: string; value: string; noteAr?: string }> }
export interface Report {
  kind: ReportKind; titleAr: string; audienceAr: string; window: { labelAr: string; start: string; end: string; partial: boolean };
  extractedAt: string; definitionVersion: string; sources: string[]; limitationsAr: string[]; sections: ReportSection[];
}

const LIMITS_COMMON = [
  'معرّف المتصفح (tw_sid) ليس شخصًا ولا زيارة بشرية مؤكدة.',
  'الخروج المرتبط يثبت ضغطة فعلية أعقبها طلب تحويل؛ لا يثبت تحميل صفحة التاجر ولا شراء.',
  'غياب تقرير الشريك يعني «غير معلوم» لا صفر.',
  'النسب ذات المقامات الصغيرة تُعرض بالعدد والمقام ولا تُقرأ كسببية.',
];

function journeySection(o: Overview): ReportSection {
  return {
    titleAr: 'رحلة القرار',
    rows: o.cards.map((c) => ({
      labelAr: METRICS[c.id].nameAr,
      value: c.numerator == null ? `غير متاح — ${c.reason ?? ''}` : c.denominator != null ? ratioText(c.numerator, c.denominator) : `${c.numerator}${c.unit === 'sar' ? ' ريال' : ''}`,
      noteAr: `${METRICS[c.id].provesAr} — لا يثبت ${METRICS[c.id].notProvesAr}`,
    })),
  };
}

function moneySection(o: Overview, forInvestor: boolean): ReportSection {
  const m = o.money;
  if (!m) return { titleAr: 'المال', rows: [{ labelAr: 'الحالة', value: `غير متاح — ${o.moneyReason ?? ''}` }] };
  const rows: ReportSection['rows'] = [
    { labelAr: 'تكلفة الفترة (F02)', value: `${m.periodCost.sar} ريال`, noteAr: m.periodCost.unconvertedRows ? `${m.periodCost.unconvertedRows} صفًا بلا تحويل موثق` : undefined },
    { labelAr: 'نقد مصروف في الفترة (F01)', value: `${m.cashSpent.sar} ريال` },
    { labelAr: 'مستحق غير مدفوع (F03)', value: `${m.dueUnpaid.sar} ريال` },
    { labelAr: 'إجمالي الصرف منذ البداية (F04)', value: `${m.totalSinceStart.sar} ريال`, noteAr: 'ما أُدخل فقط' },
    { labelAr: 'تغطية تقارير الشركاء (C01)', value: `${m.revenue.coverageCount}/2`, noteAr: m.revenue.coverage.map((c) => `${PARTNER_LABEL_AR[c.source] ?? c.source}: ${c.detailAr}`).join(' · ') },
  ];
  if (m.revenue.coverageState === 'coverage_missing') rows.push({ labelAr: 'العمولات المعتمدة / المقبوضة', value: 'غير معلوم', noteAr: 'لا تقرير شريك يغطي الفترة' });
  else {
    rows.push({ labelAr: 'عمولات معتمدة (S08)', value: `${m.revenue.confirmedSar} ريال` }, { labelAr: 'مقبوض نقدًا (S08P)', value: `${m.revenue.paidSar} ريال` }, { labelAr: 'معلق', value: `${m.revenue.pendingSar} ريال` }, { labelAr: 'مستحق القبض (F08)', value: `${m.revenue.receivableSar} ريال` });
    if (m.operatingResultSar != null) rows.push({ labelAr: 'النتيجة التشغيلية الإدارية (F06)', value: `${m.operatingResultSar} ريال`, noteAr: 'S08 − F02؛ سياسة إدارية لا محاسبية' });
    if (m.netCashSar != null) rows.push({ labelAr: 'صافي التدفق النقدي (F07)', value: `${m.netCashSar} ريال` });
  }
  if (!forInvestor || true) rows.push({ labelAr: 'تمويل المؤسس (F05)', value: `${m.funding.sar} ريال`, noteAr: 'ليس إيرادًا' });
  return { titleAr: 'المال', rows };
}

export async function buildFounderReport(w: MetricWindow): Promise<Report> {
  const o = await buildOverview(w);
  const sections: ReportSection[] = [
    { titleAr: 'الخلاصة', rows: [{ labelAr: 'النتيجة', value: o.headline.resultAr }, { labelAr: 'أكبر فجوة', value: o.headline.gapAr }, { labelAr: 'القرار التالي', value: o.headline.decisionAr }] },
    journeySection(o),
    moneySection(o, false),
    { titleAr: 'الأهداف', rows: o.goals.length ? o.goals.map((g) => ({ labelAr: g.nameAr, value: `${g.current ?? 'غير متاح'} / ${g.goal.target_value}`, noteAr: `${g.status} — ${g.statusReasonAr}` })) : [{ labelAr: 'لا أهداف للشهر', value: '—' }] },
    { titleAr: 'الاحتياجات', rows: o.needs.slice(0, 8).map((n) => ({ labelAr: n.labelAr, value: `${n.searchSessions} متصفح / ${n.searchEvents} حدث`, noteAr: n.bucketReasonAr })) },
    { titleAr: 'المتاجر', rows: o.referrals.stores.slice(0, 10).map((s) => ({ labelAr: s.nameAr, value: `${s.linkedInteractions} خروج مرتبط / ${s.recordedClicks} ضغطة مسجلة / ${s.rawRows} خام` })) },
    { titleAr: 'جودة البيانات', rows: o.quality.map((q) => ({ labelAr: q.severity, value: q.textAr })) },
  ];
  return {
    kind: 'founder', titleAr: 'تقرير المؤسس', audienceAr: 'المؤسس', window: { labelAr: w.labelAr, start: w.start.toISOString(), end: w.end.toISOString(), partial: w.partial },
    extractedAt: o.generatedAt, definitionVersion: DEFINITION_VERSION,
    sources: ['usage_events', 'first_party_interactions', 'outbound_clicks', 'founder_expenses', 'founder_revenue_entries', 'affiliate_reports', 'affiliate_conversions', 'founder_goals', 'tps_product_projection'],
    limitationsAr: LIMITS_COMMON, sections,
  };
}

export async function buildInvestorReport(w: MetricWindow): Promise<Report> {
  const o = await buildOverview(w);
  const proven: string[] = [], notProven: string[] = [];
  const s05 = o.cards.find((c) => c.id === 'S05'), s01 = o.cards.find((c) => c.id === 'S01'), s02 = o.cards.find((c) => c.id === 'S02');
  if (s01?.numerator != null) proven.push(`${s01.numerator} متصفحًا أرسل بحثًا في الفترة، ${s02?.numerator ?? '؟'} تلقى نتيجة غير فارغة.`);
  if (s05?.numerator != null) proven.push(`${s05.numerator} خروجًا مرتبطًا مثبتًا بضغطة فعلية وطلب تحويل.`);
  notProven.push('عدد الأشخاص خلف المعرّفات وبشريتهم وإقامتهم.', 'وصول المستخدم إلى المتجر أو إتمام شراء.');
  if (o.money?.revenue.coverageState === 'coverage_missing') notProven.push('أي طلب أو عمولة للفترة — لا تقرير شريك مستورد.');
  const sections: ReportSection[] = [
    { titleAr: 'الاستخدام المؤهل', rows: journeySection(o).rows.filter((r) => !r.labelAr.includes('عمولات') && !r.labelAr.includes('طلبات')) },
    { titleAr: 'الدليل التجاري', rows: [
      ...o.referrals.stores.slice(0, 5).map((s) => ({ labelAr: `خروج مرتبط إلى ${s.nameAr}`, value: String(s.linkedInteractions) })),
      ...o.needs.filter((n) => n.category !== 'unparsed').slice(0, 5).map((n) => ({ labelAr: `حاجة: ${n.labelAr}`, value: `${n.searchSessions} متصفح باحث`, noteAr: n.bucketReasonAr })),
    ] },
    moneySection(o, true),
    { titleAr: 'ما ثبت', rows: proven.map((p) => ({ labelAr: '✓', value: p })) },
    { titleAr: 'ما لم يثبت بعد', rows: notProven.map((p) => ({ labelAr: '—', value: p })) },
    { titleAr: 'الفرضيات قيد الاختبار', rows: [
      { labelAr: 'إغلاق حلقة الشريك', value: 'مطابقة صادرات أمازون ونون تنقل الطلبات والعمولات من مجهول إلى معلوم للفترات المغطاة.' },
      { labelAr: 'اختبار حاجة المكيف', value: 'اختيار واضح بموديل موثق وعرضين صالحين يحسّن إنجاز المهمة والخروج المرتبط؛ يُختبر مع 5 مشاركين قبل أي توسع.' },
    ] },
  ];
  return {
    kind: 'investor', titleAr: 'تقرير المستثمر', audienceAr: 'مستثمر محتمل', window: { labelAr: w.labelAr, start: w.start.toISOString(), end: w.end.toISOString(), partial: w.partial },
    extractedAt: o.generatedAt, definitionVersion: DEFINITION_VERSION,
    sources: ['usage_events', 'first_party_interactions ⋈ outbound_clicks', 'founder_expenses', 'founder_revenue_entries', 'affiliate_*'],
    limitationsAr: [...LIMITS_COMMON, 'هذا سجل إدارة للمؤسس، لا قوائم مالية معتمدة.'], sections,
  };
}

export async function buildStoreReport(w: MetricWindow, storeSlug: string): Promise<Report> {
  const option = listRetailerOptions().find((r) => r.slug === storeSlug);
  if (!option) throw new Error('unknown store');
  const start = w.start.toISOString().slice(0, 10), end = new Date(w.end.getTime() - 1).toISOString().slice(0, 10);
  const [retailer, o] = await Promise.all([getRetailerReport(option.storeId, 'custom', start, end), buildOverview(w, { includeMoney: true })]);
  const mine = o.referrals.stores.find((s) => s.slug === storeSlug);
  const products = o.products.filter((p) => p.stores.includes(option.displayNameAr) || p.stores.includes(option.displayName));
  const partner = o.money && (storeSlug === 'amazon' || storeSlug === 'noon') ? o.money.revenue : null;
  const partnerRows: ReportSection['rows'] = partner
    ? (Object.entries(partner.byState) as Array<[CommissionState, { sar: number; rows: number }]>).filter(([, v]) => v.rows > 0).map(([k, v]) => ({ labelAr: COMMISSION_STATE_AR[k], value: `${v.rows} صف / ${v.sar} ريال` }))
    : [{ labelAr: 'نتائج الشريك', value: 'غير متاح — لا برنامج شريك لهذا المتجر أو لا تقرير مستورد' }];
  const sections: ReportSection[] = [
    { titleAr: 'الإحالات المرتبطة إلى المتجر', rows: [
      { labelAr: 'ضغطات خروج مسجلة (واجهتنا)', value: String(mine?.recordedClicks ?? 0) },
      { labelAr: 'خروج مرتبط مثبت (ضغطة + تحويل)', value: String(mine?.linkedInteractions ?? 0), noteAr: `${mine?.linkedBrowsers ?? 0} متصفحًا` },
      { labelAr: 'طلبات /go خام (بما فيها الآلية)', value: String(mine?.rawRows ?? 0), noteAr: 'تشغيلي فقط' },
      { labelAr: 'جلسات مؤهلة (تقرير المتجر القائم)', value: String(retailer.qualifiedSessions) },
      { labelAr: 'وصول التاجر', value: 'غير متاح من /go — يحتاج بيانات المتجر' },
    ] },
    { titleAr: 'المنتجات المطلوبة عبر المتجر', rows: (products.length ? products : []).slice(0, 10).map((p) => ({ labelAr: p.nameAr, value: `${p.sessions} متصفح / ${p.interactions} خروج مرتبط`, noteAr: p.blockerAr ?? undefined })) },
    { titleAr: 'الفئات', rows: retailer.topCategories.slice(0, 8).map((c) => ({ labelAr: c.category, value: String(c.count) })) },
    { titleAr: 'نتائج الشريك للفترة', rows: partnerRows.length ? partnerRows : [{ labelAr: 'لا صفوف', value: partner ? 'غير معلوم للفترة' : '—' }] },
  ];
  return {
    kind: 'store', titleAr: `تقرير متجر ${option.displayNameAr}`, audienceAr: `متجر ${option.displayNameAr}`,
    window: { labelAr: w.labelAr, start: w.start.toISOString(), end: w.end.toISOString(), partial: w.partial },
    extractedAt: o.generatedAt, definitionVersion: DEFINITION_VERSION, sources: ['first_party_interactions ⋈ outbound_clicks', 'usage_events', 'affiliate_*'],
    limitationsAr: [...LIMITS_COMMON, 'لا يتضمن بيانات أفراد ولا أرقام متاجر أخرى.', ...retailer.limitations], sections,
  };
}

export function reportToCsv(r: Report): string {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [['section', 'label', 'value', 'note'].join(',')];
  lines.push(['meta', 'title', r.titleAr, ''].map(esc).join(','));
  lines.push(['meta', 'window', `${r.window.start} → ${r.window.end}${r.window.partial ? ' (partial)' : ''}`, r.window.labelAr].map(esc).join(','));
  lines.push(['meta', 'extracted_at', r.extractedAt, formatRiyadh(r.extractedAt)].map(esc).join(','));
  lines.push(['meta', 'definition_version', r.definitionVersion, ''].map(esc).join(','));
  for (const s of r.sections) for (const row of s.rows) lines.push([s.titleAr, row.labelAr, row.value, row.noteAr ?? ''].map(esc).join(','));
  for (const l of r.limitationsAr) lines.push(['limitations', '', l, ''].map(esc).join(','));
  return '﻿' + lines.join('\n');
}
