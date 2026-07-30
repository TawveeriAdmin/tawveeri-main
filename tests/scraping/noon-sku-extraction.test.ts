/**
 * ADR-149 — Noon price refresh was 100% silently broken by one regex.
 *
 * `updateProductPrice` extracted the SKU with `/\/p\/([A-Z0-9]+)/i`, i.e. "the chars AFTER
 * /p/". Every Noon URL in production is `.../<SKU>/p/` with `/p/` TERMINAL, so the pattern
 * never matched, the keyed API lookup was skipped, and refresh fell through to HTML
 * scraping — which returns null on Noon. Measured in production: 120 attempts, 120
 * failures, 0 products updated.
 *
 * Every URL below is a real `product_stores.product_url` from production.
 */
import { extractNoonSku } from '@/lib/scraping/stores/noon-scraper';

describe('extractNoonSku (ADR-149)', () => {
  // ── Real production URLs — the shape that was 100% failing ────────────────
  const PRODUCTION: [string, string][] = [
    [
      'https://www.noon.com/saudi-en/galaxy-a17-dual-sim-4g-light-blue-4gb-ram-128gb-middle-east-version/N70214272V/p/',
      'N70214272V',
    ],
    [
      'https://www.noon.com/saudi-en/6-liter-digital-electric-multi-pressure-cooker-aluminum-cooking-pot-with-nonstick-coating-keep-warm-function-6-l-1000-w-nep682dx-silver/N70012924V/p/',
      'N70012924V',
    ],
    [
      'https://www.noon.com/saudi-en/m4-smart-watch-bracelet-waterproof-bluetooth-wristband-and-heart-rate-monitor-fitness-tracker-black/Z50D2FD9D5BEC3416FD27Z/p/',
      'Z50D2FD9D5BEC3416FD27Z',
    ],
    [
      'https://www.noon.com/saudi-en/flexy-5l-digital-air-fryer-1500w-7-in-1-360-heating-oil-free-cooking-touch-panel-presets-viewing-window-energy-efficient-2-year-warranty/ZDDE3579DDE4B621BEEC4Z/p/',
      'ZDDE3579DDE4B621BEEC4Z',
    ],
  ];

  it.each(PRODUCTION)('extracts the SKU from the production form: %s', (url, sku) => {
    expect(extractNoonSku(url)).toBe(sku);
  });

  it('handles the terminal /p/ with no trailing slash', () => {
    expect(extractNoonSku('https://www.noon.com/saudi-en/some-slug/N70214272V/p')).toBe('N70214272V');
  });

  it('ignores query strings and fragments', () => {
    expect(extractNoonSku('https://www.noon.com/saudi-en/slug/N70214272V/p/?o=abc&utm=x')).toBe('N70214272V');
    expect(extractNoonSku('https://www.noon.com/saudi-en/slug/N70214272V/p/#reviews')).toBe('N70214272V');
  });

  it('still supports the legacy /p/<sku> form so no existing URL regresses', () => {
    expect(extractNoonSku('https://www.noon.com/saudi-en/p/N70214272V')).toBe('N70214272V');
    expect(extractNoonSku('https://www.noon.com/saudi-en/p/N70214272V/')).toBe('N70214272V');
  });

  it('uppercases a lowercased SKU', () => {
    expect(extractNoonSku('https://www.noon.com/saudi-en/slug/n70214272v/p/')).toBe('N70214272V');
  });

  // ── Explicit rejection: unknown beats incorrect ───────────────────────────
  it('rejects a URL with no /p/ marker rather than guessing', () => {
    expect(extractNoonSku('https://www.noon.com/saudi-en/some-category-page')).toBeNull();
  });

  it('never mistakes a hyphenated slug segment for a SKU', () => {
    // The segment before /p/ here is a slug, not a SKU — must reject, not return the slug.
    expect(extractNoonSku('https://www.noon.com/saudi-en/galaxy-a17-128gb/p/')).toBeNull();
  });

  it('rejects an all-letter segment (a SKU always contains a digit)', () => {
    expect(extractNoonSku('https://www.noon.com/saudi-en/slug/ABCDEFGH/p/')).toBeNull();
  });

  it('rejects a too-short segment', () => {
    expect(extractNoonSku('https://www.noon.com/saudi-en/slug/N70/p/')).toBeNull();
  });

  it('is safe on empty and malformed input', () => {
    expect(extractNoonSku('')).toBeNull();
    expect(extractNoonSku('not-a-url')).toBeNull();
  });

  it('THE REGRESSION: the old pattern found nothing on the production form', () => {
    // Documents precisely why 120/120 attempts failed, so this can never silently return.
    const url = PRODUCTION[0][0];
    expect(url.match(/\/p\/([A-Z0-9]+)/i)).toBeNull();
    expect(extractNoonSku(url)).toBe('N70214272V');
  });
});
