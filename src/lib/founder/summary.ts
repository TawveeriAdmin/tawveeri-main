// src/lib/founder/summary.ts — the Arabic daily/monthly summary. Numbers come ONLY from the
// overview composition (register-bound facts with metric_id + window). The optional AI layer
// (Anthropic Messages API, same containment as founder-intelligence.ts) may add possible
// explanations, unknowns and ONE proposed experiment — and is REJECTED wholesale if it emits a
// number that is not in the fact pack, cites a metric id that does not exist, returns partial
// JSON, or times out. The deterministic summary always stands on its own.
import { createServerClient } from '@/lib/database';
import { METRICS, DEFINITION_VERSION } from './registry';
import { deltaText, ratioText, type MetricValue } from './metrics';
import { buildOverview, type Overview } from './overview';
import { formatRiyadh, previousEqualWindow, riyadhMidnightDaysAgo, windowFor, monthWindow, riyadhMonthStart, type MetricWindow } from './windows';

type AnyClient = { from: (table: string) => any };

export interface SummaryFact { metricId: string; windowLabelAr: string; numerator: number | null; denominator: number | null; previous: number | null; textAr: string; coverage: string }

export interface DeterministicSummary {
  titleAr: string; windowLabelAr: string; partial: boolean; cutoffAr: string;
  whatHappenedAr: string[]; changedAr: string[]; topNeedsAr: string[]; servingWellAr: string[]; blockersAr: string[]; moneyAr: string[]; decisionsAr: string[]; unknownsAr: string[];
  facts: SummaryFact[]; allowedNumbers: number[];
}

export interface AiExplanation { possible_explanations: string[]; unknowns: string[]; one_experiment: { title_ar: string; proposed_target: string; measure_ar: string } | null; facts_used: string[] }

export interface SummaryRecord {
  id?: string; kind: 'daily' | 'monthly' | 'on_demand'; periodStart: string; periodEnd: string; partial: boolean;
  deterministic: DeterministicSummary; ai: AiExplanation | null; aiStatus: 'ok' | 'unavailable' | 'rejected' | 'disabled'; aiReason: string | null; generatedAt: string; definitionVersion: string;
}

const fmt = (n: number | null) => (n == null ? 'غير متاح' : Number.isInteger(n) ? String(n) : n.toFixed(1));

