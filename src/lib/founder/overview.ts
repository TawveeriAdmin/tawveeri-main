// src/lib/founder/overview.ts — composes ONE decision picture for a window: journey pack (+ equal
// previous window), money, partner coverage, goals, top needs/products, data quality. Every page,
// the daily summary and every export read from this composition — no second computation path.
import { fetchWindowWithPrevious, metricFromPack, measuredMetric, unavailableMetric, type MetricValue, type PackResult } from './metrics';
import {
  fetchExpenses, fetchRevenueEntries, fetchFunding, fetchBudgets, fetchAffiliateReports, fetchAffiliateConversions,
  cashSpent, periodCost, dueUnpaid, totalSinceStart, breakdownBy, upcomingCommitments, budgetStatus, revenueSummary, fundingTotal, round2,
  type ExpenseRow, type RevenueRow, type RevenueSummary, type SarTotal, type Breakdown, type UpcomingCommitment, type BudgetStatus,
} from './finance';
import { fetchGoals, fetchGoalRevisions, evaluateGoal, buildScenarios, type GoalView, type ScenariosView, type ScenarioInputs } from './goals';
import { getSetting } from './ledger';
import { fetchQueryDemand, buildQueryDemand, buildNeedDemand, fetchCatalogCapability, fetchProductDemand, type NeedDemand, type ProductDemand, type QueryDemand } from './demand';
import { fetchReferrals, type ReferralsData } from './referrals';
import { DEFINITION_VERSION } from './registry';
import { daysBetween, riyadhMonthStart, windowFor, monthWindow, type MetricWindow } from './windows';

export interface MoneyPicture {
  cashSpent: SarTotal; periodCost: SarTotal; dueUnpaid: SarTotal; totalSinceStart: SarTotal;
  byCategory: Breakdown[]; byVendor: Breakdown[]; byCampaign: Breakdown[]; byKind: Breakdown[];
  upcoming: UpcomingCommitment[]; budgets: BudgetStatus[];
  revenue: RevenueSummary; funding: { sar: number; unconvertedRows: number };
  operatingResultSar: number | null; netCashSar: number | null; founderNetCashUsedSar: number | null;
  expenseRows: number; revenueRows: number;
}

export interface DataQualityItem { severity: 'info' | 'warn' | 'critical'; textAr: string }

export interface Overview {
  window: MetricWindow; previousWindow: MetricWindow; generatedAt: string; definitionVersion: string;
  pack: PackResult; prevPack: PackResult;
  cards: MetricValue[]; prevCards: MetricValue[];
  money: MoneyPicture | null; moneyReason: string | null;
  goals: GoalView[]; scenarios: ScenariosView | null;
  needs: NeedDemand[]; queries: QueryDemand[]; products: ProductDemand[]; demandReason: string | null;
  referrals: ReferralsData;
  quality: DataQualityItem[];
  headline: { resultAr: string; gapAr: string; decisionAr: string };
}

export const CARD_ORDER = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08'] as const;

export async function buildMoneyPicture(w: MetricWindow, now = new Date()): Promise<MoneyPicture> {
  const [expenses, revenue, funding, budgets, reports, conversions] = await Promise.all([
    fetchExpenses(), fetchRevenueEntries(), fetchFunding(), fetchBudgets(), fetchAffiliateReports(), fetchAffiliateConversions(),
  ]);
  return composeMoney(expenses, revenue, funding, budgets, revenueSummary(revenue, conversions, reports, w), w, now);
}

