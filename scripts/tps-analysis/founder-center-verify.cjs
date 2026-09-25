// Founder Operating Center — end-to-end verification (ADR-383).
// Isolated admin session via magic link (in memory, no mail), tw_test cookie on every request so
// every usage event this run produces is is_test=true. Ledger rows it creates are prefixed
// "E2E-VERIFY" and soft-deleted at the end (they stay in founder_ledger_audit by design).
// Usage: AUDIT_BASE_URL=http://localhost:3000 node scripts/tps-analysis/founder-center-verify.cjs
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { Client } = require('pg');
const base = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
const dir = process.env.AUDIT_DIR || 'docs/evidence/founder-center-2026-09-25';
fs.mkdirSync(dir, { recursive: true });
const out = { base, startedAt: new Date().toISOString(), pages: [], api: [], journey: {}, cron: null, cleanup: [] };
const log = (o) => console.log(JSON.stringify(o));

(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: founder, error } = await admin.from('users').select('email').eq('role', 'admin').limit(1).single();
  if (error || !founder?.email) throw Error('admin account unavailable');
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: founder.email });
  if (linkError) throw Error('magic link failed');
  const cookies = [];
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => cookies, setAll: (v) => { cookies.splice(0, cookies.length, ...v); } } });
  const { error: authError } = await client.auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token });
  if (authError) throw Error('session verification failed');
  const cookieHeader = [...cookies.map((c) => `${c.name}=${c.value}`), 'tw_test=1'].join('; ');

  const api = async (method, path, body, form) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookieHeader, ...(form ? {} : { 'content-type': 'application/json' }), 'x-tw-test': '1' }, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    out.api.push({ method, path, status: res.status, ok: res.ok, sample: typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 400) });
    log({ method, path, status: res.status });
    return { res, data };
  };

  // ── 0. Pages first (clean state: no E2E ledger rows yet), desktop + mobile ─
  const runStartedAt = new Date().toISOString();
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--lang=ar'] });
    const page = await browser.newPage();
    await page.setCookie(...cookies.map((c) => ({ name: c.name, value: c.value, url: base, path: '/' })), { name: 'tw_test', value: '1', url: base, path: '/' });
    const errors = []; page.on('pageerror', (e) => errors.push(String(e.message)));
    const routes = process.env.AUDIT_ROUTES ? process.env.AUDIT_ROUTES.split(',') : ['founder?w=30d', 'founder/audience?w=30d', 'founder/demand?w=30d', 'founder/referrals?w=30d', 'founder/expenses?w=30d', 'founder/revenue?w=30d', 'founder/goals?w=30d', 'founder/summary?w=7d', 'founder/reports?kind=founder&w=30d', 'founder/reports?kind=store&store=extra&w=30d', 'founder/reports?kind=investor&w=30d'];
    for (const route of routes) {
      await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
      const t0 = Date.now();
      const response = await page.goto(`${base}/ar/admin/${route}`, { waitUntil: 'networkidle2', timeout: 180000 });
      await page.waitForNetworkIdle({ idleTime: 700, timeout: 60000 }).catch(() => {});
      const slug = route.replace(/[?&=]/g, '-').replaceAll('/', '_');
      const text = await page.evaluate(() => document.body.innerText);
      fs.writeFileSync(`${dir}/${slug}.txt`, text.replaceAll(founder.email, '[founder email]'));
      await page.screenshot({ path: `${dir}/${slug}-desktop.png`, fullPage: true });
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      await page.waitForNetworkIdle({ idleTime: 300, timeout: 10000 }).catch(() => {});
      const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await page.screenshot({ path: `${dir}/${slug}-mobile.png`, fullPage: true });
      const rec = { route, status: response?.status(), ms: Date.now() - t0, mobileOverflow, showsUnknownNotZero: /غير معلوم/.test(text), statementTimeout: /statement timeout/.test(text), pageErrors: errors.splice(0), textChars: text.length };
      out.pages.push(rec); log(rec);
    }
    if (process.env.AUDIT_PAGES_ONLY === '1') { await browser.close(); browser = null; await client.auth.signOut({ scope: 'local' }); fs.writeFileSync(`${dir}/verification-pages-only.json`, JSON.stringify(out, null, 2)); log({ done: true, pagesOnly: true }); return; }

    // ── Public journey with query_id linking (test mode): search → compare page → exit click ─
    const jp = await browser.newPage();
    await jp.setCookie({ name: 'tw_test', value: '1', url: base, path: '/' });
    await jp.setViewport({ width: 390, height: 844 });
    await jp.goto(`${base}/ar/search?q=${encodeURIComponent('مكيف')}&test=1`, { waitUntil: 'networkidle2', timeout: 180000 });
    await jp.waitForNetworkIdle({ idleTime: 1500, timeout: 60000 }).catch(() => {});
    const sid = await jp.evaluate(() => localStorage.getItem('tw_sid'));
    const qid = await jp.evaluate(() => sessionStorage.getItem('tw_qid'));
    out.journey.search = { sessionMinted: !!sid, queryIdMinted: !!qid };
    const compareHref = await jp.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/compare/"], a[href*="/products/"]')][0]; return a ? a.getAttribute('href') : null; });
    const target = compareHref ? new URL(compareHref, base).toString() : `${base}/ar/compare/${encodeURIComponent('lg|split|NO_SERIES|18000|Inverter|cool_only')}`;
    await jp.setRequestInterception(true);
    jp.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:')) r.abort(); else r.continue(); });
    await jp.goto(target, { waitUntil: 'networkidle2', timeout: 180000 }).catch(() => {});
    await jp.waitForNetworkIdle({ idleTime: 1200, timeout: 30000 }).catch(() => {});
    const qidAfter = await jp.evaluate(() => sessionStorage.getItem('tw_qid'));
    const clicked = await jp.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/go/"]')][0]; if (!a) return null; a.click(); return a.getAttribute('href'); });
    await new Promise((r) => setTimeout(r, 3500));
    out.journey.compare = { target, queryIdPersisted: qidAfter === qid, exitClicked: clicked };
    await jp.close();
    await new Promise((r) => setTimeout(r, 2500));
    if (sid) {
      const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
      await c.connect(); await c.query('BEGIN READ ONLY');
      const ev = (await c.query("select event_type, is_test, meta->>'query_id' qid, meta->>'result_set_id' rsid from usage_events where session_id=$1 and created_at > now()-interval '15 minutes' order by created_at", [sid])).rows;
      const fpi = (await c.query("select interaction_id, query_id, is_test from first_party_interactions where session_id=$1 and created_at > now()-interval '15 minutes'", [sid])).rows;
      const oc = (await c.query("select interaction_id, is_test from outbound_clicks where session_id=$1 and clicked_at > now()-interval '15 minutes'", [sid])).rows;
      await c.query('ROLLBACK'); await c.end();
      const searchQ = ev.find((e) => e.event_type === 'search')?.qid ?? null;
      const linkedTypes = new Set(['results', 'product_view', 'comparison_view', 'go_click', 'category_go_click', 'return_to_decision', 'evidence_view', 'alternative_view', 'no_answer', 'error']);
      out.journey.linking = { events: ev, interactions: fpi, outbound: oc, allTest: ev.every((e) => e.is_test) && fpi.every((i) => i.is_test) && oc.every((o) => o.is_test), sameQueryIdAcrossJourney: !!searchQ && ev.filter((e) => linkedTypes.has(e.event_type)).every((e) => e.qid === searchQ), interactionCarriesQueryId: fpi.length ? fpi.every((i) => i.query_id === searchQ) : null, exitLinkedToInteraction: oc.length && fpi.length ? oc.some((o) => fpi.some((i) => i.interaction_id === o.interaction_id)) : null };
    }
  } finally { if (browser) await browser.close(); }

  // ── 1. Ledger journey ──────────────────────────────────────────────────
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const exp = await api('POST', '/api/admin/founder/expenses', { vendor: 'E2E-VERIFY Railway', description: 'verification row', category: 'hosting', service_period_start: today, service_period_end: today, paid_at: today, amount_original: 37.5, currency: 'SAR', fees: 0, tax: 5.63, recurrence: 'monthly', renewal_at: today, evidence_state: 'documented', evidence_ref: 'e2e' });
  const expId = exp.data?.id;
  const bad = await api('POST', '/api/admin/founder/expenses', { vendor: '', category: 'nope', service_period_start: 'x', amount_original: 'x' });
  out.journey.validationRejected = bad.res.status === 400 && !!bad.data?.fieldErrors;
  const usd = await api('POST', '/api/admin/founder/expenses', { vendor: 'E2E-VERIFY Anthropic', category: 'ai', service_period_start: today, paid_at: today, amount_original: 10, currency: 'USD' });
  const usdId = usd.data?.id;
  if (expId) await api('PATCH', `/api/admin/founder/expenses/${expId}`, { description: 'verification row (edited)', note: 'e2e edit' });
  const csv = 'المورد,الوصف,الفئة,تاريخ الدفع,المبلغ,العملة\nE2E-VERIFY CSV Vendor,سطر مستورد,استضافة,01/09/2026,12.25,SAR\nE2E-VERIFY CSV Vendor,سطر مستورد,استضافة,01/09/2026,12.25,SAR\nE2E-VERIFY Bad,,غير معروف,01/09/2026,abc,SAR';
  const mkForm = (dry) => { const f = new FormData(); f.append('file', new Blob([csv], { type: 'text/csv' }), 'e2e.csv'); if (dry) f.append('dryRun', '1'); return f; };
  const dry = await api('POST', '/api/admin/founder/expenses/import', undefined, mkForm(true));
  const real = await api('POST', '/api/admin/founder/expenses/import', undefined, mkForm(false));
  const again = await api('POST', '/api/admin/founder/expenses/import', undefined, mkForm(false));
  out.journey.import = { dry: dry.data, real: { imported: real.data?.wouldImport, skipped: real.data?.skippedDuplicates, rejected: real.data?.rejectedRows }, again: again.data?.alreadyImported === true };
  const rev = await api('POST', '/api/admin/founder/revenue', { source: 'amazon_associates', state: 'confirmed', commission_amount: 3.75, currency: 'SAR', unit: 'item', quantity: 1, period_start: today, period_end: today, approved_at: today, report_ref: 'E2E-VERIFY report', notes: 'E2E-VERIFY' });
  const revId = rev.data?.id;
  const revBad = await api('POST', '/api/admin/founder/revenue', { source: 'noon_affiliate', state: 'paid', commission_amount: 1, period_start: today });
  out.journey.revenueValidationRejected = revBad.res.status === 400;
  const fund = await api('POST', '/api/admin/founder/funding', { amount: 100, funded_at: today, note: 'E2E-VERIFY' });
  const fundId = fund.data?.id;
  const goal = await api('POST', '/api/admin/founder/goals', { month: today.slice(0, 7) + '-01', metric_id: 'S02', definition_version: '2026-09-25.1', target_value: 100, rationale: 'E2E-VERIFY goal', baseline_value: 80 });
  const goalId = goal.data?.id;
  if (goalId) { await api('PATCH', `/api/admin/founder/goals/${goalId}`, { target_value: 110, reason: 'E2E-VERIFY revision' }); }
  const goalNoReason = goalId ? await api('PATCH', `/api/admin/founder/goals/${goalId}`, { target_value: 120 }) : null;
  out.journey.goalEditWithoutReasonRejected = goalNoReason ? goalNoReason.res.status === 400 : null;
  await api('PATCH', '/api/admin/founder/settings', { summary_hour_riyadh: 8 });
  const settingsBad = await api('PATCH', '/api/admin/founder/settings', { summary_hour_riyadh: 99 });
  out.journey.settingsValidationRejected = settingsBad.res.status === 400;
  const summary = await api('POST', '/api/admin/founder/summary', { w: '7d', withAi: true });
  out.journey.summary = { status: summary.res.status, aiStatus: summary.data?.summary?.aiStatus, aiReason: summary.data?.summary?.aiReason, facts: summary.data?.summary?.deterministic?.facts?.length, decisions: summary.data?.summary?.deterministic?.decisionsAr };
  const expJson = await api('GET', '/api/admin/founder/export?kind=founder&w=7d&format=json');
  const expCsv = await api('GET', '/api/admin/founder/export?kind=investor&w=30d&format=csv');
  const expStore = await api('GET', '/api/admin/founder/export?kind=store&store=extra&w=30d&format=json');
  out.journey.exports = { founderSections: expJson.data?.sections?.length, investorCsvBytes: typeof expCsv.data === 'string' ? expCsv.data.length : null, storeTitle: expStore.data?.titleAr };
  if (typeof expCsv.data === 'string') fs.writeFileSync(`${dir}/investor-report-30d.csv`, expCsv.data);
  fs.writeFileSync(`${dir}/founder-report-7d.json`, JSON.stringify(expJson.data, null, 2));
  const unauth = await fetch(`${base}/api/admin/founder/expenses`); out.journey.unauthenticatedBlocked = unauth.status === 403;

  // ── 2. Cron route (forced) ──────────────────────────────────────────────
  const cron = await fetch(`${base}/api/cron/founder-daily?force=1`, { method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  out.cron = { status: cron.status, body: await cron.json().catch(() => null) };
  const cronNoAuth = await fetch(`${base}/api/cron/founder-daily`, { method: 'POST' }); out.cron.unauthorizedBlocked = cronNoAuth.status === 401;

  // ── 3. Cleanup (soft deletes; audit rows remain) ────────────────────────
  for (const [path, id] of [['/api/admin/founder/expenses/', expId], ['/api/admin/founder/expenses/', usdId], ['/api/admin/founder/revenue/', revId]]) {
    if (id) { const r = await api('DELETE', `${path}${id}?note=e2e%20cleanup`); out.cleanup.push({ path, id, status: r.res.status }); }
  }
  if (fundId) out.cleanup.push({ path: '/api/admin/founder/funding', id: fundId, status: (await api('DELETE', `/api/admin/founder/funding?id=${fundId}`)).res.status });
  if (goalId) out.cleanup.push({ path: '/api/admin/founder/goals/', id: goalId, status: (await api('DELETE', `/api/admin/founder/goals/${goalId}?reason=e2e%20cleanup`)).res.status });
  // imported CSV rows: soft-delete by vendor prefix (server-side, service role) so no E2E row leaks into totals
  const { data: imported } = await admin.from('founder_expenses').select('id').like('vendor', 'E2E-VERIFY%').is('deleted_at', null);
  for (const r of imported ?? []) { const d = await api('DELETE', `/api/admin/founder/expenses/${r.id}?note=e2e%20cleanup`); out.cleanup.push({ path: 'import', id: r.id, status: d.res.status }); }
  // The on-demand summary generated while E2E rows existed embeds their test amounts — remove it
  // (daily/monthly summaries from the forced cron run are real data and are kept).
  const { data: testSummaries } = await admin.from('founder_summaries').select('id').eq('kind', 'on_demand').gte('generated_at', runStartedAt);
  for (const s of testSummaries ?? []) { await admin.from('founder_summaries').delete().eq('id', s.id); out.cleanup.push({ path: 'founder_summaries', id: s.id, status: 'deleted' }); }
  await client.auth.signOut({ scope: 'local' });
  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${dir}/verification.json`, JSON.stringify(out, null, 2));
  log({ done: true, pages: out.pages.length, apiCalls: out.api.length, cleanup: out.cleanup.length });
})().catch((e) => { console.error(e.stack || e.message); fs.writeFileSync(`${dir}/verification.json`, JSON.stringify({ ...out, fatal: e.message }, null, 2)); process.exitCode = 1; });