export function buildDeterministicSummary(o: Overview, kind: SummaryRecord['kind']): DeterministicSummary {
  const w = o.window;
  const facts: SummaryFact[] = [];
  const allowed = new Set<number>();
  const push = (m: MetricValue, prev: MetricValue | undefined, textAr: string) => {
    const f: SummaryFact = { metricId: m.id, windowLabelAr: w.labelAr, numerator: m.numerator, denominator: m.denominator, previous: prev?.numerator ?? null, textAr, coverage: m.coverage };
    facts.push(f);
    for (const v of [m.numerator, m.denominator, prev?.numerator ?? null, prev?.denominator ?? null]) if (v != null) allowed.add(v);
  };
  const card = (id: string) => o.cards.find((c) => c.id === id) as MetricValue;
  const prevCard = (id: string) => o.prevCards.find((c) => c.id === id);

  const whatHappened: string[] = [];
  const changed: string[] = [];
  for (const id of ['S01', 'S02', 'S04', 'S05', 'S06'] as const) {
    const m = card(id), p = prevCard(id), def = METRICS[id];
    if (m.numerator == null) { push(m, p, `${def.nameAr}: غير متاح (${m.reason ?? 'بلا سبب'})`); continue; }
    const value = m.denominator != null ? ratioText(m.numerator, m.denominator) : String(m.numerator);
    push(m, p, `${def.nameAr}: ${value} [${id}]`);
    whatHappened.push(`${def.nameAr}: ${value}. يثبت ${def.provesAr} ولا يثبت ${def.notProvesAr}`);
    const d = deltaText(m.numerator, p?.numerator ?? null);
    if (d) {
      const pctNow = m.denominator ? (m.numerator / m.denominator) * 100 : null;
      const pctPrev = p?.denominator ? ((p.numerator ?? 0) / p.denominator) * 100 : null;
      if (pctNow != null) allowed.add(Number(pctNow.toFixed(1)));
      if (pctPrev != null) allowed.add(Number(pctPrev.toFixed(1)));
      allowed.add(Math.abs(d.absolute));
      changed.push(`${def.shortAr}: ${fmt(m.numerator)} مقابل ${fmt(d.previous)} في ${o.previousWindow.labelAr} (${d.absolute >= 0 ? '+' : '−'}${Math.abs(d.absolute)}${d.previous > 0 ? `، ${d.pctText}` : ''})${pctNow != null && pctPrev != null ? `؛ النسبة ${pctNow.toFixed(1)}% مقابل ${pctPrev.toFixed(1)}%` : ''}. المقامات صغيرة؛ لا تُقرأ كسببية.`);
    }
  }
  const s03 = card('S03');
  if (s03.numerator != null) { push(s03, prevCard('S03'), `ضغطات مقارنة: ${s03.numerator} متصفح [S03]`); whatHappened.push(`ضغط رابط المقارنة: ${s03.numerator} متصفحًا (سطح بطاقة الاختيار الذكي فقط).`); }

  const topNeeds = o.needs.filter((n) => n.category !== 'unparsed').slice(0, 5).map((n) => {
    allowed.add(n.searchSessions); allowed.add(n.searchEvents); allowed.add(n.linkedSessions); allowed.add(n.positiveSessions);
    return `${n.labelAr}: ${n.searchSessions} متصفح بحث (${n.searchEvents} حدثًا)، ${n.positiveSessions} تلقى نتيجة، ${n.linkedSessions} خرج مرتبطًا خلال 30 دقيقة — ${n.bucketReasonAr}`;
  });
  const servingWell: string[] = [];
  const blockers: string[] = [];
  for (const p of o.products.slice(0, 5)) {
    allowed.add(p.sessions); allowed.add(p.interactions);
    if (p.blockerAr) blockers.push(`${p.nameAr}: ${p.sessions} متصفح / ${p.interactions} تفاعل — ${p.blockerAr}`);
    else servingWell.push(`${p.nameAr}: ${p.sessions} متصفح خرج مرتبطًا، مقارنة حديثة من ${p.projection?.storeCount ?? '؟'} متاجر`);
  }
  const s02 = card('S02');
  if (s02.numerator != null && s02.denominator && s02.numerator / s02.denominator >= 0.8) servingWell.push(`البحث يعيد نتيجة غير فارغة لأغلب الباحثين (${ratioText(s02.numerator, s02.denominator)}) — لا يثبت ملاءمتها.`);
  for (const q of o.quality.filter((x) => x.severity !== 'info').slice(0, 4)) blockers.push(q.textAr);

  const money: string[] = [];
  const unknowns: string[] = ['عدد الأشخاص السعوديين خلف المعرّفات، ووصولهم إلى المتجر، وإتمامهم قرارًا صحيحًا — غير مقاس.'];
  if (o.money) {
    const m = o.money;
    for (const v of [m.cashSpent.sar, m.periodCost.sar, m.revenue.confirmedSar, m.revenue.paidSar, m.revenue.pendingSar, m.totalSinceStart.sar, m.dueUnpaid.sar, m.funding.sar]) allowed.add(v);
    if (m.expenseRows === 0) unknowns.push('المصروفات: السجل فارغ — لا تكلفة محسوبة.');
    else money.push(`صرفنا نقدًا ${m.cashSpent.sar} ريال في الفترة، وتكلفة الفترة ${m.periodCost.sar} ريال، والمستحق غير المدفوع ${m.dueUnpaid.sar} ريال. [F01/F02/F03]`);
    if (m.revenue.coverageState === 'coverage_missing') unknowns.push('طلبات الشركاء والعمولات: غير معلومة — لا تقرير أمازون أو نون يغطي الفترة. [S07/S08]');
    else {
      money.push(`عمولات معتمدة ${m.revenue.confirmedSar} ريال، مقبوض ${m.revenue.paidSar} ريال، معلق ${m.revenue.pendingSar} ريال (تغطية ${m.revenue.coverageCount}/2). [S08/S08P]`);
      allowed.add(m.revenue.coverageCount);
    }
    if (m.operatingResultSar != null) { allowed.add(m.operatingResultSar); money.push(`النتيجة التشغيلية الإدارية للفترة ${m.operatingResultSar} ريال. [F06]`); }
  }

  const decisions: string[] = [];
  if (o.money?.revenue.coverageState === 'coverage_missing') decisions.push('استيراد صادرات أمازون ونون للفترة ومطابقتها — قبل أي حكم على الربحية.');
  const behind = o.goals.filter((g) => g.status === 'behind');
  if (behind[0]) decisions.push(`مراجعة هدف «${behind[0].nameAr}»: ${behind[0].statusReasonAr}`);
  if (o.needs[0] && o.needs[0].category !== 'unparsed') decisions.push(`أعلى حاجة «${o.needs[0].labelAr}»: مراجعة أعلى 3 مجموعات منتجات يدويًا قبل أي وعد «أفضل سعر لنفس الموديل».`);
  if (blockers.length) decisions.push(`معالجة أول عائق مثبت: ${blockers[0]}`);
  if (!decisions.length) decisions.push('لا قرار جديد اليوم — الأدلة لا تدعم تغييرًا؛ استمرار الرصد.');

  const cutoffAr = `${formatRiyadh(w.end)} السعودية${w.partial ? ' (نافذة جزئية)' : ''}`;
  return {
    titleAr: kind === 'monthly' ? `تقرير شهر ${w.labelAr}` : kind === 'daily' ? `ملخص ${w.labelAr}` : `ملخص عند الطلب — ${w.labelAr}`,
    windowLabelAr: w.labelAr, partial: w.partial, cutoffAr,
    whatHappenedAr: whatHappened, changedAr: changed, topNeedsAr: topNeeds, servingWellAr: servingWell, blockersAr: blockers, moneyAr: money, decisionsAr: decisions.slice(0, 3), unknownsAr: unknowns,
    facts, allowedNumbers: [...allowed],
  };
}

