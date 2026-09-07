/**
 * Amazon brand detection (2026-09-07, ADR-305 follow-up — brand='Unknown' blocker).
 *
 * MEASURED: Amazon.sa's search-result markup carries no dedicated brand element at all
 * (re-verified live 2026-09-07 — every field, h2/aria-label/img-alt, repeats the same
 * free-text title). `amazon-search-scraper.ts` previously hardcoded `brand = 'Unknown'`
 * for every result, which meant no genuine Amazon product could ever fingerprint-match
 * another store's offer by brand. `detectBrandFromText()` (scripts/tps-core/brand-map.ts)
 * scans the title against the curated, evidence-backed brand list only — it never invents
 * a brand — and the scraper now uses it with an 'Unknown' fallback, unchanged from before,
 * when no known brand appears.
 */
import { detectBrandFromText, canonicalizeBrand } from '../../scripts/tps-core/brand-map';
import { AmazonSearchScraper } from '../../src/lib/scraping/search/amazon-search-scraper';
import * as cheerio from 'cheerio';

describe('detectBrandFromText — curated, evidence-backed brand detection from free text', () => {
  it('detects a genuine branded AC title (LG)', () => {
    expect(detectBrandFromText('Split Air Conditioner, LG, Jet Cool 2 Ton Cool')).toBe('LG');
  });

  it('detects genuine branded AC titles across multiple real brands', () => {
    expect(detectBrandFromText('Gree GWC12AVCXD-S6DTA1C 12000 BTU AI-inverter')).toBe('Gree');
    expect(detectBrandFromText('Nikai NSAC18136C26NINV 18000 BTU')).toBe('Nikai');
    expect(detectBrandFromText('Panasonic CS/CU-YV18UKS 18000 BTU heat/cool')).toBe('Panasonic');
    expect(detectBrandFromText('Haier HSU-18LPC13/R2(T3)-N 18000 BTU')).toBe('Haier');
    expect(detectBrandFromText('Midea split white 18000 BTU')).toBe('Midea');
    expect(detectBrandFromText('Hisense split wifi 12000 BTU')).toBe('Hisense');
  });

  it('resolves the detected brand to the correct canonical form', () => {
    expect(canonicalizeBrand(detectBrandFromText('Gree Split AC 18000 BTU'))).toBe('gree');
    expect(canonicalizeBrand(detectBrandFromText('LG Dual Cool Inverter'))).toBe('lg');
  });

  it('a longer, more specific brand wins over a shorter one it contains ("Super General" vs "General")', () => {
    expect(canonicalizeBrand(detectBrandFromText('Super General 1.5 Ton 18000 BTU Window Air Conditioner'))).toBe('supergeneral');
  });

  it('a genuinely unbranded title (no brand word at all) returns null, never a guess', () => {
    // The real storefront row this mission traced: a genuine Gree product whose OWN title
    // never says "Gree" anywhere.
    expect(detectBrandFromText('GWH18AGDXF-D3NTA1G-I 18000 BTU, 1.5 Ton Split Air Conditioner, White')).toBeNull();
  });

  it('accessory titles with no recognizable manufacturer still return null', () => {
    expect(detectBrandFromText('5 Pcs Air Conditioner Fin Cleaner Set, 3 Different Ac Fin Comb')).toBeNull();
    expect(detectBrandFromText('Decorative PVC Line Set Cover 3" W Flexible Pipe for Ductless Mini Split Air Conditioners')).toBeNull();
  });

  it('never matches a brand token embedded inside an unrelated word (word-boundary safety)', () => {
    expect(detectBrandFromText('Flag football set with blog stand')).toBeNull(); // "lg" hides inside "Flag"/"blog"
  });

  it('a common-English-word brand ("AUX") is excluded from free-text scanning to avoid false positives elsewhere on Amazon', () => {
    expect(detectBrandFromText('AUX cable for headphones 3.5mm')).toBeNull();
  });

  it('a place-name brand ("YORK") is excluded from free-text scanning for the same reason, even though it is a real AC brand', () => {
    expect(detectBrandFromText('YORK Taurus Inverter Window Air Conditioner 19,448 BTU')).toBeNull();
  });

  it('"General" is excluded from free-text scanning (too common a word across unrelated Amazon categories)', () => {
    expect(detectBrandFromText('General X 1 Ton Split Air Conditioner Cooling & Heating, 11000 BTU')).toBeNull();
  });

  it('works for a non-AC Amazon category too (the fix is naturally shared at the ingestion layer)', () => {
    expect(detectBrandFromText('Apple Airpods Pro 2')).toBe('Apple');
  });

  it('MEASURED FALSE POSITIVE (2026-09-07, live re-scrape): a short Arabic brand key does not match inside an unrelated Arabic word', () => {
    // "قابل" (adjustable/capable) contains "ابل" (an Apple alias) as a raw substring — a
    // genuine AC-deflector accessory was tagged brand=Apple by the pre-fix substring-only
    // Arabic matching. \p{L}-based lookaround boundaries must reject this.
    expect(detectBrandFromText('AC Deflector Adjustable Split – موزع هواء مكيف قابل للتعديل مع دوران 360')).toBeNull();
  });

  it('MEASURED FALSE POSITIVE (2026-09-07, live re-scrape): a short brand key does not match the tail of an unrelated alphanumeric model code', () => {
    // Model code "TN24HP" ends in "HP" — a digit is not a *letter*, so a letter-only boundary
    // let "HP" (Hewlett-Packard, a real alias elsewhere) match here. Must reject it.
    expect(detectBrandFromText('General Supreme GS TN24HP Titanium Plus Cold Split Air Conditioner, 22000 BTU')).toBeNull();
  });

  it('a real Arabic brand mention is still detected once correctly boundaried', () => {
    expect(canonicalizeBrand(detectBrandFromText('جري مكيف فريون متنقل، حار بارد ، قدرة 16000 واط'))).toBe('gree');
    expect(canonicalizeBrand(detectBrandFromText('دانسات مكيف سبليت جداري بارد، 18000 وحدة'))).toBe('dansat');
  });

  it('empty/null input returns null', () => {
    expect(detectBrandFromText('')).toBeNull();
    expect(detectBrandFromText(null)).toBeNull();
    expect(detectBrandFromText(undefined)).toBeNull();
  });
});

