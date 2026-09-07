/**
 * Shared slug authority (2026-09-07, product-creation architecture audit).
 *
 * Extracted from ProductService.createProduct()'s previously-private slug logic so
 * discover-firecrawl/route.ts's own separate product-creation path can reuse the SAME
 * authority instead of duplicating (and, as measured, omitting) it. PROVEN DEFECT this
 * closes: discover-firecrawl's own insert never set products.slug (NOT NULL, no DB
 * default) — every one of its scheduled runs, every 6h for all 4 served merchants
 * (almanea/extra/jarir/amazon), created zero net-new products since the pg_cron
 * mechanism's inception (2026-07-21, ADR-009): 739/739 runs, 0 successes, silently.
 */
import { generateSlug, slugSuffixFromSku, slugCandidates } from '../../src/lib/scraping/services/slugify';

describe('generateSlug', () => {
  it('slugifies a real product title', () => {
    expect(generateSlug('Samsung 75 Inch Mini LED 4K Smart TV, UA75M70HAUXSA, 120Hz, Tizen OS, UHD'))
      .toBe('samsung-75-inch-mini-led-4k-smart-tv-ua75m70hauxsa-120hz-tizen-os-uhd');
  });

  it('is deterministic — same input always produces the same base slug', () => {
    const name = 'LG Split Air Conditioner 18000 BTU';
    expect(generateSlug(name)).toBe(generateSlug(name));
  });

  it('strips punctuation and collapses whitespace/dashes', () => {
    expect(generateSlug('Dansat DTD50UWS — Ultra HD 4K, WebOS!  Smart TV')).toBe('dansat-dtd50uws-ultra-hd-4k-webos-smart-tv');
  });

  it('never leaves a leading or trailing dash', () => {
    expect(generateSlug('  -- Weird Title -- ')).not.toMatch(/^-|-$/);
  });

  it('returns an empty string for a name with no Latin/digit characters (caller-handled fallback)', () => {
    expect(generateSlug('مكيف')).toBe('');
  });
});

describe('slugSuffixFromSku', () => {
  it('produces a short, url-safe suffix from a merchant SKU/ASIN', () => {
    expect(slugSuffixFromSku('B0H8KTMZXZ')).toBe('b0h8ktmzxz');
  });

  it('strips non-alphanumeric characters', () => {
    expect(slugSuffixFromSku('N70383363V-p')).toBe('n70383363v');
  });
});

describe('slugCandidates', () => {
  it('the primary candidate is the same slug ProductService has always produced (no churn for existing consumers)', () => {
    const candidates = slugCandidates('Split Air Conditioner, LG, Jet Cool 2 Ton Cool', 'B0C2WP722Y');
    expect(candidates[0]).toBe('split-air-conditioner-lg-jet-cool-2-ton-cool');
  });

  it('includes a SKU-suffixed candidate for collision retry when a SKU is available', () => {
    const candidates = slugCandidates('LG Split AC 18000 BTU', 'B0H8KTMZXZ');
    expect(candidates).toContain('lg-split-ac-18000-btu-b0h8ktmzxz');
  });

  it('omits the SKU-suffixed candidate when no SKU is available (only base + random-suffix)', () => {
    const candidates = slugCandidates('LG Split AC 18000 BTU', null);
    expect(candidates.length).toBe(2);
    expect(candidates[0]).toBe('lg-split-ac-18000-btu');
    expect(candidates[1]).toMatch(/^lg-split-ac-18000-btu-[a-z0-9]{6}$/);
  });

  it('always ends with a random-suffixed fallback candidate as the last resort', () => {
    const candidates = slugCandidates('LG Split AC 18000 BTU', 'B0H8KTMZXZ');
    expect(candidates.length).toBe(3);
    expect(candidates[2]).toMatch(/^lg-split-ac-18000-btu-[a-z0-9]{6}$/);
  });

  it('never produces an empty or NOT-NULL-violating slug, even for a name that slugifies to nothing', () => {
    for (const c of slugCandidates('مكيف سبليت', null)) {
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it('two different real products never collide on their primary candidate', () => {
    const a = slugCandidates('Gree Split AC 18000 BTU Cool Only', 'B0AAA00001');
    const b = slugCandidates('LG Split AC 18000 BTU Cool Only', 'B0BBB00002');
    expect(a[0]).not.toBe(b[0]);
  });
});
