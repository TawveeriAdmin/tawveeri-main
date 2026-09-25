// src/lib/founder/goals.ts — monthly goals with honest status, plus profitability scenarios
// that refuse to forecast from inputs the founder has not provided.
import { createServerClient } from '@/lib/database';
import { METRICS } from './registry';
import { round2 } from './finance';
import { daysBetween, monthWindow, type MetricWindow } from './windows';

type AnyClient = { from: (table: string) => any };

export interface GoalRow {
  id: string; month: string; metric_id: string; definition_version: string; baseline_value: number | null;
  baseline_window_start: string | null; baseline_window_end: string | null; target_value: number; direction: 'gte' | 'lte';
  rationale: string | null; owner: string | null; proposed_action: string | null; created_at: string; updated_at: string; archived_at: string | null;
}
export interface GoalRevisionRow { id: number; goal_id: string; before: Record<string, unknown> | null; after: Record<string, unknown>; reason: string | null; created_at: string }

export type GoalStatus = 'achieved' | 'on_track' | 'behind' | 'not_judgeable';
export const GOAL_STATUS_AR: Record<GoalStatus, string> = { achieved: 'متحقق', on_track: 'على المسار', behind: 'متأخر', not_judgeable: 'غير قابل للحكم' };

export interface GoalView {
  goal: GoalRow; nameAr: string; unit: string;
  current: number | null; coverageOk: boolean; currentReasonAr: string | null;
  progressPct: number | null; expectedPacePct: number | null; daysLeft: number; status: GoalStatus; statusReasonAr: string;
  definitionChanged: boolean; revisions: GoalRevisionRow[];
}

export async function fetchGoals(month: Date): Promise<GoalRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const m = new Date(month.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
  const { data } = await supabase.from('founder_goals').select('*').eq('month', m).is('archived_at', null).order('created_at', { ascending: true });
  return ((data ?? []) as GoalRow[]).map((g) => ({ ...g, target_value: Number(g.target_value), baseline_value: g.baseline_value == null ? null : Number(g.baseline_value) }));
}

export async function fetchGoalRevisions(goalIds: string[]): Promise<Map<string, GoalRevisionRow[]>> {
  const out = new Map<string, GoalRevisionRow[]>();
  if (goalIds.length === 0) return out;
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_goal_revisions').select('*').in('goal_id', goalIds).order('id', { ascending: true });
  for (const r of (data ?? []) as GoalRevisionRow[]) out.set(r.goal_id, [...(out.get(r.goal_id) ?? []), r]);
  return out;
}

/** current: metric value month-to-date; coverageOk false ⇒ not_judgeable regardless of the number. */
export function evaluateGoal(goal: GoalRow, current: number | null, coverageOk: boolean, currentReasonAr: string | null, now: Date, currentVersion: string, revisions: GoalRevisionRow[] = []): GoalView {
  const def = METRICS[goal.metric_id];
  const win: MetricWindow = monthWindow(new Date(`${goal.month}T00:00:00+03:00`));
  const total = daysBetween(win.start, win.end);
  const elapsed = Math.min(total, Math.max(0, daysBetween(win.start, now)));
  const daysLeft = Math.max(0, Math.ceil(total - elapsed));
  const definitionChanged = goal.definition_version !== currentVersion;
  const base = { goal, nameAr: def?.nameAr ?? goal.metric_id, unit: def?.unit ?? '', current, coverageOk, currentReasonAr, daysLeft, definitionChanged, revisions };
  if (current == null || !coverageOk) {
    return { ...base, progressPct: null, expectedPacePct: null, status: 'not_judgeable', statusReasonAr: currentReasonAr ?? 'القيمة الحالية غير متاحة أو التغطية ناقصة' };
  }
  if (definitionChanged) {
    return { ...base, progressPct: null, expectedPacePct: null, status: 'not_judgeable', statusReasonAr: `تعريف المؤشر تغير (${goal.definition_version} → ${currentVersion}) — لا يقارن الهدف بقيمة من تعريف آخر` };
  }
  const gte = goal.direction === 'gte';
  const target = goal.target_value;
  const progressPct = target !== 0 ? (current / target) * 100 : null;
  const paceFraction = total > 0 ? elapsed / total : 1;
  const expectedPacePct = paceFraction * 100;
  if (gte ? current >= target : current <= target) return { ...base, progressPct, expectedPacePct, status: 'achieved', statusReasonAr: `${current} مقابل هدف ${target}` };
  if (!gte) return { ...base, progressPct, expectedPacePct, status: elapsed >= total ? 'behind' : 'on_track', statusReasonAr: `${current} والهدف ألا يتجاوز ${target}` };
  const expected = target * paceFraction;
  const onTrack = current >= expected * 0.9;
  return {
    ...base, progressPct, expectedPacePct,
    status: elapsed >= total ? 'behind' : onTrack ? 'on_track' : 'behind',
    statusReasonAr: `${current} من ${target} (${progressPct?.toFixed(0)}%)، والوتيرة المتوقعة حتى اليوم ${expected.toFixed(1)}؛ ${daysLeft} يومًا متبقيًا`,
  };
}