describe('AmazonSearchScraper.parseProduct — end-to-end brand wiring (current live markup, 2026-09-07)', () => {
  const scraper = new AmazonSearchScraper() as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parseProduct: (($: any, el: any) => { brand: string; name_en: string; model: string; category: string } | null);
  };

  // Reproduces Amazon's CURRENT card shape (re-verified live 2026-09-07): h2/aria-label/img-alt
  // all repeat the same free-text title — there is no separate brand element, unlike the
  // 2026-08-03 markup `amazon-search-title.test.ts` pins (h2 span = bare brand). Both eras
  // must work: the title-selector logic already handles both (that test still passes
  // unmodified); this suite proves brand now comes from the title text either way.
  const card = (asin: string, title: string) => `
    <div data-component-type="s-search-result" data-asin="${asin}">
      <h2 aria-label="${title}"><span>${title}</span></h2>
      <div data-cy="title-recipe"><a href="/dp/${asin}"><span>${title}</span></a></div>
    </div>`;

  function parse(html: string) {
    const $ = cheerio.load(html);
    const el = $("div[data-component-type='s-search-result']").first();
    return scraper.parseProduct($, el);
  }

  it('a genuine branded Amazon AC gets its real brand, not Unknown', () => {
    const p = parse(card('B0C2WP722Y', 'Split Air Conditioner, LG, Jet Cool 2 Ton Cool'));
    expect(p?.brand).toBe('LG');
    expect(p?.name_en).toBe('Split Air Conditioner, LG, Jet Cool 2 Ton Cool');
  });

  it('a genuine Amazon AC whose title states no brand at all stays Unknown (no invention)', () => {
    const p = parse(card('B0H8KTMZXZ', 'GWH18AGDXF-D3NTA1G-I 18000 BTU, 1.5 Ton Split Air Conditioner, White'));
    expect(p?.brand).toBe('Unknown');
  });

  it('an accessory stays excluded from air_conditioner regardless of brand detection (separate mechanism, unaffected)', () => {
    const p = parse(card('B0GVM8QS56', 'Air Conditioner Condensate Drain Tray Outdoor AC Support Tray Plastic Drainage Pan for AC Units'));
    expect(p?.category).not.toBe('air_conditioner');
    expect(p?.brand).toBe('Unknown');
  });

  it('a non-AC Amazon category also gets a correct brand (shared ingestion-layer fix, no regression)', () => {
    const p = parse(card('B0TESTMOB1', 'Apple iPhone 16 Pro Max 256GB Titanium Black'));
    expect(p?.brand).toBe('Apple');
  });

  it('the title text itself is unaffected by the brand fix (no truncation, no BTU/model loss)', () => {
    const title = 'Gree GWC12AVCXD-S6DTA1C 12000 BTU AI-inverter Split Air Conditioner';
    const p = parse(card('B0GREETEST', title));
    expect(p?.name_en).toBe(title);
    expect(p?.brand).toBe('Gree');
  });
});
