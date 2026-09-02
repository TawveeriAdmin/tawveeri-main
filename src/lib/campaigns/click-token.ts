// src/lib/campaigns/click-token.ts
// Minimal anti-forgery token for campaign-click ingestion (Final Closure Round §3).
//
// WHY THIS EXISTS: under the new direct-link click architecture, the affiliate URL is
// built and embedded in the page at IMPRESSION time (server render / eligible-campaigns
// API response), not at click time — there is no more `/go/campaign/[id]` redirect a
// crawler could increment just by requesting a URL. But `/api/campaigns/click` is still
// a plain POST endpoint, so without SOME binding to a real impression, a bot could still
// script arbitrary POSTs to it. This token is the minimal fix: a short-lived, server-signed
// value handed out ONLY alongside a real eligible-campaign response, which the click
// endpoint verifies before writing to campaign_clicks. It is NOT a security boundary
// against a determined attacker (a bot can still fetch the eligible-campaigns response
// and then replay its token) — it only raises the bar above "bare GET increments a
// metric," which was the exact `/go` anomaly shape. Deliberately NOT a full CAPTCHA/
// ad-tech system: no DB row, no session, HMAC-only, verified in one pure function.
import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes — generous enough for a slow read, short enough to bound replay

function secret(): string {
  // Falls back to the service-role key (already a private, rotatable secret this app
  // holds) rather than requiring a NEW env var for a token whose only job is "was this
  // issued by us, recently" — never used as a cryptographic identity, never logged.
  return process.env.CAMPAIGN_CLICK_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'tawveeri-campaign-click-dev-secret';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Issue a token binding a click event to a specific campaign, valid for TOKEN_TTL_MS. */
export function issueClickToken(campaignId: string, now: Date = new Date()): string {
  const issuedAt = now.getTime();
  const payload = `${campaignId}.${issuedAt}`;
  return `${issuedAt}.${sign(payload)}`;
}

export interface TokenVerification {
  valid: boolean;
  reason?: 'malformed' | 'expired' | 'bad_signature';
}

/** Verify a token was issued for `campaignId` and has not expired. Never throws. */
export function verifyClickToken(campaignId: string, token: string | null | undefined, now: Date = new Date()): TokenVerification {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [issuedAtStr, signature] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return { valid: false, reason: 'malformed' };
  if (now.getTime() - issuedAt > TOKEN_TTL_MS || now.getTime() < issuedAt) return { valid: false, reason: 'expired' };

  const expected = sign(`${campaignId}.${issuedAt}`);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return { valid: false, reason: 'bad_signature' };
  return timingSafeEqual(expectedBuf, actualBuf) ? { valid: true } : { valid: false, reason: 'bad_signature' };
}