// ── AI explanation (optional, validated, never a number source) ─────────────

const MODEL = process.env.FOUNDER_INTEL_BRIEF_MODEL || 'claude-sonnet-5';
const TIMEOUT_MS = 20000;
const SYSTEM = `You explain an Arabic founder summary for Tawveeri (توفيري), a Saudi price-comparison site. You receive a JSON fact pack: pre-computed facts (each with metric_id, window, numerator, denominator, previous), unknowns and blockers. Write ONLY: possible explanations (hypotheses, hedged), what remains unknown, and ONE small experiment for the coming week. Rules you cannot break: never write any number that is not present verbatim in the fact pack; never estimate orders, revenue or conversion from clicks; never call a browser id a person; never claim causation; never propose external publishing, spending, ranking changes or automation; a proposed participant count in the experiment must be labelled proposed_target and be a small integer (3-10). Every explanation must reference at least one metric_id from the pack in facts_used. Respond with ONLY this JSON object: {"facts_used":["S01"],"possible_explanations":["..."],"unknowns":["..."],"one_experiment":{"title_ar":"...","proposed_target":"5","measure_ar":"..."}}`;

const NUM_RE = /\d+(?:[.,]\d+)?/g;
const ARABIC_DIGITS = /[٠-٩]/g;

export function validateAiExplanation(raw: unknown, det: DeterministicSummary): { ok: true; ai: AiExplanation } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not an object' };
  const o = raw as Record<string, unknown>;
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []);
  const factsUsed = strs(o.facts_used);
  if (factsUsed.length === 0 || factsUsed.some((id) => !det.facts.some((f) => f.metricId === id) && !METRICS[id])) return { ok: false, reason: 'facts_used references an unknown metric id' };
  const explanations = strs(o.possible_explanations), unknowns = strs(o.unknowns);
  if (explanations.length === 0) return { ok: false, reason: 'no explanations' };
  let experiment: AiExplanation['one_experiment'] = null;
  if (o.one_experiment && typeof o.one_experiment === 'object') {
    const e = o.one_experiment as Record<string, unknown>;
    if (typeof e.title_ar === 'string' && typeof e.measure_ar === 'string') {
      const target = String(e.proposed_target ?? '');
      if (!/^\d{1,2}$/.test(target) || Number(target) < 3 || Number(target) > 10) return { ok: false, reason: 'proposed_target out of range' };
      experiment = { title_ar: e.title_ar, proposed_target: target, measure_ar: e.measure_ar };
    }
  }
  const allowed = new Set(det.allowedNumbers.map((n) => Number(n)));
  const texts = [...explanations, ...unknowns, experiment?.title_ar ?? '', experiment?.measure_ar ?? ''];
  for (const t of texts) {
    const normalized = t.replace(ARABIC_DIGITS, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    for (const m of normalized.match(NUM_RE) ?? []) {
      const v = Number(m.replace(',', '.'));
      if (!allowed.has(v) && !allowed.has(Number(v.toFixed(1))) && !(v >= 3 && v <= 10 && experiment && String(v) === experiment.proposed_target)) return { ok: false, reason: `number ${m} not in fact pack` };
    }
  }
  return { ok: true, ai: { facts_used: factsUsed, possible_explanations: explanations.slice(0, 4), unknowns: unknowns.slice(0, 4), one_experiment: experiment } };
}

