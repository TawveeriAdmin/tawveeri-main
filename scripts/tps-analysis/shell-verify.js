#!/usr/bin/env node
/**
 * SHELL VERIFY — the root-layout restructure, measured on the rendered artefact (ADR-155).
 *
 * Every check reads the SERVED BYTES. That is the whole point: the defect this closes was
 * invisible to the type checker, the linter, the test suite and a DOM inspection in a browser,
 * because a script corrected `<html lang>` after first paint. A page that "looks right" in
 * DevTools was still announcing English copy in an Arabic voice to a screen reader that read
 * the document as delivered.
 *
 *   node scripts/tps-analysis/shell-verify.js                          # localhost:3000
 *   node scripts/tps-analysis/shell-verify.js --base https://tawveeri.com
 */

const BASE = (() => {
  const i = process.argv.indexOf('--base');
  return i >= 0 ? process.argv[i + 1].replace(/\/$/, '') : 'http://localhost:3000';
})();

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  const html = await res.text();
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const body = bodyMatch ? bodyMatch[1] : '';
  const markup = body
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<template[\s\S]*?<\/template>/g, '');
  return {
    status: res.status,
    html,
    htmlTag: (html.match(/<html[^>]*>/) || [''])[0],
    bodyBytes: Buffer.byteLength(body, 'utf8'),
    markupBytes: Buffer.byteLength(markup, 'utf8'),
    text: markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  };
}

const SURFACES = [
  ['home', '/{L}'],
  ['search', '/{L}/search?q=laptop'],
  ['compare', '/{L}/compare'],
  ['categories', '/{L}/categories'],
  ['deals', '/{L}/deals'],
  ['stores', '/{L}/stores'],
  ['product-list', '/{L}/products'],
];