// ── Scenarios ───────────────────────────────────────────────────────────────

export interface ScenarioInputs {
  commission_per_linked_exit_sar?: { value: number; source: 'measured' | 'assumption'; note?: string } | null;
  monthly_operating_cost_sar?: { value: number; source: 'measured' | 'assumption'; note?: string } | null;
  linked_exits_monthly?: { value: number; source: 'measured' | 'assumption'; note?: string } | null;
  growth_conservative?: number; growth_base?: number; growth_optimistic?: number;
  acquisition_cost_per_linked_exit_sar?: { value: number; source: 'measured' | 'assumption'; note?: string } | null;
}

export interface ScenarioResult {
  name: 'conservative' | 'base' | 'optimistic'; labelAr: string; growthMonthly: number;
  monthsToOperatingBreakeven: number | null; monthsToPayback: number | null; monthlyCommissionAtMonth12: number | null;
}

export interface ScenariosView {
  ready: boolean; missingInputsAr: string[]; assumptionsAr: string[]; results: ScenarioResult[];
  breakevenMonthlyExitsNeeded: number | null; founderNetCashUsedSar: number | null;
}

export function buildScenarios(inputs: ScenarioInputs, measured: { linkedExits30d: number | null; periodCostLast30dSar: number | null; founderNetCashUsedSar: number | null }): ScenariosView {
  const missing: string[] = [];
  const assumptions: string[] = [];
  const commission = inputs.commission_per_linked_exit_sar?.value ?? null;
  if (commission == null) missing.push('العمولة المعتمدة لكل خروج مرتبط (ريال) — تُقاس من تقارير الشريك مقسومة على الخروج المرتبط في الفترة نفسها');
  else assumptions.push(`عمولة لكل خروج مرتبط ${commission} ريال (${inputs.commission_per_linked_exit_sar?.source === 'measured' ? 'مقاسة' : 'افتراض'})`);
  const cost = inputs.monthly_operating_cost_sar?.value ?? measured.periodCostLast30dSar ?? null;
  if (cost == null) missing.push('تكلفة التشغيل الشهرية (ريال) — تُشتق من سجل المصروفات بعد إدخاله');
  else assumptions.push(`تكلفة تشغيل شهرية ${cost} ريال (${inputs.monthly_operating_cost_sar ? (inputs.monthly_operating_cost_sar.source === 'measured' ? 'مقاسة' : 'افتراض') : 'من مصروفات آخر 30 يومًا'})`);
  const exits = inputs.linked_exits_monthly?.value ?? measured.linkedExits30d ?? null;
  if (exits == null) missing.push('الخروج المرتبط شهريًا');
  else assumptions.push(`خروج مرتبط شهري ${exits} (${inputs.linked_exits_monthly ? (inputs.linked_exits_monthly.source === 'measured' ? 'مقاس' : 'افتراض') : 'مقاس من آخر 30 يومًا'})`);
  const growth = { conservative: inputs.growth_conservative ?? 0, base: inputs.growth_base ?? 0.1, optimistic: inputs.growth_optimistic ?? 0.25 };
  assumptions.push(`نمو شهري مفترض للخروج المرتبط: محافظ ${(growth.conservative * 100).toFixed(0)}%، أساسي ${(growth.base * 100).toFixed(0)}%، متفائل ${(growth.optimistic * 100).toFixed(0)}%`);
  const breakevenMonthlyExitsNeeded = commission != null && commission > 0 && cost != null ? Math.ceil(cost / commission) : null;
  if (missing.length) return { ready: false, missingInputsAr: missing, assumptionsAr: assumptions, results: [], breakevenMonthlyExitsNeeded, founderNetCashUsedSar: measured.founderNetCashUsedSar };
  const results = (['conservative', 'base', 'optimistic'] as const).map((name) => {
    const g = growth[name];
    let e = exits as number; let cumulative = 0; let breakeven: number | null = null; let payback: number | null = null; let m12 = 0;
    for (let m = 1; m <= 36; m++) {
      const commissionMonth = e * (commission as number);
      const net = commissionMonth - (cost as number);
      cumulative += net;
      if (breakeven == null && net >= 0) breakeven = m;
      if (payback == null && measured.founderNetCashUsedSar != null && cumulative >= measured.founderNetCashUsedSar) payback = m;
      if (m === 12) m12 = round2(commissionMonth);
      e = e * (1 + g);
    }
    return { name, labelAr: name === 'conservative' ? 'محافظ' : name === 'base' ? 'أساسي' : 'متفائل', growthMonthly: g, monthsToOperatingBreakeven: breakeven, monthsToPayback: payback, monthlyCommissionAtMonth12: m12 };
  });
  return { ready: true, missingInputsAr: [], assumptionsAr: assumptions, results, breakevenMonthlyExitsNeeded, founderNetCashUsedSar: measured.founderNetCashUsedSar };
}
