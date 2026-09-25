// src/lib/founder/daily-email.ts — «ملخص توفيري اليومي»: the founder's morning email, rendered from
// the SAME register-bound summary the center shows (founder_summaries), never a second computation.
// Order is fixed by the founder's mandate: what happened yesterday → money (paid / expected /
// collected / pending, unknown never zero) → month goals → data quality → ONE decision → link.
// Every number carries its metric id; browser ids are never people; a linked exit is never a store
// visit or a purchase; pending commission is never cash. When a block cannot be computed it says
// «غير متاح» — the email is still sent, deterministic, never empty, never a stack trace.
import { createServerClient } from '@/lib/database';
import { generateSummary, latestSummary, type SummaryRecord } from './summary';
import { buildOverview, buildMoneyPicture, type Overview, type MoneyPicture } from './overview';
import { fetchExpenses, expenseSar } from './finance';
import { GOAL_STATUS_AR } from './goals';
import { ratioText } from './metrics';
import { formatRiyadh, monthWindow, riyadhMonthStart, riyadhDateString, windowFor, toRiyadh, type MetricWindow } from './windows';

type AnyClient = { from: (table: string) => any };
export const FOUNDER_LINK = 'https://tawveeri.com/founder';

export interface DailyEmail { reportDate: string; subject: string; html: string; text: string; summaryId: string | null; aiStatus: string; blocksUnavailable: string[] }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
/** The text/plain part is derived from the HTML lines: strip tags, then restore entities. */
const toText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const sar = (v: number | null | undefined) => (v == null ? 'غير متاح' : `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ر.س`);
const li = (items: string[]) => (items.length ? `<ul style="margin:6px 0 0;padding-inline-start:18px">${items.map((t) => `<li style="margin:3px 0">${t}</li>`).join('')}</ul>` : '');
const h = (title: string) => `<h3 style="margin:18px 0 4px;font-size:15px;color:#1f6f59">${esc(title)}</h3>`;
const note = (s: string) => `<p style="margin:4px 0 0;font-size:11px;color:#5b6b63">${s}</p>`;

export function subjectFor(reportDate: string, kind: 'daily' | 'test' = 'daily'): string {
  return `${kind === 'test' ? '[اختبار] ' : ''}ملخص توفيري اليومي — ${reportDate}`;
}

/** Block 1 — yesterday in documented numbers. */
function yesterdayBlock(o: Overview): { html: string; text: string[] } {
  const c = (id: string) => o.cards.find((x) => x.id === id);
  const p = o.pack.ok ? o.pack.pack : null;
  const lines: string[] = [];
  if (p) {
    lines.push(`متصفحات مرصودة: <b>${p.observed_browsers}</b> (Q01) — معرّفات متصفح، ليست أشخاصًا.`);
    lines.push(`أظهرت نية شراء (بحث/استشارة/فتح منتج/خروج): <b>${p.intent_browsers}</b> (Q01I).`);
  }
  const s01 = c('S01'), s02 = c('S02'), s05 = c('S05'), s06 = c('S06');
  if (s01?.numerator != null) lines.push(`أرسل بحثًا: <b>${s01.numerator}</b> (S01)؛ تلقى نتائج غير فارغة: <b>${ratioText(s02?.numerator ?? null, s02?.denominator ?? null)}</b> (S02).`);
  if (s05?.numerator != null) lines.push(`خروج مرتبط مسجّل (ضغطة فعلية + طلب تحويل بالمعرّف نفسه): <b>${s05.numerator}</b> (S05)${s06?.numerator != null ? `، منها بعد بحث خلال 30 دقيقة: <b>${s06.numerator}</b> (S06)` : ''} — ليس زيارة متجر مؤكدة ولا شراء.`);
  const needs = o.needs.filter((n) => n.category !== 'unparsed').slice(0, 3).map((n) => `${esc(n.labelAr)} (${n.searchSessions} متصفح)`);
  if (needs.length) lines.push(`أعلى الاحتياجات: ${needs.join('، ')}.`);
  const products = o.products.slice(0, 3).map((x) => `${esc(x.nameAr)} (${x.sessions} متصفح${x.blockerAr ? '، يحتاج تحققًا' : ''})`);
  if (products.length) lines.push(`أعلى المنتجات خلف الخروج المرتبط: ${products.join('، ')}.`);
  const stores = o.referrals.stores.filter((s) => s.linkedInteractions > 0).slice(0, 3).map((s) => `${esc(s.nameAr)} (${s.linkedInteractions})`);
  if (stores.length) lines.push(`أعلى المتاجر بالخروج المرتبط: ${stores.join('، ')}.`);
  if (!lines.length) lines.push('لا نشاط مسجل أمس (أو تعذر القياس — انظر جودة البيانات).');
  return { html: h('ماذا حدث أمس؟') + li(lines), text: lines.map(toText) };
}

