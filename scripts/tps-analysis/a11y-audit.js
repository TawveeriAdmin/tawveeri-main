#!/usr/bin/env node
/**
 * P2-7 · WCAG 2.2 AA baseline harness.
 *
 * Measures the RENDERED artefact (hydrated DOM in a real browser), not a model of it —
 * the standing rule from CHECKPOINT #19. axe-core runs in-page after hydration, at two
 * viewports, in both locales.
 *
 * Read-only: it never issues GET /go/<id> (that route INSERTS into outbound_clicks) and
 * it never submits a form that writes.
 *
 *   node scripts/tps-analysis/a11y-audit.js                    # localhost:3000
 *   node scripts/tps-analysis/a11y-audit.js --base https://tawveeri.com
 *   node scripts/tps-analysis/a11y-audit.js --json
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const AXE_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../node_modules/axe-core/axe.min.js'),
  'utf8'
);

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const BASE = (flag('base', 'http://localhost:3000')).replace(/\/$/, '');
const AS_JSON = args.includes('--json');
const ONLY_ROUTE = flag('route', null);

// Customer-impact order, per the P2-7 entry point.
const ROUTES = [
  { id: 'home', path: (l) => `/${l}` },
  { id: 'search', path: (l) => `/${l}/search?q=${encodeURIComponent(l === 'ar' ? 'لابتوب' : 'laptop')}` },
  { id: 'compare-detail', path: () => `/ar/compare/${encodeURIComponent('apple|iPhone|15|Standard|128')}`, fixedLocale: true },
  { id: 'advisor', path: (l) => `/${l}/advisor` },
  { id: 'deals', path: (l) => `/${l}/deals` },
];

const VIEWPORTS = [
  { id: 'desktop', width: 1280, height: 900, isMobile: false },
  { id: 'mobile', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Both themes are shipped surfaces, so both are measured. next-themes reads this key.
const THEMES = args.includes('--light-only') ? ['light'] : ['light', 'dark'];

async function settle(page) {
  // Search and advisor fetch after hydration; give the client render a bounded window.
  try {
    await page.waitForNetworkIdle({ idleTime: 900, timeout: 25000 });
  } catch {
    /* bounded — a slow upstream must not abort the audit */
  }
  await new Promise((r) => setTimeout(r, 600));
}

async function runAxe(page) {
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(async (tags) => {
    const res = await window.axe.run(document, {
      runOnly: { type: 'tag', values: tags },
    });
    return {
      violations: res.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        tags: v.tags.filter((t) => t.startsWith('wcag')),
        count: v.nodes.length,
        nodes: v.nodes.slice(0, 6).map((n) => ({
          target: n.target.join(' '),
          summary: (n.failureSummary || '').split('\n').filter(Boolean).slice(1, 3).join(' | '),
          html: n.html.slice(0, 220),
        })),
        // Contrast failures are fixed at the COLOUR PAIR, not the node. Carry every node's
        // measured pair so 333 failing nodes collapse to the handful of tokens behind them.
        contrastPairs:
          v.id === 'color-contrast'
            ? v.nodes.map((n) => {
                const d = (n.any || []).find((c) => c.data && c.data.contrastRatio !== undefined);
                if (!d) return null;
                return {
                  fg: d.data.fgColor,
                  bg: d.data.bgColor,
                  ratio: d.data.contrastRatio,
                  expected: d.data.expectedContrastRatio,
                  fontSize: d.data.fontSize,
                  fontWeight: d.data.fontWeight,
                  html: n.html.slice(0, 160),
                };
              }).filter(Boolean)
            : undefined,
      })),
      // axe parks a rule in `incomplete` when it cannot decide alone — WCAG 2.2's
      // target-size (2.5.8) lands here routinely. Reporting only `violations` would let a
      // whole success criterion pass unexamined, so these are surfaced, not swallowed.
      incomplete: (res.incomplete || []).map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        count: v.nodes.length,
        nodes: v.nodes.slice(0, 4).map((n) => ({
          target: n.target.join(' '),
          html: n.html.slice(0, 160),
        })),
      })),
      passedRules: res.passes.map((p) => p.id),
    };
  }, TAGS);
}

