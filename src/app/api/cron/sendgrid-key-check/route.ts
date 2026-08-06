// GET /api/cron/sendgrid-key-check — SendGrid key rotation audit (2026-08-06, security incident
// closeout). Read-only, sends NO email, NEVER prints/logs the key itself. Confirms which scope
// profile the currently-configured SENDGRID_API_KEY actually has in the running production
// service, so key rotation can be verified without ever displaying the secret. Bearer
// CRON_SECRET auth, same convention as every other /api/cron/* route.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ sendgridApiKeyPresent: false }, { status: 200 });
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/scopes', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return NextResponse.json({
        sendgridApiKeyPresent: true,
        keyValid: false,
        sendgridStatus: res.status,
      }, { status: 200 });
    }
    const data = await res.json().catch(() => null) as { scopes?: string[] } | null;
    const scopes = data?.scopes ?? [];
    return NextResponse.json({
      sendgridApiKeyPresent: true,
      keyValid: true,
      scopeCount: scopes.length,
      scopes, // scope NAMES only (e.g. "mail.send") — never the key value
      isMailSendOnlyProfile: scopes.length > 0 && scopes.every((s) => s.startsWith('mail.send')),
    });
  } catch (error) {
    return NextResponse.json({ sendgridApiKeyPresent: true, keyValid: null, error: error instanceof Error ? error.message : 'check failed' }, { status: 200 });
  }
}