export function composeMoney(expenses: ExpenseRow[], revenueRows: RevenueRow[], funding: Parameters<typeof fundingTotal>[0], budgets: Parameters<typeof budgetStatus>[0], revenue: RevenueSummary, w: MetricWindow, now = new Date()): MoneyPicture {
  const cash = cashSpent(expenses, w);
  const period = periodCost(expenses, w);
  const monthW = monthWindow(riyadhMonthStart(now));
  const monthFraction = daysBetween(monthW.start, now) / Math.max(1, daysBetween(monthW.start, monthW.end));
  const byCategory = breakdownBy(expenses, w, 'category');
  const fund = fundingTotal(funding);
  const total = totalSinceStart(expenses);
  const paidAllTime = revenueRows.filter((r) => r.state === 'paid').reduce((s, r) => s + (r.amount_sar ?? ((r.currency || 'SAR').toUpperCase() === 'SAR' ? r.commission_amount : 0)), 0);
  const coverageOk = revenue.coverageState !== 'coverage_missing';
  return {
    cashSpent: cash, periodCost: period, dueUnpaid: dueUnpaid(expenses, w.end), totalSinceStart: total,
    byCategory, byVendor: breakdownBy(expenses, w, 'vendor'), byCampaign: breakdownBy(expenses, w, 'campaign'), byKind: breakdownBy(expenses, w, 'cost_kind'),
    upcoming: upcomingCommitments(expenses, now), budgets: budgetStatus(budgets, breakdownBy(expenses, monthW, 'category'), monthFraction),
    revenue, funding: fund,
    operatingResultSar: coverageOk ? round2(revenue.confirmedSar - period.sar) : null,
    netCashSar: coverageOk ? round2(revenue.paidSar - cash.sar) : null,
    founderNetCashUsedSar: expenses.length ? round2(total.sar - paidAllTime) : null,
    expenseRows: expenses.length, revenueRows: revenueRows.length,
  };
}

function headlineFor(cards: MetricValue[], prev: MetricValue[], money: MoneyPicture | null, goals: GoalView[], needs: NeedDemand[], w: MetricWindow): Overview['headline'] {
  const get = (id: string, list: MetricValue[]) => list.find((c) => c.id === id)?.numerator ?? null;
  const s01 = get('S01', cards), s02 = get('S02', cards), s05 = get('S05', cards), s06 = get('S06', cards);
  const parts: string[] = [];
  if (s01 != null && s02 != null) parts.push(`${s01} متصفحًا بحث، ${s02} تلقى نتيجة`);
  if (s05 != null) parts.push(`${s05} خروجًا مرتبطًا مسجلًا${s06 != null ? ` منها ${s06} تبع بحثًا خلال 30 دقيقة` : ''}`);
  if (money) {
    parts.push(money.revenue.coverageState === 'coverage_missing' ? 'الطلبات والعمولات غير معلومة (لا تغطية شريك)' : `عمولات معتمدة ${money.revenue.confirmedSar} ريال، مقبوض ${money.revenue.paidSar} ريال`);
    if (money.expenseRows > 0) parts.push(`تكلفة الفترة ${money.periodCost.sar} ريال`);
  }
  const resultAr = parts.length ? `${w.labelAr}: ${parts.join('؛ ')}.` : `${w.labelAr}: القياس غير متاح.`;
  let gapAr = 'لا فجوة قياس مسجلة.';
  if (money?.revenue.coverageState === 'coverage_missing') gapAr = 'أكبر فجوة: لا تقرير شريك يغطي الفترة — لا يمكن الحكم على الربحية.';
  else if (money && money.expenseRows === 0) gapAr = 'أكبر فجوة: سجل المصروفات فارغ — التكلفة والتعادل غير محسوبين.';
  else {
    const behind = goals.filter((g) => g.status === 'behind');
    if (behind.length) gapAr = `أكبر فجوة: هدف «${behind[0].nameAr}» متأخر (${behind[0].statusReasonAr}).`;
    else if (needs[0] && needs[0].bucket === 'demand_needs_coverage_or_identity') gapAr = `أكبر فجوة: أعلى حاجة (${needs[0].labelAr}) بلا مقارنة حديثة كافية.`;
  }
  let decisionAr = 'القرار التالي: استورد تقارير أمازون ونون للفترة، ثم راجع أعلى 3 مجموعات مكيفات قبل أي توسع تسويقي.';
  if (money && money.revenue.coverageState !== 'coverage_missing' && needs[0]) decisionAr = `القرار التالي: اختبار حاجة «${needs[0].labelAr}» مع 5 مشترين محتملين قبل زيادة الإنفاق؛ لا تغيير في الترتيب.`;
  return { resultAr, gapAr, decisionAr };
}

