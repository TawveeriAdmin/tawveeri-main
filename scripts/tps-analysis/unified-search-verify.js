#!/usr/bin/env node
/**
 * P2-8 · UNIFIED SEARCH — verification.
 *
 * Two things are being proven here, and they are different:
 *
 *   1. ROUTING. One entry point answers both a described need and a named product, and
 *      routes each to the right capability WITHOUT the customer choosing.
 *   2. THE HARD CONDITION. Wherever the advisor's answer renders, the AI disclosure
 *      renders at the same moment or earlier — checked by DOM position, in the approved
 *      wording, not by "a disclosure exists somewhere on the page".
 *
 *   node scripts/tps-analysis/unified-search-verify.js
 *   node scripts/tps-analysis/unified-search-verify.js --base https://tawveeri.com
 *
 * Read-only: it types and reads, never activates an exit (/go/<id> INSERTS).
 */
const fs = require('fs');
const puppeteer = require('puppeteer');

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const BASE = flag('base', 'http://localhost:3000').replace(/\/$/, '');
const CHROME = [
  flag('chrome', null),
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find((p) => fs.existsSync(p));

// LAUNCH_VOCABULARY §8 — the approved wording. Both clauses. The second one is
// load-bearing; a disclosure that lost it would still "be present" and would still be
// wrong, which is exactly why this compares text rather than counting elements.
const APPROVED = {
  ar: 'وفّر مساعد تسوّق ذكي (ذكاء اصطناعي) — يقترح بناءً على أسعار رصدناها.',
  en: 'Waffar is an AI shopping assistant — it suggests based on prices we observed.',
};

// Need-based (must reason) vs named product (must not). Chosen to match the routing rule's
// two sides, in both languages.
const CASES = [
  { id: 'need', ar: 'مكيف لغرفة 30 متر هادئ تحت 4000', en: 'a quiet AC for a 30 m² room under 4000', expect: 'advisory' },
  { id: 'need2', ar: 'لابتوب للألعاب تحت 5000', en: 'a gaming laptop under 5000', expect: 'advisory' },
  { id: 'named', ar: 'ايفون 15', en: 'iphone 15', expect: 'retrieval' },
  { id: 'browse', ar: 'لابتوب', en: 'laptop', expect: 'retrieval' },
];

const results = [];
const record = (check, ctx, pass, detail) => {
  results.push({ check, ctx, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${check.padEnd(38)} ${ctx.padEnd(14)} ${detail}`);
};

const settle = async (page, ms = 2500) => {
  try { await page.waitForNetworkIdle({ idleTime: 1200, timeout: 30000 }); } catch {}
  await new Promise((r) => setTimeout(r, ms));
};

/** Where the disclosure sits relative to the answer — the whole point of condition 1. */
const PROBE = (approved) => {
  const answer = document.querySelector('[data-testid="advisor-answer"]');
  const discs = [...document.querySelectorAll('[data-testid="waffar-ai-disclosure"]')];
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const texts = discs.map((d) => norm(d.textContent));
  let relation = 'no-answer';
  if (answer) {
    if (discs.length === 0) relation = 'MISSING';
    else {
      // "at the same moment or earlier" = the disclosure is inside the answer, or precedes
      // it in document order. Node.DOCUMENT_POSITION_CONTAINED_BY = 16, PRECEDING = 2.
      relation = discs.some((d) => {
        const rel = answer.compareDocumentPosition(d);
        return (rel & 16) !== 0 || (rel & 2) !== 0;
      }) ? 'at-or-before' : 'AFTER';
    }
  }
  return {
    hasAnswer: !!answer,
    disclosureCount: discs.length,
    relation,
    texts,
    exactMatch: texts.some((t) => t === approved),
    hasRetrievalPick: !!document.querySelector('[data-testid="smart-pick"]'),
    productCards: document.querySelectorAll('[data-testid="product-card"], article').length,
  };
};

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  for (const locale of ['ar', 'en']) {
    const approved = APPROVED[locale];

    // ── The unified entry point ────────────────────────────────────────────────
    for (const c of CASES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1000 });
      const q = c[locale];
      await page.goto(`${BASE}/${locale}/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await settle(page);
      // The advisor is fetched in parallel and is the slower of the two reads (~2s in
      // production, ~7s on a cold dev server). A fixed sleep sampled before it landed and
      // reported "no answer" — an instrument error, not a routing failure. Wait for the
      // element where one is expected; for the retrieval cases the settle above plus this
      // bounded wait is the window in which a WRONG answer would have appeared.
      if (c.expect === 'advisory') {
        try { await page.waitForSelector('[data-testid="advisor-answer"]', { timeout: 30000 }); } catch {}
      } else {
        await new Promise((r) => setTimeout(r, 8000));
      }
      const p = await page.evaluate(PROBE, approved);
      const ctx = `${locale}/${c.id}`;

      if (c.expect === 'advisory') {
        record('need-based query reasons', ctx, p.hasAnswer, p.hasAnswer ? `answer rendered · "${q}"` : `NO answer for "${q}"`);
        if (p.hasAnswer) {
          record('disclosure at or before answer', ctx, p.relation === 'at-or-before', `relation=${p.relation} · ${p.disclosureCount} on page`);
          record('disclosure wording is approved', ctx, p.exactMatch, p.exactMatch ? 'exact §8 match' : `got: ${JSON.stringify(p.texts).slice(0, 160)}`);
          record('one answer, not two', ctx, !p.hasRetrievalPick, p.hasRetrievalPick ? 'retrieval smart-pick ALSO shown' : 'retrieval pick correctly suppressed');
        }
      } else {
        record('named/browse query does NOT reason', ctx, !p.hasAnswer, p.hasAnswer ? `answer wrongly rendered for "${q}"` : `retrieval only · "${q}"`);
        record('no orphan disclosure', ctx, p.disclosureCount === 0, `${p.disclosureCount} disclosure(s) with no answer`);
      }
      await page.close();
    }

    // ── The ONE clarification question ─────────────────────────────────────────
    // Three properties, and the second is the one that failed in production before:
    //   · an ambiguous need may be asked ONE question, with a visible skip
    //   · a need that ALREADY carries the answer is never asked
    //   · the recommendation is on screen either way — the question is not a gate
    {
      const AMBIGUOUS = { ar: 'ابي مكيف هادئ وموفر كهرباء', en: 'a quiet energy-saving air conditioner' };
      const ALREADY_GIVEN = { ar: 'ابي مكيف رخيص لغرفه ٤٠ متر', en: 'a cheap AC for a 40 m2 room' };

      for (const [id, q] of [['ambiguous', AMBIGUOUS[locale]], ['already-given', ALREADY_GIVEN[locale]]]) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1000 });
        await page.goto(`${BASE}/${locale}/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await settle(page);
        try { await page.waitForSelector('[data-testid="advisor-answer"]', { timeout: 30000 }); } catch {}
        await new Promise((r) => setTimeout(r, 1500));
        const c = await page.evaluate(() => {
          const prompts = document.querySelectorAll('[data-testid="clarify-prompt"]');
          const answer = document.querySelector('[data-testid="advisor-answer"]');
          return {
            prompts: prompts.length,
            hasSkip: !!document.querySelector('[data-testid="clarify-skip"]'),
            skipLabel: (document.querySelector('[data-testid="clarify-skip"]')?.textContent || '').trim(),
            // A recommendation must be present WITH the question — declining costs nothing.
            hasRecommendation: !!(answer && answer.querySelector('h3')),
          };
        });
        const ctx = `${locale}/${id}`;

        if (id === 'already-given') {
          // THE RECORDED FAILURE. «لغرفه ٤٠ متر» supplies the area in the sentence; asking
          // for it again is the defect this unit exists to prevent.
          record('never asks for what was given', ctx, c.prompts === 0,
            c.prompts === 0 ? 'no question — the area was parsed from the query'
                            : 'ASKED for the room size the shopper already wrote');
        } else {
          record('at most ONE question', ctx, c.prompts <= 1, `${c.prompts} prompt(s) rendered`);
          if (c.prompts === 1) {
            record('the question has a visible skip', ctx, c.hasSkip, c.skipLabel || 'no skip control');
            record('declining still leaves a result', ctx, c.hasRecommendation,
              c.hasRecommendation ? 'recommendation rendered alongside the question'
                                  : 'the question is gating the answer');
          }
        }
        await page.close();
      }
    }

    // ── The retired entry point must LAND somewhere useful, not merely 404 ─────
    // A published «وفّر» link that now asks its question of the unified surface is the
    // proof that the entry point was retired without retiring the capability.
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1000 });
      const q = CASES[0][locale];
      await page.goto(`${BASE}/${locale}/advisor?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await settle(page);
      try { await page.waitForSelector('[data-testid="advisor-answer"]', { timeout: 30000 }); } catch {}
      // Read the URL AFTER settling. Next performs this redirect through the RSC payload,
      // so the navigation is 200 → 200 and the address only changes once the client has
      // applied it. Sampling right after `goto` reported "no redirect" while the browser
      // was mid-hop — an instrument error that would have been read as a broken route.
      const landed = page.url();
      const p = await page.evaluate(PROBE, approved);
      record('/advisor redirects to search', `${locale}/advisor`, /\/search\?/.test(landed), `landed on ${landed.replace(BASE, '')}`);
      record('the carried query still answers', `${locale}/advisor`, p.hasAnswer, p.hasAnswer ? 'answer rendered after redirect' : 'NO answer');
      record('disclosure survives the move', `${locale}/advisor`, p.exactMatch && p.relation === 'at-or-before',
        `${p.disclosureCount} present · exact=${p.exactMatch} · relation=${p.relation}`);
      await page.close();
    }

    // ── The second door is gone from the header ────────────────────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1000 });
      await page.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await settle(page, 1200);
      const nav = await page.evaluate(() => ({
        advisorLinks: [...document.querySelectorAll('header a[href*="/advisor"]')].length,
        needExamples: !!document.body.innerText.match(/صِف ما تحتاجه|describe what you need/i),
      }));
      record('no second entry point in header', locale, nav.advisorLinks === 0,
        `${nav.advisorLinks} header link(s) to /advisor`);
      await page.close();
    }

    // ── …and the capability is still discoverable from the one that remains ────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1000 });
      await page.goto(`${BASE}/${locale}/search`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await settle(page, 1500);
      const taught = await page.evaluate(() =>
        !!document.body.innerText.match(/صِف ما تحتاجه|describe what you need/i));
      record('need phrasing is taught on entry', locale, taught,
        taught ? 'the empty state shows how to describe a need'
               : 'only product-name examples — the capability would go undiscovered');
      await page.close();
    }
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n══ SUMMARY ══\n${results.length} checks · ${failed.length} failing`);
  for (const f of failed) console.log(`   FAIL ${f.check} [${f.ctx}] — ${f.detail}`);
  console.log(failed.length === 0 ? 'GATE: PASS' : 'GATE: FAIL');
}

run();
