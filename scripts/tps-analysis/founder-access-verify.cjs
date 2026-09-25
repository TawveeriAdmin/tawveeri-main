// Founder access verification: /founder short link, returnUrl safety, session-only cookies, mobile
// button. Cases: admin logged in, logged out, ordinary customer (a temporary account created and
// deleted inside this run), iPhone-Safari UA emulation + desktop Chrome. Read-mostly: the only
// writes are the temporary customer account and the security_alert audit row the middleware makes.
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const puppeteer = require('puppeteer');
const fs = require('fs');
const base = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
const dir = process.env.AUDIT_DIR || 'docs/evidence/founder-access-2026-09-25';
fs.mkdirSync(dir, { recursive: true });
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const out = { base, cases: [] };
const log = (o) => { out.cases.push(o); console.log(JSON.stringify(o)); };

async function sessionCookiesFor(admin, email) {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const cookies = [];
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: (v) => { cookies.splice(0, cookies.length, ...v); } } });
  const { error } = await client.auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token });
  if (error) throw new Error('verifyOtp failed: ' + error.message);
  return { cookies, client };
}

// Cookie mutation helpers: the @supabase/ssr cookie value is `base64-<base64url JSON session>`,
// possibly chunked across `.0`, `.1`… cookies. Forcing `expires_at` into the past makes the server
// client refresh the session on the next request, which is the only moment it re-sets auth
// cookies — exactly where the 30-day / session-only policy must show up in Set-Cookie.
function decodeSession(cookies) {
  const parts = cookies.filter((c) => c.name.startsWith('sb-') && c.name.includes('auth-token')).sort((a, b) => a.name.localeCompare(b.name));
  const joined = parts.map((c) => c.value).join('');
  const raw = joined.startsWith('base64-') ? Buffer.from(joined.slice(7), 'base64url').toString('utf8') : decodeURIComponent(joined);
  return { parts, session: JSON.parse(raw) };
}
function encodeSession(parts, session) {
  const value = 'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  if (parts.length === 1) return [{ name: parts[0].name, value }];
  const size = Math.ceil(value.length / parts.length);
  return parts.map((p, i) => ({ name: p.name, value: value.slice(i * size, (i + 1) * size) }));
}

async function visit(browser, { cookies = [], ua, mobile = false, url, label, shot }) {
  // A fresh, isolated context per case — cookies never leak between cases.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  if (ua) await page.setUserAgent(ua);
  await page.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
  if (cookies.length) await page.setCookie(...cookies.map((c) => ({ name: c.name, value: c.value, url: base, path: '/' })));
  const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  const finalUrl = page.url();
  const text = await page.evaluate(() => document.body.innerText);
  const mobileButton = await page.evaluate(() => !![...document.querySelectorAll('a')].find((a) => a.textContent && a.textContent.includes('مركز قرارات المؤسس') && getComputedStyle(a).display !== 'none'));
  if (shot) await page.screenshot({ path: `${dir}/${shot}.png`, fullPage: false });
  const result = { label, status: res && res.status(), finalUrl: finalUrl.replace(base, ''), leaksAdminData: /متصفحات أظهرت|الخروج المرتبط|founder_expenses/.test(text) && !finalUrl.includes('/admin/founder'), mobileButtonVisible: mobileButton };
  await context.close();
  return result;
}

