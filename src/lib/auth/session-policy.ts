// src/lib/auth/session-policy.ts — browser side of «تذكر هذا الجهاز».
// Remembered: the Supabase auth cookies keep the 30-day cap set in getBrowserClient().
// Not remembered (default, and the right choice on a shared/public device): mark the browser with
// the `tw_session_only` cookie (itself a session cookie) and re-set the auth cookies WITHOUT
// Max-Age so they die with the browser; the middleware/server clients see the marker and keep
// refreshed tokens session-only too. Nothing here weakens auth: the token values are unchanged.
import { SESSION_ONLY_COOKIE } from './founder-shortcut';

const secure = () => (typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '');

export function setRememberDevice(remember: boolean): void {
  if (typeof document === 'undefined') return;
  document.cookie = remember
    ? `${SESSION_ONLY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure()}`
    : `${SESSION_ONLY_COOKIE}=1; Path=/; SameSite=Lax${secure()}`;
}

/** Call once right after a successful sign-in when the device is NOT remembered. */
export function makeAuthCookiesSessionOnly(): void {
  if (typeof document === 'undefined') return;
  for (const part of document.cookie.split(';')) {
    const [rawName, ...rest] = part.split('=');
    const name = rawName.trim();
    if (!name.startsWith('sb-')) continue;
    document.cookie = `${name}=${rest.join('=')}; Path=/; SameSite=Lax${secure()}`;
  }
}