(async () => {
  // The puppeteer-managed download in ~/.cache is incomplete on this machine (no chrome.exe),
  // so fall back to the system browser. Override with --chrome <path>.
  const CHROME_CANDIDATES = [
    flag('chrome', null),
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));

  const browser = await puppeteer.launch({
    headless: 'new',
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const results = [];
  const locales = ['ar', 'en'];

  for (const route of ROUTES) {
    if (ONLY_ROUTE && route.id !== ONLY_ROUTE) continue;
    const localesForRoute = route.fixedLocale ? ['ar'] : locales;
    for (const locale of localesForRoute) {
      for (const vp of VIEWPORTS) {
        for (const theme of THEMES) {
          const page = await browser.newPage();
          await page.setViewport(vp);
          // next-themes uses storageKey="tawveeri-theme"; seed it before first paint so the
          // audited render is the themed one, not a flash of the default.
          await page.evaluateOnNewDocument((t) => {
            try { localStorage.setItem('tawveeri-theme', t); } catch {}
          }, theme);
          const url = `${BASE}${route.path(locale)}`;
          let record = { route: route.id, locale, viewport: vp.id, theme, url };
          try {
            const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            record.status = resp ? resp.status() : 0;
            await settle(page);
            // Prove the theme actually applied — an unverified instrument is not evidence.
            record.themeApplied = await page.evaluate(() =>
              document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            const axeResult = await runAxe(page);
            record = { ...record, ...axeResult };
          } catch (err) {
            record.error = String(err.message || err);
            record.violations = [];
          }
          results.push(record);
          if (!AS_JSON) {
            const crit = (record.violations || []).filter((v) => v.impact === 'critical' || v.impact === 'serious');
            const total = (record.violations || []).reduce((s, v) => s + v.count, 0);
            const mismatch = record.themeApplied && record.themeApplied !== theme ? ' THEME-MISMATCH' : '';
            console.log(
              `${record.route.padEnd(15)} ${locale}  ${vp.id.padEnd(7)} ${theme.padEnd(5)} ` +
                `HTTP ${record.status ?? '—'}  violations ${String(record.violations.length).padStart(2)} ` +
                `(nodes ${String(total).padStart(3)})  critical/serious rules ${crit.length}` +
                mismatch + (record.error ? `  ERROR ${record.error}` : '')
            );
          }
          await page.close();
        }
      }
    }
  }

  await browser.close();

  if (AS_JSON) {
    console.log(JSON.stringify({ base: BASE, results }, null, 2));
    return;
  }

  // Rolled up by rule — the unit a fix acts on.
  const byRule = new Map();
  for (const r of results) {
    for (const v of r.violations || []) {
      const e = byRule.get(v.id) || { id: v.id, impact: v.impact, help: v.help, tags: v.tags, nodes: 0, where: new Set(), samples: [] };
      e.nodes += v.count;
      e.where.add(`${r.route}/${r.locale}/${r.viewport}/${r.theme}`);
      for (const n of v.nodes) if (e.samples.length < 4) e.samples.push(n);
      byRule.set(v.id, e);
    }
  }
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const rules = [...byRule.values()].sort(
    (a, b) => (order[a.impact] ?? 9) - (order[b.impact] ?? 9) || b.nodes - a.nodes
  );

  console.log('\n══ VIOLATIONS BY RULE ══');
  for (const r of rules) {
    console.log(`\n[${(r.impact || '?').toUpperCase()}] ${r.id} — ${r.help}`);
    console.log(`   ${r.tags.join(' ')} · ${r.nodes} nodes · ${r.where.size} page/viewport combos`);
    console.log(`   surfaces: ${[...r.where].join(', ')}`);
    for (const s of r.samples) {
      console.log(`   · ${s.target}`);
      if (s.summary) console.log(`     ${s.summary}`);
      console.log(`     ${s.html.replace(/\s+/g, ' ')}`);
    }
  }

  // ── Contrast rolled up by colour pair — the actual fix unit ──
  const pairs = new Map();
  for (const r of results) {
    for (const v of r.violations || []) {
      for (const p of v.contrastPairs || []) {
        const key = `${p.fg}|${p.bg}|${p.expected}`;
        const e = pairs.get(key) || { ...p, nodes: 0, where: new Set(), samples: [] };
        e.nodes += 1;
        e.where.add(`${r.route}:${r.theme}`);
        if (e.samples.length < 3 && !e.samples.includes(p.html)) e.samples.push(p.html);
        pairs.set(key, e);
      }
    }
  }
  if (pairs.size) {
    console.log('\n══ CONTRAST FAILURES BY COLOUR PAIR ══');
    for (const p of [...pairs.values()].sort((a, b) => b.nodes - a.nodes)) {
      console.log(
        `\n${p.fg} on ${p.bg} — ${p.ratio}:1 (needs ${p.expected}:1) · ${p.fontSize} ${p.fontWeight} · ` +
          `${p.nodes} nodes · routes: ${[...p.where].join(', ')}`
      );
      for (const s of p.samples) console.log(`   ${s.replace(/\s+/g, ' ')}`);
    }
  }

  // ── Needs-review (axe `incomplete`) and coverage proof ──
  const inc = new Map();
  for (const r of results) {
    for (const v of r.incomplete || []) {
      const e = inc.get(v.id) || { ...v, nodes: 0, where: new Set(), samples: [] };
      e.nodes += v.count;
      e.where.add(`${r.route}/${r.viewport}/${r.theme}`);
      for (const n of v.nodes) if (e.samples.length < 4) e.samples.push(n);
      inc.set(v.id, e);
    }
  }
  if (inc.size) {
    console.log('\n══ NEEDS REVIEW (axe could not decide) ══');
    for (const v of inc.values()) {
      console.log(`\n${v.id} — ${v.help} · ${v.nodes} nodes · ${v.where.size} combos`);
      for (const s of v.samples) console.log(`   ${s.target}\n     ${s.html.replace(/\s+/g, ' ')}`);
    }
  }
  // Proof the WCAG 2.2 rules actually RAN — a rule absent from both violations and passes
  // was never evaluated, and "no violations" would then be an artefact, not a result.
  const ran = new Set();
  for (const r of results) for (const id of r.passedRules || []) ran.add(id);
  for (const id of byRule.keys()) ran.add(id);
  for (const id of inc.keys()) ran.add(id);
  // `target-size` is the only NEW 2.2 AA success criterion axe can decide, and it is the
  // one most likely to be silently skipped. Focus order, focus restoration and reflow are
  // not static properties and are measured by a11y-keyboard.js instead — listed here so
  // this file is not mistaken for full 2.2 coverage on its own.
  const WCAG22 = ['target-size'];
  console.log('\n══ WCAG 2.2 RULE COVERAGE ══');
  for (const id of WCAG22) console.log(`   ${id}: ${ran.has(id) ? 'evaluated' : 'NOT EVALUATED'}`);
  console.log('   2.4.3 focus order · 2.4.11 focus not obscured · 1.4.10 reflow · 3.1.1 lang:');
  console.log('     not static properties — measured by scripts/tps-analysis/a11y-keyboard.js');

  const criticalSerious = rules.filter((r) => r.impact === 'critical' || r.impact === 'serious');
  console.log(
    `\n══ SUMMARY ══\n${results.length} page renders · ${rules.length} distinct rules failing · ` +
      `${criticalSerious.length} critical/serious · ` +
      `${rules.reduce((s, r) => s + r.nodes, 0)} total failing nodes`
  );
  console.log(criticalSerious.length === 0 ? 'GATE: PASS (zero critical/serious)' : 'GATE: FAIL');
})();