export async function explainWithAi(det: DeterministicSummary): Promise<{ ai: AiExplanation | null; status: SummaryRecord['aiStatus']; reason: string | null }> {
  if (process.env.ENABLE_FOUNDER_AI_BRIEF !== '1') return { ai: null, status: 'disabled', reason: 'ENABLE_FOUNDER_AI_BRIEF != 1' };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ai: null, status: 'unavailable', reason: 'ANTHROPIC_API_KEY not configured' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const payload = { window: det.windowLabelAr, partial: det.partial, facts: det.facts.map((f) => ({ metric_id: f.metricId, numerator: f.numerator, denominator: f.denominator, previous: f.previous, text_ar: f.textAr })), unknowns: det.unknownsAr, blockers: det.blockersAr, top_needs: det.topNeedsAr };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1600, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(payload) }] }),
    });
    if (!res.ok) return { ai: null, status: 'unavailable', reason: `Anthropic API ${res.status}` };
    const data = (await res.json()) as { stop_reason?: string; content?: Array<{ type: string; text?: string }> };
    if (data.stop_reason && data.stop_reason !== 'end_turn') return { ai: null, status: 'rejected', reason: `incomplete response: ${data.stop_reason}` };
    const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
    let parsed: unknown;
    try { parsed = JSON.parse(text.trim().replace(/^```json\s*|```$/g, '')); } catch { return { ai: null, status: 'rejected', reason: 'invalid JSON' }; }
    const v = validateAiExplanation(parsed, det);
    return v.ok ? { ai: v.ai, status: 'ok', reason: null } : { ai: null, status: 'rejected', reason: v.reason };
  } catch (e) {
    return { ai: null, status: 'unavailable', reason: e instanceof Error ? e.message : 'unknown error' };
  } finally { clearTimeout(timer); }
}

// ── Orchestration + persistence ─────────────────────────────────────────────

export async function generateSummary(kind: SummaryRecord['kind'], w: MetricWindow, opts: { persist?: boolean; withAi?: boolean } = {}): Promise<SummaryRecord> {
  const overview = await buildOverview(w);
  const det = buildDeterministicSummary(overview, kind);
  const ai = opts.withAi === false ? { ai: null, status: 'disabled' as const, reason: 'skipped' } : await explainWithAi(det);
  const record: SummaryRecord = {
    kind, periodStart: w.start.toISOString(), periodEnd: w.end.toISOString(), partial: w.partial,
    deterministic: det, ai: ai.ai, aiStatus: ai.status, aiReason: ai.reason, generatedAt: new Date().toISOString(), definitionVersion: DEFINITION_VERSION,
  };
  if (opts.persist !== false) {
    const supabase = createServerClient() as unknown as AnyClient;
    const { data, error } = await supabase.from('founder_summaries').insert({
      kind, period_start: record.periodStart, period_end: record.periodEnd, partial: w.partial, definition_version: DEFINITION_VERSION,
      deterministic: det, ai: ai.ai, ai_status: ai.status, ai_reason: ai.reason,
    }).select('id').single();
    if (error) throw new Error(`summary persist failed: ${error.message}`);
    record.id = data.id;
  }
  return record;
}

export async function latestSummary(kind: SummaryRecord['kind'], periodStart?: Date): Promise<SummaryRecord | null> {
  const supabase = createServerClient() as unknown as AnyClient;
  let q = supabase.from('founder_summaries').select('*').eq('kind', kind).order('generated_at', { ascending: false }).limit(1);
  if (periodStart) q = q.eq('period_start', periodStart.toISOString());
  const { data } = await q.maybeSingle();
  if (!data) return null;
  return { id: data.id, kind: data.kind, periodStart: data.period_start, periodEnd: data.period_end, partial: data.partial, deterministic: data.deterministic, ai: data.ai, aiStatus: data.ai_status, aiReason: data.ai_reason, generatedAt: data.generated_at, definitionVersion: data.definition_version };
}

export async function listSummaries(limit = 30): Promise<SummaryRecord[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_summaries').select('id, kind, period_start, period_end, partial, deterministic, ai, ai_status, ai_reason, generated_at, definition_version').order('generated_at', { ascending: false }).limit(limit);
  return ((data ?? []) as Array<Record<string, any>>).map((d) => ({ id: d.id, kind: d.kind, periodStart: d.period_start, periodEnd: d.period_end, partial: d.partial, deterministic: d.deterministic, ai: d.ai, aiStatus: d.ai_status, aiReason: d.ai_reason, generatedAt: d.generated_at, definitionVersion: d.definition_version }));
}

/** Windows the scheduled job should summarise for a run at `now`: yesterday (daily), and the
 *  previous month on the first run of a month. */
export function scheduledSummaryWindows(now = new Date()): Array<{ kind: 'daily' | 'monthly'; window: MetricWindow }> {
  const out: Array<{ kind: 'daily' | 'monthly'; window: MetricWindow }> = [{ kind: 'daily', window: windowFor('day', now) }];
  const monthStart = riyadhMonthStart(now);
  if (riyadhMidnightDaysAgo(0, now).getTime() === monthStart.getTime()) out.push({ kind: 'monthly', window: monthWindow(riyadhMonthStart(now, 1)) });
  return out;
}

export { previousEqualWindow };
