// POST /api/cron/daily-founder-report — sends the Arabic daily founder summary (ADR-216).
// Bearer CRON_SECRET auth, same convention as every other /api/cron/* route. Recipient comes
// from FOUNDER_DAILY_REPORT_EMAIL — never hardcoded in client code, never exposed in a response.
// Intended trigger: a Railway Cron Job hitting this route once daily. Read-only over governed
// metrics; sends one email, no writes.
import { NextRequest, NextResponse } from 'next/server';
import { generateDailyFounderReport } from '@/lib/admin/daily-report';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  const report = await generateDailyFounderReport();

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    // Finish the generator + endpoint even when the send can't happen yet (founder mandate:
    // don't block the rest of the task on a missing credential — report the exact gap instead).
    return NextResponse.json({
      sent: false,
      reason: 'SENDGRID_API_KEY is not configured',
      subject: report.subjectAr,
      hasActivity: report.hasActivity,
    }, { status: 200 });
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }] }],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'info@tawveeri.com',
          name: process.env.SENDGRID_FROM_NAME || 'Tawveeri',
        },
        subject: report.subjectAr,
        content: [{ type: 'text/html', value: report.html }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return NextResponse.json({ sent: false, error: `SendGrid ${response.status}`, detail: body.slice(0, 300) }, { status: 502 });
    }

    return NextResponse.json({ sent: true, subject: report.subjectAr, hasActivity: report.hasActivity });
  } catch (error) {
    return NextResponse.json({ sent: false, error: error instanceof Error ? error.message : 'send failed' }, { status: 500 });
  }
}
