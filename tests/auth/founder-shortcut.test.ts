import { safeRelativePath, resolveFounderShortcut, applySessionCookiePolicy, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/founder-shortcut';

describe('safeRelativePath', () => {
  it('accepts a plain same-origin path', () => expect(safeRelativePath('/admin/founder')).toBe('/admin/founder'));
  it('rejects absolute and protocol-relative targets', () => {
    for (const bad of ['https://evil.com', 'http://evil.com/x', '//evil.com', '/\\evil.com', '/%2F%2Fevil.com', 'javascript:alert(1)', '/javascript:alert(1)', '']) expect(safeRelativePath(bad)).toBeNull();
  });
  it('collapses leading slashes and rejects CRLF', () => {
    expect(safeRelativePath('///admin')).toBeNull();
    expect(safeRelativePath('/admin\r\nSet-Cookie: x')).toBeNull();
  });
});

describe('resolveFounderShortcut', () => {
  it('logged-out → login with a safe return path', () => expect(resolveFounderShortcut({ hasUser: false, role: null, locale: 'ar' })).toEqual({ kind: 'login', path: '/ar/auth/login?redirect=%2Fadmin%2Ffounder' }));
  it('admin → founder center', () => expect(resolveFounderShortcut({ hasUser: true, role: 'admin', locale: 'ar' }).path).toBe('/ar/admin/founder'));
  it('customer → unauthorized page', () => expect(resolveFounderShortcut({ hasUser: true, role: 'customer', locale: 'ar' }).kind).toBe('unauthorized'));
});

describe('applySessionCookiePolicy', () => {
  it('caps a 400-day cookie at 30 days and forces sameSite=lax', () => {
    const o = applySessionCookiePolicy<Record<string, unknown>>({ maxAge: 400 * 86400, path: '/' }, false);
    expect(o.maxAge).toBe(SESSION_MAX_AGE_SECONDS); expect(o.sameSite).toBe('lax');
  });
  it('session-only removes maxAge/expires entirely', () => {
    const o = applySessionCookiePolicy({ maxAge: 3600, expires: new Date(), path: '/' }, true) as Record<string, unknown>;
    expect('maxAge' in o).toBe(false); expect('expires' in o).toBe(false);
  });
});
