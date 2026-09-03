// Daily Founder Email — report generator (ADR-216). Summarizes the previous Riyadh calendar
// day using the SAME governed data as the Command Center — no separate metric definitions.
// The base template below is still a deterministic template, not an LLM call — ADR-216's
// original reasoning (at well under 100 real sessions/day, a narrated brief mostly restates
// noise) remains correct for a single day read in isolation, and this file's core behavior is
// UNCHANGED. Every line here is traceable to a governed metric; UNKNOWN/insufficient-sample
// data is stated, never shown as zero or invented as a strong claim.
//
// FOCUS TODAY (integrated review, 2026-08-30; shared with the Command Center dashboard per
// ADR-277) — optional, additive, default OFF. Reasons over a WEEK of trend-relative evidence
// (need-signals momentum, emerging-language, existing opportunities), not a single day's raw
// count, which is the distinction that makes an AI layer defensible now where ADR-213 correctly
// deferred it before. Gated behind ENABLE_FOUNDER_AI_BRIEF (unset/anything other than '1' = OFF,
// byte-identical output to before this section existed).
//
// The actual computation (fetch events, need-signals, emerging-language, opportunities, the AI
// call) lives ONE place — src/lib/admin/focus-today.ts's computeFocusToday() — reused verbatim by
// this file and by the Command Center dashboard (src/app/[locale]/admin/command-center/
// focus-today.tsx). This file's job is ONLY to render that shared result as HTML for the email;
// it computes nothing of its own. computeFocusToday() never throws — a defect in the assembly
// can never break the guaranteed-send deterministic email either.
import { getCommandCenterData } from './command-center-queries';
import { computeOpportunities } from './opportunities';
import { fetchGrowthContent } from './growth-queries';
import { retailerDisplayName as retailerName } from '@/lib/providers/registry';
import {
  computeFocusToday, DOMAIN_LABEL_AR, EVIDENCE_CONFIDENCE_LABEL_AR, ACTION_TIER_LABEL_AR,
} from './focus-today';
import type { FocusItem } from './founder-intelligence';

// ACT/WATCH/INSUFFICIENT_EVIDENCE (ADR-275) — structural, computed deterministically per-kind in
// opportunities.ts, never set or upgraded by the AI. Rendered as a visible badge so the
// evidence-strength/action-readiness distinction is legible at a glance, not just in prose. Only
// the color mapping is email-specific (inline hex, HTML email can't use Tailwind) — the labels
// themselves come from the shared focus-today.ts module, same words the dashboard shows.
const ACTION_TIER_COLOR: Record<FocusItem['actionTier'], string> = {
  ACT: '#1f6f59', WATCH: '#9a5b13', INSUFFICIENT_EVIDENCE: '#7a7a7a',
};

function focusItemHtml(item: FocusItem): string {
  return `<div style="border-top:1px solid #eef6f2;padding:10px 0">
    <p style="margin:0 0 4px;font-weight:bold">${escapeHtml(item.titleAr)}
      <span style="font-weight:bold;color:${ACTION_TIER_COLOR[item.actionTier]};font-size:11px;border:1px solid ${ACTION_TIER_COLOR[item.actionTier]};border-radius:8px;padding:1px 6px;margin-inline-start:4px">${ACTION_TIER_LABEL_AR[item.actionTier]}</span>
      <span style="font-weight:normal;color:#5b6b63;font-size:12px">(${DOMAIN_LABEL_AR[item.domain]} — ثقة الدليل ${EVIDENCE_CONFIDENCE_LABEL_AR[item.evidenceConfidence]}${item.earlySignal ? '، إشارة مبكرة' : ''})</span></p>
    <p style="margin:0 0 4px;color:#333">${escapeHtml(item.whyNowAr)}</p>
    <p style="margin:0 0 4px;color:#333"><b>الإجراء المقترح:</b> ${escapeHtml(item.recommendedActionAr)}</p>
    <p style="margin:0;color:#5b6b63;font-size:12px">الدليل: ${escapeHtml(item.evidenceAr)}${item.riskCaveatAr ? ` — تحذير: ${escapeHtml(item.riskCaveatAr)}` : ''}</p>
  </div>`;
}

