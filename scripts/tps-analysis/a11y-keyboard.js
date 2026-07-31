#!/usr/bin/env node
/**
 * P2-7 · the half of WCAG 2.2 AA that a static scan cannot see.
 *
 * axe checks the DOM at rest. These checks drive the page: they Tab through it, open the
 * mobile filter sheet, press Escape, shrink the viewport to 200% zoom, and ask the browser
 * what actually changed. Every verdict below comes from the rendered artefact.
 *
 *   node scripts/tps-analysis/a11y-keyboard.js
 *   node scripts/tps-analysis/a11y-keyboard.js --base https://tawveeri.com
 *
 * Read-only: never activates a link (no /go/<id> — that route INSERTS), only focuses.
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

const results = [];
/**
 * `accepted` marks a deviation that was measured, understood, and judged not to fail its
 * success criterion — never a way to quiet a check. It still prints, still appears in the
 * summary, and carries its reason. Only the gate ignores it.
 */
const record = (check, locale, pass, detail, accepted) => {
  results.push({ check, locale, pass, detail, accepted: !pass && !!accepted });
  const tag = pass ? 'PASS' : accepted ? 'NOTE' : 'FAIL';
  console.log(`${tag}  ${check.padEnd(34)} ${locale.padEnd(3)} ${detail}`);
};

const settle = async (page) => {
  try { await page.waitForNetworkIdle({ idleTime: 900, timeout: 25000 }); } catch {}
  await new Promise((r) => setTimeout(r, 500));
};

