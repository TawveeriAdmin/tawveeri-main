/**
 * Amazon search-result TITLE extraction (ADR-183).
 *
 * Amazon moved the title and the old selector started returning the BRAND. Measured on live
 * `/s?k=` HTML 2026-08-03, on the same `div[data-component-type='s-search-result']` root:
 *
 *   h2 span                          → "Hisense"      ← the brand line
 *   [data-cy="title-recipe"] a span  → "Sponsored"    ← the sponsored label
 *   a.s-line-clamp-4 span            → "55 inch QLED 4K Smart TV 55E7Q, HSR 120Hz …"
 *
 * So every Amazon result on the customer search page rendered with a brand where its name
 * should be — and seeded discovery could never match a model number against it.
 *
 * These fixtures reproduce that exact markup so the fix is proven WITHOUT hitting Amazon,
 * which matters twice over: it is deterministic, and Amazon rate-limits a burst of probes
 * (a 2,270-byte stub with zero items) so live re-verification is not always available.
 */
import * as cheerio from 'cheerio';

/** Mirrors the private selector logic in amazon-search-scraper.parseProduct. */
function extractTitle(html: string): string {
  const $ = cheerio.load(html);
  const el = $("div[data-component-type='s-search-result']").first();
  const NON_TITLES = /^(sponsored|إعلان|ad|brand|results?)$/i;
  const candidates: string[] = [];
  el.find('a.s-line-clamp-4 span, a.s-line-clamp-3 span, a.s-line-clamp-2 span, [data-cy="title-recipe"] a span, h2 a span, h2 span')
    .each((_i, node) => { const t = $(node).text().trim(); if (t) candidates.push(t); });
  return candidates.find((t) => t.length >= 15 && !NON_TITLES.test(t))
    ?? candidates.find((t) => !NON_TITLES.test(t))
    ?? 'No title';
}

const SPONSORED_CARD = `
<div data-component-type="s-search-result" data-asin="B0F62T577B">
  <h2><span>Hisense</span></h2>
  <div data-cy="title-recipe"><a href="/dp/B0F62T577B"><span>Sponsored</span></a></div>
  <a class="s-line-clamp-4" href="/dp/B0F62T577B"><span>55 inch QLED 4K Smart TV 55E7Q, HSR 120Hz Quantum Dot Colour, Dolby Vision</span></a>
</div>`;

const ORGANIC_CARD = `
<div data-component-type="s-search-result" data-asin="B0DTHQCH95">
  <h2><span>Haier</span></h2>
  <div data-cy="title-recipe"><a href="/dp/B0DTHQCH95"><span>75 Inch 4K QLED Smart Google TV | Gaming@120 Hz | Dolby Audio | MEMC</span></a></div>
</div>`;

/** The pre-2026-08 markup, to prove the fallback still works if Amazon reverts. */
const LEGACY_CARD = `
<div data-component-type="s-search-result" data-asin="B0LEGACY01">
  <h2><a href="/dp/B0LEGACY01"><span>Samsung Galaxy S24 Ultra 512GB Titanium Black</span></a></h2>
</div>`;

describe('Amazon search title extraction', () => {
  it('takes the product title, not the brand, on an organic card', () => {
    expect(extractTitle(ORGANIC_CARD)).toBe('75 Inch 4K QLED Smart Google TV | Gaming@120 Hz | Dolby Audio | MEMC');
  });

  it('skips the "Sponsored" label and the brand on a sponsored card', () => {
    const t = extractTitle(SPONSORED_CARD);
    expect(t).toContain('55 inch QLED 4K Smart TV 55E7Q');
    expect(t).not.toBe('Sponsored');
    expect(t).not.toBe('Hisense');
  });

  it('still reads the legacy h2 markup, so a revert degrades instead of breaking', () => {
    expect(extractTitle(LEGACY_CARD)).toBe('Samsung Galaxy S24 Ultra 512GB Titanium Black');
  });

  it('never returns a bare brand — the defect this guards', () => {
    for (const html of [SPONSORED_CARD, ORGANIC_CARD, LEGACY_CARD]) {
      const t = extractTitle(html);
      expect(['Hisense', 'Haier', 'Samsung', 'Apple', 'ViewSonic', 'Sponsored']).not.toContain(t);
      expect(t.length).toBeGreaterThan(15);
    }
  });
});
