// POST /api/cron/daily-founder-report — sends the Arabic daily founder summary (ADR-216).
// Bearer CRON_SECRET auth, same convention as every other /api/cron/* route. Recipient comes
// from FOUNDER_DAILY_REPORT_EMAIL — never hardcoded in client code. Intended trigger: a Railway
// Cron Job hitting this route once daily. Read-only over governed metrics; sends one email.
//
// Delivery diagnostics (2026-08-06 fix): the original version reported `sent:true` purely from
// SendGrid's HTTP response being 2xx — but /v3/mail/send returning 202 only means "accepted for
// delivery," not "delivered." It silently discarded the `X-Message-Id` header (the only handle
// for tracing the send afterward) and never checked whether the recipient is on a suppression
// list (bounced/blocked/invalid/spam-reported/unsubscribed) — SendGrid still returns 202 for a
// suppressed recipient and just never delivers it. This version checks suppression BEFORE
// sending and returns the message ID + real response status, so "sent:true" is actually
// verifiable instead of assumed. Never exposes the API key itself.
import { NextRequest, NextResponse } from 'next/server';
import { generateDailyFounderReport } from '@/lib/admin/daily-report';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SuppressionStatus {
  bounced: boolean;
  blocked: boolean;
  invalid: boolean;
  spamReported: boolean;
  globallyUnsubscribed: boolean;
  checkError: string | null;
}

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
    const hasEntries = async (r: Response) => {
      if (!r.ok) return false; // 404/other = not found in this list, not "unknown"
      const data = await r.json().catch(() => []);
      return Array.isArray(data) && data.length > 0;
    };
    return {
      bounced: await hasEntries(bounces),
      blocked: await hasEntries(blocks),
      invalid: await hasEntries(invalid),
      spamReported: await hasEntries(spam),
      globallyUnsubscribed: await hasEntries(global),
      checkError: null,
    };
  } catch (e) {
    return { bounced: false, blocked: false, invalid: false, spamReported: false, globallyUnsubscribed: false, checkError: e instanceof Error ? e.message : 'suppression check failed' };
  }
}

async function checkSenderVerified(fromEmail: string, apiKey: string): Promise<boolean | null> {
  try {
    const res = await fetch('https://api.sendgrid.com/v3/verified_senders', { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) return null; // account may use domain auth instead of single-sender verification — inconclusive, not a failure
    const data = await res.json().catch(() => null) as { results?: Array<{ from_email?: string; verified?: boolean }> } | null;
    const match = data?.results?.find((r) => r.from_email?.toLowerCase() === fromEmail.toLowerCase());
    return match ? Boolean(match.verified) : null; // not in single-sender list ⇒ likely domain-authenticated, inconclusive here
  } catch {
    return null;
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

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@tawveeri.com';
  const fromName = process.env.SENDGRID_FROM_NAME || 'Tawveeri';

  if (!apiKey) {
    const report = await generateDailyFounderReport();
    return NextResponse.json({
      sent: false,
      reason: 'SENDGRID_API_KEY is not configured',
      sendgridApiKeyPresent: false,
      subject: report.subjectAr,
      hasActivity: report.hasActivity,
    }, { status: 200 });
  }

  // Pre-flight: check the recipient against SendGrid's suppression lists BEFORE sending —
  // this is the most common reason a 202-accepted send never arrives.
  const [suppression, senderVerified, report] = await Promise.all([
    checkSuppressions(recipient, apiKey),
    checkSenderVerified(fromEmail, apiKey),
    generateDailyFounderReport(),
  ]);
  const isSuppressed = suppression.bounced || suppression.blocked || suppression.invalid || suppression.spamReported || suppression.globallyUnsubscribed;

  const diagnostics = {
    sendgridApiKeyPresent: true,
    fromEmail,
    fromName,
    toEmail: recipient,
    senderVerified, // true / false / null (inconclusive — likely domain-authenticated)
    suppression,
  };

  if (isSuppressed) {
    // Do not attempt to send to a suppressed address — SendGrid would accept the request (202)
    // and silently drop it, which is exactly the symptom being diagnosed. Report, don't guess-fix
    // by removing the suppression entry ourselves (that's an account-content decision).
    return NextResponse.json({
      sent: false,
      reason: 'recipient is on a SendGrid suppression list — SendGrid would accept the send but never deliver it',
      subject: report.subjectAr,
      hasActivity: report.hasActivity,
      ...diagnostics,
    }, { status: 200 });
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }] }],
        from: { email: fromEmail, name: fromName },
        subject: report.subjectAr,
        content: [{ type: 'text/html', value: report.html }],
      }),
    });

    const messageId = response.headers.get('x-message-id');

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return NextResponse.json({
        sent: false,
        sendgridStatus: response.status,
        error: `SendGrid ${response.status}`,
        detail: body.slice(0, 500),
        ...diagnostics,
      }, { status: 502 });
    }

    return NextResponse.json({
      sent: true,
      sendgridStatus: response.status,
      messageId,
      subject: report.subjectAr,
      hasActivity: report.hasActivity,
      ...diagnostics,
      note: 'HTTP 202/message ID means SendGrid ACCEPTED the send, not that it was delivered — check the SendGrid Activity Feed for this message ID to confirm final delivery status.',
    });
  } catch (error) {
    return NextResponse.json({ sent: false, error: error instanceof Error ? error.message : 'send failed', ...diagnostics }, { status: 500 });
  }
}