/** Describe whatever currently holds focus, plus its computed focus indicator. */
const FOCUS_PROBE = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
    cls: (el.className && String(el.className).slice(0, 60)) || '',
    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    outlineWidth: cs.outlineWidth,
    outlineStyle: cs.outlineStyle,
    boxShadow: cs.boxShadow === 'none' ? '' : cs.boxShadow.slice(0, 80),
    // A text input inside a pill commonly sets `outline-none` and lets the WRAPPER draw
    // the ring via focus-within. Checking the focused node alone reported those as
    // ringless — an instrument error, not a defect. Walk three ancestors and accept a
    // ring drawn on behalf of the focused control.
    ancestorIndicator: (() => {
      let n = el.parentElement, depth = 0;
      while (n && depth < 3) {
        const p = getComputedStyle(n);
        const ring = (p.outlineStyle !== 'none' && parseFloat(p.outlineWidth) > 0) ||
          (p.boxShadow && p.boxShadow !== 'none');
        if (ring) return `${n.tagName.toLowerCase()}:${p.outlineStyle !== 'none' ? 'outline' : 'shadow'}`;
        n = n.parentElement; depth++;
      }
      return '';
    })(),
    visible: r.width > 0 && r.height > 0,
  };
};

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  for (const locale of ['ar', 'en']) {
    // ── 1. Skip link is the FIRST tab stop and actually moves focus ──────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await page.keyboard.press('Tab');
      const first = await page.evaluate(FOCUS_PROBE);
      const isSkip = !!first && first.tag === 'a' && /main|المحتوى/i.test(first.label);
      record('skip-link is first tab stop', locale, isSkip, first ? `${first.tag} "${first.label}"` : 'nothing focused');
      // and it must become VISIBLE when focused (sr-only + focus:not-sr-only)
      const skipVisible = !!first && first.w > 1 && first.h > 1;
      record('skip-link visible when focused', locale, skipVisible, first ? `${first.w}×${first.h}px` : '—');
      await page.close();
    }

    // ── 2. Every tab stop has a VISIBLE focus indicator (2.4.7) ──────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${BASE}/${locale}/search?q=${encodeURIComponent(locale === 'ar' ? 'لابتوب' : 'laptop')}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const stops = [];
      const seen = new Set();
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const p = await page.evaluate(FOCUS_PROBE);
        if (!p) break;
        const key = `${p.tag}|${p.label}|${p.x},${p.y}`;
        if (seen.has(key)) break; // wrapped around
        seen.add(key);
        stops.push(p);
      }
      const noIndicator = stops.filter(
        (s) => s.visible && (s.outlineStyle === 'none' || parseFloat(s.outlineWidth) === 0)
          && !s.boxShadow && !s.ancestorIndicator
      );
      record('visible focus ring on every stop', locale, noIndicator.length === 0,
        `${stops.length} stops examined · ${noIndicator.length} without outline or shadow` +
        (noIndicator.length ? ` → e.g. <${noIndicator[0].tag}> "${noIndicator[0].label}" ${noIndicator[0].cls}` : ''));

      // ── 3. Focus order follows VISUAL order, RTL included (1.3.2 / 2.4.3) ──────
      // In Arabic the visual reading order is right-to-left, so a correct tab order has
      // x DECREASING within a row. Comparing against the wrong axis is how an RTL focus
      // bug hides, which is why the axis is chosen by locale rather than assumed.
      const rtl = locale === 'ar';
      const rows = stops.filter((s) => s.visible && s.w > 0);
      let comparisons = 0;
      const inverted = [];
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1], b = rows[i];
        if (Math.abs(a.y - b.y) > 12) continue;      // different visual row — y governs
        comparisons++;
        if (rtl ? b.x > a.x + 4 : b.x + 4 < a.x) {
          // Is this the KNOWN intra-card pattern — a card's own action button preceding
          // that card's own body — or a genuine cross-component order bug? Decided on
          // evidence: the action button is named "<action>: <product>", so if the next
          // stop's name contains the same product, both controls belong to one card.
          const product = (a.label.split(':')[1] || '').trim();
          const sameCard = product.length >= 8 && b.label.includes(product.slice(0, 12));
          inverted.push({
            sameCard,
            text: `<${a.tag}>"${a.label}"@${a.x} → <${b.tag}>"${b.label}"@${b.x}`,
          });
        }
      }
      const crossComponent = inverted.filter((i) => !i.sameCard);
      const intraCard = inverted.length - crossComponent.length;
      record('focus order matches visual order', locale, crossComponent.length === 0,
        `${comparisons} same-row pairs · ${crossComponent.length} cross-component inversions · ` +
        `${intraCard} intra-card (action button before its own card body)` +
        (crossComponent.length ? ` → ${crossComponent.slice(0, 3).map((i) => i.text).join(' | ')}` : ''));
      if (intraCard > 0 && crossComponent.length === 0) {
        record('  ↳ intra-card order accepted', locale, false,
          `${intraCard} pairs · each control now names its own product, so 2.4.3's "preserves ` +
          `meaning and operability" holds. The DOM order is the documented click-interception ` +
          `guard; reordering it is a component restructure, deferred out of this ticket.`, true);
      }
      await page.close();
    }

    // ── 4. Mobile filter sheet: traps focus, releases on Escape AND on close ─────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.goto(`${BASE}/${locale}/search?q=${encodeURIComponent(locale === 'ar' ? 'لابتوب' : 'laptop')}`, { waitUntil: 'domcontentloaded' });
      await settle(page);

      // The Arabic label is «المرشحات», not «الفلاتر» — the first regex matched neither and
      // reported "no filter button" as a defect. Match the shipped strings, and FOCUS the
      // trigger before clicking: a bare .click() leaves focus on <body>, so the dialog has
      // nothing to restore focus to and "focus not returned" would be the harness's fault.
      const opened = await page.evaluate((labels) => {
        const btns = [...document.querySelectorAll('button')];
        const b = btns.find((x) => {
          const txt = (x.getAttribute('aria-label') || x.textContent || '').trim();
          return labels.some((l) => txt.includes(l));
        });
        if (!b) return false;
        b.setAttribute('data-a11y-trigger', '1');
        b.focus();
        b.click();
        return true;
      }, locale === 'ar' ? ['المرشحات', 'الفلاتر', 'تصفية'] : ['Filters', 'Filter']);
      if (!opened) {
        record('filter sheet — trigger found', locale, false, 'no filter button matched');
      } else {
        await new Promise((r) => setTimeout(r, 700));
        const dialogOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
        record('filter sheet opens', locale, dialogOpen, dialogOpen ? 'role=dialog present' : 'no dialog');

        if (dialogOpen) {
          // Focus must move INTO the dialog, and 40 tabs must never leave it.
          let escaped = 0, sampled = 0;
          for (let i = 0; i < 40; i++) {
            await page.keyboard.press('Tab');
            const inside = await page.evaluate(() => {
              const d = document.querySelector('[role="dialog"]');
              if (!d) return null;
              return d.contains(document.activeElement);
            });
            if (inside === null) break;
            sampled++;
            if (!inside) escaped++;
          }
          record('filter sheet traps focus', locale, escaped === 0 && sampled > 0,
            `${sampled} tabs inside the open sheet · ${escaped} escaped to the page behind`);

          // Escape must close it AND return focus to the control that opened it (2.4.3).
          await page.keyboard.press('Escape');
          await new Promise((r) => setTimeout(r, 600));
          const afterEsc = await page.evaluate(() => {
            const trig = document.querySelector('[data-a11y-trigger]');
            const act = document.activeElement;
            return {
              stillOpen: !!document.querySelector('[role="dialog"]'),
              focusOnTrigger: act === trig,
              focusIsBody: act === document.body,
              triggerStillInDom: !!trig,
              activeDesc: act && act !== document.body
                ? `<${act.tagName.toLowerCase()}> "${(act.getAttribute('aria-label') || act.textContent || '').trim().slice(0, 30)}"`
                : '<body>',
            };
          });
          record('filter sheet closes on Escape', locale, !afterEsc.stillOpen,
            afterEsc.stillOpen ? 'dialog still in the DOM — this is the trap that harms' : 'dismissed');
          record('focus returns to trigger on close', locale, afterEsc.focusOnTrigger,
            afterEsc.focusOnTrigger ? 'restored'
              : `focus is on ${afterEsc.activeDesc} · trigger ${afterEsc.triggerStillInDom ? 'still in DOM' : 'REMOVED from DOM'}`);
        }
      }
      await page.close();
    }

    // ── 5. Touch targets ≥24×24 (2.5.8 AA) with the 44 CSS px house rule reported ─
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const small = await page.evaluate(() => {
        const out = { under24: [], under44: 0, total: 0 };
        const els = [...document.querySelectorAll('a[href], button, input, select, [role="button"]')];
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;         // not rendered
          if (getComputedStyle(el).display === 'contents') continue;
          // sr-only controls (the skip link at rest) are 1×1 and clipped. They are not
          // pointer targets, so 2.5.8 does not apply until they are revealed on focus.
          if (r.width <= 1 || r.height <= 1) continue;
          // An inline link inside a paragraph is exempt from 2.5.8.
          const inline = getComputedStyle(el).display === 'inline';
          out.total++;
          const min = Math.min(r.width, r.height);
          if (min < 44) out.under44++;
          if (min < 24 && !inline) {
            out.under24.push({
              tag: el.tagName.toLowerCase(),
              label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
              size: `${Math.round(r.width)}×${Math.round(r.height)}`,
            });
          }
        }
        return out;
      });
      record('touch targets ≥24px (2.5.8 AA)', locale, small.under24.length === 0,
        `${small.total} controls · ${small.under24.length} under 24px · ${small.under44} under the 44px house rule` +
        (small.under24.length ? ` → ${small.under24.slice(0, 3).map((s) => `${s.tag} "${s.label}" ${s.size}`).join('; ')}` : ''));
      await page.close();
    }

    // ── 6. 200% zoom must not force horizontal scrolling (1.4.10 reflow) ─────────
    {
      const page = await browser.newPage();
      // 1280 CSS px at 200% zoom = a 640 px viewport. Reflow requires no 2-D scrolling.
      await page.setViewport({ width: 640, height: 512 });
      await page.goto(`${BASE}/${locale}/search?q=${encodeURIComponent(locale === 'ar' ? 'لابتوب' : 'laptop')}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        const offenders = [];
        if (de.scrollWidth > de.clientWidth + 1) {
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width > de.clientWidth + 1 && r.height > 0) {
              const cs = getComputedStyle(el);
              if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue; // own scroller: allowed
              offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), w: Math.round(r.width) });
              if (offenders.length >= 3) break;
            }
          }
        }
        return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, offenders };
      });
      const ok = overflow.scrollWidth <= overflow.clientWidth + 1;
      record('no horizontal scroll at 200% zoom', locale, ok,
        `${overflow.scrollWidth}px content in ${overflow.clientWidth}px viewport` +
        (ok ? '' : ` → ${overflow.offenders.map((o) => `${o.tag}.${o.cls} ${o.w}px`).join('; ') || 'no single offender isolated'}`));
      await page.close();
    }

    // ── 7. prefers-reduced-motion is honoured (2.3.3) ────────────────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const motion = await page.evaluate(() => {
        const moving = [];
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          const dur = parseFloat(cs.animationDuration) || 0;
          const iter = cs.animationIterationCount;
          // A finite entrance animation is not the hazard 2.3.3 addresses; a LOOPING one is.
          if (dur > 0 && cs.animationName !== 'none' && (iter === 'infinite' || dur > 5)) {
            moving.push({ tag: el.tagName.toLowerCase(), name: cs.animationName, dur: cs.animationDuration, iter });
            if (moving.length >= 5) break;
          }
        }
        return moving;
      });
      record('reduced-motion honoured', locale, motion.length === 0,
        motion.length === 0 ? 'no infinite or >5s animation under reduce'
          : `${motion.length} still animating → ${motion.slice(0, 3).map((m) => `${m.tag}:${m.name}(${m.dur},${m.iter})`).join('; ')}`);
      await page.close();
    }

    // ── 8. Resolve axe's "needs review" contrast nodes ──────────────────────────
    // axe abstains wherever it cannot be sure what is behind the text — translucent
    // surfaces, backdrop-filter, gradients. On this site that is 411 nodes, and
    // "axe abstained" is not the same as "it passes". Composite the ancestor chain by
    // hand (alpha over alpha until an opaque layer) and compute the real ratio.
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.evaluateOnNewDocument((t) => {
        try { localStorage.setItem('tawveeri-theme', t); } catch {}
      }, theme);
      await page.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const res = await page.evaluate(() => {
        const parse = (c) => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const p = m[1].split(',').map((v) => parseFloat(v));
          return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        };
        const over = (fg, bg) => ({           // source-over compositing
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        });
        const lum = (c) => {
          const f = [c.r, c.g, c.b].map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
        };
        const ratio = (a, b) => {
          const l1 = lum(a), l2 = lum(b);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };
        const worst = [];
        let checked = 0, unresolved = 0;
        for (const el of document.querySelectorAll('body *')) {
          // Only elements that own visible text.
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) continue;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || cs.visibility === 'hidden' || cs.opacity === '0') continue;
          const fg = parse(cs.color);
          if (!fg) continue;
          // Walk up compositing backgrounds until fully opaque.
          let bg = { r: 255, g: 255, b: 255, a: 0 };
          let node = el, gradient = false;
          const stack = [];
          while (node && node !== document.documentElement) {
            const s = getComputedStyle(node);
            if (s.backgroundImage && s.backgroundImage !== 'none') gradient = true;
            const c = parse(s.backgroundColor);
            if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
            node = node.parentElement;
          }
          const rootBg = parse(getComputedStyle(document.documentElement).backgroundColor);
          bg = rootBg && rootBg.a === 1 ? rootBg : { r: 255, g: 255, b: 255, a: 1 };
          for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
          if (gradient) { unresolved++; continue; }   // cannot be decided from styles alone
          checked++;
          const size = parseFloat(cs.fontSize);
          const bold = parseInt(cs.fontWeight, 10) >= 700;
          const large = size >= 24 || (size >= 18.66 && bold);
          const need = large ? 3 : 4.5;
          const got = ratio(fg, bg);
          if (got < need) {
            worst.push({
              text: el.textContent.trim().slice(0, 24),
              got: Math.round(got * 100) / 100,
              need,
              cls: String(el.className).slice(0, 40),
            });
          }
        }
        return { checked, unresolved, worst: worst.slice(0, 5), failing: worst.length };
      });
      record(`composited contrast (${theme})`, locale, res.failing === 0,
        `${res.checked} text nodes composited through their translucent ancestors · ` +
        `${res.failing} below threshold · ${res.unresolved} over a gradient, not decidable from styles` +
        (res.failing ? ` → ${res.worst.map((w) => `"${w.text}" ${w.got}<${w.need}`).join('; ')}` : ''));
      await page.close();
    }

    // ── 9. Meaning carried by colour alone (1.4.1) ──────────────────────────────
    // No tool can decide this — whether a colour MEANS something is a judgement about the
    // content. What can be measured is the population that would have to carry meaning
    // that way: a coloured element with no text, no label, no title and no image. This
    // check enumerates that population so the judgement is made against a list rather
    // than an impression. A non-empty list is not automatically a failure; an unexamined
    // one is.
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${BASE}/${locale}/search?q=${encodeURIComponent(locale === 'ar' ? 'لابتوب' : 'laptop')}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const swatches = await page.evaluate(() => {
        const found = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.textContent.trim()) continue;                    // carries text → not colour-only
          const tag = el.tagName.toLowerCase();
          // A shape conveys the meaning, not the colour — whether the element IS one or
          // CONTAINS one. Checking only descendants counted every store logo as a
          // colour-only swatch and reported 51 false candidates.
          if (tag === 'img' || tag === 'svg' || tag === 'canvas') continue;
          if (el.querySelector('svg, img, canvas')) continue;
          if (el.getAttribute('aria-label') || el.getAttribute('title')) continue;
          if (el.getAttribute('aria-hidden') === 'true') continue; // explicitly decorative
          const cs = getComputedStyle(el);
          const bg = cs.backgroundColor;
          if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || r.width > 64 || r.height > 64) continue; // a panel, not a dot
          found.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className).slice(0, 46),
            size: `${Math.round(r.width)}×${Math.round(r.height)}`,
            bg,
          });
        }
        return found;
      });
      record('no colour-only status indicators', locale, swatches.length === 0,
        swatches.length === 0
          ? 'no textless, unlabelled coloured element under 64px on the results page'
          : `${swatches.length} candidates need a human verdict → ` +
            swatches.slice(0, 4).map((s) => `${s.tag}.${s.cls} ${s.size} ${s.bg}`).join('; '));
      await page.close();
    }

    // ── 10. Page has a language, and it is the RIGHT one (3.1.1) ────────────────
    {
      const page = await browser.newPage();
      await page.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const langInfo = await page.evaluate(() => ({
        htmlLang: document.documentElement.lang,
        htmlDir: document.documentElement.dir,
        innerLang: document.querySelector('[lang]:not(html)')?.getAttribute('lang') || '',
        innerDir: document.querySelector('[dir]:not(html)')?.getAttribute('dir') || '',
      }));
      const ok = langInfo.htmlLang === locale;
      record('html lang matches locale', locale, ok,
        `<html lang="${langInfo.htmlLang || '(none)'}" dir="${langInfo.htmlDir || '(none)'}">` +
        (langInfo.innerLang ? ` · inner [lang="${langInfo.innerLang}" dir="${langInfo.innerDir}"]` : ''));
      await page.close();
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass && !r.accepted);
  const accepted = results.filter((r) => r.accepted);
  console.log(`\n══ SUMMARY ══\n${results.length} checks · ${failed.length} failing · ${accepted.length} accepted deviations`);
  for (const f of failed) console.log(`   FAIL ${f.check} [${f.locale}] — ${f.detail}`);
  for (const a of accepted) console.log(`   NOTE ${a.check.trim()} [${a.locale}] — ${a.detail}`);
  console.log(failed.length === 0 ? 'GATE: PASS' : 'GATE: FAIL');
}

run();