/** Renders computeFocusToday()'s result as HTML. Returns '' (no section at all — byte-identical
 *  to today's email) when the shared function reports the flag off. Never throws — the shared
 *  function itself never throws, and every branch here is a plain string template. */
async function buildFocusTodaySection(existingOpportunities: ReturnType<typeof computeOpportunities>): Promise<string> {
  const result = await computeFocusToday(existingOpportunities);
  if (!result.enabled) return '';
  if (!result.aiAvailable) {
    return `<div style="background:#fff7ed;border-radius:12px;padding:12px;margin:0 0 20px;color:#9a5b13;font-size:13px">
      تعذر توليد توصيات الذكاء الاصطناعي اليوم (${escapeHtml(result.reason)}) — الأرقام أدناه غير متأثرة، هذا القسم فقط غير متاح.
    </div>`;
  }
  // Window disclosure (ADR-278): the rest of this email is about YESTERDAY specifically; this
  // section always looks at the last 7 days vs. the 7 before that — never let the founder read
  // the two as the same window.
  const windowNote = '<p style="margin:4px 0 0;color:#5b6b63;font-size:11px">يعتمد على آخر 7 أيام مقابل الأسبوع السابق — بخلاف بقية هذه الرسالة التي تخص يوم أمس فقط.</p>';
  if (result.focusItems.length === 0) {
    return `<div style="background:#f8fcfa;border-radius:12px;padding:14px;margin:0 0 20px">
      <b style="color:#1f6f59">ركّز اليوم على:</b>
      <p style="margin:6px 0 0;color:#5b6b63">لا توجد إشارة قوية بما يكفي لتوصية اليوم — لا حاجة لإنشاء عمل جديد.</p>
      ${windowNote}
    </div>`;
  }
  return `<div style="background:#f8fcfa;border-radius:12px;padding:14px;margin:0 0 20px">
    <b style="color:#1f6f59">ركّز اليوم على:</b>
    ${windowNote}
    ${result.focusItems.map(focusItemHtml).join('')}
  </div>`;
}

export interface DailyReportResult {
  subjectAr: string;
  html: string;
  hasActivity: boolean;
}

const EARLY_SIGNAL_SESSIONS = 30;