/** Block 2 — money, strictly separated. */
function moneyBlock(dayMoney: MoneyPicture | null, monthMoney: MoneyPicture | null, expectedRows: Array<{ vendor: string; sar: number | null; due: string | null }>): { html: string; text: string[] } {
  const lines: string[] = [];
  if (!dayMoney || !monthMoney) lines.push('السجل المالي: غير متاح (تعذر القراءة).');
  else {
    lines.push(`مصروف مدفوع فعليًا: أمس <b>${sar(dayMoney.cashSpent.sar)}</b> (F01)، وهذا الشهر حتى الآن <b>${sar(monthMoney.cashSpent.sar)}</b>${monthMoney.cashSpent.unconvertedRows ? ` (+${monthMoney.cashSpent.unconvertedRows} بعملة أجنبية بلا تحويل)` : ''}.`);
    lines.push(expectedRows.length ? `التزامات/فواتير متوقعة بانتظار التأكيد: ${expectedRows.slice(0, 5).map((e) => `${esc(e.vendor)} ${sar(e.sar)}${e.due ? ` (${e.due})` : ''}`).join('، ')}${expectedRows.length > 5 ? ` و${expectedRows.length - 5} أخرى` : ''}.` : 'التزامات/فواتير متوقعة بانتظار التأكيد: لا شيء حاليًا.');
    const r = monthMoney.revenue;
    if (r.coverageState === 'coverage_missing') lines.push(`عمولات مقبوضة: <b>غير معلوم</b>؛ عمولات معتمدة: <b>غير معلوم</b> — لا تقرير شريك يغطي الشهر (S08/S08P)${r.pendingSar ? `؛ معلق/متوقع مصرّح به: ${sar(r.pendingSar)} — ليس إيرادًا مقبوضًا` : ''}.`);
    else lines.push(`عمولات مقبوضة هذا الشهر: <b>${sar(r.paidSar)}</b> (S08P)؛ معتمدة: ${sar(r.confirmedSar)} (S08)؛ معلقة: ${sar(r.pendingSar)} — المعلق ليس مقبوضًا. تغطية الشركاء ${r.coverageCount}/2.`);
  }
  return { html: h('الأداء المالي') + li(lines), text: lines.map(toText) };
}

/** Block 3 — month goals. */
function goalsBlock(o: Overview, monthEnd: Date): { html: string; text: string[] } {
  if (!o.goals.length) { const t = 'لا أهداف مسجلة لهذا الشهر — «تحديد هدف» في المركز.'; return { html: h('أهداف الشهر') + `<p style="margin:4px 0">${t}</p>`, text: [t] }; }
  const lines = o.goals.map((g) => `${esc(g.nameAr)} (${g.goal.metric_id}): <b>${GOAL_STATUS_AR[g.status]}</b> — ${g.current ?? 'غير متاح'} / ${g.goal.target_value}${g.goal.direction === 'lte' ? ' (أقل أفضل)' : ''}، الموعد ${formatRiyadh(monthEnd, false)}${g.status === 'not_judgeable' ? ` — ${esc(g.statusReasonAr)}` : ''}`);
  return { html: h('أهداف الشهر') + li(lines), text: lines.map(toText) };
}

/** Block 4 — data quality (only when something matters). */
function qualityBlock(o: Overview): { html: string; text: string[] } {
  const items = o.quality.filter((q) => q.severity !== 'info').map((q) => `${q.severity === 'critical' ? '⚠︎ ' : ''}${esc(q.textAr)}`);
  if (!items.length) return { html: '', text: [] };
  return { html: h('جودة البيانات') + li(items), text: items.map(toText) };
}

