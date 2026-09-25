// src/lib/auth/founder-shortcut.ts — pure decision logic for the founder's short link
// (`/founder`) and for safe post-login return paths. Edge-safe (no Node APIs) so the middleware
// can import it; unit-tested in tests/auth/founder-shortcut.test.ts.

export const FOUNDER_TARGET = '/admin/founder';

/** Same-origin, path-only redirect targets. Rejects absolute URLs, protocol-relative `//host`,
 *  backslash tricks and anything not starting with a single `/`. Returns null when unsafe. */
export function safeRelativePath(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim();
  try { s = decodeURIComponent(s); } catch { return null; }
  if (!s.startsWith('/')) return null;
  if (s.startsWith('//') || s.startsWith('/\\') || /[\r\n]/.test(s)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(s)) return null;
  return s.replace(/^\/+/, '/');
}

export type ShortcutDecision =
  | { kind: 'target'; path: string }
  | { kind: 'login'; path: string }
  | { kind: 'unauthorized'; path: string };

export function resolveFounderShortcut(input: { hasUser: boolean; role: string | null; locale: 'ar' | 'en' }): ShortcutDecision {
  const target = `/${input.locale}${FOUNDER_TARGET}`;
  if (!input.hasUser) return { kind: 'login', path: `/${input.locale}/auth/login?redirect=${encodeURIComponent(FOUNDER_TARGET)}` };
  if (input.role === 'admin') return { kind: 'target', path: target };
  return { kind: 'unauthorized', path: `/${input.locale}/unauthorized` };
}

/** Session lifetime policy: 30 days maximum, and a session-only cookie when the person did NOT
 *  tick «تذكر هذا الجهاز» (the `tw_session_only` marker cookie is present). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_ONLY_COOKIE = 'tw_session_only';

export function applySessionCookiePolicy<T extends Record<string, unknown>>(options: T, sessionOnly: boolean): T {
  const next: Record<string, unknown> = { ...options, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' };
  if (sessionOnly) { delete next.maxAge; delete next.expires; }
  else if (typeof next.maxAge === 'number' && next.maxAge > SESSION_MAX_AGE_SECONDS) next.maxAge = SESSION_MAX_AGE_SECONDS;
  else if (next.maxAge == null && !('expires' in next)) next.maxAge = SESSION_MAX_AGE_SECONDS;
  return next as T;
}