export async function generateDailyFounderReport(): Promise<DailyReportResult> {
  const data = await getCommandCenterData('yesterday');
  const { real, prevReal, commercial, baseline, quality } = data;
  const opportunities = computeOpportunities(data);

  // ADR-244 Gate E: content awaiting founder review is a real, actionable signal —
  // never fabricated activity; shown only when ready_for_review rows actually exist.
  const readyContent = await fetchGrowthContent()
    .then((rows) => rows.filter((r) => r.status === 'ready_for_review'))
    .catch(() => []);
  const reviewBlock = readyContent.length
    ? `<div style="background:#eafaf3;border:1px solid #b9e7d4;border-radius:12px;padding:14px;margin:0 0 20px">
         <b style="color:#126b4f">محتوى جديد جاهز للمراجعة (${readyContent.length}):</b>
         ${readyContent.map((r) => `<div style="margin-top:6px">• ${r.title ?? r.content_id} — ${r.why_now ? r.why_now.slice(0, 120) + '…' : ''}</div>`).join('')}
         <div style="margin-top:8px"><a href="https://tawveeri.com/ar/admin/growth" style="color:#0d5c46;font-weight:bold">راجع واعتمد أو اطلب تعديل ←</a></div>
       </div>`
    : '';

  const dateStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' });
  const hasActivity = real.sessions > 0 || commercial.confirmedRetailerRedirects > 0;

  if (baseline.currentIsPreLaunch) {
    return {
      subjectAr: `توفيري — ملخص يوم ${dateStr}: اختبار ما قبل الإطلاق`,
      hasActivity: false,
      html: wrap(`
        <p style="font-size:16px">اختبار ما قبل الإطلاق — لم يبدأ الأساس التجاري الرسمي بعد (${new Date(baseline.date).toLocaleDateString('ar-SA')}).</p>
        <p>لا تُعرض أي أرقام من هذه الفترة كإشارة تجارية حقيقية.</p>
      `),
    };
  }

  if (!hasActivity) {
    return {
      subjectAr: readyContent.length
        ? `توفيري — محتوى جاهز للمراجعة (${readyContent.length})`
        : `توفيري — ملخص يوم ${dateStr}: لا نشاط`,
      hasActivity: readyContent.length > 0,
      html: wrap(`${reviewBlock}<p style="font-size:16px">لم يتم تسجيل أي نشاط إنتاجي مؤهل يوم أمس.</p>`),
    };
  }

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
  const sessionsDelta = prevReal.sessions > 0 ? pct(real.sessions - prevReal.sessions, prevReal.sessions) : null;
  const searchDelta = prevReal.search > 0 ? pct(real.search - prevReal.search, prevReal.search) : null;

  const topRetailer = commercial.retailers[0];
  const topProduct = commercial.topReferredProducts[0];
  const topCategory = commercial.referredCategoryDemand[0];
  const topOpportunity = opportunities[0];

  // Deterministic brief — "what changed / why / what matters / what to consider / confidence".
  const briefParts: string[] = [];
  if (sessionsDelta !== null) {
    briefParts.push(sessionsDelta >= 0
      ? `الجلسات الحقيقية ارتفعت ${sessionsDelta}% مقابل اليوم السابق.`
      : `الجلسات الحقيقية انخفضت ${Math.abs(sessionsDelta)}% مقابل اليوم السابق.`);
  } else {
    briefParts.push(`لا توجد بيانات كافية لمقارنة الجلسات مع اليوم السابق (${baseline.previousIsPreLaunch ? 'اليوم السابق كان اختبار ما قبل الإطلاق' : 'العدد كان صفراً'}).`);
  }
  if (topRetailer) {
    // ADR-286 wording fix: raw /go request count — "مسجّلة" (recorded), not "مؤكدة" (confirmed).
    briefParts.push(`أكثر متجر استقبل إحالات: ${retailerName(topRetailer.storeSlug)} (${topRetailer.confirmedRedirects} تحويلة مسجّلة).`);
  }
  if (topCategory) {
    briefParts.push(`أعلى فئة اهتماماً في الإحالات: ${topCategory.category} (${topCategory.count}).`);
  }
  if (topOpportunity) {
    briefParts.push(`أهم فرصة تجارية: ${topOpportunity.titleAr}${topOpportunity.earlySignal ? ' (إشارة مبكرة — عينة صغيرة)' : ''}.`);
  } else {
    briefParts.push('لا توجد فرصة تجارية واضحة اليوم بالأدلة المتاحة.');
  }
  const confidenceNote = real.sessions < EARLY_SIGNAL_SESSIONS
    ? `مبني على ${real.sessions} جلسة حقيقية — عينة صغيرة، إشارة مبكرة وليست قراراً نهائياً.`
    : `مبني على ${real.sessions} جلسة حقيقية.`;

  const focusTodayBlock = await buildFocusTodaySection(opportunities);

  const html = wrap(`
    <h2 style="margin:0 0 4px;font-size:20px">ملخص يوم ${dateStr}</h2>
    <p style="color:#5b6b63;margin:0 0 20px">توفيري — مركز قيادة المؤسس</p>
    ${focusTodayBlock}
    ${reviewBlock}

    <table style="width:100%;border-collapse:collapse;margin-bottom:4px" role="presentation">
      ${statRow('الجلسات الحقيقية', String(real.sessions), sessionsDelta !== null ? `${sessionsDelta >= 0 ? '▲' : '▼'} ${Math.abs(sessionsDelta)}%` : 'جديد')}
      ${statRow('عمليات البحث', String(real.search), searchDelta !== null ? `${searchDelta >= 0 ? '▲' : '▼'} ${Math.abs(searchDelta)}%` : 'جديد')}
      ${statRow('زيارات مؤهلة مُحالة', String(commercial.qualifiedVisitsReferred), '')}
      ${statRow('تفاعلات متجر صريحة (دقيقة القرار)', String(commercial.explicitRetailerInteractions), '')}
      ${statRow('طلبات /go مسجّلة (تشغيلي)', String(commercial.confirmedRetailerRedirects), '')}
    </table>
    <!-- ADR-286 wording fix: "تفاعلات متجر صريحة" requires a real onClick to have fired
         (first_party_interactions, REAL only); "طلبات /go مسجّلة" is a raw server-recorded
         request count — operational evidence, never proof of customer interaction. -->
    <p style="margin:0 0 20px;font-size:11px;color:#5b6b63">
      ${commercial.correlatedMerchantNavigations} من التفاعلات الصريحة مرتبطة بخروج فعلي للمتجر عبر /go — طلبات /go المسجّلة قياس تشغيلي فقط ولا تثبت تفاعل عميل.
    </p>

    ${commercial.retailers.length > 0 ? `
    <h3 style="font-size:14px;margin:0 0 8px">التحويلات حسب المتجر</h3>
    <ul style="margin:0 0 20px;padding-inline-start:20px">
      ${commercial.retailers.slice(0, 5).map((r) => `<li>${retailerName(r.storeSlug)}: ${r.confirmedRedirects}</li>`).join('')}
    </ul>` : ''}

    ${commercial.topSearchTerms.length > 0 ? `
    <h3 style="font-size:14px;margin:0 0 8px">أعلى 5 عبارات بحث</h3>
    <ul style="margin:0 0 20px;padding-inline-start:20px">
      ${commercial.topSearchTerms.slice(0, 5).map((t) => `<li>${escapeHtml(t.query)} (${t.count}×)</li>`).join('')}
    </ul>` : ''}

    ${topProduct ? `
    <h3 style="font-size:14px;margin:0 0 8px">أعلى 5 منتجات مُحالة</h3>
    <ul style="margin:0 0 20px;padding-inline-start:20px">
      ${commercial.topReferredProducts.slice(0, 5).map((p) => `<li>${escapeHtml(p.nameAr)} (${p.count})</li>`).join('')}
    </ul>` : ''}

    ${data.unmetDemand.length > 0 ? `
    <h3 style="font-size:14px;margin:0 0 8px">طلب غير ملبى (مهم)</h3>
    <ul style="margin:0 0 20px;padding-inline-start:20px">
      ${data.unmetDemand.slice(0, 5).map((q) => `<li>${escapeHtml(q.query)} (${q.count}×)</li>`).join('')}
    </ul>` : ''}

    <div style="background:#f8fcfa;border-radius:12px;padding:16px;margin-bottom:20px">
      <h3 style="font-size:14px;margin:0 0 8px;color:#1f6f59">الموجز</h3>
      <ul style="margin:0;padding-inline-start:20px">
        ${briefParts.map((p) => `<li>${p}</li>`).join('')}
      </ul>
      <p style="margin:8px 0 0;font-size:12px;color:#5b6b63">${confidenceNote}</p>
    </div>

    ${(quality.trackingStopped || (quality.goClickOutboundDivergencePct ?? 0) > 0.15) ? `
    <div style="background:#fff7ed;border-radius:12px;padding:12px;margin-bottom:20px;color:#9a5b13">
      ${quality.trackingStopped ? '<p style="margin:0">تحذير: لا يوجد حدث تتبع خلال آخر 6 ساعات.</p>' : ''}
      ${(quality.goClickOutboundDivergencePct ?? 0) > 0.15 ? '<p style="margin:0">تحذير: تباين في مسارات قياس الخروج — راجع مركز القيادة.</p>' : ''}
    </div>` : ''}

    <a href="https://tawveeri.com/ar/admin/command-center" style="display:inline-block;background:#1f6f59;color:#fff;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold">
      فتح مركز قيادة المؤسس ←
    </a>
  `);

  return { subjectAr: `توفيري — ملخص يوم ${dateStr}: ${real.sessions} جلسة، ${commercial.confirmedRetailerRedirects} تحويلة`, html, hasActivity: true };
}

function statRow(label: string, value: string, delta: string): string {
  return `<tr style="border-bottom:1px solid #eef6f2">
    <td style="padding:8px 0;color:#5b6b63">${label}</td>
    <td style="padding:8px 0;text-align:end;font-weight:bold;font-size:18px">${value}</td>
    <td style="padding:8px 0;text-align:end;color:#5b6b63;font-size:12px;width:70px">${delta}</td>
  </tr>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function wrap(body: string): string {
  return `<!doctype html><html dir="rtl" lang="ar"><body style="font-family:sans-serif;background:#f5faf7;padding:24px;color:#1a1a1a">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">${body}</div>
  </body></html>`;
}
