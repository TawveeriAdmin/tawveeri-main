// POST /api/cron/daily-founder-report — sends «ملخص توفيري اليومي» (ADR-385; supersedes ADR-216's
// command-center email). Trigger: Railway service `daily-founder-report-cron`, cron `0 5 * * *` UTC
// = 08:00 Asia/Riyadh (Saudi Arabia has no DST), config-as-code in railway.founder-report-cron.toml.
// Bearer CRON_SECRET, recipient from FOUNDER_DAILY_REPORT_EMAIL (never hardcoded).
//
// Guarantees: one 'sent' row per (report_date, kind) in founder_email_sends — a second call the
// same day returns skipped, never a second email; every attempt (sent / failed / suppressed /
// not_configured / dry_run / skipped) is logged with the exact HTML sent; the body is rendered
// from the SAME register-bound summary the center shows, deterministic first, AI optional and
// validated; a computation failure still produces a correct deterministic email, never a stack trace.
// Query flags: ?dryRun=1 (render + log, no send), ?kind=test (a founder-only test message that
// does not consume the day's daily slot), ?force=1 (bypass the duplicate guard — manual use only).
//
// Delivery diagnostics (kept from the 2026-08-06 fix): SendGrid's 202 means ACCEPTED, not delivered;
// the recipient is checked against suppression lists first, and the X-Message-Id is logged.
import { NextRequest, NextResponse } from 'next/server';
import { buildDailyEmail, alreadySentToday, logSend, SCHEDULE_LABEL } from '@/lib/founder/daily-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

interface SuppressionStatus { bounced: boolean; blocked: boolean; invalid: boolean; spamReported: boolean; globallyUnsubscribed: boolean; checkError: string | null }

async function checkSuppressions(email: string, apiKey: string): Promise<SuppressionStatus> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const enc = encodeURIComponent(email);
  try {
    const [bounces, blocks, invalid, spam, global] = await Promise.all([
      fetch(`https://api.sendgrid.com/v3/suppression/bounces/${enc}`, { headers }),
      fetch(`https://api.sendgrid.com/v3/suppression/blocks/${enc}`, { headers }),
      fetch(`https://api.sendgrid.com/v3/suppression/invalid_emails/${enc}`, { headers }),
      fetch(`https://api.sendgrid.com/v3/suppression/spam_reports/${enc}`, { headers }),
      fetch(`https://api.sendgrid.com/v3/asm/suppressions/global/${enc}`, { headers }),
    ]);
    const hasEntries = async (r: Response) => { if (!r.ok) return false; const data = await r.json().catch(() => []); return Array.isArray(data) && data.length > 0; };
    return { bounced: await hasEntries(bounces), blocked: await hasEntries(blocks), invalid: await hasEntries(invalid), spamReported: await hasEntries(spam), globallyUnsubscribed: await hasEntries(global), checkError: null };
  } catch (e) {
    return { bounced: false, blocked: false, invalid: false, spamReported: false, globallyUnsubscribed: false, checkError: e instanceof Error ? e.message : 'suppression check failed' };
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const recipient = process.env.FOUNDER_DAILY_REPORT_EMAIL;
  if (!recipient) {
    return NextResponse.json({ error: 'FOUNDER_DAILY_REPORT_EMAIL is not configured' }, { status: 500 });
  }
  const sp = request.nextUrl.searchParams;
  const dryRun = sp.get('dryRun') === '1';
  const force = sp.get('force') === '1';
  const kind: 'daily' | 'test' = sp.get('kind') === 'test' ? 'test' : 'daily';
  const trigger = sp.get('trigger') ?? (kind === 'test' ? 'test' : 'cron');
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@tawveeri.com';
  const fromName = process.env.SENDGRID_FROM_NAME || 'Tawveeri';

  const email = await buildDailyEmail(new Date(), kind);
  const base = { report_date: email.reportDate, kind, recipient, subject: email.subject, summary_id: email.summaryId, trigger, scheduled_for: SCHEDULE_LABEL };

  // One email per day per kind — the guard is the log itself (partial unique index on status='sent').
  if (!force) {
    const prior = await alreadySentToday(email.reportDate, kind);
    if (prior) {
      await logSend({ ...base, status: 'skipped_duplicate', message_id: prior.message_id, provider_status: null, error: `already sent at ${prior.attempted_at}` });
      return NextResponse.json({ sent: false, skipped: 'already sent today', reportDate: email.reportDate, priorMessageId: prior.message_id, priorAttemptedAt: prior.attempted_at, subject: email.subject });
    }
  }

  if (dryRun) {
    await logSend({ ...base, status: 'dry_run', message_id: null, provider_status: null, error: null, html_snapshot: email.html });
    return NextResponse.json({ sent: false, dryRun: true, reportDate: email.reportDate, subject: email.subject, aiStatus: email.aiStatus, blocksUnavailable: email.blocksUnavailable, textPreview: email.text.slice(0, 1500) });
  }

  if (!apiKey) {
    await logSend({ ...base, status: 'not_configured', message_id: null, provider_status: null, error: 'SENDGRID_API_KEY is not configured', html_snapshot: email.html });
    return NextResponse.json({ sent: false, reason: 'SENDGRID_API_KEY is not configured', sendgridApiKeyPresent: false, subject: email.subject }, { status: 200 });
  }

  const suppression = await checkSuppressions(recipient, apiKey);
  const isSuppressed = suppression.bounced || suppression.blocked || suppression.invalid || suppression.spamReported || suppression.globallyUnsubscribed;
  const diagnostics = { sendgridApiKeyPresent: true, fromEmail, fromName, toEmail: recipient, suppression, aiStatus: email.aiStatus, blocksUnavailable: email.blocksUnavailable };
  if (isSuppressed) {
    await logSend({ ...base, status: 'suppressed', message_id: null, provider_status: null, error: JSON.stringify(suppression), html_snapshot: email.html });
    return NextResponse.json({ sent: false, reason: 'recipient is on a SendGrid suppression list — SendGrid would accept the send but never deliver it', subject: email.subject, ...diagnostics }, { status: 200 });
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }] }],
        from: { email: fromEmail, name: fromName },
        subject: email.subject,
        content: [{ type: 'text/plain', value: email.text }, { type: 'text/html', value: email.html }],
      }),
    });
    const messageId = response.headers.get('x-message-id');
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      await logSend({ ...base, status: 'failed', message_id: null, provider_status: response.status, error: body.slice(0, 500), html_snapshot: email.html });
      return NextResponse.json({ sent: false, sendgridStatus: response.status, error: `SendGrid ${response.status}`, detail: body.slice(0, 500), ...diagnostics }, { status: 502 });
    }
    const logId = await logSend({ ...base, status: 'sent', message_id: messageId, provider_status: response.status, error: null, html_snapshot: email.html });
    return NextResponse.json({ sent: true, sendgridStatus: response.status, messageId, reportDate: email.reportDate, subject: email.subject, logId, ...diagnostics, note: 'HTTP 202/message ID means SendGrid ACCEPTED the send, not that it was delivered — the founder_email_sends row is the send-of-record; final delivery is confirmed by the inbox.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'send failed';
    await logSend({ ...base, status: 'failed', message_id: null, provider_status: null, error: msg, html_snapshot: email.html }).catch(() => null);
    return NextResponse.json({ sent: false, error: msg, ...diagnostics }, { status: 500 });
  }
}