export async function buildDailyEmail(now = new Date(), kind: 'daily' | 'test' = 'daily'): Promise<DailyEmail> {
  const day = windowFor('day', now);
  const reportDate = riyadhDateString(day.start);
  const unavailable: string[] = [];
  let summary: SummaryRecord | null = null;
  try {
    summary = (await latestSummary('daily', day.start)) ?? (await generateSummary('daily', day, { persist: true }));
  } catch (e) { unavailable.push(`summary: ${e instanceof Error ? e.message : 'failed'}`); }
  let overview: Overview | null = null;
  try { overview = await buildOverview(day, { now }); } catch (e) { unavailable.push(`overview: ${e instanceof Error ? e.message : 'failed'}`); }
  const monthW: MetricWindow = windowFor('month', now);
  let monthMoney: MoneyPicture | null = null;
  try { monthMoney = await buildMoneyPicture(monthW, now); } catch (e) { unavailable.push(`money: ${e instanceof Error ? e.message : 'failed'}`); }
  let expected: Array<{ vendor: string; sar: number | null; due: string | null }> = [];
  try { expected = (await fetchExpenses()).filter((e) => e.payment_status === 'expected').map((e) => ({ vendor: e.vendor, sar: expenseSar(e), due: e.expected_for ?? e.due_at })); } catch { /* shown as none */ }

  const subject = subjectFor(reportDate, kind);
  const blocks: Array<{ html: string; text: string[] }> = [];
  if (overview) { blocks.push(yesterdayBlock(overview)); blocks.push(moneyBlock(overview.money, monthMoney, expected)); blocks.push(goalsBlock(overview, monthWindow(riyadhMonthStart(now)).end)); blocks.push(qualityBlock(overview)); }
  else blocks.push({ html: h('ماذا حدث أمس؟') + '<p>غير متاح — تعذر حساب المؤشرات لهذا اليوم؛ الأرقام في المركز هي المرجع.</p>', text: ['غير متاح — تعذر حساب المؤشرات'] });

  // ONE decision: the summary's first decision, else the overview headline, else the default.
  const decision = summary?.deterministic.decisionsAr?.[0] ?? overview?.headline.decisionAr ?? 'استيراد تقارير أمازون ونون للفترة قبل أي حكم على الربحية.';
  const cutoff = `${formatRiyadh(day.end)} بتوقيت السعودية`;
  const aiHtml = summary?.ai?.possible_explanations?.length ? `${h('تفسير مقترح (فرضيات، لا أرقام جديدة)')}${li(summary.ai.possible_explanations.slice(0, 2).map(esc))}` : '';

  const html = `<!doctype html><html lang="ar"><body style="margin:0;background:#f5faf7;padding:20px;font-family:-apple-system,Segoe UI,Tahoma,sans-serif;color:#1a1a1a">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:22px;direction:rtl;text-align:right">
    <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:.08em;color:#1f6f59">توفيري · مركز قرارات المؤسس</p>
    <h2 style="margin:4px 0 2px;font-size:20px">${esc(subject)}</h2>
    <p style="margin:0 0 6px;font-size:12px;color:#5b6b63">يوم ${esc(reportDate)} (منتصف الليل → منتصف الليل، آسيا/الرياض) · قطع البيانات ${esc(cutoff)}</p>
    ${blocks.map((b) => b.html).join('')}
    ${aiHtml}
    <div style="margin:20px 0 8px;padding:14px;border-radius:12px;background:#eef8f4;border:1px solid #bfe3d6">
      <p style="margin:0;font-size:11px;font-weight:bold;color:#1f6f59">قرار اليوم — إجراء واحد</p>
      <p style="margin:6px 0 0;font-size:15px;font-weight:bold">${esc(decision)}</p>
    </div>
    <a href="${FOUNDER_LINK}" style="display:inline-block;margin-top:8px;background:#1f6f59;color:#fff;padding:11px 20px;border-radius:12px;text-decoration:none;font-weight:bold">افتح مركز قرارات المؤسس ←</a>
    ${note('كل رقم يحمل تعريفه ونافذته ومصدره داخل المركز (S/Q/F هي معرّفات السجل). معرّف المتصفح ليس شخصًا؛ الخروج المرتبط ليس زيارة متجر مؤكدة ولا شراء؛ العمولة المعلقة ليست إيرادًا مقبوضًا؛ «غير معلوم» ليس صفرًا.')}
    ${unavailable.length ? note(`أجزاء غير متاحة في هذه الرسالة: ${esc(unavailable.join('؛ '))}`) : ''}
  </div></body></html>`;
  const text = [subject, ...blocks.flatMap((b) => b.text), `قرار اليوم: ${decision}`, FOUNDER_LINK].join('\n');
  return { reportDate, subject, html, text, summaryId: summary?.id ?? null, aiStatus: summary?.aiStatus ?? 'unavailable', blocksUnavailable: unavailable };
}

// ── Send log ──────────────────────────────────────────────────────────────

export interface SendLogRow { id: string; report_date: string; kind: string; recipient: string; subject: string; status: string; message_id: string | null; provider_status: number | null; error: string | null; trigger: string | null; scheduled_for: string | null; attempted_at: string }

export async function alreadySentToday(reportDate: string, kind: 'daily' | 'test'): Promise<SendLogRow | null> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_email_sends').select('id, report_date, kind, recipient, subject, status, message_id, provider_status, error, trigger, scheduled_for, attempted_at').eq('report_date', reportDate).eq('kind', kind).eq('status', 'sent').limit(1).maybeSingle();
  return (data as SendLogRow | null) ?? null;
}

export async function logSend(row: Omit<SendLogRow, 'id' | 'attempted_at'> & { summary_id?: string | null; html_snapshot?: string | null }): Promise<string | null> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_email_sends').insert(row).select('id').single();
  return data?.id ?? null;
}

export async function recentSends(limit = 14): Promise<SendLogRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_email_sends').select('id, report_date, kind, recipient, subject, status, message_id, provider_status, error, trigger, scheduled_for, attempted_at').order('attempted_at', { ascending: false }).limit(limit);
  return (data ?? []) as SendLogRow[];
}

/** The schedule as a human string, computed from the cron expression the Railway service runs. */
export const SCHEDULE_LABEL = '08:00 Asia/Riyadh (cron 0 5 * * * UTC, no DST)';
export function nextScheduledRun(now = new Date()): Date {
  const r = toRiyadh(now); const today = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate(), 5, 0, 0));
  return today.getTime() > now.getTime() ? today : new Date(today.getTime() + 86_400_000);
}
