// Daily Founder Email — report generator (ADR-216). Summarizes the previous Riyadh calendar
// day using the SAME governed data as the Command Center — no separate metric definitions.
// The "AI brief" here is a deterministic template, not an LLM call: at current sample sizes
// (well under 100 real sessions/day) a narrated brief would mostly restate noise as insight,
// and the founder's own mandate prefers deterministic text when an LLM adds no real value.
// Every line is traceable to a governed metric; UNKNOWN/insufficient-sample data is stated,
// never shown as zero or invented as a strong claim.
import { getCommandCenterData } from './command-center-queries';
import { computeOpportunities } from './opportunities';
import { getProviderByStoreId } from '@/lib/providers/registry';

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
      subjectAr: `توفيري — ملخص يوم ${dateStr}: لا نشاط`,
      hasActivity: false,
      html: wrap(`<p style="font-size:16px">لم يتم تسجيل أي نشاط إنتاجي مؤهل يوم أمس.</p>`),
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
    briefParts.push(`أكثر متجر استقبل إحالات: ${retailerName(topRetailer.storeSlug)} (${topRetailer.confirmedRedirects} تحويلة مؤكدة).`);
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

  const html = wrap(`
    <h2 style="margin:0 0 4px;font-size:20px">ملخص يوم ${dateStr}</h2>
    <p style="color:#5b6b63;margin:0 0 20px">توفيري — مركز قيادة المؤسس</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px" role="presentation">
      ${statRow('الجلسات الحقيقية', String(real.sessions), sessionsDelta !== null ? `${sessionsDelta >= 0 ? '▲' : '▼'} ${Math.abs(sessionsDelta)}%` : 'جديد')}
      ${statRow('عمليات البحث', String(real.search), searchDelta !== null ? `${searchDelta >= 0 ? '▲' : '▼'} ${Math.abs(searchDelta)}%` : 'جديد')}
      ${statRow('زيارات مؤهلة مُحالة', String(commercial.qualifiedVisitsReferred), '')}
      ${statRow('تحويلات مؤكدة للمتاجر', String(commercial.confirmedRetailerRedirects), '')}
    </table>

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

function retailerName(storeSlugOrId: string): string {
  const provider = getProviderByStoreId(storeSlugOrId);
  return provider?.displayNameAr || provider?.displayName || storeSlugOrId;
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