export async function buildOverview(w: MetricWindow, opts: { includeDemand?: boolean; includeMoney?: boolean; includeReferrals?: boolean; now?: Date } = {}): Promise<Overview> {
  const now = opts.now ?? new Date();
  const { current, previous, previousWindow } = await fetchWindowWithPrevious(w);
  const cards = CARD_ORDER.map((id) => (id === 'S07' || id === 'S08' ? unavailableMetric(id, w, 'يُحسب من سجل الإيرادات', 'coverage_missing') : metricFromPack(id, current, w)));
  const prevCards = CARD_ORDER.map((id) => (id === 'S07' || id === 'S08' ? unavailableMetric(id, previousWindow, 'يُحسب من سجل الإيرادات', 'coverage_missing') : metricFromPack(id, previous, previousWindow)));

  let money: MoneyPicture | null = null; let moneyReason: string | null = null;
  if (opts.includeMoney !== false) {
    try { money = await buildMoneyPicture(w, now); } catch (e) { moneyReason = e instanceof Error ? e.message : 'unknown'; }
  }
  if (money) {
    const cov = money.revenue.coverageState;
    const idx7 = CARD_ORDER.indexOf('S07'), idx8 = CARD_ORDER.indexOf('S08');
    cards[idx7] = cov === 'coverage_missing' ? unavailableMetric('S07', w, 'لا تقرير شريك مستورد ولا إدخال موثق يغطي الفترة', 'coverage_missing')
      : measuredMetric('S07', w, money.revenue.orders + money.revenue.items + money.revenue.aggregates, null, cov === 'complete' ? (w.partial ? 'partial' : 'complete') : 'partial');
    cards[idx8] = cov === 'coverage_missing' ? unavailableMetric('S08', w, 'لا قيمة مالية موثقة للفترة', 'coverage_missing')
      : measuredMetric('S08', w, money.revenue.confirmedSar, null, cov === 'complete' ? (w.partial ? 'partial' : 'complete') : 'partial');
  }

  // Goals: current month only, evaluated month-to-date.
  const monthStart = riyadhMonthStart(now);
  const mtd = windowFor('month', now);
  const mtdPack = w.kind === 'month' ? current : (await fetchWindowWithPrevious(mtd)).current;
  const goalRows = await fetchGoals(monthStart).catch(() => []);
  const revisions = await fetchGoalRevisions(goalRows.map((g) => g.id)).catch(() => new Map());
  const goals: GoalView[] = goalRows.map((g) => {
    const idIsMoney = g.metric_id.startsWith('S07') || g.metric_id.startsWith('S08') || g.metric_id.startsWith('F');
    if (idIsMoney) {
      const val = g.metric_id === 'S08' ? money?.revenue.confirmedSar ?? null : g.metric_id === 'S07' ? (money ? money.revenue.orders + money.revenue.items + money.revenue.aggregates : null) : g.metric_id === 'F02' ? money?.periodCost.sar ?? null : g.metric_id === 'F01' ? money?.cashSpent.sar ?? null : null;
      const ok = !!money && money.revenue.coverageState !== 'coverage_missing';
      return evaluateGoal(g, val, ok || g.metric_id.startsWith('F'), ok || g.metric_id.startsWith('F') ? null : 'لا تغطية شريك للشهر', now, DEFINITION_VERSION, revisions.get(g.id) ?? []);
    }
    const m = metricFromPack(g.metric_id, mtdPack, mtd);
    return evaluateGoal(g, m.numerator, m.coverage !== 'unavailable', m.reason ?? null, now, DEFINITION_VERSION, revisions.get(g.id) ?? []);
  });

  let scenarios: ScenariosView | null = null;
  try {
    const inputs = (await getSetting<ScenarioInputs>('scenario_inputs')) ?? {};
    const last30 = windowFor('30d', now);
    const p30 = w.kind === '30d' ? current : (await fetchWindowWithPrevious(last30)).current;
    const expenses = money ? await fetchExpenses() : [];
    scenarios = buildScenarios(inputs, {
      linkedExits30d: p30.ok ? p30.pack.linked_interactions : null,
      periodCostLast30dSar: money && expenses.length ? periodCost(expenses, last30).sar : null,
      founderNetCashUsedSar: money?.founderNetCashUsedSar ?? null,
    });
  } catch { scenarios = null; }

  let needs: NeedDemand[] = [], queries: QueryDemand[] = [], products: ProductDemand[] = []; let demandReason: string | null = null;
  if (opts.includeDemand !== false) {
    const qd = await fetchQueryDemand(w);
    if (qd.ok) {
      queries = buildQueryDemand(qd.rows);
      const catalog = await fetchCatalogCapability().catch(() => new Map());
      needs = buildNeedDemand(qd.rows, catalog);
    } else demandReason = qd.reason;
    const pd = await fetchProductDemand(w);
    if (pd.ok) products = pd.products; else demandReason = demandReason ?? pd.reason;
  }

  const referrals = opts.includeReferrals === false ? { ok: false, stores: [], byChannel: [], totals: { rawRows: 0, rowsWithSession: 0, linkedInteractions: 0, recordedClicks: 0 } } : await fetchReferrals(w);

  const quality: DataQualityItem[] = [];
  if (!current.ok) quality.push({ severity: 'critical', textAr: `تعذر حساب حزمة المؤشرات: ${current.reason}` });
  else {
    const p = current.pack;
    const lastEvent = p.last_usage_event_at ? Date.now() - new Date(p.last_usage_event_at).getTime() : null;
    if (lastEvent != null && lastEvent > 6 * 3600_000 && w.partial) quality.push({ severity: 'warn', textAr: `آخر حدث استخدام قبل ${Math.round(lastEvent / 3600_000)} ساعة — تحقق من التتبع` });
    if (p.raw_outbound_rows > 0) quality.push({ severity: 'info', textAr: `${p.raw_outbound_without_session} من ${p.raw_outbound_rows} طلب /go خام بلا معرّف متصفح (${((p.raw_outbound_without_session / p.raw_outbound_rows) * 100).toFixed(1)}%) — تبقى خارج كل رقم تجاري` });
    if (p.explicit_interactions > p.linked_interactions) quality.push({ severity: 'info', textAr: `${p.explicit_interactions - p.linked_interactions} تفاعلًا صريحًا بلا صف /go مطابق داخل النافذة — لا يُحذف ولا يُرقّى` });
    if (p.test_browsers + p.admin_browsers > 0) quality.push({ severity: 'info', textAr: `مستبعد من كل الأرقام: ${p.test_browsers} متصفح اختبار، ${p.admin_browsers} متصفح إدارة، ${p.bot_ua_events_excluded} حدث بوسم زاحف معروف` });
    if (p.search_sessions > 0 && p.search_events / p.search_sessions > 4) quality.push({ severity: 'warn', textAr: `تركّز عالٍ: ${p.search_events} حدث بحث من ${p.search_sessions} متصفح — لا يُقرأ كعدد باحثين` });
    if (p.comparison_auto_events > 0) quality.push({ severity: 'info', textAr: `${p.comparison_auto_events} عرض مقارنة تلقائي (فتح صفحة) لا يُعد قرار مقارنة؛ الضغطات الفعلية ${p.comparison_click_events}` });
  }
  if (money) {
    if (money.revenue.coverageState === 'coverage_missing') quality.push({ severity: 'critical', textAr: 'تغطية تقارير الشركاء 0/2 — الطلبات والعمولات غير معلومة، ليست صفرًا' });
    else if (money.revenue.coverageState === 'partial') quality.push({ severity: 'warn', textAr: `تغطية تقارير الشركاء ${money.revenue.coverageCount}/2` });
    const unconverted = money.cashSpent.unconvertedRows + money.periodCost.unconvertedRows;
    if (unconverted) quality.push({ severity: 'warn', textAr: `${unconverted} مصروفًا بعملة أجنبية بلا تحويل موثق — خارج المجاميع بالريال` });
    if (money.expenseRows === 0) quality.push({ severity: 'warn', textAr: 'سجل المصروفات فارغ — أضف المصروفات التاريخية أو استوردها' });
  } else if (moneyReason) quality.push({ severity: 'critical', textAr: `تعذر قراءة السجل المالي: ${moneyReason}` });
  if (!referrals.ok && referrals.reason) quality.push({ severity: 'warn', textAr: `تعذر قراءة الإحالات: ${referrals.reason}` });
  if (demandReason) quality.push({ severity: 'warn', textAr: `تعذر قراءة الطلب: ${demandReason}` });

  return {
    window: w, previousWindow, generatedAt: new Date().toISOString(), definitionVersion: DEFINITION_VERSION,
    pack: current, prevPack: previous, cards, prevCards, money, moneyReason, goals, scenarios, needs, queries, products, demandReason, referrals, quality,
    headline: headlineFor(cards, prevCards, money, goals, needs, w),
  };
}
