// Samsung KSA official-gateway repair mission (2026-09-13), Fix 1: the production
// scraper used to hardcode `specifications: {}` — proven, via a direct read of
// samsung-ksa-scraper.ts, to be the reason 60 of 425 audited identities were
// "audit-only" (only a one-off analysis script could ever see the PDP spec
// table). This is a real fixture of Samsung's own `.pdd32-product-spec__content-item`
// markup shape (label/value pair rows), not synthetic guesswork.
import * as cheerio from 'cheerio';
import { extractSpecTable } from '../../src/lib/scraping/stores/samsung-ksa-scraper';

const MONITOR_URL = 'https://www.samsung.com/sa_en/monitors/high-resolution/smart-m8-32-inch-uhd-4k-ls32bm801umxue/';
const monitorSpecHtml = `
<div class="pdd32-product-spec">
  <div class="pdd32-product-spec__content-item">
    <div class="pdd32-product-spec__content-item-title">Resolution</div>
    <div class="pdd32-product-spec__content-item-desc">3,840 x 2,160</div>
  </div>
  <div class="pdd32-product-spec__content-item">
    <div class="pdd32-product-spec__content-item-title">Panel Type</div>
    <div class="pdd32-product-spec__content-item-desc">VA</div>
  </div>
  <div class="pdd32-product-spec__content-item">
    <div class="pdd32-product-spec__content-item-title">Wall Mount Bracket</div>
    <div class="pdd32-product-spec__content-item-desc">No</div>
  </div>
</div>
`;

describe('extractSpecTable — captures the raw PDP spec table with provenance', () => {
  it('preserves the RAW manufacturer label/value exactly (no normalization here)', () => {
    const $ = cheerio.load(monitorSpecHtml);
    const result = extractSpecTable($, MONITOR_URL);
    // Raw evidence untouched — "3,840 x 2,160" is NOT collapsed to "3840x2160" at
    // capture time (Section 6: never overwrite the manufacturer's raw value; any
    // normalization a plugin needs happens in that plugin, reading this raw value).
    expect(result.raw['Resolution']).toBe('3,840 x 2,160');
    expect(result.raw['Panel Type']).toBe('VA');
    expect(result.raw['Wall Mount Bracket']).toBe('No');
  });

  it('stamps provenance: source, source_url, observed_at', () => {
    const $ = cheerio.load(monitorSpecHtml);
    const result = extractSpecTable($, MONITOR_URL);
    expect(result.source).toBe('samsung_ksa_pdp_spec_table');
    expect(result.source_url).toBe(MONITOR_URL);
    expect(new Date(result.observed_at).getTime()).not.toBeNaN();
  });

  it('returns an empty raw object (not a crash) when a page has no spec table', () => {
    const $ = cheerio.load('<html><body>no spec table here</body></html>');
    const result = extractSpecTable($, MONITOR_URL);
    expect(result.raw).toEqual({});
  });
});
