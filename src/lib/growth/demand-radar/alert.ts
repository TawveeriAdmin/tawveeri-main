// HIGH-opportunity founder email (ADR-247 §24). Reuses the existing SendGrid
// direct-send infrastructure (same env vars as the daily founder report).
// TEST opportunities are labeled TEST in the subject and never counted as REAL.

import { categoryNameAr } from './saudi-lexicon';
import type { RadarCandidate } from './types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

export async function sendHighOpportunityAlert(op: {
  id: string;
  candidate: RadarCandidate;
  category: string | null;
  reasons: string[];
  suggestedReply: string | null;
  suggestedQuery: string | null;
  isTest: boolean;
}): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const recipient = process.env.FOUNDER_DAILY_REPORT_EMAIL;
  if (!apiKey || !recipient) return false; // observable via alerted_at staying null

  const catAr = categoryNameAr(op.category);
  const sourceLabel = op.candidate.source === 'x' ? 'X' : 'TEST';
  const ago = op.candidate.postedAt
    ? Math.round((Date.now() - new Date(op.candidate.postedAt).getTime()) / 60000)
    : null;
  const subject = `${op.isTest ? '[TEST] ' : ''}فرصة طلب جديدة — ${catAr} — ${sourceLabel}`;

  const html = `<!doctype html><html dir="rtl" lang="ar"><body style="font-family:sans-serif;background:#f5faf7;padding:24px;color:#1a1a1a">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
    ${op.isTest ? '<p style="background:#fef3c7;padding:8px 12px;border-radius:8px;font-weight:bold">تنبيه تجريبي — لا يُحتسب في الأرقام الحقيقية</p>' : ''}
    <h2 style="margin:0 0 6px;font-size:18px">فرصة طلب — ${catAr}</h2>
    ${ago !== null ? `<p style="color:#5b6b63;margin:0 0 14px">ظهر قبل ${ago} دقيقة</p>` : ''}
    <p style="margin:0 0 4px;font-weight:bold">${op.candidate.authorHandle ? '@' + op.candidate.authorHandle : 'مستخدم'}:</p>
    <blockquote style="background:#f8fcfa;border-radius:12px;padding:14px;margin:0 0 16px;font-size:15px">${escapeHtml(op.candidate.text.slice(0, 400))}</blockquote>
    <p style="font-weight:bold;margin:0 0 6px">لماذا هذه فرصة:</p>
    <ul style="margin:0 0 16px;padding-inline-start:20px">
      ${op.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
    </ul>
    ${op.suggestedReply ? `<p style="font-weight:bold;margin:0 0 6px">الرد المقترح:</p>
    <blockquote style="background:#eafaf3;border-radius:12px;padding:14px;margin:0 0 16px">${escapeHtml(op.suggestedReply)}</blockquote>` : '<p style="color:#9a5b13">لم تنجح صياغة رد مقترح — الفرصة قائمة بدونه.</p>'}
    ${op.suggestedQuery ? `<p style="color:#5b6b63">بحث توفيري المقترح: «${escapeHtml(op.suggestedQuery)}»</p>` : ''}
    <a href="${APP_URL}/ar/admin/growth#op-${op.id}" style="display:inline-block;background:#1f6f59;color:#fff;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold">راجع الفرصة ←</a>
  </div></body></html>`;

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }] }],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'info@tawveeri.com',
          name: process.env.SENDGRID_FROM_NAME || 'Tawveeri',
        },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    return res.ok || res.status === 202;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
