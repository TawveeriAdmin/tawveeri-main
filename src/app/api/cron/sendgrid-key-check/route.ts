// /api/cron/sendgrid-key-check — SendGrid key rotation remediation (2026-08-06 security
// incident closeout, ticket #26429850). Sends NO email. NEVER prints/logs/returns any part of
// an API key SECRET — only SendGrid's own non-secret `api_key_id`/`name` metadata (the same
// fields SendGrid's own dashboard shows an admin), used purely to identify which account key is
// currently active without ever handling the credential itself. Bearer CRON_SECRET auth, same
// convention as every other /api/cron/* route.
//
// GET  — read-only diagnosis: self key identity (by non-secret id/name) + full account key list.
// POST — one explicit remediation action per call (?action=restrict-self | revoke-old), so each
//        step can be inspected before the next runs. Refuses to touch a key it cannot positively
//        identify, and refuses to ever revoke the key currently authenticating the very request.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Known from the exposed setup document (ADR-216/217 security audit) — a NAME, not a secret.
// Safe to reference: SendGrid key names are non-sensitive labels, same as what's shown in the
// account dashboard.
const COMPROMISED_KEY_NAME = 'Tawveeri-Mail';

interface SgKeyMeta { api_key_id: string; name: string }

function requireAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

// Extracts ONLY the non-secret ID segment from an "SG.<id>.<secret>" key string — the same
// identifier SendGrid's own `GET /v3/api_keys` list exposes as `api_key_id`. The secret segment
// is never read out of this function's return value.
function extractKeyId(rawKey: string): string | null {
  const parts = rawKey.split('.');
  return parts.length === 3 && parts[0] === 'SG' ? parts[1] : null;
}

async function listAccountKeys(apiKey: string): Promise<{ keys: SgKeyMeta[] | null; status: number }> {
  const res = await fetch('https://api.sendgrid.com/v3/api_keys', { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) return { keys: null, status: res.status };
  const data = await res.json().catch(() => null) as { result?: SgKeyMeta[] } | null;
  return { keys: data?.result ?? [], status: res.status };
}

async function identifySelf(apiKey: string) {
  const selfId = extractKeyId(apiKey);
  const { keys, status } = await listAccountKeys(apiKey);
  const selfEntry = selfId && keys ? keys.find((k) => k.api_key_id === selfId) ?? null : null;
  return {
    selfId, // non-secret identifier only
    selfName: selfEntry?.name ?? null,
    isCompromisedByName: selfEntry?.name === COMPROMISED_KEY_NAME,
    allKeys: keys?.map((k) => ({ id: k.api_key_id, name: k.name })) ?? null,
    listStatus: status,
  };
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return NextResponse.json({ sendgridApiKeyPresent: false }, { status: 200 });

  try {
    const [scopesRes, identity] = await Promise.all([
      fetch('https://api.sendgrid.com/v3/scopes', { headers: { Authorization: `Bearer ${apiKey}` } }),
      identifySelf(apiKey),
    ]);
    const scopesData = scopesRes.ok ? await scopesRes.json().catch(() => null) as { scopes?: string[] } | null : null;
    const scopes = scopesData?.scopes ?? [];

    return NextResponse.json({
      sendgridApiKeyPresent: true,
      keyValid: scopesRes.ok,
      scopeCount: scopes.length,
      scopes,
      isMailSendOnlyProfile: scopes.length > 0 && scopes.every((s) => s.startsWith('mail.send')),
      self: { id: identity.selfId, name: identity.selfName, isCompromisedByName: identity.isCompromisedByName },
      accountKeys: identity.allKeys, // [{id, name}] — non-secret metadata for every key in the account
    });
  } catch (error) {
    return NextResponse.json({ sendgridApiKeyPresent: true, keyValid: null, error: error instanceof Error ? error.message : 'check failed' }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'SENDGRID_API_KEY is not configured' }, { status: 500 });

  const action = request.nextUrl.searchParams.get('action');
  const identity = await identifySelf(apiKey);

  if (identity.isCompromisedByName) {
    // Refuse to modify or continue using a key identified as the compromised one — per the
    // explicit remediation rule: stop and report, never restrict-in-place, never touch further.
    return NextResponse.json({
      action,
      performed: false,
      reason: `The currently active key (id=${identity.selfId}) matches the compromised key name "${COMPROMISED_KEY_NAME}" — refusing to modify it.`,
      founderActionRequired: 'Create a brand-new SendGrid API key (Custom Access, mail.send only) in the SendGrid dashboard, update Railway SENDGRID_API_KEY to the new value, and redeploy. Do not restrict or reuse this key.',
    }, { status: 200 });
  }

  if (action === 'restrict-self') {
    if (!identity.selfId) {
      return NextResponse.json({ action, performed: false, reason: 'Could not determine the current key\'s non-secret ID from its format — refusing to guess which account key to modify.' }, { status: 200 });
    }
    const res = await fetch(`https://api.sendgrid.com/v3/api_keys/${identity.selfId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopes: ['mail.send'] }),
    });
    const body = await res.json().catch(() => null);
    return NextResponse.json({
      action,
      performed: res.ok,
      sendgridStatus: res.status,
      self: { id: identity.selfId, name: identity.selfName },
      resultScopes: res.ok ? body?.scopes : undefined,
      error: res.ok ? undefined : JSON.stringify(body).slice(0, 300),
    }, { status: 200 });
  }

  if (action === 'revoke-old') {
    const matches = (identity.allKeys ?? []).filter((k) => k.name === COMPROMISED_KEY_NAME && k.id !== identity.selfId);
    if (matches.length !== 1) {
      return NextResponse.json({
        action,
        performed: false,
        reason: matches.length === 0
          ? `No account key named "${COMPROMISED_KEY_NAME}" found (other than self) — it may already be removed.`
          : `Found ${matches.length} keys named "${COMPROMISED_KEY_NAME}" — refusing to guess which one; not an exact match.`,
        matchCount: matches.length,
      }, { status: 200 });
    }
    const target = matches[0];
    const res = await fetch(`https://api.sendgrid.com/v3/api_keys/${target.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return NextResponse.json({
      action,
      performed: res.status === 204,
      sendgridStatus: res.status,
      revoked: { id: target.id, name: target.name },
    }, { status: 200 });
  }

  return NextResponse.json({ error: 'Unknown or missing action. Use ?action=restrict-self or ?action=revoke-old.' }, { status: 400 });
}
