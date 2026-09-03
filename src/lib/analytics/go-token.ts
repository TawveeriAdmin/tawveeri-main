// src/lib/analytics/go-token.ts
// 2026-09-03 incident fix (root-fix design, /go redirect-flood investigation): a short-lived,
// server-signed token binding a `/go/<offerId>` link to the SPECIFIC offer it was rendered
// for — same proven pattern as src/lib/campaigns/click-token.ts (Campaign V1's anti-forgery
// token), generalized for the general storefront `/go` exit path instead of duplicated.
//
// WHAT THIS PROVES, AND WHAT IT DOES NOT. Issued server-side at RENDER time (when a product
// card / comparison row / advisor answer resolves its `/go/<id>` href) and embedded in that
// href as `?gt=<token>`. A request to `/go` carrying a valid, unexpired token for the SAME
// offerId is evidence the link was rendered by our own server for that exact offer — it rules
// out ID enumeration/guessing and stale/copied links surviving past their window. It does NOT
// cryptographically prove a human clicked (a client that fetches a real rendered page can read
// the token out of the HTML and replay it) — same disclosed limitation as click-token.ts. The
// goal is only what ADR-282's own comment already states for the analogous case: raise the bar
// above "a bare GET increments a metric," not build a CAPTCHA. Never gates the redirect itself
// — see the NON-NEGOTIABLE rule below.
//
// NON-NEGOTIABLE (incident finding): navigation fail-open, analytics fail-closed. A missing or
// invalid token must never block, delay, or alter the merchant redirect — only change how the
// resulting outbound_clicks row is CLASSIFIED (`interaction_provenance`). Losing the classification
// signal is acceptable; losing a real shopper's redirect is not.
import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes — long enough for a shopper comparing tabs/stores before exiting

function secret(): string {
  // Same fallback rationale as click-token.ts: a private, already-rotatable secret this app
  // holds, never a new credential whose only job is "did our own server issue this recently."
  return process.env.GO_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'tawveeri-go-token-dev-secret';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Issue a token binding a click to a specific `/go/<offerId>` path segment, valid for TOKEN_TTL_MS. */
export function issueGoToken(offerId: string, now: Date = new Date()): string {
  const issuedAt = now.getTime();
  const payload = `${offerId}.${issuedAt}`;
  return `${issuedAt}.${sign(payload)}`;
}

export interface GoTokenVerification {
  valid: boolean;
  reason?: 'malformed' | 'expired' | 'bad_signature';
}

/** Verify a token was issued for `offerId` and has not expired. Never throws. */
export function verifyGoToken(offerId: string, token: string | null | undefined, now: Date = new Date()): GoTokenVerification {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [issuedAtStr, signature] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return { valid: false, reason: 'malformed' };
  if (now.getTime() - issuedAt > TOKEN_TTL_MS || now.getTime() < issuedAt) return { valid: false, reason: 'expired' };

  const expected = sign(`${offerId}.${issuedAt}`);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return { valid: false, reason: 'bad_signature' };
  return timingSafeEqual(expectedBuf, actualBuf) ? { valid: true } : { valid: false, reason: 'bad_signature' };
}