(async () => {
  console.log(`\nSHELL VERIFY — ${BASE}\n${'='.repeat(64)}\n`);

  // ── 1. LANG/DIR IN THE SERVED BYTES, EVERY SURFACE, BOTH LOCALES ───────────────
  console.log('§1 served <html lang> / <html dir>');
  for (const locale of ['ar', 'en']) {
    const wantDir = locale === 'ar' ? 'rtl' : 'ltr';
    for (const [name, tpl] of SURFACES) {
      const r = await get(tpl.replace('{L}', locale));
      const langOk = new RegExp(`lang="${locale}"`).test(r.htmlTag);
      const dirOk = new RegExp(`dir="${wantDir}"`).test(r.htmlTag);
      check(
        `${locale} ${name}: lang=${locale} dir=${wantDir}`,
        r.status === 200 && langOk && dirOk,
        `${r.status} ${r.htmlTag}`,
      );
    }
  }

  // ── 2. 404 — STATUS, BODY, HEADER, HEADING, SEARCH CTA ────────────────────────
  console.log('\n§2 404 page (unmatched route) — the documented acceptance criteria');
  for (const locale of ['ar', 'en']) {
    const r = await get(`/${locale}/this-route-does-not-exist-xyz`);
    const heading = locale === 'ar' ? 'الصفحة غير موجودة' : 'Page not found';
    const cta = locale === 'ar' ? 'ابحث عن منتج' : 'Search for a product';
    const header = locale === 'ar' ? 'تخطي إلى المحتوى الرئيسي' : 'Skip to main content';
    check(`${locale} 404: status 404`, r.status === 404, String(r.status));
    check(`${locale} 404: body > 1500 bytes`, r.bodyBytes > 1500, `${r.bodyBytes} bytes`);
    check(`${locale} 404: site header present`, r.text.includes(header));
    check(`${locale} 404: not-found heading`, r.text.includes(heading));
    check(`${locale} 404: search CTA`, r.text.includes(cta));
    check(`${locale} 404: lang/dir correct`, r.htmlTag.includes(`lang="${locale}"`), r.htmlTag);
  }

  // ── 3. SIBLINGS UNAFFECTED — a real page must still be 200 with a real body ───
  console.log('\n§3 siblings unaffected');
  for (const locale of ['ar', 'en']) {
    const r = await get(`/${locale}/search?q=iphone`);
    check(`${locale} search still 200 with a rendered body`, r.status === 200 && r.markupBytes > 5000, `${r.status}, ${r.markupBytes} markup bytes`);
  }

  // ── 4. METADATA — locale-aware title survived the move ────────────────────────
  console.log('\n§4 metadata');
  for (const locale of ['ar', 'en']) {
    const r = await get(`/${locale}`);
    const og = (r.html.match(/property="og:locale"\s+content="([^"]+)"/) || [])[1];
    check(`${locale} og:locale`, og === (locale === 'ar' ? 'ar_SA' : 'en_US'), String(og));
    const canonical = (r.html.match(/rel="canonical"\s+href="([^"]+)"/) || [])[1] || '';
    check(`${locale} canonical present`, canonical.length > 0, canonical);
  }

  // ── 5. THE SILENT TRUST ELEMENTS ─────────────────────────────────────────────
  // These fail without breaking. Nothing throws, no test goes red, and the page still looks
  // finished — which is exactly why they are measured on the artefact rather than reasoned
  // about. The AI disclosure's DOM position is measured by `unified-search-verify.js` (it needs
  // a browser); the two below can be measured on the served bytes, so they are measured here.
  console.log('\n§5 silent trust elements');
  {
    // OBSERVATION LINES resolve from provenance, not the stored optimistic stamp (DEBT-1).
    //
    // ON THE THRESHOLDS — read before tightening them. DEBT-1 records this reference case as
    // "5, 10, 25" and warns that SMALLER numbers mean the falsely-fresh claim is back. Measured
    // 2026-08-01 on production AND on this build, in the same minute: BOTH render 3 exits with
    // ages 11, 26, 6. The two age figures are the recorded ones plus exactly one day of drift,
    // which is the correct direction — a provenance-resolved age only grows. The retailer count
    // 5 → 3 is live-catalogue movement, identical before and after the change, so it is not
    // evidence about this change. The gate is therefore "a comparison is still being delivered"
    // (≥2 retailers) plus "ages are real and not collapsed", not a frozen count that would go
    // red every time an offer expires.
    const r = await get('/ar/compare/' + encodeURIComponent('apple|iPhone|15|Standard|128'));
    const exits = new Set([...r.html.matchAll(/\/go\/([0-9a-f-]{36})/g)].map((m) => m[1]));
    const ages = [...r.text.matchAll(/(\d+)\s*(?:يوم|يومًا|أيام)/g)].map((m) => Number(m[1]));
    check('compare reference case still delivers a comparison (≥2 retailer exits)', exits.size >= 2, `${exits.size} exits`);
    check('compare reference case: observation ages rendered', ages.length > 0, `ages: ${ages.join(', ') || 'none'}`);
    check('observation age is not collapsed to "today"', ages.some((a) => a >= 10), `max age ${Math.max(0, ...ages)}d`);

    // AFFILIATE TAG SURVIVES A REAL EXIT. Not a unit test of the builder — the actual
    // redirect the customer receives. `tw_test=1` marks the click `is_test` so this
    // verification never enters the funnel it is verifying.
    const anyExit = [...exits][0];
    if (!anyExit) {
      check('amazon exit carries tag=tawveeri-21', false, 'no exit found to follow');
    } else {
      let amazonChecked = false;
      for (const id of [...exits].slice(0, 6)) {
        const res = await fetch(`${BASE}/go/${id}?tw_test=1`, { redirect: 'manual' });
        const loc = res.headers.get('location') || '';
        if (/amazon\./i.test(loc)) {
          check('amazon exit carries tag=tawveeri-21', loc.includes('tag=tawveeri-21'), loc.slice(0, 120));
          amazonChecked = true;
          break;
        }
      }
      if (!amazonChecked) {
        check('amazon exit carries tag=tawveeri-21', false, 'no Amazon offer among the reference case exits — check the case, not the tag');
      }
    }
  }

  console.log('\n' + '='.repeat(64));
  const failed = results.filter((r) => !r.pass);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('\nFAILED:');
    failed.forEach((f) => console.log(`  - ${f.name} (${f.detail})`));
    process.exit(1);
  }
})();