/** Force a server-side token refresh and inspect the Set-Cookie policy the middleware applies. */
async function cookiePolicyCase(browser, cookies, sessionOnly) {
  const { parts, session } = decodeSession(cookies);
  const expired = { ...session, expires_at: Math.floor(Date.now() / 1000) - 120, expires_in: 0 };
  const rewritten = encodeSession(parts, expired);
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setCookie(...rewritten.map((c) => ({ ...c, url: base, path: '/' })), ...(sessionOnly ? [{ name: 'tw_session_only', value: '1', url: base, path: '/' }] : []));
  const setCookies = [];
  page.on('response', (r) => { const h = r.headers()['set-cookie']; if (h) setCookies.push(...h.split(/\n/)); });
  await page.goto(`${base}/founder`, { waitUntil: 'networkidle2', timeout: 120000 });
  const finalUrl = page.url().replace(base, '');
  const sb = setCookies.filter((c) => /^sb-/.test(c) && !/Max-Age=0/.test(c));
  const maxAges = sb.map((c) => { const m = c.match(/Max-Age=(\d+)/i); return m ? Number(m[1]) : null; });
  await context.close();
  return { label: `cookie policy after forced refresh (${sessionOnly ? 'session-only' : 'remembered'})`, finalUrl, refreshedCookies: sb.length, maxAgeDays: maxAges.map((s) => (s == null ? 'session' : Math.round(s / 86400))), allSameSiteLax: sb.every((c) => /SameSite=Lax/i.test(c)), secureFlag: sb.map((c) => /;\s*Secure/i.test(c)) };
}

(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: founder } = await admin.from('users').select('email').eq('role', 'admin').limit(1).single();
  const founderSession = await sessionCookiesFor(admin, founder.email);
  // temporary ordinary customer
  const tempEmail = `founder-access-e2e-${Date.now()}@tawveeri.local`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email: tempEmail, email_confirm: true, user_metadata: { full_name: 'E2E customer' } });
  if (cErr) throw cErr;
  await admin.from('users').upsert({ id: created.user.id, email: tempEmail, role: 'customer', full_name: 'E2E customer' }, { onConflict: 'id' });
  const customerSession = await sessionCookiesFor(admin, tempEmail);
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--lang=ar'] });
    log(await visit(browser, { cookies: founderSession.cookies, url: `${base}/founder`, label: 'founder logged in — desktop Chrome', shot: 'founder-desktop' }));
    log(await visit(browser, { cookies: founderSession.cookies, url: `${base}/founder`, label: 'founder logged in — iPhone Safari UA', ua: IPHONE_UA, mobile: true, shot: 'founder-iphone' }));
    log(await visit(browser, { cookies: founderSession.cookies, url: `${base}/ar/admin/command-center`, label: 'founder on another admin page — mobile button present', ua: IPHONE_UA, mobile: true, shot: 'admin-mobile-button' }));
    log(await visit(browser, { url: `${base}/founder`, label: 'logged out → login with return path', shot: 'logged-out' }));
    log(await visit(browser, { cookies: customerSession.cookies, url: `${base}/founder`, label: 'ordinary customer → unauthorized', shot: 'customer' }));
    log(await visit(browser, { cookies: customerSession.cookies, url: `${base}/ar/admin/founder`, label: 'ordinary customer direct URL → unauthorized' }));
    // returnUrl safety: an already-logged-in founder hitting login with an external redirect must never leave the origin
    for (const bad of ['https://evil.example', '//evil.example', '/%2F%2Fevil.example']) {
      log(await visit(browser, { cookies: founderSession.cookies, url: `${base}/ar/auth/login?redirect=${encodeURIComponent(bad)}`, label: `login redirect=${bad} (founder session)` }));
    }
    log(await visit(browser, { cookies: founderSession.cookies, url: `${base}/ar/auth/login?redirect=%2Fadmin%2Ffounder`, label: 'login redirect=/admin/founder (founder session) → honoured' }));
    // cookie policy: after a forced server-side refresh, remembered ≤ 30 days; session-only has no Max-Age
    log(await cookiePolicyCase(browser, founderSession.cookies, false));
    log(await cookiePolicyCase(browser, founderSession.cookies, true));
  } finally {
    if (browser) await browser.close();
    await founderSession.client.auth.signOut({ scope: 'local' }).catch(() => {});
    await customerSession.client.auth.signOut({ scope: 'global' }).catch(() => {});
    await admin.from('users').delete().eq('id', created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    out.cleanup = { tempUserDeleted: true, tempEmail: tempEmail.replace(/e2e-\d+/, 'e2e-<ts>') };
    fs.writeFileSync(`${dir}/verification.json`, JSON.stringify(out, null, 2));
  }
  console.log(JSON.stringify({ done: true, cases: out.cases.length }));
})().catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
